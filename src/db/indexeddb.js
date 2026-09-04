import { seedDirectories, seedDirectoryFields, seedDocuments, seedTasks, users } from '../data/seed';

const DB_NAME = 'kontur-organization-db';
const VERSION = 5;
const META_STORE = 'meta';
const SCHEMA_MARKER = 'relational-schema-v1';
const DOCUMENT_GROUP_DIRECTORY_NAME = 'Группировка документов';
const DOCUMENT_GROUP_CONTENT_MARKER = 'document-group-content-v2';
const DEPARTMENT_HEADS_NAME = 'Руководители подразделений';
const DEFAULT_LOGIN_PASSWORD_MARKER = 'default-login-password-v1';

// The UI gets hydrated records below, while IndexedDB stores connected entities.
const STORE_DEFINITIONS = {
  organizations: { keyPath: 'id' }, roles: { keyPath: 'id' }, departments: { keyPath: 'id' }, employees: { keyPath: 'id' }, users: { keyPath: 'id' },
  tasks: { keyPath: 'id' }, taskPerformers: { keyPath: 'id' }, taskAttachments: { keyPath: 'id' },
  documents: { keyPath: 'id' }, documentFiles: { keyPath: 'id' },
  directories: { keyPath: 'id' }, directoryFields: { keyPath: 'id' }, directoryRecords: { keyPath: 'id' },
  messages: { keyPath: 'id' }, notifications: { keyPath: 'id' }, reportTemplates: { keyPath: 'id' }, auditLog: { keyPath: 'id' },
  [META_STORE]: { keyPath: 'id' },
};

const defaultOrganization = {
  id: 'organization', legalName: '', shortName: '', inn: '', kpp: '', ogrn: '', legalAddress: '', postalAddress: '', phone: '', email: '', website: '', director: '',
  bankName: '', bik: '', correspondentAccount: '', settlementAccount: '',
};

const employeeDirectoryFields = [
  { id: 'code', name: 'Код', type: 'числовой' }, { id: 'name', name: 'ФИО', type: 'текстовый' },
  { id: 'personnelNumber', name: 'Табельный номер', type: 'текстовый' }, { id: 'department', name: 'Подразделение', type: 'текстовый' },
  { id: 'position', name: 'Должность', type: 'текстовый' }, { id: 'employmentStatus', name: 'Статус занятости', type: 'текстовый' },
  { id: 'hireDate', name: 'Дата приёма', type: 'дата' }, { id: 'birthDate', name: 'Дата рождения', type: 'дата' },
  { id: 'passport', name: 'Паспорт', type: 'текстовый' }, { id: 'snils', name: 'СНИЛС', type: 'текстовый' }, { id: 'inn', name: 'ИНН', type: 'текстовый' },
  { id: 'phone', name: 'Телефон', type: 'телефон' }, { id: 'email', name: 'Электронная почта', type: 'текстовый' }, { id: 'education', name: 'Образование', type: 'текстовый' },
  { id: 'diploma', name: 'Диплом', type: 'текстовый' }, { id: 'driversLicense', name: 'Водительское удостоверение', type: 'текстовый' }, { id: 'militaryId', name: 'Военный билет', type: 'текстовый' },
];

const counterpartyDirectoryFields = [
  { id: 'code', name: 'Код', type: 'числовой' }, { id: 'name', name: 'Наименование', type: 'текстовый' },
  { id: 'inn', name: 'ИНН', type: 'текстовый' }, { id: 'kpp', name: 'КПП', type: 'текстовый' },
  { id: 'bankDetails', name: 'Банковские реквизиты', type: 'текстовый' }, { id: 'address', name: 'Адрес', type: 'текстовый' },
  { id: 'responsibleLastName', name: 'Фамилия ответственного лица', type: 'текстовый' }, { id: 'phone', name: 'Телефон', type: 'телефон' },
  { id: 'email', name: 'Электронная почта', type: 'текстовый' },
  { id: 'status', name: 'Статус', type: 'текстовый' },
];

