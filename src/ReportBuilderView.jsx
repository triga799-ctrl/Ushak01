import { useMemo, useState } from 'react';

const taskFields = [
  { id: 'number', name: 'Номер' }, { id: 'title', name: 'Задача' }, { id: 'status', name: 'Статус' },
  { id: 'priority', name: 'Приоритет' }, { id: 'owner', name: 'Постановщик' }, { id: 'performers', name: 'Исполнители' },
  { id: 'dueDate', name: 'Срок исполнения', type: 'дата' }, { id: 'progress', name: 'Прогресс, %', type: 'числовой' },
];

const documentFields = [
  { id: 'title', name: 'Документ' }, { id: 'categoryLabel', name: 'Раздел' }, { id: 'type', name: 'Вид' },
  { id: 'number', name: 'Номер' }, { id: 'status', name: 'Статус' }, { id: 'owner', name: 'Ответственный' },
  { id: 'updated', name: 'Дата документа', type: 'дата' }, { id: 'documentGroup', name: 'Группа' }, { id: 'counterparty', name: 'Контрагент' },
];

const userFields = [
  { id: 'name', name: 'Пользователь' }, { id: 'department', name: 'Подразделение' },
  { id: 'login', name: 'Логин' }, { id: 'role', name: 'Роль' },
];

const operators = [
  ['contains', 'содержит'], ['equals', 'равно'], ['notEquals', 'не равно'],
  ['startsWith', 'начинается с'], ['empty', 'не заполнено'], ['notEmpty', 'заполнено'],
];

