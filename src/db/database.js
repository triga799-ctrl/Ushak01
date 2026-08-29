import { seedDirectories, seedDocuments, seedTasks, users } from '../data/seed';

const DB_NAME = 'kontur-organization-db';
const VERSION = 1;
const STORES = ['tasks', 'documents', 'directories', 'users'];

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const db = request.result;
      STORES.forEach((store) => {
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
  const currentTasks = await getAll(db, 'tasks');
  if (!currentTasks.length) {
    await Promise.all([
      ...seedTasks.map((task) => put(db, 'tasks', task)),
      ...seedDocuments.map((document) => put(db, 'documents', document)),
      ...users.map((user) => put(db, 'users', user)),
      ...Object.entries(seedDirectories).map(([name, rows]) => put(db, 'directories', { id: name, name, rows })),
    ]);
  } else {
    const savedUsers = await getAll(db, 'users');
    const today = new Date();
    const todayText = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const migratedTasks = currentTasks
      .filter((task) => task.status === 'Ожидает согласования' || ['Средний', 'Низкий'].includes(task.priority) || (task.dueDate < todayText && !['Завершено', 'Просрочено'].includes(task.status)))
      .map((task) => ({
        ...task,
        status: task.dueDate < todayText && !['Завершено', 'Просрочено'].includes(task.status) ? 'Просрочено' : task.status === 'Ожидает согласования' ? 'Утверждение' : task.status,
        priority: ['Средний', 'Низкий'].includes(task.priority) ? 'Обычный' : task.priority,
      }));
    const migratedUsers = savedUsers
      .map((savedUser) => {
        const seedUser = users.find((user) => user.id === savedUser.id);

        return seedUser && (!savedUser.login || !savedUser.password || savedUser.role !== seedUser.role || !savedUser.department)
          ? { ...savedUser, login: seedUser.login, password: seedUser.password, role: seedUser.role, department: seedUser.department }
          : null;
      })
      .filter(Boolean);

    await Promise.all([
      ...migratedTasks.map((task) => put(db, 'tasks', task)),
      ...migratedUsers.map((user) => put(db, 'users', user)),
    ]);
  }
  const [tasks, documents, directories, savedUsers] = await Promise.all(STORES.map((store) => getAll(db, store)));
  db.close();
  return { tasks, documents, directories, users: savedUsers };
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
