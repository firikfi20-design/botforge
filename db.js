const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const db = new Database(path.join(dataDir, 'botforge.db'));

// Enable WAL for better performance
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emoji TEXT DEFAULT '🤖',
    name TEXT NOT NULL,
    cat TEXT NOT NULL,
    price TEXT,
    description TEXT,
    features TEXT DEFAULT '[]',
    duration TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    tier TEXT,
    price TEXT,
    period TEXT DEFAULT 'разово',
    description TEXT,
    features TEXT DEFAULT '[]',
    popular INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    contact TEXT,
    bot TEXT,
    message TEXT,
    tg_message_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ── Seed default data if empty ─────────────────────────────────
const botsCount = db.prepare('SELECT COUNT(*) as c FROM bots').get().c;
if (botsCount === 0) {
  const insertBot = db.prepare(`
    INSERT INTO bots (emoji, name, cat, price, description, features, duration)
    VALUES (@emoji, @name, @cat, @price, @description, @features, @duration)
  `);
  const defaultBots = [
    { emoji:'🛍', name:'Каталог товаров', cat:'sales', price:'от $150', description:'Полноценный магазин прямо в Telegram: карточки товаров, корзина, оплата через Payme/Click/Stripe.', features:JSON.stringify(['Каталог с фото и описанием','Корзина и оформление заказа','Оплата онлайн (Payme, Click)','Уведомления о заказе','Панель управления для владельца']), duration:'7–14 дней' },
    { emoji:'📅', name:'Запись на услуги', cat:'sales', price:'от $100', description:'Клиенты выбирают удобное время прямо в чате. Автоматические напоминания снижают процент неявок.', features:JSON.stringify(['Выбор даты и времени','Напоминания за 24 и 1 час','Подтверждение/отмена записи','Расписание для нескольких мастеров','Google-календарь интеграция']), duration:'5–10 дней' },
    { emoji:'📝', name:'Приём заказов', cat:'sales', price:'от $80', description:'Удобная форма заказа с выбором товаров/услуг. Менеджер мгновенно получает уведомление с деталями.', features:JSON.stringify(['Пошаговая форма заказа','Выбор позиций из меню/прайса','Мгновенное уведомление менеджеру','История заказов клиента','Статус заказа для клиента']), duration:'4–7 дней' },
    { emoji:'💬', name:'FAQ / Автоответы', cat:'support', price:'от $60', description:'Бот отвечает на типовые вопросы 24/7. Снижает нагрузку на менеджеров на 60–80%.', features:JSON.stringify(['База знаний из вопрос-ответов','Поиск по ключевым словам','Эскалация на менеджера','Статистика вопросов','Лёгкое обновление базы']), duration:'3–5 дней' },
    { emoji:'🎫', name:'Тикет-система', cat:'support', price:'от $150', description:'Клиент создаёт обращение, оно попадает в очередь к нужному специалисту.', features:JSON.stringify(['Создание и нумерация тикетов','Распределение по категориям','Назначение на оператора','Статусы: открыт, в работе, закрыт','Оценка качества обслуживания']), duration:'8–14 дней' },
    { emoji:'🤖', name:'AI-чатбот (GPT)', cat:'support', price:'от $300', description:'Умный бот на базе ChatGPT, обученный на материалах вашего бизнеса.', features:JSON.stringify(['Обучение на вашей базе знаний','Понимает свободную речь','Умеет брать заявки','Эскалация сложных вопросов','Ежемесячное обновление знаний']), duration:'10–20 дней' },
    { emoji:'🎁', name:'Реферальная программа', cat:'marketing', price:'от $120', description:'Клиенты приглашают друзей и получают бонусы. Вирусный рост базы без затрат на рекламу.', features:JSON.stringify(['Уникальные реф. ссылки','Подсчёт приглашений и бонусов','Вывод бонусов / скидки','Рейтинг лучших партнёров','Статистика конверсий']), duration:'6–10 дней' },
    { emoji:'📢', name:'Рассылки и акции', cat:'marketing', price:'от $80', description:'Отправляйте рекламные сообщения всей базе или сегментам.', features:JSON.stringify(['Сегментация по интересам','Отложенная рассылка','Кнопки и изображения','Статистика открытий','Отписка по желанию']), duration:'4–7 дней' },
    { emoji:'⭐', name:'Программа лояльности', cat:'marketing', price:'от $200', description:'Накопительные баллы, уровни, промокоды. Увеличивает повторные продажи.', features:JSON.stringify(['Начисление баллов за покупки','Уровни: бронза, серебро, золото','Промокоды и персональные скидки','История баллов','Аналитика удержания']), duration:'10–16 дней' },
    { emoji:'👥', name:'HR-бот', cat:'internal', price:'от $150', description:'Автоматизирует рутину HR: заявки на отпуск, опросы, онбординг сотрудников.', features:JSON.stringify(['Заявки на отпуск и больничный','Пульс-опросы команды','Онбординг с чек-листом','Справочник компании','Оповещения о событиях']), duration:'7–12 дней' },
    { emoji:'✅', name:'Задачи и отчёты', cat:'internal', price:'от $120', description:'Ставьте задачи прямо в Telegram, получайте ежедневные отчёты от команды.', features:JSON.stringify(['Постановка задач с дедлайном','Ежедневный отчёт в 18:00','Статусы выполнения','Напоминания об дедлайнах','Сводка для руководителя']), duration:'6–10 дней' },
    { emoji:'📊', name:'Опросы и голосования', cat:'internal', price:'от $60', description:'Проводите NPS-опросы клиентов и внутренние голосования команды.', features:JSON.stringify(['Конструктор анкет','Анонимные и именные ответы','Экспорт в Excel','NPS-расчёт','Автоматический повтор']), duration:'3–6 дней' },
  ];
  const insertMany = db.transaction((bots) => bots.forEach(b => insertBot.run(b)));
  insertMany(defaultBots);
}