const requestResult = (request) => new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
const getAll = (db, store) => requestResult(db.transaction(store, 'readonly').objectStore(store).getAll());
const put = (db, store, value) => requestResult(db.transaction(store, 'readwrite').objectStore(store).put(value)).then(() => value);
const remove = (db, store, id) => requestResult(db.transaction(store, 'readwrite').objectStore(store).delete(id));
const clear = (db, store) => requestResult(db.transaction(store, 'readwrite').objectStore(store).clear());

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const db = request.result;
      Object.entries(STORE_DEFINITIONS).forEach(([name, options]) => { if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, options); });
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function normalizedId(value) { return String(value ?? '').trim().toLowerCase().replaceAll(/[^a-zа-яё0-9]+/gi, '-').replaceAll(/(^-|-$)/g, '') || `item-${Date.now()}`; }
function splitName(name = '') { const [lastName = '', firstName = '', middleName = ''] = name.replaceAll('.', '').split(/\s+/).filter(Boolean); return { lastName, firstName, middleName }; }
const roleId = (role) => `role-${normalizedId(role || 'user')}`;
const departmentId = (name) => `department-${normalizedId(name || 'unassigned')}`;
const taskPerformerId = (taskId, userId) => `${taskId}:performer:${userId}`;
const taskAttachmentId = (taskId, attachment, index) => attachment.id ?? `${taskId}:attachment:${normalizedId(attachment.name ?? index + 1)}:${index}`;

function taskStorageRecord(task) { const { performerIds, completedPerformerIds, attachments, ...record } = task; return record; }
function documentStorageRecord(document) { const { attachment, ...record } = document; return record; }
function directoryStorageRecord(directory) {
  const { rows, fields, ...record } = directory;
  return { ...record, code: record.code ?? normalizedId(record.name), isSystem: record.isSystem ?? ['Сотрудники', 'Подразделения', 'Роли и права'].includes(record.name) };
}

function hydrateTasks(tasks, performers, attachments) {
  return tasks.map((task) => {
    const taskPerformers = performers.filter((item) => item.taskId === task.id);
    return { ...task, performerIds: taskPerformers.map((item) => item.userId), completedPerformerIds: taskPerformers.filter((item) => item.isCompleted).map((item) => item.userId), attachments: attachments.filter((item) => item.taskId === task.id).map(({ taskId, ...attachment }) => attachment) };
  });
}

function hydrateDocuments(documents, files) { return documents.map((document) => ({ ...document, attachment: files.find((file) => file.documentId === document.id) ?? null })); }

function hydrateDirectories(directories, fields, records) {
  return directories.map((directory) => ({
    ...directory,
    fields: fields.filter((field) => field.directoryId === directory.id).toSorted((left, right) => left.position - right.position).map(({ sourceFieldId, directoryId, position, referenceDirectoryId, ...field }) => ({ ...field, id: sourceFieldId ?? field.id, ...(referenceDirectoryId ? { directory: referenceDirectoryId } : {}) })),
    rows: records.filter((record) => record.directoryId === directory.id).map(({ code, data }) => ({ ...data, code })),
  }));
}

async function replaceTaskRelations(db, task) {
  const [performers, attachments] = await Promise.all([getAll(db, 'taskPerformers'), getAll(db, 'taskAttachments')]);
  await Promise.all([...performers.filter((item) => item.taskId === task.id).map((item) => remove(db, 'taskPerformers', item.id)), ...attachments.filter((item) => item.taskId === task.id).map((item) => remove(db, 'taskAttachments', item.id))]);
  const completed = new Set(task.completedPerformerIds ?? []);
  await Promise.all([
    ...(task.performerIds ?? []).map((userId) => put(db, 'taskPerformers', { id: taskPerformerId(task.id, userId), taskId: task.id, userId, isCompleted: completed.has(userId), completedAt: completed.has(userId) ? new Date().toISOString() : null })),
    ...(task.attachments ?? []).map((attachment, index) => put(db, 'taskAttachments', { ...attachment, id: taskAttachmentId(task.id, attachment, index), taskId: task.id, uploadedById: attachment.uploadedById ?? task.ownerId })),
  ]);
}

