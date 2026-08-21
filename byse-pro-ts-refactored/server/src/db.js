import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customers (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) REFERENCES users(id),
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(50) NOT NULL,
      whatsapp_opt_in INT DEFAULT 0,
      reminders_enabled INT DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id VARCHAR(255) PRIMARY KEY,
      customer_id VARCHAR(255) REFERENCES customers(id),
      total NUMERIC NOT NULL,
      items_json TEXT NOT NULL,
      purchased_at TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reminder_logs (
      id SERIAL PRIMARY KEY,
      customer_id VARCHAR(255) REFERENCES customers(id),
      scheduled_date VARCHAR(50) NOT NULL,
      sent_at TIMESTAMP NOT NULL,
      status VARCHAR(50) NOT NULL,
      message TEXT,
      error TEXT,
      UNIQUE(customer_id, scheduled_date)
    );

    CREATE TABLE IF NOT EXISTS reminder_settings (
      id INT PRIMARY KEY CHECK (id = 1),
      enabled INT NOT NULL DEFAULT 1,
      first_day VARCHAR(20) NOT NULL DEFAULT 'tuesday',
      second_day VARCHAR(20) NOT NULL DEFAULT 'friday',
      third_day VARCHAR(20) NOT NULL DEFAULT 'saturday',
      hour INT NOT NULL DEFAULT 10,
      minute INT NOT NULL DEFAULT 0,
      template TEXT NOT NULL DEFAULT 'Oi {nome}! 👋\n\nPassando para lembrar da sua última compra: {produtos}.\n\nSe precisar de reposição ou quiser conferir novidades, fale conosco por aqui. 💬\n\nAté breve!'
    );

    INSERT INTO reminder_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
  `);
  console.log('✅ Banco de dados PostgreSQL inicializado!');
}