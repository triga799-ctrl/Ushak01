import test from 'node:test';
import assert from 'node:assert/strict';
import { canViewTask, canWrite, normalizeTaskMutation } from '../server/policy.mjs';

const task = { id: 't1', ownerId: 'owner', performerIds: ['performer'] };

test('сервер ограничивает видимость задач постановщиком и исполнителями', () => {
  assert.equal(canViewTask({ id: 'owner', role: 'Постановщик' }, task), true);
  assert.equal(canViewTask({ id: 'performer', role: 'Исполнитель' }, task), true);
  assert.equal(canViewTask({ id: 'other', role: 'Исполнитель' }, task), false);
  assert.equal(canViewTask({ id: 'manager', role: 'Руководитель' }, task), true);
});

test('сервер разрешает менять справочники и пользователей только администратору', () => {
  assert.equal(canWrite({ id: 'admin', role: 'Администратор' }, 'users', { id: 'u2' }), true);
  assert.equal(canWrite({ id: 'manager', role: 'Руководитель' }, 'users', { id: 'u2' }), false);
  assert.equal(canWrite({ id: 'owner', role: 'Постановщик' }, 'tasks', task, task), true);
  assert.equal(canWrite({ id: 'other', role: 'Исполнитель' }, 'tasks', task, task), false);
});

test('исполнитель не может изменить чужую отметку или реквизиты задачи', () => {
  const existing = { ...task, title: 'Исходная', status: 'В работе', dueDate: '2099-01-01', completedPerformerIds: [] };
  assert.throws(() => normalizeTaskMutation({ id: 'performer', role: 'Исполнитель' }, { ...existing, title: 'Подмена' }, existing));
  assert.throws(() => normalizeTaskMutation({ id: 'performer', role: 'Исполнитель' }, { ...existing, completedPerformerIds: ['owner'] }, existing));
  const accepted = normalizeTaskMutation({ id: 'performer', role: 'Исполнитель' }, { ...existing, completedPerformerIds: ['performer'] }, existing);
  assert.deepEqual(accepted.completedPerformerIds, ['performer']);
});
