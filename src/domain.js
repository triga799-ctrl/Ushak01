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
