import test, { after } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.VECTOR_TEST_DATABASE = 'memory';
process.env.COOKIE_SECRET = 'integration-test-cookie-secret-32-characters';

const { app, pool, seedIfEmpty } = await import('../server/index.mjs');
const serverAddress = await app.listen({ host: '127.0.0.1', port: 0 });

after(async () => {
  await app.close();
  await pool.end();
});

async function login(login, password = '123') {
  const response = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { login, password } });
  assert.equal(response.statusCode, 200, response.body);
  return response.headers['set-cookie'].split(';')[0];
}

const request = (cookie, options) => app.inject({ ...options, headers: { cookie, ...(options.headers || {}) } });

test('healthcheck, вход и защищенная загрузка рабочего пространства', async () => {
  const health = await app.inject({ method: 'GET', url: '/api/health' });
  assert.equal(health.statusCode, 200);
  assert.equal(health.json().database, 'connected');
  const anonymous = await app.inject({ method: 'GET', url: '/api/bootstrap' });
  assert.equal(anonymous.statusCode, 401);
  const invalidLogin = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { login: 'admin', password: 'wrong' } });
  assert.equal(invalidLogin.statusCode, 401);
  const adminCookie = await login('admin');
  const workspace = await request(adminCookie, { method: 'GET', url: '/api/bootstrap' });
  assert.equal(workspace.statusCode, 200);
  assert.ok(workspace.json().users.length >= 5);
  assert.equal(JSON.stringify(workspace.json()).includes('password'), false);
});

test('совместная работа: CRUD задачи, роли и видимость между пользователями', async () => {
  const adminCookie = await login('admin');
  const performerCookie = await login('kuznetsov');
  const observerCookie = await login('volkova');
  const task = { id: 'integration-task', number: 'TEST-001', title: 'Интеграционная задача', ownerId: 'u1', performerIds: ['u4'], completedPerformerIds: [], status: 'В работе', dueDate: '2099-01-01', dueTime: '18:00', attachments: [] };
  const created = await request(adminCookie, { method: 'PUT', url: `/api/entities/tasks/${task.id}`, payload: task });
  assert.equal(created.statusCode, 200, created.body);
  let performerWorkspace = await request(performerCookie, { method: 'GET', url: '/api/bootstrap' });
  assert.ok(performerWorkspace.json().tasks.some((item) => item.id === task.id));
  const observerWorkspace = await request(observerCookie, { method: 'GET', url: '/api/bootstrap' });
  assert.equal(observerWorkspace.json().tasks.some((item) => item.id === task.id), false);
  const forged = await request(performerCookie, { method: 'PUT', url: `/api/entities/tasks/${task.id}`, payload: { ...task, title: 'Подмена' } });
  assert.equal(forged.statusCode, 403);
  const completed = await request(performerCookie, { method: 'PUT', url: `/api/entities/tasks/${task.id}`, payload: { ...task, completedPerformerIds: ['u4'] } });
  assert.equal(completed.statusCode, 200, completed.body);
  assert.equal(completed.json().status, 'Утверждение');
  const removed = await request(adminCookie, { method: 'DELETE', url: `/api/entities/tasks/${task.id}` });
  assert.equal(removed.statusCode, 204);
  performerWorkspace = await request(performerCookie, { method: 'GET', url: '/api/bootstrap' });
  assert.equal(performerWorkspace.json().tasks.some((item) => item.id === task.id), false);
});

test('чат, справочники, файлы, аудит и резервная копия сохраняются на сервере', async () => {
  const adminCookie = await login('admin');
  const performerCookie = await login('kuznetsov');
  const message = { id: 'integration-message', senderId: 'u1', recipientId: 'u4', text: 'Проверка совместной работы', createdAt: new Date().toISOString() };
  assert.equal((await request(adminCookie, { method: 'PUT', url: `/api/entities/messages/${message.id}`, payload: message })).statusCode, 200);
  const performerWorkspace = await request(performerCookie, { method: 'GET', url: '/api/bootstrap' });
  assert.ok(performerWorkspace.json().messages.some((item) => item.id === message.id));
  const observerWorkspace = await request(await login('volkova'), { method: 'GET', url: '/api/bootstrap' });
  assert.equal(observerWorkspace.json().messages.some((item) => item.id === message.id), false);

  const directory = { id: 'integration-directory', name: 'Тестовый справочник', fields: [{ id: 'name', name: 'Название', type: 'текстовый' }], rows: [{ code: '1', name: 'Запись' }] };
  assert.equal((await request(adminCookie, { method: 'PUT', url: `/api/entities/directories/${directory.id}`, payload: directory })).statusCode, 200);
  const deniedDirectory = await request(performerCookie, { method: 'PUT', url: '/api/entities/directories/forbidden', payload: { ...directory, id: 'forbidden' } });
  assert.equal(deniedDirectory.statusCode, 403);

  const document = { id: 'integration-document', title: 'Документ с файлом', attachment: { id: 'file-1', name: 'test.txt', type: 'text/plain', size: 5, blob: { __blob: true, type: 'text/plain', data: Buffer.from('hello').toString('base64') } } };
  assert.equal((await request(adminCookie, { method: 'PUT', url: `/api/entities/documents/${document.id}`, payload: document })).statusCode, 200);
  const persistedFiles = await pool.query('select id::text as id, byte_size from entity_files where entity_id = $1', [document.id]);
  assert.equal(persistedFiles.rowCount, 1, JSON.stringify(persistedFiles.rows));
  const workspace = (await request(adminCookie, { method: 'GET', url: '/api/bootstrap' })).json();
  const savedDocument = workspace.documents.find((item) => item.id === document.id);
  assert.ok(savedDocument.attachment.blob, JSON.stringify(savedDocument));
  assert.equal(Buffer.from(savedDocument.attachment.blob.data, 'base64').toString(), 'hello');
  assert.ok(workspace.auditLog.some((item) => item.entityId === document.id));

  const backup = await request(adminCookie, { method: 'GET', url: '/api/backup' });
  assert.equal(backup.statusCode, 200);
  assert.equal(backup.json().database, 'vector-server');
  assert.ok(backup.json().data.directories.some((item) => item.id === directory.id));
});