async function replaceDocumentFiles(db, document) {
  const files = await getAll(db, 'documentFiles');
  await Promise.all(files.filter((item) => item.documentId === document.id).map((item) => remove(db, 'documentFiles', item.id)));
  if (document.attachment) await put(db, 'documentFiles', { ...document.attachment, id: document.attachment.id ?? `${document.id}:file:${normalizedId(document.attachment.name ?? 'file')}`, documentId: document.id, fileName: document.attachment.name, fileUrl: document.attachment.fileUrl ?? null, mimeType: document.attachment.type ?? '' });
}

async function replaceDirectoryStructure(db, directory) {
  const [fields, records] = await Promise.all([getAll(db, 'directoryFields'), getAll(db, 'directoryRecords')]);
  await Promise.all([...fields.filter((item) => item.directoryId === directory.id).map((item) => remove(db, 'directoryFields', item.id)), ...records.filter((item) => item.directoryId === directory.id).map((item) => remove(db, 'directoryRecords', item.id))]);
  const nextFields = directory.fields?.length ? directory.fields : [{ id: 'code', name: 'Код', type: 'текстовый' }, { id: 'name', name: 'Наименование', type: 'текстовый' }];
  await Promise.all([
    ...nextFields.map((field, position) => put(db, 'directoryFields', { ...field, id: `${directory.id}:field:${field.id}`, sourceFieldId: field.id, directoryId: directory.id, position, referenceDirectoryId: field.directory ?? null })),
    ...(directory.rows ?? []).map((row, index) => { const { code, ...data } = row; return put(db, 'directoryRecords', { id: `${directory.id}:record:${normalizedId(row.id ?? code ?? index + 1)}`, directoryId: directory.id, code: String(code ?? index + 1), data, parentId: row.parentId ?? null }); }),
  ]);
}

async function ensureEmployeeDirectoryFields(db) {
  const [directories, fields, records] = await Promise.all([getAll(db, 'directories'), getAll(db, 'directoryFields'), getAll(db, 'directoryRecords')]);
  const directory = directories.find((item) => String(item.name ?? '').toLowerCase().startsWith('сотрудники'));
  if (!directory) return;
  const currentFields = fields.filter((field) => field.directoryId === directory.id).toSorted((left, right) => left.position - right.position).map(({ sourceFieldId, directoryId, position, referenceDirectoryId, ...field }) => ({ ...field, id: sourceFieldId ?? field.id, ...(referenceDirectoryId ? { directory: referenceDirectoryId } : {}) }));
  const currentById = new Map(currentFields.map((field) => [field.id, field]));
  const nextFields = [...employeeDirectoryFields.map((field) => ({ ...(currentById.get(field.id) ?? {}), ...field })), ...currentFields.filter((field) => !employeeDirectoryFields.some((standard) => standard.id === field.id))];
  const changed = nextFields.length !== currentFields.length || nextFields.some((field, index) => field.id !== currentFields[index]?.id || field.name !== currentFields[index]?.name || field.type !== currentFields[index]?.type);
  if (!changed) return;
  const rows = records.filter((record) => record.directoryId === directory.id).map(({ code, data }) => ({ ...data, code }));
  await replaceDirectoryStructure(db, { ...directory, fields: nextFields, rows });
}

