import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveTaskStatus, documentStatuses, filterDocuments } from '../src/domain.js';

test('задача переходит на утверждение после выполнения всеми исполнителями', () => {
  assert.equal(deriveTaskStatus({ status: 'В работе', performerIds: ['u1', 'u2'], completedPerformerIds: ['u1', 'u2'] }), 'Утверждение');
  assert.equal(deriveTaskStatus({ status: 'В работе', performerIds: ['u1', 'u2'], completedPerformerIds: ['u1'] }), 'В работе');
});

test('завершённая задача не возвращается на утверждение', () => {
  assert.equal(deriveTaskStatus({ status: 'Завершено', performerIds: ['u1'], completedPerformerIds: ['u1'] }), 'Завершено');
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