test('справочник сохраняет создание, редактирование и удаление между повторными загрузками', async () => {
  const adminCookie = await login('admin');
  const directoryId = 'directory-persistence-cycle';
  const createdDirectory = {
    id: directoryId,
    name: 'Проверка сохранения',
    fields: [{ id: 'name', name: 'Наименование', type: 'текстовый' }],
    rows: [{ code: '1', name: 'Созданная запись' }],
  };

  assert.equal((await request(adminCookie, {
    method: 'PUT', url: `/api/entities/directories/${directoryId}`, payload: createdDirectory,
  })).statusCode, 200);
  let workspace = (await request(adminCookie, { method: 'GET', url: '/api/bootstrap' })).json();
  assert.equal(workspace.directories.find((item) => item.id === directoryId)?.rows[0]?.name, 'Созданная запись');

  const editedDirectory = { ...createdDirectory, rows: [{ code: '1', name: 'Изменённая запись' }] };
  assert.equal((await request(adminCookie, {
    method: 'PUT', url: `/api/entities/directories/${directoryId}`, payload: editedDirectory,
  })).statusCode, 200);
  workspace = (await request(adminCookie, { method: 'GET', url: '/api/bootstrap' })).json();
  assert.equal(workspace.directories.find((item) => item.id === directoryId)?.rows[0]?.name, 'Изменённая запись');

  assert.equal((await request(adminCookie, {
    method: 'DELETE', url: `/api/entities/directories/${directoryId}`,
  })).statusCode, 204);
  workspace = (await request(adminCookie, { method: 'GET', url: '/api/bootstrap' })).json();
  assert.equal(workspace.directories.some((item) => item.id === directoryId), false);
});

test('выход завершает серверную сессию', async () => {
  const cookie = await login('admin');
  assert.equal((await request(cookie, { method: 'POST', url: '/api/auth/logout' })).statusCode, 200);
  assert.equal((await request(cookie, { method: 'GET', url: '/api/bootstrap' })).statusCode, 401);
});

test('SSE сообщает второму клиенту об изменениях', async () => {
  const cookie = await login('admin');
  const controller = new AbortController();
  const events = await fetch(`${serverAddress}/api/events`, { headers: { cookie }, signal: controller.signal });
  assert.equal(events.status, 200);
  const reader = events.body.getReader();
  const decoder = new TextDecoder();
  assert.match(decoder.decode((await reader.read()).value), /event: ready/);
  const template = { id: 'sse-template', name: 'SSE test' };
  assert.equal((await request(cookie, { method: 'PUT', url: `/api/entities/reportTemplates/${template.id}`, payload: template })).statusCode, 200);
  const change = decoder.decode((await reader.read()).value);
  assert.match(change, /event: change/);
  assert.match(change, /sse-template/);
  controller.abort();
});

test('CRUD пользователя обновляет серверную учетную запись и пароль', async () => {
  const adminCookie = await login('admin');
  const user = { id: 'integration-user', name: 'Тестовый пользователь', initials: 'ТП', role: 'Исполнитель', department: 'ИТ-отдел', login: 'integration-user', password: 'test-password', isActive: true };
  assert.equal((await request(adminCookie, { method: 'PUT', url: `/api/entities/users/${user.id}`, payload: user })).statusCode, 200);
  const newUserCookie = await login(user.login, user.password);
  assert.equal((await request(newUserCookie, { method: 'GET', url: '/api/bootstrap' })).statusCode, 200);
  const editedUser = { ...user, name: 'Измененный пользователь', login: 'integration-user-edited', password: 'edited-password' };
  assert.equal((await request(adminCookie, { method: 'PUT', url: `/api/entities/users/${user.id}`, payload: editedUser })).statusCode, 200);
  const afterEdit = (await request(adminCookie, { method: 'GET', url: '/api/bootstrap' })).json().users.find((item) => item.id === user.id);
  assert.equal(afterEdit.name, editedUser.name);
  assert.equal(afterEdit.login, editedUser.login);
  assert.equal((await app.inject({ method: 'POST', url: '/api/auth/login', payload: { login: editedUser.login, password: editedUser.password } })).statusCode, 200);
  assert.equal((await request(adminCookie, { method: 'DELETE', url: `/api/entities/users/${user.id}` })).statusCode, 204);
  await seedIfEmpty();
  const usersAfterRestartInitialization = (await request(adminCookie, { method: 'GET', url: '/api/bootstrap' })).json().users;
  assert.equal(usersAfterRestartInitialization.some((item) => item.id === user.id), false);
  assert.equal((await app.inject({ method: 'POST', url: '/api/auth/login', payload: { login: user.login, password: user.password } })).statusCode, 401);
});

