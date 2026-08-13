import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { db } from './db.js';
import { getSettings, runReminderBatch, startReminderScheduler } from './reminders.js';

const app = express();
const port = Number(process.env.PORT ?? 3333);
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true, service: 'byse-pro-reminder-bot' }));

app.post('/api/customers', (req, res) => {
  const { id, name, phone, whatsappOptIn = false, remindersEnabled = true } = req.body ?? {};
  if (!id || !name || !phone) return res.status(400).json({ error: 'id, name e phone são obrigatórios.' });
  db.prepare(`INSERT INTO customers (id, name, phone, whatsapp_opt_in, reminders_enabled) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name, phone=excluded.phone, whatsapp_opt_in=excluded.whatsapp_opt_in, reminders_enabled=excluded.reminders_enabled`)
    .run(id, name, phone, whatsappOptIn ? 1 : 0, remindersEnabled ? 1 : 0);
  res.json({ ok: true });
});

app.post('/api/purchases', (req, res) => {
  const { id, customerId, total, items, purchasedAt } = req.body ?? {};
  if (!id || !customerId || !Array.isArray(items)) return res.status(400).json({ error: 'id, customerId e items são obrigatórios.' });
  db.prepare(`INSERT OR REPLACE INTO purchases (id, customer_id, total, items_json, purchased_at) VALUES (?, ?, ?, ?, ?)`)
    .run(id, customerId, Number(total ?? 0), JSON.stringify(items), purchasedAt ?? new Date().toISOString());
  res.json({ ok: true });
});

app.get('/api/reminders/settings', (_req, res) => res.json(getSettings()));
app.put('/api/reminders/settings', (req, res) => {
  const { enabled, firstDay, secondDay, hour, minute, template } = req.body ?? {};
  db.prepare(`UPDATE reminder_settings SET enabled=?, first_day=?, second_day=?, hour=?, minute=?, template=? WHERE id=1`)
    .run(enabled ? 1 : 0, firstDay ?? 'tuesday', secondDay ?? 'friday', Number(hour ?? 10), Number(minute ?? 0), template ?? getSettings().template);
  res.json(getSettings());
});

app.get('/api/reminders/stats', (_req, res) => {
  const stats = db.prepare(`SELECT
    COUNT(*) as total,
    SUM(CASE WHEN status='sent' THEN 1 ELSE 0 END) as sent,
    SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed
    FROM reminder_logs`).get();
  res.json(stats);
});

app.post('/api/reminders/run-now', async (_req, res) => {
  res.json(await runReminderBatch());
});

app.listen(port, () => {
  console.log(`BYSE PRO reminder bot running on http://localhost:${port}`);
  startReminderScheduler();
});