async function ensureCounterpartyDirectoryFields(db) {
  const [directories, fields, records] = await Promise.all([getAll(db, 'directories'), getAll(db, 'directoryFields'), getAll(db, 'directoryRecords')]);
  const directory = directories.find((item) => String(item.name ?? '').trim().toLowerCase() === 'контрагенты');
  if (!directory) return;
  const currentFields = fields.filter((field) => field.directoryId === directory.id).toSorted((left, right) => left.position - right.position).map(({ sourceFieldId, directoryId, position, referenceDirectoryId, ...field }) => ({ ...field, id: sourceFieldId ?? field.id, ...(referenceDirectoryId ? { directory: referenceDirectoryId } : {}) }));
  const currentById = new Map(currentFields.map((field) => [field.id, field]));
  const nextFields = [...counterpartyDirectoryFields.map((field) => ({ ...(currentById.get(field.id) ?? {}), ...field })), ...currentFields.filter((field) => field.id !== 'owner' && !counterpartyDirectoryFields.some((standard) => standard.id === field.id))];
  const rows = records.filter((record) => record.directoryId === directory.id).map(({ code, data }) => ({ ...data, code }));
  const nextRows = rows.map((row) => ({ ...row, inn: row.inn || String(row.code ?? ''), status: row.status || row.owner || '' }));
  const fieldsChanged = nextFields.length !== currentFields.length || nextFields.some((field, index) => field.id !== currentFields[index]?.id || field.name !== currentFields[index]?.name || field.type !== currentFields[index]?.type);
  const rowsChanged = nextRows.some((row, index) => row.inn !== rows[index].inn || row.status !== rows[index].status);
  if (!fieldsChanged && !rowsChanged) return;
  await replaceDirectoryStructure(db, { ...directory, fields: nextFields, rows: nextRows });
}

async function ensureDocumentGroupDirectory(db) {
  const [directories, metadata] = await Promise.all([getAll(db, 'directories'), getAll(db, META_STORE)]);
  const existing = directories.find((directory) => String(directory.name ?? '').trim().toLowerCase() === DOCUMENT_GROUP_DIRECTORY_NAME.toLowerCase());
  const rows = seedDirectories[DOCUMENT_GROUP_DIRECTORY_NAME] ?? [];
  if (!existing) {
    const directory = { id: 'document-groups', name: DOCUMENT_GROUP_DIRECTORY_NAME, rows, fields: seedDirectoryFields[DOCUMENT_GROUP_DIRECTORY_NAME] ?? [] };
    await put(db, 'directories', directoryStorageRecord(directory));
    await replaceDirectoryStructure(db, directory);
  } else if (!metadata.some((item) => item.id === DOCUMENT_GROUP_CONTENT_MARKER)) {
    const records = await getAll(db, 'directoryRecords');
    await Promise.all([
      ...records.filter((record) => record.directoryId === existing.id).map((record) => remove(db, 'directoryRecords', record.id)),
      ...rows.map((row, index) => { const { code, ...data } = row; return put(db, 'directoryRecords', { id: `${existing.id}:record:${normalizedId(code ?? index + 1)}`, directoryId: existing.id, code: String(code ?? index + 1), data, parentId: null }); }),
    ]);
  }
  if (!metadata.some((item) => item.id === DOCUMENT_GROUP_CONTENT_MARKER)) await put(db, META_STORE, { id: DOCUMENT_GROUP_CONTENT_MARKER, value: new Date().toISOString() });
}

async function ensureDemoAdministrator(db) {
  const savedUsers = await getAll(db, 'users');
  if (savedUsers.some((user) => user.login?.toLowerCase() === 'admin')) return;
  const demoAdministrator = users.find((user) => user.login === 'admin');
  const legacyAdministrator = savedUsers.find((user) => user.id === demoAdministrator?.id);
  if (legacyAdministrator && demoAdministrator) {
    await put(db, 'users', { ...legacyAdministrator, login: legacyAdministrator.login || demoAdministrator.login, password: legacyAdministrator.password || demoAdministrator.password });
    return;
  }
  if (demoAdministrator) await put(db, 'users', demoAdministrator);
}

