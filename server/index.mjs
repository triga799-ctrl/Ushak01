import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import { seedDirectories, seedDirectoryFields, seedDocuments, seedTasks, users as seedUsers } from '../src/data/seed.js';
import { canViewTask, canWrite, normalizeTaskMutation } from './policy.mjs';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = {
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || '0.0.0.0',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://vector:vector@127.0.0.1:5432/vector',
  cookieSecret: process.env.COOKIE_SECRET || 'development-only-change-this-secret',
  secureCookie: process.env.COOKIE_SECURE === 'true' || (process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false'),
  sessionDays: Number(process.env.SESSION_DAYS || 7),
  maxBodyBytes: Number(process.env.MAX_BODY_MB || 25) * 1024 * 1024,
};
if (process.env.NODE_ENV === 'production' && config.cookieSecret.length < 32) throw new Error('COOKIE_SECRET must contain at least 32 characters.');

let PoolClass = pg.Pool;
if (process.env.VECTOR_TEST_DATABASE === 'memory') {
  const { newDb, DataType } = await import('pg-mem');
  const memoryDatabase = newDb({ autoCreateForeignKeyIndices: true });
  memoryDatabase.public.registerFunction({ name: 'encode', args: [DataType.bytea, DataType.text], returns: DataType.text, implementation: (content, format) => Buffer.from(content).toString(format === 'base64' ? 'base64' : 'hex') });
  PoolClass = memoryDatabase.adapters.createPg().Pool;
}
const pool = new PoolClass({ ...(process.env.DATABASE_URL && process.env.VECTOR_TEST_DATABASE !== 'memory' ? { connectionString: config.databaseUrl } : {}), max: 12, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 10_000 });
const app = Fastify({ logger: process.env.NODE_ENV !== 'test', bodyLimit: config.maxBodyBytes, trustProxy: process.env.TRUST_PROXY === 'true' });
const eventClients = new Set();
await app.register(cookie, { secret: config.cookieSecret, hook: 'onRequest' });
await app.register(rateLimit, { global: false });

const stores = new Set(['tasks', 'documents', 'directories', 'users', 'messages', 'notifications', 'reportTemplates', 'auditLog', 'meta']);
const publicUser = (user) => { const { password, ...safe } = user; return safe; };
const tokenHash = (token) => crypto.createHash('sha256').update(token).digest('hex');
const sessionCookie = 'vector_session';
const userReferenceKeys = new Set(['userId', 'senderId', 'recipientId', 'ownerId', 'uploadedById', 'createdById', 'updatedById', 'approvedById', 'authorId']);
const userReferenceListKeys = new Set(['performerIds', 'completedPerformerIds', 'watcherIds']);

function containsUserReference(value, userId) {
  if (Array.isArray(value)) return value.some((item) => containsUserReference(item, userId));
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, child]) => (
    (userReferenceKeys.has(key) && child === userId)
    || (userReferenceListKeys.has(key) && Array.isArray(child) && child.includes(userId))
    || (!userReferenceKeys.has(key) && !userReferenceListKeys.has(key) && containsUserReference(child, userId))
  ));
}

async function userDependencies(client, userId) {
  const { rows } = await client.query("select store, id, data from app_entities where store in ('tasks', 'documents', 'messages', 'notifications', 'reportTemplates', 'directories', 'meta')");
  return rows.filter((row) => containsUserReference(row.data, userId)).map((row) => ({
    store: row.store,
    id: row.id,
    title: row.data.title || row.data.name || row.data.text || row.id,
  }));
}

async function validateUserChange(client, entity, existing = null) {
  if (!String(entity.name || '').trim() || !String(entity.login || '').trim()) return 'Укажите ФИО и логин пользователя.';
  const login = String(entity.login).trim().toLowerCase();
  const duplicate = await client.query('select user_id from auth_users where lower(login) = $1 and user_id <> $2', [login, entity.id]);
  if (duplicate.rowCount) return 'Этот логин уже используется.';
  const removesLastAdministrator = existing?.role === 'Администратор' && existing?.isActive !== false
    && (entity.role !== 'Администратор' || entity.isActive === false);
  if (removesLastAdministrator) {
    const remaining = await client.query("select count(*)::int as count from app_entities where store = 'users' and id <> $1 and data->>'role' = 'Администратор' and coalesce((data->>'isActive')::boolean, true)", [entity.id]);
    if (!remaining.rows[0].count) return 'Нельзя убрать или отключить последнего активного администратора.';
  }
  return null;
}

