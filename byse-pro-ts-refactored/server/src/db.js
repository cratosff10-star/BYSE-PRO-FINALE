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
      whatsapp_api_url TEXT,
      whatsapp_api_key TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_api_url TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_api_key TEXT;

    CREATE TABLE IF NOT EXISTS customers (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) REFERENCES users(id),
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(50) NOT NULL,
      whatsapp_opt_in INT DEFAULT 0,
      reminders_enabled INT DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) REFERENCES users(id),
      name VARCHAR(255) NOT NULL,
      category VARCHAR(255),
      barcode VARCHAR(255),
      code VARCHAR(255),
      cost NUMERIC DEFAULT 0,
      price NUMERIC DEFAULT 0,
      imposto NUMERIC DEFAULT 0,
      frete NUMERIC DEFAULT 0,
      vip_price NUMERIC,
      vip_price_3x NUMERIC,
      description TEXT,
      control_stock BOOLEAN DEFAULT TRUE,
      image_url TEXT,
      stocks JSONB DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS stock_locations (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) REFERENCES users(id),
      name VARCHAR(255) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS whatsapp_schedules (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(255) REFERENCES users(id),
      schedule_index INT CHECK (schedule_index BETWEEN 1 AND 3),
      days_of_week TEXT[],
      send_time TIME NOT NULL,
      message_template TEXT,
      send_to_all BOOLEAN DEFAULT TRUE,
      customer_ids TEXT[],
      enabled BOOLEAN DEFAULT FALSE,
      UNIQUE(user_id, schedule_index)
    );

    -- ADIÇÃO DA TABELA DE VENDAS
    CREATE TABLE IF NOT EXISTS sales (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) REFERENCES users(id),
      customer_id VARCHAR(255),
      customer_name VARCHAR(255),
      seller VARCHAR(255),
      payment_method VARCHAR(100),
      discount NUMERIC DEFAULT 0,
      subtotal NUMERIC DEFAULT 0,
      total NUMERIC DEFAULT 0,
      gender VARCHAR(50),
      sales_channel VARCHAR(100),
      delivery_type VARCHAR(100),
      items JSONB DEFAULT '[]',
      date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Garante que colunas de whatsapp_schedules existam caso a tabela já tenha sido criada antes
    ALTER TABLE whatsapp_schedules ADD COLUMN IF NOT EXISTS send_to_all BOOLEAN DEFAULT TRUE;
    ALTER TABLE whatsapp_schedules ADD COLUMN IF NOT EXISTS customer_ids TEXT[];
    ALTER TABLE whatsapp_schedules ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT FALSE;
    ALTER TABLE whatsapp_schedules ADD COLUMN IF NOT EXISTS days_of_week TEXT[];
    ALTER TABLE whatsapp_schedules ADD COLUMN IF NOT EXISTS send_time TIME;
    ALTER TABLE whatsapp_schedules ADD COLUMN IF NOT EXISTS message_template TEXT;
  `);
  console.log('✅ Banco de dados PostgreSQL inicializado e atualizado com sucesso!');
}