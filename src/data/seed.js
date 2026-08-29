export const users = [
  { id: 'u1', name: 'Иванов И. И.', initials: 'ИИ', role: 'Администратор', department: 'Администрация', color: '#1c5cbf', login: 'admin', password: 'admin123' },
  { id: 'u2', name: 'Смирнов А. П.', initials: 'СП', role: 'Руководитель', department: 'Проектный офис', color: '#c06b3e', login: 'smirnov', password: 'project123' },
  { id: 'u3', name: 'Петрова М. С.', initials: 'ПМ', role: 'Постановщик', department: 'Юридический отдел', color: '#8a4fb4', login: 'petrova', password: 'user123' },
  { id: 'u4', name: 'Кузнецов И. В.', initials: 'КИ', role: 'Исполнитель', department: 'ИТ-отдел', color: '#16856e', login: 'kuznetsov', password: 'user123' },
  { id: 'u5', name: 'Волкова О. Н.', initials: 'ВО', role: 'Наблюдатель', department: 'Финансовый отдел', color: '#b25173', login: 'volkova', password: 'user123' },
];

export const seedTasks = [
  { id: 't1', title: 'Подготовить отчёт по внедрению СЭД', status: 'В работе', priority: 'Высокий', ownerId: 'u2', dueDate: '2026-09-15', dueTime: '17:30', description: 'Подготовить итоговый отчёт по внедрению СЭД за III квартал 2026 года.', progress: 60, documents: ['План внедрения СЭД.docx', 'Показатели по внедрению.xlsx', 'Регламент подготовки отчётов.pdf'], checklist: [{ text: 'Собрать исходные данные', done: true }, { text: 'Проанализировать показатели', done: true }, { text: 'Подготовить черновик отчёта', done: true }, { text: 'Согласовать отчёт', done: false }, { text: 'Утвердить и опубликовать', done: false }] },
  { id: 't2', title: 'Согласовать регламент работы с данными', status: 'Утверждение', priority: 'Обычный', ownerId: 'u3', dueDate: '2026-09-16', dueTime: '12:00', description: 'Проверить замечания подразделений и подготовить финальную редакцию.', progress: 35, documents: ['Регламент работы с данными.docx'], checklist: [] },
  { id: 't3', title: 'Обновить справочник контрагентов', status: 'Завершено', priority: 'Обычный', ownerId: 'u4', dueDate: '2026-09-08', dueTime: '18:00', description: 'Актуализировать реквизиты и статусы контрагентов.', progress: 100, documents: [], checklist: [] },
  { id: 't4', title: 'Провести обучение пользователей', status: 'В работе', priority: 'Обычный', ownerId: 'u5', dueDate: '2026-09-20', dueTime: '15:00', description: 'Подготовить программу и провести две сессии обучения.', progress: 45, documents: ['Программа обучения.pdf'], checklist: [] },
  { id: 't5', title: 'Проверить актуальность нормативных документов', status: 'Просрочено', priority: 'Высокий', ownerId: 'u2', dueDate: '2026-08-30', dueTime: '10:00', description: 'Провести ревизию документов с истекающим сроком действия.', progress: 20, documents: [], checklist: [] },
  { id: 't6', title: 'Подготовить план аудита процессов', status: 'В работе', priority: 'Высокий', ownerId: 'u1', dueDate: '2026-09-18', dueTime: '16:30', description: 'Сформировать план аудита с ответственными и сроками.', progress: 55, documents: ['План аудита.xlsx'], checklist: [] },
  { id: 't7', title: 'Разработать инструкцию по работе в системе', status: 'Утверждение', priority: 'Обычный', ownerId: 'u3', dueDate: '2026-09-22', dueTime: '14:00', description: 'Описать основные пользовательские сценарии.', progress: 75, documents: ['Инструкция пользователя.docx'], checklist: [] },
  { id: 't8', title: 'Сформировать отчёт по задачам за месяц', status: 'Завершено', priority: 'Обычный', ownerId: 'u4', dueDate: '2026-09-05', dueTime: '17:00', description: 'Сформировать сводные показатели выполнения задач.', progress: 100, documents: [], checklist: [] },
];

export const seedDirectories = {
  'Подразделения': [{ name: 'Администрация', code: 'ADM', owner: 'Иванов И. И.' }, { name: 'Отдел цифровизации', code: 'DCG', owner: 'Смирнов А. П.' }, { name: 'Юридический отдел', code: 'LAW', owner: 'Петрова М. С.' }],
  'Контрагенты': [{ name: 'ООО «Альфа»', code: '7701234567', owner: 'Действующий' }, { name: 'АО «Север»', code: '7807654321', owner: 'Действующий' }, { name: 'ООО «Вектор»', code: '6603109876', owner: 'На проверке' }],
  'Роли и права': [{ name: 'Администратор', code: 'ADMIN', owner: 'Полный доступ' }, { name: 'Руководитель', code: 'MANAGER', owner: 'Работа с задачами и документами' }, { name: 'Специалист', code: 'SPECIALIST', owner: 'Исполнение задач' }],
};

export const seedDocuments = [
  { id: 'd1', title: 'Регламент работы с нормативной документацией', type: 'Регламент', number: 'РД-01/2026', status: 'Действует', updated: '2026-08-20', owner: 'Петрова М. С.' },
  { id: 'd2', title: 'Положение о порядке ведения справочников', type: 'Положение', number: 'ПД-14/2026', status: 'Действует', updated: '2026-07-15', owner: 'Иванов И. И.' },
  { id: 'd3', title: 'Инструкция по работе в СЭД', type: 'Инструкция', number: 'И-08/2026', status: 'На согласовании', updated: '2026-08-28', owner: 'Смирнов А. П.' },
  { id: 'd4', title: 'Политика информационной безопасности', type: 'Политика', number: 'П-02/2026', status: 'Требует пересмотра', updated: '2025-12-18', owner: 'Петрова М. С.' },
];
