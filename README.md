# BotForge — Node.js Backend + Telegram Bot

Полноценный сайт с Node.js бэкендом, SQLite базой данных и интеграцией с Telegram-ботом.

## Структура проекта

```
botforge/
├── server.js          # Express сервер + Telegram бот
├── db.js              # SQLite база данных + seed данных
├── package.json
├── .env               # Токены и настройки
├── public/
│   └── index.html     # Фронтенд (одна страница)
└── data/
    └── botforge.db    # База данных (создаётся автоматически)
```

## Быстрый старт

### 1. Установить зависимости
```bash
cd botforge
npm install
```

### 2. Проверить .env файл
```env
TELEGRAM_BOT_TOKEN=8823222516:AAEhcBDEFNKq2JSZiALcsAHHvGQgqQyMrEo
TELEGRAM_ADMIN_ID=8946933185
ADMIN_PASSWORD=admin123
PORT=3000
```

### 3. Запустить сервер
```bash
npm start
```

Откройте: **http://localhost:3000**

---

## Что происходит когда клиент оставляет заявку

1. Клиент заполняет форму на сайте
2. Заявка сохраняется в SQLite (`leads` таблица)
3. Бот мгновенно отправляет уведомление в Telegram с кнопками:
   - ✅ Принято — отмечает заявку обработанной
   - 💬 Ответить — напоминание ответить клиенту
4. Заявка видна в **Админ панели → Заявки**

## Админ панель

Нажмите **"⚙ Админ"** в футере сайта.

**Пароль по умолчанию:** `admin123`

### Что можно делать:
- 🤖 **Боты** — добавлять/редактировать/удалять карточки ботов в каталоге
- 💰 **Тарифы** — изменять цены и описание тарифных планов
- 👤 **О нас** — менять имя, фото, описание, статистику
- 📞 **Контакты** — Telegram, WhatsApp, Email ссылки
- 📋 **Заявки** — все заявки с сайта (они же приходят в Telegram)
- 🔧 **Настройки** — смена пароля админ панели

## API эндпоинты

```
GET    /api/bots              — список ботов (публичный)
POST   /api/bots              — создать бота (только админ)
PUT    /api/bots/:id          — обновить бота (только админ)
DELETE /api/bots/:id          — удалить бота (только админ)

GET    /api/plans             — тарифы (публичный)
PUT    /api/plans             — обновить тарифы (только админ)

GET    /api/settings          — настройки сайта (публичный)
PUT    /api/settings          — обновить настройки (только админ)

GET    /api/leads             — заявки (только админ)
POST   /api/leads             — создать заявку (публичный — форма)
DELETE /api/leads             — очистить все заявки (только админ)
DELETE /api/leads/:id         — удалить заявку (только админ)

POST   /api/auth/login        — вход в админку
POST   /api/auth/change-password — смена пароля (только админ)
```

## Деплой на сервер (Ubuntu/VPS)

```bash
# Установить Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Клонировать/скопировать проект
cd /var/www
mkdir botforge && cd botforge
# скопируйте файлы...

npm install
npm start

# Для автозапуска — PM2
npm install -g pm2
pm2 start server.js --name botforge
pm2 startup
pm2 save
```

### Nginx конфиг (опционально)
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Telegram Bot команды

- `/start` — бот отвечает приветствием и показывает ваш ID

---

**Все данные хранятся в SQLite — файл `data/botforge.db`.**  
Делайте резервные копии этого файла!