async function migrate() {
  const sql = await fs.readFile(path.join(rootDirectory, 'server', 'migrations', '001-initial.sql'), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(sql);
    await client.query("insert into schema_migrations(version) values ('001-initial') on conflict do nothing");
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally { client.release(); }
}

async function upsertRaw(client, store, entity) {
  const safe = store === 'users' ? publicUser(entity) : entity;
  await client.query(
    `insert into app_entities(store, id, data) values ($1, $2, $3::jsonb)
     on conflict (store, id) do update set data = excluded.data, updated_at = now()`,
    [store, String(entity.id), JSON.stringify(safe)],
  );
  if (store === 'users' && entity.login) {
    const existing = await client.query('select password_hash from auth_users where user_id = $1', [entity.id]);
    const hash = entity.password ? await bcrypt.hash(String(entity.password), 12) : existing.rows[0]?.password_hash || await bcrypt.hash('123', 12);
    await client.query(
      `insert into auth_users(user_id, login, password_hash, is_active) values ($1, $2, $3, $4)
       on conflict (user_id) do update set login = excluded.login, password_hash = excluded.password_hash,
       is_active = excluded.is_active, updated_at = now()`,
      [entity.id, entity.login, hash, entity.isActive !== false],
    );
  }
  return safe;
}

async function seedIfEmpty() {
  const { rows: [{ count }] } = await pool.query("select count(*)::int as count from app_entities where store = 'users'");
  if (count) return;
  const client = await pool.connect();
  try {
    await client.query('begin');
    for (const user of seedUsers) await upsertRaw(client, 'users', { ...user, isActive: user.isActive !== false });
    for (const task of seedTasks) await upsertRaw(client, 'tasks', { performerIds: [], completedPerformerIds: [], attachments: [], ...task });
    for (const document of seedDocuments) await upsertRaw(client, 'documents', document);
    let directoryIndex = 0;
    for (const [name, rows] of Object.entries(seedDirectories)) {
      directoryIndex += 1;
      await upsertRaw(client, 'directories', { id: name === 'Группировка документов' ? 'document-groups' : `directory-${directoryIndex}`, name, rows, fields: seedDirectoryFields[name] || [{ id: 'code', name: 'Код', type: 'текстовый' }, { id: 'name', name: 'Наименование', type: 'текстовый' }] });
    }
    await upsertRaw(client, 'meta', { id: 'organization', legalName: '', shortName: '', inn: '', kpp: '', ogrn: '', legalAddress: '', postalAddress: '', phone: '', email: '', website: '', director: '', bankName: '', bik: '', correspondentAccount: '', settlementAccount: '' });
    await client.query('commit');
  } catch (error) { await client.query('rollback'); throw error; } finally { client.release(); }
}

async function currentUser(request) {
  const token = request.cookies[sessionCookie];
  if (!token) return null;
  const result = await pool.query(
    `select e.data from user_sessions s join app_entities e on e.store = 'users' and e.id = s.user_id
     where s.token_hash = $1 and s.expires_at > now()`, [tokenHash(token)],
  );
  if (!result.rowCount) return null;
  await pool.query('update user_sessions set last_seen_at = now() where token_hash = $1', [tokenHash(token)]);
  return result.rows[0].data;
}

async function requireUser(request, reply) {
  const user = await currentUser(request);
  if (!user) return reply.code(401).send({ error: 'Требуется вход в систему.' });
  request.user = user;
}

async function audit(client, request, action, store, id, details = {}) {
  await client.query(
    'insert into audit_events(user_id, action, entity_store, entity_id, details, ip_address) values ($1,$2,$3,$4,$5::jsonb,$6)',
    [request.user?.id || null, action, store, id || null, JSON.stringify(details), request.ip || null],
  );
}

async function storeFiles(client, store, id, value) {
  async function visit(node) {
    if (Array.isArray(node)) return Promise.all(node.map(visit));
    if (!node || typeof node !== 'object') return node;
    if (node.__blob && node.data) {
      const fileId = crypto.randomUUID();
      const content = Buffer.from(node.data, 'base64');
      await client.query('insert into entity_files(id, entity_store, entity_id, mime_type, byte_size, content) values ($1,$2,$3,$4,$5,$6)', [fileId, store, id, node.type || 'application/octet-stream', content.length, content]);
      return { __fileId: fileId, type: node.type || 'application/octet-stream', size: content.length };
    }
    const result = {};
    for (const [key, child] of Object.entries(node)) result[key] = await visit(child);
    return result;
  }
  return visit(value);
}

async function expandFiles(value) {
  const ids = [];
  const collect = (node) => { if (Array.isArray(node)) node.forEach(collect); else if (node && typeof node === 'object') { if (node.__fileId) ids.push(node.__fileId); else Object.values(node).forEach(collect); } };
  collect(value);
  if (!ids.length) return value;
  const placeholders = ids.map((_, index) => `$${index + 1}`).join(', ');
  const result = await pool.query(`select id, mime_type, encode(content, 'base64') as data from entity_files where id::text in (${placeholders})`, ids);
  const files = new Map(result.rows.map((file) => [String(file.id), file]));
  const replace = (node) => {
    if (Array.isArray(node)) return node.map(replace);
    if (!node || typeof node !== 'object') return node;
    if (node.__fileId) { const file = files.get(String(node.__fileId)); return file ? { __blob: true, type: file.mime_type, data: file.data } : null; }
    return Object.fromEntries(Object.entries(node).map(([key, child]) => [key, replace(child)]));
  };
  return replace(value);
}

async function applicationData(user, fullAccess = false) {
  const result = await pool.query('select store, data from app_entities order by created_at');
  const grouped = Object.fromEntries([...stores].map((store) => [store, []]));
  for (const row of result.rows) grouped[row.store].push(await expandFiles(row.data));
  const allTasks = grouped.tasks;
  grouped.tasks = fullAccess ? allTasks : allTasks.filter((task) => canViewTask(user, task));
  if (!fullAccess) {
    grouped.messages = grouped.messages.filter((message) => message.senderId === user.id || message.recipientId === user.id);
    grouped.notifications = grouped.notifications.filter((notification) => !notification.userId || notification.userId === user.id);
  }
  const audits = await pool.query('select id, user_id as "userId", action, entity_store as "entityType", entity_id as "entityId", created_at as "createdAt" from audit_events order by created_at desc limit 500');
  return { tasks: grouped.tasks, documents: grouped.documents, directories: grouped.directories, users: grouped.users, messages: grouped.messages, notifications: grouped.notifications, reportTemplates: grouped.reportTemplates, auditLog: audits.rows, organization: grouped.meta.find((item) => item.id === 'organization') || {} };
}

function publishChange(store, id, action) {
  const payload = `event: change\ndata: ${JSON.stringify({ store, id, action, at: new Date().toISOString() })}\n\n`;
  for (const response of eventClients) response.write(payload);
}

app.get('/api/health', async () => { await pool.query('select 1'); return { status: 'ok', database: 'connected' }; });
app.get('/api/auth/users', async () => {
  const result = await pool.query("select data->>'id' as id, data->>'name' as name, data->>'login' as login from app_entities where store = 'users' and coalesce((data->>'isActive')::boolean, true) order by data->>'name'");
  return result.rows;
});
app.post('/api/auth/login', { config: { rateLimit: { max: process.env.NODE_ENV === 'test' ? 100 : 8, timeWindow: '1 minute' } } }, async (request, reply) => {
  const login = String(request.body?.login || '').trim().toLowerCase();
  const password = String(request.body?.password || '');
  const result = await pool.query(`select a.user_id, a.password_hash, e.data from auth_users a join app_entities e on e.store = 'users' and e.id = a.user_id where lower(a.login) = $1 and a.is_active`, [login]);
  const matched = result.rows[0];
  if (!matched || !(await bcrypt.compare(password, matched.password_hash))) return reply.code(401).send({ error: 'Неверный пользователь или пароль.' });
  const token = crypto.randomBytes(32).toString('base64url');
  const sessionId = crypto.randomUUID();
  await pool.query('delete from user_sessions where expires_at <= now()');
  await pool.query(`insert into user_sessions(id, user_id, token_hash, expires_at) values ($1,$2,$3,now() + ($4 || ' days')::interval)`, [sessionId, matched.user_id, tokenHash(token), config.sessionDays]);
  reply.setCookie(sessionCookie, token, { path: '/', httpOnly: true, sameSite: 'strict', secure: config.secureCookie, maxAge: config.sessionDays * 86400 });
  return { user: matched.data };
});
app.get('/api/auth/session', async (request, reply) => ({ user: await currentUser(request) || null }));
app.post('/api/auth/logout', async (request, reply) => {
  const token = request.cookies[sessionCookie];
  if (token) await pool.query('delete from user_sessions where token_hash = $1', [tokenHash(token)]);
  reply.clearCookie(sessionCookie, { path: '/' });
  return { ok: true };
});

app.get('/api/bootstrap', { preHandler: requireUser }, async (request) => applicationData(request.user));
app.get('/api/events', { preHandler: requireUser }, async (request, reply) => {
  reply.hijack();
  reply.raw.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  reply.raw.write(`event: ready\ndata: {}\n\n`);
  eventClients.add(reply.raw);
  const heartbeat = setInterval(() => reply.raw.write(': heartbeat\n\n'), 25_000);
  request.raw.on('close', () => { clearInterval(heartbeat); eventClients.delete(reply.raw); });
});
app.put('/api/entities/:store/:id', { preHandler: requireUser }, async (request, reply) => {
  const { store, id } = request.params;
  if (!stores.has(store) || !id || String(request.body?.id) !== id) return reply.code(400).send({ error: 'Некорректная сущность.' });
  const existingResult = await pool.query('select data from app_entities where store = $1 and id = $2', [store, id]);
  const existing = existingResult.rows[0]?.data || null;
  if (!canWrite(request.user, store, request.body, existing)) return reply.code(403).send({ error: 'Недостаточно прав для изменения.' });
  let entity = request.body;
  try { if (store === 'tasks') entity = normalizeTaskMutation(request.user, request.body, existing); }
  catch (error) { return reply.code(403).send({ error: error.message }); }
  const client = await pool.connect();
  try {
    await client.query('begin');
    if (store === 'users') {
      const validationError = await validateUserChange(client, entity, existing);
      if (validationError) { await client.query('rollback'); return reply.code(409).send({ error: validationError }); }
    }
    if (!existing) await client.query("insert into app_entities(store, id, data) values ($1,$2,'{}'::jsonb) on conflict do nothing", [store, id]);
    if (store !== 'users') await client.query('delete from entity_files where entity_store = $1 and entity_id = $2', [store, id]);
    const safeInput = store === 'users' ? entity : await storeFiles(client, store, id, entity);
    const saved = await upsertRaw(client, store, safeInput);
    await audit(client, request, existing ? 'save' : 'create', store, id);
    await client.query('commit');
    publishChange(store, id, existing ? 'save' : 'create');
    return expandFiles(saved);
  } catch (error) { await client.query('rollback'); throw error; } finally { client.release(); }
});
app.delete('/api/entities/:store/:id', { preHandler: requireUser }, async (request, reply) => {
  const { store, id } = request.params;
  if (!stores.has(store)) return reply.code(400).send({ error: 'Некорректное хранилище.' });
  const result = await pool.query('select data from app_entities where store = $1 and id = $2', [store, id]);
  if (!result.rowCount) return reply.code(404).send({ error: 'Запись не найдена.' });
  if (!canWrite(request.user, store, result.rows[0].data, result.rows[0].data)) return reply.code(403).send({ error: 'Недостаточно прав для удаления.' });
  if (store === 'users' && id === request.user.id) return reply.code(409).send({ error: 'Нельзя удалить текущего пользователя.' });
  const client = await pool.connect();
  try {
    await client.query('begin');
    if (store === 'users') {
      const dependencies = await userDependencies(client, id);
      if (dependencies.length) {
        await client.query('rollback');
        return reply.code(409).send({ error: `Нельзя удалить пользователя: найдены связанные записи (${dependencies.length}). Сначала переназначьте или удалите их.`, dependencies });
      }
      if (result.rows[0].data.role === 'Администратор' && result.rows[0].data.isActive !== false) {
        const remaining = await client.query("select count(*)::int as count from app_entities where store = 'users' and id <> $1 and data->>'role' = 'Администратор' and coalesce((data->>'isActive')::boolean, true)", [id]);
        if (!remaining.rows[0].count) { await client.query('rollback'); return reply.code(409).send({ error: 'Нельзя удалить последнего активного администратора.' }); }
      }
    }
    await client.query('delete from app_entities where store = $1 and id = $2', [store, id]);
    if (store === 'users') await client.query('delete from auth_users where user_id = $1', [id]);
    await audit(client, request, 'delete', store, id);
    await client.query('commit');
  } catch (error) { await client.query('rollback'); throw error; } finally { client.release(); }
  publishChange(store, id, 'delete');
  return reply.code(204).send();
});

app.get('/api/backup', { preHandler: requireUser }, async (request, reply) => {
  if (request.user.role !== 'Администратор') return reply.code(403).send({ error: 'Резервная копия доступна администратору.' });
  return { product: 'Вектор', database: 'vector-server', version: 1, exportedAt: new Date().toISOString(), data: await applicationData(request.user, true) };
});
app.post('/api/restore', { preHandler: requireUser }, async (request, reply) => {
  if (request.user.role !== 'Администратор') return reply.code(403).send({ error: 'Восстановление доступно администратору.' });
  const data = request.body?.data;
  if (!data || !Array.isArray(data.users)) return reply.code(400).send({ error: 'Неверный формат серверной резервной копии.' });
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('delete from app_entities');
    for (const store of ['tasks', 'documents', 'directories', 'users', 'messages', 'notifications', 'reportTemplates']) for (const entity of data[store] || []) {
      await client.query("insert into app_entities(store, id, data) values ($1,$2,'{}'::jsonb) on conflict do nothing", [store, entity.id]);
      await upsertRaw(client, store, store === 'users' ? entity : await storeFiles(client, store, entity.id, entity));
    }
    await upsertRaw(client, 'meta', { id: 'organization', ...(data.organization || {}) });
    await audit(client, request, 'restore', 'database', 'vector-server');
    await client.query('commit');
    publishChange('database', 'vector-server', 'restore');
  } catch (error) { await client.query('rollback'); throw error; } finally { client.release(); }
  return applicationData(request.user);
});
app.post('/api/migrate-local', { preHandler: requireUser }, async (request, reply) => {
  if (request.user.role !== 'Администратор') return reply.code(403).send({ error: 'Перенос доступен администратору.' });
  const data = request.body?.data;
  if (!data || !Array.isArray(data.tasks) || !Array.isArray(data.users)) return reply.code(400).send({ error: 'Локальные данные не распознаны.' });
  const client = await pool.connect();
  try {
    await client.query('begin');
    for (const store of ['tasks', 'documents', 'directories', 'users', 'messages', 'notifications', 'reportTemplates']) for (const entity of data[store] || []) {
      await client.query("insert into app_entities(store, id, data) values ($1,$2,'{}'::jsonb) on conflict do nothing", [store, entity.id]);
      const prepared = store === 'users' && !entity.password ? { ...entity, password: '123' } : await storeFiles(client, store, entity.id, entity);
      await upsertRaw(client, store, prepared);
    }
    await upsertRaw(client, 'meta', { id: 'organization', ...(data.organization || {}) });
    await audit(client, request, 'migrate', 'database', 'indexeddb');
    await client.query('commit');
    publishChange('database', 'indexeddb', 'migrate');
  } catch (error) { await client.query('rollback'); throw error; } finally { client.release(); }
  return applicationData(request.user);
});

const distDirectory = path.join(rootDirectory, 'dist');
try {
  await fs.access(distDirectory);
  await app.register(fastifyStatic, { root: distDirectory, wildcard: false });
  app.setNotFoundHandler((request, reply) => request.raw.url.startsWith('/api/') ? reply.code(404).send({ error: 'Маршрут API не найден.' }) : reply.sendFile('index.html'));
} catch { app.log.warn('Папка dist не найдена: сервер запущен только в режиме API.'); }

app.setErrorHandler((error, request, reply) => {
  request.log.error(error);
  if (error.code === '23505') return reply.code(409).send({ error: 'Запись с такими уникальными данными уже существует.' });
  return reply.code(error.statusCode || 500).send({ error: error.statusCode ? error.message : 'Внутренняя ошибка сервера.' });
});

await migrate();
await seedIfEmpty();
if (process.env.VECTOR_TEST_DATABASE !== 'memory') await app.listen({ port: config.port, host: config.host });

const shutdown = async () => { await app.close(); await pool.end(); process.exit(0); };
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export { app, pool, seedIfEmpty };