async function ensureDepartmentHeadsAndUsers(db) {
  const [directories, fields, records, departments, roles] = await Promise.all([getAll(db, 'directories'), getAll(db, 'directoryFields'), getAll(db, 'directoryRecords'), getAll(db, 'departments'), getAll(db, 'roles')]);
  const departmentsDirectory = directories.find((directory) => directory.name === 'Подразделения');
  if (departmentsDirectory) {
    const directoryRows = records.filter((record) => record.directoryId === departmentsDirectory.id).map(({ code, data }) => ({ ...data, code }));
    if (!directoryRows.some((row) => row.name === DEPARTMENT_HEADS_NAME)) {
      const directoryFields = fields.filter((field) => field.directoryId === departmentsDirectory.id).toSorted((left, right) => left.position - right.position).map(({ sourceFieldId, directoryId, position, referenceDirectoryId, ...field }) => ({ ...field, id: sourceFieldId ?? field.id, ...(referenceDirectoryId ? { directory: referenceDirectoryId } : {}) }));
      await replaceDirectoryStructure(db, { ...departmentsDirectory, fields: directoryFields, rows: [...directoryRows, { code: 'HEADS', name: DEPARTMENT_HEADS_NAME, owner: '' }] });
    }
  }
  await Promise.all([
    ...(departments.some((department) => department.name === DEPARTMENT_HEADS_NAME) ? [] : [put(db, 'departments', { id: departmentId(DEPARTMENT_HEADS_NAME), code: 'HEADS', name: DEPARTMENT_HEADS_NAME, parentId: null, managerId: null })]),
    ...(['Администратор', 'Постановщик'].filter((role) => !roles.some((item) => item.name === role)).map((name) => put(db, 'roles', { id: roleId(name), name, permissions: [] }))),
  ]);
}

async function ensureDefaultLoginPassword(db) {
  const [metadata, savedUsers] = await Promise.all([getAll(db, META_STORE), getAll(db, 'users')]);
  if (metadata.some((item) => item.id === DEFAULT_LOGIN_PASSWORD_MARKER)) return;
  await Promise.all([...savedUsers.map((user) => put(db, 'users', { ...user, password: '123' })), put(db, META_STORE, { id: DEFAULT_LOGIN_PASSWORD_MARKER, value: new Date().toISOString() })]);
}

