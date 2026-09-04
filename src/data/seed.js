export const users = [
  { id: 'u1', name: 'Иванов И. И.', initials: 'ИИ', role: 'Администратор', department: 'Администрация', color: '#1c5cbf', login: 'admin', password: '123' },
  { id: 'u2', name: 'Смирнов А. П.', initials: 'СП', role: 'Руководитель', department: 'Проектный офис', color: '#c06b3e', login: 'smirnov', password: '123' },
  { id: 'u3', name: 'Петрова М. С.', initials: 'ПМ', role: 'Постановщик', department: 'Юридический отдел', color: '#8a4fb4', login: 'petrova', password: '123' },
  { id: 'u4', name: 'Кузнецов И. В.', initials: 'КИ', role: 'Исполнитель', department: 'ИТ-отдел', color: '#16856e', login: 'kuznetsov', password: '123' },
  { id: 'u5', name: 'Волкова О. Н.', initials: 'ВО', role: 'Наблюдатель', department: 'Финансовый отдел', color: '#b25173', login: 'volkova', password: '123' },
  { id: 'u-secretary', name: 'Секретарь', initials: 'С', role: 'Администратор', department: 'Администрация', color: '#5b6f96', login: 'secretary', password: '123' },
  { id: 'u-director', name: 'Директор', initials: 'Д', role: 'Постановщик', department: 'Руководители подразделений', color: '#1c5cbf', login: 'director', password: '123' },
  { id: 'u-security', name: 'Безопасность', initials: 'Б', role: 'Постановщик', department: 'Руководители подразделений', color: '#8a4fb4', login: 'security', password: '123' },
  { id: 'u-hrr', name: 'HRR', initials: 'HR', role: 'Постановщик', department: 'Руководители подразделений', color: '#16856e', login: 'hrr', password: '123' },
  { id: 'u-deputy-study', name: 'Завуч по учебной работе', initials: 'ЗУ', role: 'Постановщик', department: 'Руководители подразделений', color: '#c06b3e', login: 'deputy-study', password: '123' },
  { id: 'u-deputy-education', name: 'Завуч по воспитательной работе', initials: 'ЗВ', role: 'Постановщик', department: 'Руководители подразделений', color: '#b25173', login: 'deputy-education', password: '123' },
  { id: 'u-khimigol', name: 'Химиголь', initials: 'Х', role: 'Постановщик', department: 'Руководители подразделений', color: '#4d72a8', login: 'khimigol', password: '123' },
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
  'Сотрудники': [{ name: 'Иванов И. И.', code: '1', owner: 'Администрация' }, { name: 'Смирнов А. П.', code: '2', owner: 'Проектный офис' }, { name: 'Петрова М. С.', code: '3', owner: 'Юридический отдел' }, { name: 'Кузнецов И. В.', code: '4', owner: 'ИТ-отдел' }, { name: 'Волкова О. Н.', code: '5', owner: 'Финансовый отдел' }],
  'Подразделения': [{ name: 'Администрация', code: 'ADM', owner: 'Иванов И. И.' }, { name: 'Проектный офис', code: 'PMO', owner: 'Смирнов А. П.' }, { name: 'Юридический отдел', code: 'LAW', owner: 'Петрова М. С.' }, { name: 'ИТ-отдел', code: 'IT', owner: 'Кузнецов И. В.' }, { name: 'Финансовый отдел', code: 'FIN', owner: 'Волкова О. Н.' }, { name: 'Руководители подразделений', code: 'HEADS', owner: '' }],
  'Контрагенты': [
    { name: 'ООО «Альфа»', code: '1', inn: '7701234567', kpp: '770101001', bankDetails: 'ПАО «Банк», БИК 044525225, р/с 40702810000000000001', address: 'г. Москва, ул. Тверская, д. 1', responsibleLastName: 'Петров', phone: '+7 (495) 123-45-67', email: 'info@alfa.example', status: 'Действующий' },
    { name: 'АО «Север»', code: '2', inn: '7807654321', kpp: '780701001', bankDetails: 'АО «Банк», БИК 044525593, р/с 40702810100000000002', address: 'г. Санкт-Петербург, Невский проспект, д. 10', responsibleLastName: 'Соколова', phone: '+7 (812) 123-45-67', email: 'office@sever.example', status: 'Действующий' },
    { name: 'ООО «Вектор»', code: '3', inn: '6603109876', kpp: '660301001', bankDetails: 'ПАО «Банк», БИК 046577964, р/с 40702810200000000003', address: 'г. Екатеринбург, проспект Ленина, д. 25', responsibleLastName: 'Кузнецов', phone: '+7 (343) 123-45-67', email: 'contact@vector.example', status: 'На проверке' },
  ],
  'Роли и права': [{ name: 'Администратор', code: 'ADMIN', owner: 'Полный доступ' }, { name: 'Руководитель', code: 'MANAGER', owner: 'Работа с задачами и документами' }, { name: 'Специалист', code: 'SPECIALIST', owner: 'Исполнение задач' }],
  'Группировка документов': [{ name: 'Безопасность', code: '1' }, { name: 'Учебная работа', code: '2' }, { name: 'Воспитательная работа', code: '3' }, { name: 'Делопроизводство', code: '4' }],
};

export const seedDirectoryFields = {
  'Контрагенты': [
    { id: 'code', name: 'Код', type: 'числовой' },
    { id: 'name', name: 'Наименование', type: 'текстовый' },
    { id: 'inn', name: 'ИНН', type: 'текстовый' },
    { id: 'kpp', name: 'КПП', type: 'текстовый' },
    { id: 'bankDetails', name: 'Банковские реквизиты', type: 'текстовый' },
    { id: 'address', name: 'Адрес', type: 'текстовый' },
    { id: 'responsibleLastName', name: 'Фамилия ответственного лица', type: 'текстовый' },
    { id: 'phone', name: 'Телефон', type: 'телефон' },
    { id: 'email', name: 'Электронная почта', type: 'текстовый' },
    { id: 'status', name: 'Статус', type: 'текстовый' },
  ],
  'Группировка документов': [
    { id: 'code', name: 'Код', type: 'числовой' },
    { id: 'name', name: 'Наименование', type: 'текстовый' },
  ],
  'Сотрудники': [
    { id: 'code', name: 'Код', type: 'числовой' },
    { id: 'name', name: 'Фамилия', type: 'текстовый' },
    { id: 'firstName', name: 'Имя', type: 'текстовый' },
    { id: 'middleName', name: 'Отчество', type: 'текстовый' },
    { id: 'department', name: 'Подразделение', type: 'справочник', directory: 'Подразделения' },
  ],
};

export const seedDocuments = [
  { id: 'd1', title: 'Регламент работы с нормативной документацией', type: 'Регламент', number: 'РД-01/2026', status: 'Действует', updated: '2026-08-20', owner: 'Петрова М. С.' },
  { id: 'd2', title: 'Положение о порядке ведения справочников', type: 'Положение', number: 'ПД-14/2026', status: 'Действует', updated: '2026-07-15', owner: 'Иванов И. И.' },
  { id: 'd3', title: 'Инструкция по работе в СЭД', type: 'Инструкция', number: 'И-08/2026', status: 'На согласовании', updated: '2026-08-28', owner: 'Смирнов А. П.' },
  { id: 'd4', title: 'Политика информационной безопасности', type: 'Политика', number: 'П-02/2026', status: 'Требует пересмотра', updated: '2025-12-18', owner: 'Петрова М. С.' },
];
