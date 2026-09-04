export const roleLevels = { 'Наблюдатель': 0, 'Исполнитель': 1, 'Специалист': 1, 'Постановщик': 2, 'Руководитель': 3, 'Руководитель проекта': 3, 'Администратор': 4 };

export function canWrite(user, store, entity, existing = null) {
  const level = roleLevels[user?.role] ?? 0;
  if (store === 'users' || store === 'directories' || store === 'meta') return user?.role === 'Администратор';
  if (store === 'tasks') {
    if (!existing) return level >= 1 && entity.ownerId === user?.id;
    return level >= 3 || existing.ownerId === user?.id || (existing.performerIds || []).includes(user?.id);
  }
  if (store === 'messages') return entity.senderId === user?.id || entity.senderId == null;
  if (store === 'notifications') return level >= 1;
  if (store === 'documents' || store === 'reportTemplates') return level >= 1;
  return false;
}

export function canViewTask(user, task) {
  return ['Администратор', 'Руководитель'].includes(user?.role) || task.ownerId === user?.id || (task.performerIds || []).includes(user?.id);
}

export function normalizeTaskMutation(user, incoming, existing) {
  if (!existing || (roleLevels[user?.role] ?? 0) >= 3 || existing.ownerId === user?.id) return incoming;
  const allowed = new Set(['completedPerformerIds', 'status', 'progress', 'history', 'comments', 'attachments']);
  for (const key of new Set([...Object.keys(existing), ...Object.keys(incoming)])) {
    if (!allowed.has(key) && JSON.stringify(incoming[key]) !== JSON.stringify(existing[key])) throw new Error('Исполнитель может изменять только выполнение, комментарии и вложения задачи.');
  }
  const previousCompleted = new Set(existing.completedPerformerIds || []);
  const nextCompleted = new Set(incoming.completedPerformerIds || []);
  for (const performerId of new Set([...previousCompleted, ...nextCompleted])) {
    if (performerId !== user.id && previousCompleted.has(performerId) !== nextCompleted.has(performerId)) throw new Error('Нельзя менять отметку выполнения другого исполнителя.');
  }
  const performers = incoming.performerIds || existing.performerIds || [];
  const allCompleted = performers.length > 0 && performers.every((id) => nextCompleted.has(id));
  const overdue = incoming.dueDate && `${incoming.dueDate}T${incoming.dueTime || '23:59'}` < new Date().toISOString().slice(0, 16);
  return { ...incoming, status: existing.status === 'Завершено' ? 'Завершено' : allCompleted ? 'Утверждение' : overdue ? 'Просрочено' : 'В работе' };
}