const plansCount = db.prepare('SELECT COUNT(*) as c FROM plans').get().c;
if (plansCount === 0) {
  const insertPlan = db.prepare(`
    INSERT INTO plans (name, tier, price, period, description, features, popular, sort_order)
    VALUES (@name, @tier, @price, @period, @description, @features, @popular, @sort_order)
  `);
  [
    { name:'Старт', tier:'для малого бизнеса', price:'от $60', period:'разово', description:'Простой бот для базовых задач', features:JSON.stringify(['1 ключевая функция','Панель управления','30 дней поддержки','Хостинг $10/мес']), popular:0, sort_order:1 },
    { name:'Бизнес', tier:'самый популярный', price:'от $150', period:'разово', description:'Полноценный бот под задачи', features:JSON.stringify(['До 5 функций','Оплата / интеграции','Аналитика и статистика','60 дней поддержки','Бесплатный хостинг 3 мес']), popular:1, sort_order:2 },
    { name:'Про', tier:'для крупных проектов', price:'от $400', period:'разово', description:'Сложная логика, AI, интеграции', features:JSON.stringify(['Неограниченный функционал','AI / GPT интеграция','CRM, ERP интеграции','90 дней приоритетной поддержки','Бесплатный хостинг 6 мес','Доработки в приоритете']), popular:0, sort_order:3 },
  ].forEach(p => insertPlan.run(p));
}

// Seed settings
const defaultSettings = {
  info_name: 'Алишер Каримов',
  info_emoji: '👨‍💻',
  info_bio: 'Основатель BotForge. 5 лет в разработке, специализируюсь на Telegram-ботах и автоматизации бизнес-процессов. Работал с клиентами из Узбекистана, России и Казахстана.',
  info_bots: '50+',
  info_clients: '30+',
  info_years: '3',
  info_days: '7',
  contact_tg: '@botforge_uz',
  contact_tg_href: 'https://t.me/botforge_uz',
  contact_wa: '+998 90 000 00 00',
  contact_email: 'hello@botforge.uz',
  contact_footer: '© 2025 BotForge. Telegram-боты для бизнеса.',
};

const upsertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
const seedSettings = db.transaction(() => {
  for (const [k, v] of Object.entries(defaultSettings)) upsertSetting.run(k, v);
});
seedSettings();

module.exports = db;
