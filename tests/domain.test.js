import test from 'node:test';
import assert from 'node:assert/strict';
import { attentionReason, canViewTask, deriveTaskStatus, documentStatuses, filterDocuments, getAttentionTasks } from '../src/domain.js';

test('задача переходит на утверждение после выполнения всеми исполнителями', () => {
  assert.equal(deriveTaskStatus({ status: 'В работе', performerIds: ['u1', 'u2'], completedPerformerIds: ['u1', 'u2'] }), 'Утверждение');
  assert.equal(deriveTaskStatus({ status: 'В работе', performerIds: ['u1', 'u2'], completedPerformerIds: ['u1'] }), 'В работе');
});

test('завершённая задача не возвращается на утверждение', () => {
  assert.equal(deriveTaskStatus({ status: 'Завершено', performerIds: ['u1'], completedPerformerIds: ['u1'] }), 'Завершено');
});

test('обычный пользователь видит только поставленные или назначенные ему задачи', () => {
  const ordinaryUser = { id: 'u2', role: 'Исполнитель' };
  const ownerTask = { ownerId: 'u2', performerIds: [] };
  const performerTask = { ownerId: 'u1', performerIds: ['u2'] };
  const otherTask = { ownerId: 'u1', performerIds: ['u3'] };

  assert.equal(canViewTask(ordinaryUser, ownerTask), true);
  assert.equal(canViewTask(ordinaryUser, performerTask), true);
  assert.equal(canViewTask(ordinaryUser, otherTask), false);
  assert.equal(canViewTask({ id: 'u4', role: 'Руководитель' }, otherTask), true);
});

test('внимание включает сроки ближайших трёх дней и высокий приоритет без завершённых задач', () => {
  const today = new Date(2026, 8, 3, 12);
  const tasks = [
    { id: 'overdue', title: 'Просроченная', status: 'Просрочено', performerIds: ['u1'], dueDate: '2026-08-30', priority: 'Обычный' },
    { id: 'soon', title: 'Срочная встреча', status: 'В работе', performerIds: ['u1'], dueDate: '2026-09-06', priority: 'Обычный' },
    { id: 'high', title: 'Важная задача', status: 'В работе', performerIds: ['u1'], dueDate: '2026-10-01', priority: 'Высокий' },
    { id: 'done', title: 'Завершённая срочная', status: 'Завершено', performerIds: ['u1'], dueDate: '2026-09-03', priority: 'Высокий' },
  ];

  assert.deepEqual(getAttentionTasks(tasks, today).map((task) => task.id), ['overdue', 'soon', 'high']);
  assert.deepEqual(attentionReason(tasks[1], today), { label: 'Срок в ближайшие 3 дня', tone: 'amber' });
  assert.deepEqual(attentionReason(tasks[2], today), { label: 'Высокий приоритет', tone: 'red' });
  assert.equal(attentionReason(tasks[3], today), null);
});

test('договоры используют собственный набор статусов', () => {
  assert.deepEqual(documentStatuses.contracts, ['Черновик', 'На согласовании', 'Действует', 'Истёк']);
});

test('фильтр документов учитывает категорию, статус и группу', () => {
  const rows = [
    { id: '1', category: 'normative', title: 'Политика', status: 'Действует', documentGroup: 'Безопасность' },
    { id: '2', category: 'internal', title: 'Инструкция', status: 'Действует', documentGroup: 'Кадры' },
  ];
  assert.deepEqual(filterDocuments(rows, { category: 'normative', status: 'Действует', group: 'Безопасность' }).map((row) => row.id), ['1']);
});
