import * as localDatabase from './indexeddb';

const rawApiUrl = String(import.meta.env.VITE_API_URL ?? '').trim();
const configuredApiUrl = rawApiUrl === '/' ? '' : rawApiUrl.replace(/\/$/, '');
const configuredStorageMode = String(import.meta.env.VITE_STORAGE_MODE ?? '').trim().toLowerCase();
export const isServerDatabase = configuredStorageMode === 'server'
  || (configuredStorageMode !== 'local' && (Boolean(rawApiUrl) || import.meta.env.PROD));
const apiUrl = (path) => `${configuredApiUrl}${path}`;
const emptyWorkspace = (users = []) => ({ tasks: [], documents: [], directories: [], users, messages: [], notifications: [], reportTemplates: [], auditLog: [], organization: {} });

async function request(path, options = {}) {
  const response = await fetch(apiUrl(path), { credentials: 'include', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(payload.error || `Ошибка сервера (${response.status}).`); error.status = response.status; error.details = payload; throw error; }
  return payload;
}

async function blobToTransfer(value) {
  if (value instanceof Blob) {
    const bytes = new Uint8Array(await value.arrayBuffer());
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    return { __blob: true, type: value.type, data: btoa(binary) };
  }
  if (Array.isArray(value)) return Promise.all(value.map(blobToTransfer));
  if (value && typeof value === 'object') return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await blobToTransfer(item)])));
  return value;
}

function transferToBlob(value) {
  if (value?.__blob) { const binary = atob(value.data); return new Blob([Uint8Array.from(binary, (character) => character.charCodeAt(0))], { type: value.type }); }
  if (Array.isArray(value)) return value.map(transferToBlob);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, transferToBlob(item)]));
  return value;
}

export async function getCurrentUser() { if (!isServerDatabase) return null; return (await request('/api/auth/session'))?.user ?? null; }
export async function authenticateUser(login, password) { if (!isServerDatabase) return null; return (await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ login, password }) })).user; }
export async function logoutUser() { if (isServerDatabase) await request('/api/auth/logout', { method: 'POST' }); }
export function subscribeDatabase(onChange) {
  if (!isServerDatabase) return () => {};
  const source = new EventSource(apiUrl('/api/events'), { withCredentials: true });
  source.addEventListener('change', onChange);
  return () => source.close();
}

export async function loadDatabase() {
  if (!isServerDatabase) return localDatabase.loadDatabase();
  try {
    const workspace = transferToBlob(await request('/api/bootstrap'));
    if (!Array.isArray(workspace?.users)) throw new Error('Серверное API недоступно. Production-сборку нужно открывать через сервер приложения, а не Vite Preview.');
    return workspace;
  } catch (error) {
    if (error.status !== 401) throw error;
    const users = await request('/api/auth/users');
    if (!Array.isArray(users)) throw new Error('Серверное API недоступно. Production-сборку нужно открывать через сервер приложения, а не Vite Preview.');
    return emptyWorkspace(users);
  }
}

export async function saveEntity(store, entity) {
  if (!isServerDatabase) return localDatabase.saveEntity(store, entity);
  return transferToBlob(await request(`/api/entities/${encodeURIComponent(store)}/${encodeURIComponent(entity.id)}`, { method: 'PUT', body: JSON.stringify(await blobToTransfer(entity)) }));
}

export async function deleteEntity(store, id) {
  if (!isServerDatabase) return localDatabase.deleteEntity(store, id);
  return request(`/api/entities/${encodeURIComponent(store)}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function exportDatabaseSnapshot() { return isServerDatabase ? request('/api/backup') : localDatabase.exportDatabaseSnapshot(); }
export async function importDatabaseSnapshot(snapshot) {
  if (!isServerDatabase) return localDatabase.importDatabaseSnapshot(snapshot);
  return transferToBlob(await request('/api/restore', { method: 'POST', body: JSON.stringify(await blobToTransfer(snapshot)) }));
}

export async function migrateLocalDatabaseToServer() {
  if (!isServerDatabase) throw new Error('Перенос доступен только при подключении к серверу.');
  const data = await localDatabase.loadDatabase();
  return transferToBlob(await request('/api/migrate-local', { method: 'POST', body: JSON.stringify({ data: await blobToTransfer(data) }) }));
}