const categoryLabels = { normative: 'Нормативные документы', internal: 'Внутренние документы', contracts: 'Договоры' };
const printableValue = (value) => {
  if (value === undefined || value === null || value === '') return '—';
  if (Array.isArray(value)) return value.map(printableValue).join(', ');
  if (typeof value === 'object') return value.name ?? value.fileName ?? 'Файл';
  return String(value);
};
const escapeHtml = (value) => printableValue(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const safeFilename = (value) => value.replace(/[^а-яёa-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '') || 'Отчёт';

function createSources(tasks, documents, users, directories) {
  const userNames = new Map(users.map((user) => [user.id, user.name]));
  return [
    {
      id: 'tasks', name: 'Задачи', fields: taskFields,
      rows: tasks.map((task) => ({ ...task, owner: userNames.get(task.ownerId) ?? 'Не указан', performers: (task.performerIds ?? []).map((id) => userNames.get(id)).filter(Boolean).join(', '), progress: task.progress ?? 0 })),
    },
    { id: 'documents', name: 'Документы', fields: documentFields, rows: documents.map((document) => ({ ...document, categoryLabel: categoryLabels[document.category] ?? 'Документы' })) },
    { id: 'users', name: 'Пользователи', fields: userFields, rows: users },
    ...directories.map((directory) => ({
      id: `directory:${directory.id}`,
      name: `Справочник: ${directory.name}`,
      fields: directory.fields?.length ? directory.fields : [{ id: 'code', name: 'Код' }, { id: 'name', name: 'Наименование' }],
      rows: directory.rows ?? [],
    })),
  ];
}

function matchesFilter(row, filter) {
  if (!filter.fieldId) return true;
  const source = String(row[filter.fieldId] ?? '').toLocaleLowerCase('ru');
  const expected = String(filter.value ?? '').trim().toLocaleLowerCase('ru');
  if (filter.operator === 'empty') return !source;
  if (filter.operator === 'notEmpty') return Boolean(source);
  if (!expected) return true;
  if (filter.operator === 'equals') return source === expected;
  if (filter.operator === 'notEquals') return source !== expected;
  if (filter.operator === 'startsWith') return source.startsWith(expected);
  return source.includes(expected);
}

export default function ReportBuilderView({ tasks, documents, users, directories, templates, onSaveTemplate }) {
  const sources = useMemo(() => createSources(tasks, documents, users, directories), [tasks, documents, users, directories]);
  const [sourceId, setSourceId] = useState('tasks');
  const source = sources.find((item) => item.id === sourceId) ?? sources[0];
  const [reportName, setReportName] = useState('Сводный отчёт');
  const [selectedFieldIds, setSelectedFieldIds] = useState(() => taskFields.map((field) => field.id));
  const [filters, setFilters] = useState([]);
  const [groupBy, setGroupBy] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [sortDirection, setSortDirection] = useState('ascending');
  const [templateId, setTemplateId] = useState('');
  const [notice, setNotice] = useState('');

  const selectedFields = source.fields.filter((field) => selectedFieldIds.includes(field.id));
  const rows = useMemo(() => {
    const filtered = source.rows.filter((row) => filters.every((filter) => matchesFilter(row, filter)));
    if (!sortBy) return filtered;
    const direction = sortDirection === 'ascending' ? 1 : -1;
    return filtered.toSorted((left, right) => String(left[sortBy] ?? '').localeCompare(String(right[sortBy] ?? ''), 'ru', { numeric: true }) * direction);
  }, [source.rows, filters, sortBy, sortDirection]);
  const groupedRows = useMemo(() => {
    if (!groupBy) return [['', rows]];
    const groups = new Map();
    rows.forEach((row) => { const key = printableValue(row[groupBy]); groups.set(key, [...(groups.get(key) ?? []), row]); });
    return [...groups.entries()].toSorted(([left], [right]) => left.localeCompare(right, 'ru', { numeric: true }));
  }, [groupBy, rows]);

  const selectSource = (nextSourceId) => {
    const nextSource = sources.find((item) => item.id === nextSourceId) ?? sources[0];
    setSourceId(nextSource.id);
    setSelectedFieldIds(nextSource.fields.map((field) => field.id));
    setFilters([]);
    setGroupBy('');
    setSortBy('');
    setNotice('');
  };
  const toggleField = (fieldId) => setSelectedFieldIds((current) => current.includes(fieldId) ? current.filter((id) => id !== fieldId) : [...current, fieldId]);
  const addFilter = () => setFilters((current) => [...current, { id: `filter-${Date.now()}`, fieldId: source.fields[0]?.id ?? '', operator: 'contains', value: '' }]);
  const updateFilter = (id, change) => setFilters((current) => current.map((filter) => filter.id === id ? { ...filter, ...change } : filter));
  const applyTemplate = (nextTemplateId) => {
    setTemplateId(nextTemplateId);
    const template = templates.find((item) => item.id === nextTemplateId);
    if (!template) return;
    const nextSourceId = template.sourceId ?? (template.directoryId ? `directory:${template.directoryId}` : 'tasks');
    const nextSource = sources.find((item) => item.id === nextSourceId) ?? sources[0];
    setSourceId(nextSource.id);
    setReportName(template.reportName ?? template.name);
    setSelectedFieldIds((template.fieldIds ?? nextSource.fields.map((field) => field.id)).filter((id) => nextSource.fields.some((field) => field.id === id)));
    setFilters(template.filters ?? []);
    setGroupBy(template.groupBy ?? '');
    setSortBy(template.sortBy ?? '');
    setSortDirection(template.sortDirection ?? 'ascending');
    setNotice(`Шаблон «${template.name}» применён.`);
  };
  const saveTemplate = async () => {
    if (!reportName.trim()) { setNotice('Укажите название отчёта.'); return; }
    if (!selectedFields.length) { setNotice('Выберите хотя бы одно поле.'); return; }
    await onSaveTemplate({ id: `report-${Date.now()}`, name: reportName.trim(), reportName: reportName.trim(), sourceId: source.id, directoryId: source.id.startsWith('directory:') ? source.id.slice(10) : null, fieldIds: selectedFieldIds, filters, groupBy, sortBy, sortDirection, createdAt: new Date().toISOString() });
    setNotice('Шаблон отчёта сохранён.');
  };
  const exportReport = async (format) => {
    if (!selectedFields.length) { setNotice('Выберите хотя бы одно поле.'); return; }
    const title = reportName.trim() || `Отчёт: ${source.name}`;
    const generated = new Intl.DateTimeFormat('ru-RU').format(new Date());
    if (format === 'excel') {
      const XLSX = await import('xlsx');
      const data = [[title], [`Источник: ${source.name}`], [`Дата формирования: ${generated}`], [], selectedFields.map((field) => field.name), ...rows.map((row) => selectedFields.map((field) => printableValue(row[field.id])))];
      const worksheet = XLSX.utils.aoa_to_sheet(data);
      worksheet['!merges'] = selectedFields.length > 1 ? [{ s: { r: 0, c: 0 }, e: { r: 0, c: selectedFields.length - 1 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: selectedFields.length - 1 } }, { s: { r: 2, c: 0 }, e: { r: 2, c: selectedFields.length - 1 } }] : [];
      worksheet['!cols'] = selectedFields.map((field) => ({ wch: Math.max(14, Math.min(42, field.name.length + 10)) }));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Отчёт');
      XLSX.writeFile(workbook, `${safeFilename(title)}.xlsx`, { compression: true });
    } else {
      const body = groupedRows.map(([group, groupRows]) => `${groupBy ? `<h2>${escapeHtml(source.fields.find((field) => field.id === groupBy)?.name)}: ${escapeHtml(group)}</h2>` : ''}<table><thead><tr>${selectedFields.map((field) => `<th>${escapeHtml(field.name)}</th>`).join('')}</tr></thead><tbody>${groupRows.map((row) => `<tr>${selectedFields.map((field) => `<td>${escapeHtml(row[field.id])}</td>`).join('')}</tr>`).join('')}</tbody></table>`).join('');
      const content = `<html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;color:#17233d}h1{font-size:20pt}h2{margin-top:18px;font-size:13pt}p{color:#637089}table{border-collapse:collapse;width:100%;margin-bottom:16px}th,td{border:1px solid #b8c4d4;padding:7px;text-align:left}th{background:#edf3ff}</style></head><body><h1>${escapeHtml(title)}</h1><p>Источник: ${escapeHtml(source.name)} · Дата формирования: ${generated} · Строк: ${rows.length}</p>${body}</body></html>`;
      const link = document.createElement('a');
      const url = URL.createObjectURL(new Blob([`\ufeff${content}`], { type: 'application/msword;charset=utf-8' }));
      link.href = url; link.download = `${safeFilename(title)}.doc`; link.click(); URL.revokeObjectURL(url);
    }
    setNotice(format === 'excel' ? 'Отчёт выгружен в Excel.' : 'Отчёт выгружен в Word.');
  };

  return <main className="single-workspace reports-workspace">
    <div className="page-title-row report-page-heading"><div><h1>Конструктор отчётов</h1><p>Соберите отчёт из задач, документов, пользователей или любого справочника.</p></div><div className="report-heading-actions">{templates.length ? <label className="report-template-picker">Сохранённые шаблоны<select value={templateId} onChange={(event) => applyTemplate(event.target.value)}><option value="">Выбрать шаблон…</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label> : null}<button className="secondary-button" type="button" onClick={saveTemplate}>Сохранить шаблон</button></div></div>
    <section className="report-builder">
      <aside className="report-settings">
        <div className="report-step"><span>1</span><div><h2>Основа отчёта</h2><p>Название и источник данных</p></div></div>
        <label>Название отчёта<input value={reportName} onChange={(event) => setReportName(event.target.value)} placeholder="Например, Задачи за месяц"/></label>
        <label>Источник данных<select value={source.id} onChange={(event) => selectSource(event.target.value)}>{sources.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <div className="report-step report-step-spaced"><span>2</span><div><h2>Поля</h2><p>Колонки итоговой таблицы</p></div></div>
        <div className="report-field-heading"><strong>Выбрано: {selectedFieldIds.length}</strong><button type="button" onClick={() => setSelectedFieldIds(selectedFieldIds.length === source.fields.length ? [] : source.fields.map((field) => field.id))}>{selectedFieldIds.length === source.fields.length ? 'Снять все' : 'Выбрать все'}</button></div>
        <div className="report-fields">{source.fields.map((field) => <label key={field.id}><input type="checkbox" checked={selectedFieldIds.includes(field.id)} onChange={() => toggleField(field.id)}/><span>{field.name}</span><small>{field.type ?? 'текстовый'}</small></label>)}</div>
        <div className="report-step report-step-spaced"><span>3</span><div><h2>Условия</h2><p>Фильтры, группировка и порядок</p></div></div>
        <div className="report-filters">{filters.map((filter) => <div className="report-filter-row" key={filter.id}><select aria-label="Поле фильтра" value={filter.fieldId} onChange={(event) => updateFilter(filter.id, { fieldId: event.target.value })}>{source.fields.map((field) => <option key={field.id} value={field.id}>{field.name}</option>)}</select><select aria-label="Условие фильтра" value={filter.operator} onChange={(event) => updateFilter(filter.id, { operator: event.target.value })}>{operators.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{['empty', 'notEmpty'].includes(filter.operator) ? null : <input aria-label="Значение фильтра" value={filter.value} onChange={(event) => updateFilter(filter.id, { value: event.target.value })} placeholder="Значение"/>}<button type="button" aria-label="Удалить фильтр" title="Удалить фильтр" onClick={() => setFilters((current) => current.filter((item) => item.id !== filter.id))}>×</button></div>)}</div>
        <button className="report-add-filter" type="button" onClick={addFilter}>＋ Добавить фильтр</button>
        <div className="report-order-grid"><label>Группировать по<select value={groupBy} onChange={(event) => setGroupBy(event.target.value)}><option value="">Без группировки</option>{source.fields.map((field) => <option key={field.id} value={field.id}>{field.name}</option>)}</select></label><label>Сортировать по<select value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="">Без сортировки</option>{source.fields.map((field) => <option key={field.id} value={field.id}>{field.name}</option>)}</select></label>{sortBy ? <label>Порядок<select value={sortDirection} onChange={(event) => setSortDirection(event.target.value)}><option value="ascending">По возрастанию</option><option value="descending">По убыванию</option></select></label> : null}</div>
        <div className="report-actions"><button className="primary-button" type="button" onClick={() => exportReport('excel')}>В Excel</button><button className="secondary-button" type="button" onClick={() => exportReport('word')}>В Word</button></div>
        {notice ? <p className="report-notice" role="status">{notice}</p> : null}
      </aside>
      <section className="report-preview"><div className="report-preview-head"><div><h2>{reportName.trim() || 'Предпросмотр отчёта'}</h2><p>{source.name}</p></div><span>{rows.length} строк · {selectedFields.length} колонок</span></div>{selectedFields.length ? <div className="report-preview-table"><table><thead><tr>{selectedFields.map((field) => <th key={field.id}>{field.name}</th>)}</tr></thead><tbody>{groupedRows.flatMap(([group, groupRows]) => [groupBy ? <tr className="report-group-row" key={`group-${group}`}><td colSpan={selectedFields.length}>{source.fields.find((field) => field.id === groupBy)?.name}: <strong>{group}</strong> · {groupRows.length}</td></tr> : null, ...groupRows.slice(0, 12).map((row, index) => <tr key={`${group}-${row.id ?? row.code ?? index}`}>{selectedFields.map((field) => <td key={field.id}>{printableValue(row[field.id])}</td>)}</tr>)]).filter(Boolean)}</tbody></table></div> : <p className="report-empty">Выберите поля, которые должны войти в отчёт.</p>}<footer><span>Предпросмотр первых записей</span><strong>Найдено: {rows.length}</strong></footer></section>
    </section>
  </main>;
}
