import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

const dataDir = path.resolve(process.env.DATA_DIR ?? './server/data');
fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(path.join(dataDir, 'byse-pro.sqlite'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  whatsapp_opt_in INTEGER NOT NULL DEFAULT 0,
  reminders_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  total REAL NOT NULL,
  items_json TEXT NOT NULL,
  purchased_at TEXT NOT NULL,
  FOREIGN KEY(customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS reminder_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id TEXT NOT NULL,
  scheduled_date TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  error TEXT,
  UNIQUE(customer_id, scheduled_date),
  FOREIGN KEY(customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS reminder_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled INTEGER NOT NULL DEFAULT 1,
  first_day TEXT NOT NULL DEFAULT 'tuesday',
  second_day TEXT NOT NULL DEFAULT 'friday',
  hour INTEGER NOT NULL DEFAULT 10,
  minute INTEGER NOT NULL DEFAULT 0,
  template TEXT NOT NULL DEFAULT 'Oi {nome}! 👋\n\nPassando para lembrar da sua última compra: {produtos}.\n\nSe precisar de reposição ou quiser conferir novidades, fale conosco por aqui. 💬\n\nAté breve!'
);

INSERT OR IGNORE INTO reminder_settings (id) VALUES (1);
`);