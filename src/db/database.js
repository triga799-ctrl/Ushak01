import { seedDirectories, seedDirectoryFields, seedDocuments, seedTasks, users } from '../data/seed';

const DB_NAME = 'kontur-organization-db';
const VERSION = 3;
const STORES = ['tasks', 'documents', 'directories', 'users', 'messages'];
const META_STORE = 'meta';
const defaultOrganization = {
  id: 'organization', legalName: '', shortName: '', inn: '', kpp: '', ogrn: '',
  legalAddress: '', postalAddress: '', phone: '', email: '', website: '', director: '',
  bankName: '', bik: '', correspondentAccount: '', settlementAccount: '',
};

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const db = request.result;
      [...STORES, META_STORE].forEach((store) => {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: 'id' });
      });
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function getAll(db, store) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(store, 'readonly').objectStore(store).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function put(db, store, value) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(store, 'readwrite').objectStore(store).put(value);
    request.onsuccess = () => resolve(value);
    request.onerror = () => reject(request.error);
  });
}

function remove(db, store, id) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(store, 'readwrite').objectStore(store).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function loadDatabase() {
  const db = await openDatabase();
  const [currentTasks, currentDocuments, currentDirectories, currentUsers, currentMessages, metadata] = await Promise.all([
    getAll(db, 'tasks'), getAll(db, 'documents'), getAll(db, 'directories'), getAll(db, 'users'), getAll(db, 'messages'), getAll(db, META_STORE),
  ]);
  const isInitialized = metadata.some((item) => item.id === 'initialized');
  const hasExistingData = [currentTasks, currentDocuments, currentDirectories, currentUsers, currentMessages].some((items) => items.length);

  if (!isInitialized && !hasExistingData) {
    await Promise.all([
      ...seedTasks.map((task) => put(db, 'tasks', task)),
      ...seedDocuments.map((document) => put(db, 'documents', document)),
      ...users.map((user) => put(db, 'users', user)),
      ...Object.entries(seedDirectories).map(([name, rows]) => put(db, 'directories', { id: name, name, rows, ...(seedDirectoryFields[name] ? { fields: seedDirectoryFields[name] } : {}) })),
    ]);
  }

  if (!isInitialized) await put(db, META_STORE, { id: 'initialized', value: true });
  const numberPrefix = `${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-`;
  let lastSequence = currentTasks.reduce((maximum, task) => task.number?.startsWith(numberPrefix) ? Math.max(maximum, Number(task.number.slice(numberPrefix.length)) || 0) : maximum, 0);
  const legacyTasks = currentTasks.filter((task) => !task.number);
  if (legacyTasks.length) await Promise.all(legacyTasks.map((task) => {
    lastSequence += 1;
    return put(db, 'tasks', { ...task, number: `${numberPrefix}${String(lastSequence).padStart(3, '0')}` });
  }));
  const [tasks, documents, directories, savedUsers, messages] = await Promise.all(STORES.map((store) => getAll(db, store)));
  db.close();
  return { tasks, documents, directories, users: savedUsers, messages, organization: metadata.find((item) => item.id === 'organization') ?? defaultOrganization };
}

export async function saveEntity(store, entity) {
  const db = await openDatabase();
  const value = await put(db, store, entity);
  db.close();
  return value;
}

export async function deleteEntity(store, id) {
  const db = await openDatabase();
  await remove(db, store, id);
  db.close();
}
