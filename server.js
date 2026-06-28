require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_ID = process.env.TELEGRAM_ADMIN_ID;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// ── Telegram Bot ───────────────────────────────────────────────
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

bot.on('message', (msg) => {
  if (msg.text === '/start') {
    bot.sendMessage(msg.chat.id,
      '👋 Привет! Я бот BotForge.\n\n' +
      'Когда кто-то оставит заявку на сайте — я сразу пришлю её сюда.\n\n' +
      `🆔 Ваш ID: \`${msg.chat.id}\``,
      { parse_mode: 'Markdown' }
    );
  }
});

async function notifyAdmin(lead) {
  if (!ADMIN_ID) return;
  const time = new Date(lead.created_at).toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent' });
  const text =
    `🔔 *Новая заявка с сайта!*\n\n` +
    `👤 *Имя:* ${lead.name || '—'}\n` +
    `📱 *Контакт:* ${lead.contact || '—'}\n` +
    `🤖 *Бот:* ${lead.bot || '—'}\n` +
    `💬 *Сообщение:* ${lead.message || '—'}\n\n` +
    `🕐 ${time}`;
  try {
    const sent = await bot.sendMessage(ADMIN_ID, text, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ Принято', callback_data: `ack_${lead.id}` },
          { text: '💬 Ответить', callback_data: `reply_${lead.id}` },
        ]]
      }
    });
    // Save Telegram message ID for reference
    db.prepare('UPDATE leads SET tg_message_id = ? WHERE id = ?').run(sent.message_id, lead.id);
  } catch (e) {
    console.error('Telegram send error:', e.message);
  }
}

bot.on('callback_query', (query) => {
  const data = query.data;
  if (data.startsWith('ack_')) {
    const id = data.replace('ack_', '');
    bot.answerCallbackQuery(query.id, { text: '✅ Отмечено!' });
    bot.editMessageReplyMarkup(
      { inline_keyboard: [[{ text: '✅ Заявка обработана', callback_data: 'done' }]] },
      { chat_id: query.message.chat.id, message_id: query.message.message_id }
    );
  }
  if (data.startsWith('reply_')) {
    bot.answerCallbackQuery(query.id, { text: 'Напишите ответ клиенту вручную' });
  }
});

// ── Middleware ─────────────────────────────────────────────────
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Auth middleware for admin ──────────────────────────────────
function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'];
  // Store custom passwords in settings
  const storedPwd = db.prepare("SELECT value FROM settings WHERE key='admin_password'").get();
  const currentPwd = storedPwd ? storedPwd.value : ADMIN_PASSWORD;
  if (token !== currentPwd) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// ── API: Auth ──────────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { password } = req.body;
  const storedPwd = db.prepare("SELECT value FROM settings WHERE key='admin_password'").get();
  const currentPwd = storedPwd ? storedPwd.value : ADMIN_PASSWORD;
  if (password === currentPwd) {
    res.json({ success: true, token: currentPwd });
  } else {
    res.status(401).json({ success: false, error: 'Неверный пароль' });
  }
});

// ── API: Bots ──────────────────────────────────────────────────
app.get('/api/bots', (req, res) => {
  const bots = db.prepare('SELECT * FROM bots ORDER BY id').all();
  res.json(bots.map(b => ({ ...b, features: JSON.parse(b.features || '[]') })));
});

app.post('/api/bots', adminAuth, (req, res) => {
  const { emoji, name, cat, price, description, features, duration } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const result = db.prepare(
    'INSERT INTO bots (emoji, name, cat, price, description, features, duration) VALUES (?,?,?,?,?,?,?)'
  ).run(emoji || '🤖', name, cat, price, description, JSON.stringify(features || []), duration);
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/bots/:id', adminAuth, (req, res) => {
  const { emoji, name, cat, price, description, features, duration } = req.body;
  db.prepare(
    'UPDATE bots SET emoji=?, name=?, cat=?, price=?, description=?, features=?, duration=? WHERE id=?'
  ).run(emoji, name, cat, price, description, JSON.stringify(features || []), duration, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/bots/:id', adminAuth, (req, res) => {
  db.prepare('DELETE FROM bots WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── API: Plans ─────────────────────────────────────────────────
app.get('/api/plans', (req, res) => {
  const plans = db.prepare('SELECT * FROM plans ORDER BY sort_order').all();
  res.json(plans.map(p => ({ ...p, features: JSON.parse(p.features || '[]'), popular: !!p.popular })));
});

app.put('/api/plans', adminAuth, (req, res) => {
  const plans = req.body;
  const update = db.prepare(
    'UPDATE plans SET name=?, tier=?, price=?, period=?, description=?, features=?, popular=? WHERE id=?'
  );
  const tx = db.transaction(() => plans.forEach(p =>
    update.run(p.name, p.tier, p.price, p.period, p.description, JSON.stringify(p.features || []), p.popular ? 1 : 0, p.id)
  ));
  tx();
  res.json({ ok: true });
});

// ── API: Settings (info + contacts) ───────────────────────────
app.get('/api/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = {};
  rows.forEach(r => out[r.key] = r.value);
  res.json(out);
});

app.put('/api/settings', adminAuth, (req, res) => {
  const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  const tx = db.transaction(() => {
    for (const [k, v] of Object.entries(req.body)) upsert.run(k, String(v));
  });
  tx();
  res.json({ ok: true });
});

// ── API: Leads ─────────────────────────────────────────────────
app.get('/api/leads', adminAuth, (req, res) => {
  const leads = db.prepare('SELECT * FROM leads ORDER BY id DESC').all();
  res.json(leads);
});

app.post('/api/leads', async (req, res) => {
  const { name, contact, bot, message } = req.body;
  if (!name && !contact) return res.status(400).json({ error: 'name or contact required' });
  const result = db.prepare(
    'INSERT INTO leads (name, contact, bot, message) VALUES (?,?,?,?)'
  ).run(name || '', contact || '', bot || '', message || '');
  const lead = db.prepare('SELECT * FROM leads WHERE id=?').get(result.lastInsertRowid);
  // Send to Telegram asynchronously
  notifyAdmin(lead).catch(console.error);
  res.json({ ok: true, id: result.lastInsertRowid });
});

app.delete('/api/leads', adminAuth, (req, res) => {
  db.prepare('DELETE FROM leads').run();
  res.json({ ok: true });
});

app.delete('/api/leads/:id', adminAuth, (req, res) => {
  db.prepare('DELETE FROM leads WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── API: Change password ───────────────────────────────────────
app.post('/api/auth/change-password', adminAuth, (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 4) return res.status(400).json({ error: 'Слишком короткий пароль' });
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('admin_password', ?)").run(newPassword);
  res.json({ ok: true, newToken: newPassword });
});

// ── Serve SPA ──────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 BotForge сервер запущен на http://localhost:${PORT}`);
  console.log(`🤖 Telegram бот запущен`);
  console.log(`👤 Заявки будут приходить в Telegram ID: ${ADMIN_ID}\n`);
});
