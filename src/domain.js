export const documentStatuses = {
  normative: ['Действует', 'На согласовании', 'Требует пересмотра'],
  internal: ['Действует', 'На согласовании', 'Требует пересмотра'],
  contracts: ['Черновик', 'На согласовании', 'Действует', 'Истёк'],
};

export function deriveTaskStatus(task) {
  if (task.status === 'Завершено') return task.status;
  const performers = task.performerIds ?? [];
  const completed = new Set(task.completedPerformerIds ?? []);
  return performers.length > 0 && performers.every((performerId) => completed.has(performerId))
    ? 'Утверждение'
    : task.status;
}

export function canViewTask(user, task) {
  return ['Администратор', 'Руководитель'].includes(user?.role)
    || task.ownerId === user?.id
    || (task.performerIds ?? []).includes(user?.id);
}

const isoDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function attentionReason(task, now = new Date()) {
  if (task.status === 'Просрочено') return { label: 'Просрочено', tone: 'red' };
  if (task.status === 'Завершено') return null;
  if (!task.performerIds?.length) return { label: 'Нет исполнителя', tone: 'gray' };
  if (task.status === 'Утверждение') return { label: 'На утверждении', tone: 'amber' };

  const today = isoDate(now);
  const deadline = new Date(now);
  deadline.setDate(deadline.getDate() + 3);
  if (task.dueDate && task.dueDate >= today && task.dueDate <= isoDate(deadline)) {
    return { label: 'Срок в ближайшие 3 дня', tone: 'amber' };
  }
  if (task.priority === 'Высокий') return { label: 'Высокий приоритет', tone: 'red' };
  return null;
}

export function getAttentionTasks(tasks, now = new Date(), limit = 5) {
  const criteria = [
    (task) => task.status === 'Просрочено',
    (task) => task.status !== 'Завершено' && !task.performerIds?.length,
    (task) => task.status === 'Утверждение',
    (task) => task.status !== 'Завершено' && task.dueDate >= isoDate(now) && task.dueDate <= isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3)),
    (task) => task.status !== 'Завершено' && task.priority === 'Высокий',
  ];
  const normalizedTitle = (task) => task.title.replace(/\s+—\s+копия$/i, '').trim().toLowerCase();
  const seenTitles = new Set();
  const attention = [];

  for (const criterion of criteria) {
    for (const task of tasks) {
      const key = normalizedTitle(task);
      if (criterion(task) && !seenTitles.has(key)) {
        seenTitles.add(key);
        attention.push(task);
        if (attention.length === limit) return attention;
      }
    }
  }
  return attention;
}

export function filterDocuments(documents, { category, query = '', status = 'Все документы', group = 'all' }) {
  const normalizedQuery = query.trim().toLowerCase();
  return documents.filter((document) => {
    const isNormative = document.category ? document.category === 'normative' : ['Регламент', 'Политика'].includes(document.type);
    const inCategory = category === 'contracts'
      ? document.category === 'contracts' || document.type === 'Договор'
      : isNormative === (category === 'normative');
    const matchesQuery = !normalizedQuery || [document.title, document.number, document.owner, document.counterparty]
      .some((value) => String(value ?? '').toLowerCase().includes(normalizedQuery));
    const matchesStatus = status === 'Все документы' || document.status === status;
    const matchesGroup = category === 'contracts' || group === 'all' || (group === 'none' ? !document.documentGroup : document.documentGroup === group);
    return inCategory && matchesQuery && matchesStatus && matchesGroup;
  });
}

export const auditEntityLabels = {
  tasks: 'задача',
  documents: 'документ',
  directories: 'справочник',
  users: 'пользователь',
  messages: 'сообщение',
  notifications: 'уведомление',
  database: 'база данных',
};