test('удаление пользователя блокируется при связанных записях и не нарушает целостность', async () => {
  const adminCookie = await login('admin');
  const user = { id: 'linked-user', name: 'Связанный пользователь', initials: 'СП', role: 'Исполнитель', department: 'ИТ-отдел', login: 'linked-user', password: '123', isActive: true };
  const task = { id: 'linked-user-task', number: 'TEST-USER-001', title: 'Задача связанного пользователя', ownerId: 'u1', performerIds: [user.id], completedPerformerIds: [], status: 'В работе', dueDate: '2099-01-01', dueTime: '18:00', attachments: [] };
  assert.equal((await request(adminCookie, { method: 'PUT', url: `/api/entities/users/${user.id}`, payload: user })).statusCode, 200);
  assert.equal((await request(adminCookie, { method: 'PUT', url: `/api/entities/tasks/${task.id}`, payload: task })).statusCode, 200);
  const blocked = await request(adminCookie, { method: 'DELETE', url: `/api/entities/users/${user.id}` });
  assert.equal(blocked.statusCode, 409);
  assert.match(blocked.json().error, /связанные записи/);
  assert.equal(blocked.json().dependencies[0].id, task.id);
  assert.ok((await request(adminCookie, { method: 'GET', url: '/api/bootstrap' })).json().users.some((item) => item.id === user.id));
  assert.equal((await request(adminCookie, { method: 'DELETE', url: `/api/entities/tasks/${task.id}` })).statusCode, 204);
  assert.equal((await request(adminCookie, { method: 'DELETE', url: `/api/entities/users/${user.id}` })).statusCode, 204);
});

test('организация, уведомления, отчеты, restore и перенос IndexedDB проходят полный цикл', async () => {
  const adminCookie = await login('admin');
  const performerCookie = await login('kuznetsov');
  const organization = { id: 'organization', legalName: 'Тестовая организация', inn: '7700000000' };
  assert.equal((await request(adminCookie, { method: 'PUT', url: '/api/entities/meta/organization', payload: organization })).statusCode, 200);
  assert.equal((await request(performerCookie, { method: 'PUT', url: '/api/entities/meta/organization', payload: organization })).statusCode, 403);
  const notification = { id: 'integration-notification', userId: 'u4', type: 'test', text: 'Тестовое уведомление', isRead: false, createdAt: new Date().toISOString() };
  assert.equal((await request(adminCookie, { method: 'PUT', url: `/api/entities/notifications/${notification.id}`, payload: notification })).statusCode, 200);
  const template = { id: 'integration-template', name: 'Тестовый отчет', columns: ['title'] };
  assert.equal((await request(adminCookie, { method: 'PUT', url: `/api/entities/reportTemplates/${template.id}`, payload: template })).statusCode, 200);

  const backupResponse = await request(adminCookie, { method: 'GET', url: '/api/backup' });
  assert.equal(backupResponse.statusCode, 200);
  const backup = backupResponse.json();
  assert.equal((await request(adminCookie, { method: 'DELETE', url: '/api/entities/reportTemplates/integration-template' })).statusCode, 204);
  assert.equal((await request(adminCookie, { method: 'POST', url: '/api/restore', payload: backup })).statusCode, 200);
  let workspace = (await request(adminCookie, { method: 'GET', url: '/api/bootstrap' })).json();
  assert.ok(workspace.reportTemplates.some((item) => item.id === template.id));
  assert.equal(workspace.organization.legalName, organization.legalName);

  const localData = { tasks: [{ id: 'migrated-task', title: 'Из IndexedDB', ownerId: 'u1', performerIds: [], completedPerformerIds: [] }], documents: [], directories: [], users: [], messages: [], notifications: [], reportTemplates: [], organization };
  assert.equal((await request(adminCookie, { method: 'POST', url: '/api/migrate-local', payload: { data: localData } })).statusCode, 200);
  workspace = (await request(adminCookie, { method: 'GET', url: '/api/bootstrap' })).json();
  assert.ok(workspace.tasks.some((item) => item.id === 'migrated-task'));
  const performerWorkspace = (await request(performerCookie, { method: 'GET', url: '/api/bootstrap' })).json();
  assert.ok(performerWorkspace.notifications.some((item) => item.id === notification.id));
});
