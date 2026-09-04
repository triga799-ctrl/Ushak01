import test from 'node:test';
import assert from 'node:assert/strict';
import { attachmentBlob, previewType } from '../src/file-preview.js';

test('предпросмотр определяет поддерживаемые форматы', () => {
  assert.equal(previewType({ name: 'report.pdf' }), 'pdf');
  assert.equal(previewType({ name: 'table.xlsx' }), 'spreadsheet');
  assert.equal(previewType({ name: 'document.docx' }), 'word');
  assert.equal(previewType({ name: 'photo.jpeg' }), 'image');
});

test('предпросмотр восстанавливает файл из серверного base64-формата', async () => {
  const file = await attachmentBlob({ blob: { __blob: true, type: 'text/plain', data: Buffer.from('Проверка').toString('base64') } });
  assert.equal(await file.text(), 'Проверка');
  assert.equal(file.type, 'text/plain');
});