async function ensureRelationalSchema(db) {
  const metadata = await getAll(db, META_STORE);
  if (metadata.some((item) => item.id === SCHEMA_MARKER)) {
    await ensureDemoAdministrator(db);
    await ensureDepartmentHeadsAndUsers(db);
    await ensureDefaultLoginPassword(db);
    await ensureEmployeeDirectoryFields(db);
    await ensureCounterpartyDirectoryFields(db);
    await ensureDocumentGroupDirectory(db);
    return;
  }
  const [legacyTasks, legacyDocuments, legacyDirectories, legacyUsers, legacyMessages] = await Promise.all([getAll(db, 'tasks'), getAll(db, 'documents'), getAll(db, 'directories'), getAll(db, 'users'), getAll(db, 'messages')]);
  if (![...legacyTasks, ...legacyDocuments, ...legacyDirectories, ...legacyUsers, ...legacyMessages].length) {
    await Promise.all([...seedTasks.map((task) => put(db, 'tasks', task)), ...seedDocuments.map((document) => put(db, 'documents', document)), ...users.map((user) => put(db, 'users', user)), ...Object.entries(seedDirectories).map(([name, rows]) => put(db, 'directories', { id: name, name, rows, fields: seedDirectoryFields[name] ?? [] }))]);
    return ensureRelationalSchema(db);
  }
  const organization = metadata.find((item) => item.id === 'organization') ?? defaultOrganization;
  const departmentNames = new Set(legacyUsers.map((user) => user.department).filter(Boolean));
  legacyDirectories.find((directory) => directory.name === 'Подразделения')?.rows?.forEach((row) => departmentNames.add(row.name));
  const roleNames = new Set(legacyUsers.map((user) => user.role).filter(Boolean));
  legacyDirectories.find((directory) => directory.name === 'Роли и права')?.rows?.forEach((row) => roleNames.add(row.name));
  await Promise.all([
    put(db, 'organizations', { ...defaultOrganization, ...organization, id: 'organization' }),
    ...[...departmentNames].map((name) => put(db, 'departments', { id: departmentId(name), code: normalizedId(name).toUpperCase(), name, parentId: null, managerId: null })),
    ...[...roleNames].map((name) => put(db, 'roles', { id: roleId(name), name, permissions: [] })),
  ]);
  await Promise.all(legacyUsers.map(async (user) => {
    const employeeId = user.employeeId ?? `employee-${user.id}`;
    await Promise.all([put(db, 'employees', { id: employeeId, ...splitName(user.name), displayName: user.name, departmentId: departmentId(user.department), phone: user.phone ?? '', email: user.email ?? '' }), put(db, 'users', { ...user, employeeId, roleId: roleId(user.role), isActive: user.isActive ?? true })]);
  }));
  await Promise.all(legacyTasks.map(async (task) => { await put(db, 'tasks', taskStorageRecord(task)); await replaceTaskRelations(db, task); }));
  await Promise.all(legacyDocuments.map(async (document) => { await put(db, 'documents', documentStorageRecord(document)); await replaceDocumentFiles(db, document); }));
  await Promise.all(legacyDirectories.map(async (directory) => { await put(db, 'directories', directoryStorageRecord(directory)); await replaceDirectoryStructure(db, directory); }));
  await Promise.all(legacyMessages.filter((message) => message.type === 'task-assignment').map((message) => put(db, 'notifications', { id: `notification-${message.id}`, userId: message.recipientId, type: message.type, text: message.text, isRead: false, createdAt: message.createdAt, entityId: message.taskId ?? null })));
  await Promise.all([put(db, META_STORE, { id: 'initialized', value: true }), put(db, META_STORE, { id: SCHEMA_MARKER, value: new Date().toISOString() }), put(db, 'auditLog', { id: `migration-${Date.now()}`, userId: null, action: 'migrate', entityType: 'database', entityId: DB_NAME, createdAt: new Date().toISOString() })]);
  await ensureDemoAdministrator(db);
  await ensureDepartmentHeadsAndUsers(db);
  await ensureDefaultLoginPassword(db);
  await ensureEmployeeDirectoryFields(db);
  await ensureCounterpartyDirectoryFields(db);
  await ensureDocumentGroupDirectory(db);
}

async function readApplicationData(db) {
  const [tasks, performers, attachments, documents, files, directories, fields, records, savedUsers, messages, organizations, notifications, reportTemplates, auditLog] = await Promise.all([
    getAll(db, 'tasks'), getAll(db, 'taskPerformers'), getAll(db, 'taskAttachments'), getAll(db, 'documents'), getAll(db, 'documentFiles'), getAll(db, 'directories'), getAll(db, 'directoryFields'), getAll(db, 'directoryRecords'), getAll(db, 'users'), getAll(db, 'messages'), getAll(db, 'organizations'), getAll(db, 'notifications'), getAll(db, 'reportTemplates'), getAll(db, 'auditLog'),
  ]);
  return { tasks: hydrateTasks(tasks, performers, attachments), documents: hydrateDocuments(documents, files), directories: hydrateDirectories(directories, fields, records), users: savedUsers, messages, notifications, reportTemplates, auditLog: auditLog.toSorted((left, right) => String(right.createdAt).localeCompare(String(left.createdAt))), organization: organizations.find((item) => item.id === 'organization') ?? defaultOrganization };
}

async function writeAudit(db, action, entityType, entityId) { await put(db, 'auditLog', { id: `audit-${Date.now()}-${Math.random().toString(16).slice(2)}`, userId: null, action, entityType, entityId, createdAt: new Date().toISOString() }); }

export async function loadDatabase() { const db = await openDatabase(); await ensureRelationalSchema(db); const data = await readApplicationData(db); db.close(); return data; }

export async function saveEntity(store, entity) {
  const db = await openDatabase();
  if (store === 'tasks') { await put(db, 'tasks', taskStorageRecord(entity)); await replaceTaskRelations(db, entity); }
  else if (store === 'documents') { await put(db, 'documents', documentStorageRecord(entity)); await replaceDocumentFiles(db, entity); }
  else if (store === 'directories') { await put(db, 'directories', directoryStorageRecord(entity)); await replaceDirectoryStructure(db, entity); }
  else if (store === 'meta' && entity.id === 'organization') await put(db, 'organizations', { ...defaultOrganization, ...entity, id: 'organization' });
  else await put(db, store, entity);
  if (store !== 'auditLog' && store !== META_STORE) await writeAudit(db, 'save', store, entity.id);
  db.close();
  return entity;
}

export async function deleteEntity(store, id) {
  const db = await openDatabase();
  if (store === 'tasks') { const [performers, attachments] = await Promise.all([getAll(db, 'taskPerformers'), getAll(db, 'taskAttachments')]); await Promise.all([...performers.filter((item) => item.taskId === id).map((item) => remove(db, 'taskPerformers', item.id)), ...attachments.filter((item) => item.taskId === id).map((item) => remove(db, 'taskAttachments', item.id))]); }
  if (store === 'documents') { const files = await getAll(db, 'documentFiles'); await Promise.all(files.filter((item) => item.documentId === id).map((item) => remove(db, 'documentFiles', item.id))); }
  if (store === 'directories') { const [fields, records] = await Promise.all([getAll(db, 'directoryFields'), getAll(db, 'directoryRecords')]); await Promise.all([...fields.filter((item) => item.directoryId === id).map((item) => remove(db, 'directoryFields', item.id)), ...records.filter((item) => item.directoryId === id).map((item) => remove(db, 'directoryRecords', item.id))]); }
  await remove(db, store, id);
  await writeAudit(db, 'delete', store, id);
  db.close();
}

export async function resetDatabase() { const db = await openDatabase(); await Promise.all(Object.keys(STORE_DEFINITIONS).map((store) => clear(db, store))); db.close(); }

async function blobToBackup(value) {
  if (value instanceof Blob) {
    const bytes = new Uint8Array(await value.arrayBuffer());
    let binary = '';
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return { __blob: true, type: value.type, data: btoa(binary) };
  }
  if (Array.isArray(value)) return Promise.all(value.map(blobToBackup));
  if (value && typeof value === 'object') return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await blobToBackup(item)])));
  return value;
}

function backupToBlob(value) {
  if (value?.__blob) {
    const binary = atob(value.data);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new Blob([bytes], { type: value.type });
  }
  if (Array.isArray(value)) return value.map(backupToBlob);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, backupToBlob(item)]));
  return value;
}

export async function exportDatabaseSnapshot() {
  const db = await openDatabase();
  const stores = Object.keys(STORE_DEFINITIONS);
  const records = Object.fromEntries(await Promise.all(stores.map(async (store) => [store, await blobToBackup(await getAll(db, store))])));
  db.close();
  return { product: 'Вектор', database: DB_NAME, version: VERSION, exportedAt: new Date().toISOString(), records };
}

export async function importDatabaseSnapshot(snapshot) {
  if (!snapshot?.records || snapshot.database !== DB_NAME) throw new Error('Файл не является резервной копией «Вектор».');
  const db = await openDatabase();
  const stores = Object.keys(STORE_DEFINITIONS);
  await Promise.all(stores.map((store) => clear(db, store)));
  for (const store of stores) {
    const records = backupToBlob(snapshot.records[store] ?? []);
    await Promise.all(records.map((record) => put(db, store, record)));
  }
  await writeAudit(db, 'restore', 'database', DB_NAME);
  const data = await readApplicationData(db);
  db.close();
  return data;
}
