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
      user_id VARCHAR(255),
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(50) NOT NULL,
      whatsapp_opt_in INT DEFAULT 0,
      reminders_enabled INT DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255),
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
      user_id VARCHAR(255),
      name VARCHAR(255) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS whatsapp_schedules (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(255),
      schedule_index INT,
      days_of_week TEXT[],
      send_time TIME NOT NULL,
      message_template TEXT,
      send_to_all BOOLEAN DEFAULT TRUE,
      customer_ids TEXT[],
      enabled BOOLEAN DEFAULT FALSE
    );

    CREATE TABLE IF NOT EXISTS sales (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255),
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

    CREATE TABLE IF NOT EXISTS sellers (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255),
      name VARCHAR(255) NOT NULL,
      commission_pct NUMERIC DEFAULT 5,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS fiados (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255),
      customer_id VARCHAR(255),
      customer_name VARCHAR(255),
      products TEXT,
      origin VARCHAR(50) DEFAULT 'manual',
      installments JSONB DEFAULT '[]',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Garante a coluna products caso a tabela fiados já exista sem ela
    ALTER TABLE fiados ADD COLUMN IF NOT EXISTS products TEXT;
    ALTER TABLE fiados ADD COLUMN IF NOT EXISTS customer_id VARCHAR(255);
    ALTER TABLE fiados ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255);
    ALTER TABLE fiados ADD COLUMN IF NOT EXISTS origin VARCHAR(50) DEFAULT 'manual';
    ALTER TABLE fiados ADD COLUMN IF NOT EXISTS installments JSONB DEFAULT '[]';

    -- Remove restrições de chave estrangeira caso tenham sido criadas anteriormente
    ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_user_id_fkey;
    ALTER TABLE products DROP CONSTRAINT IF EXISTS products_user_id_fkey;
    ALTER TABLE stock_locations DROP CONSTRAINT IF EXISTS stock_locations_user_id_fkey;
    ALTER TABLE whatsapp_schedules DROP CONSTRAINT IF EXISTS whatsapp_schedules_user_id_fkey;
    ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_user_id_fkey;
    ALTER TABLE sellers DROP CONSTRAINT IF EXISTS sellers_user_id_fkey;
    ALTER TABLE fiados DROP CONSTRAINT IF EXISTS fiados_user_id_fkey;

    -- Garante a unicidade composta para o upsert das programações do WhatsApp por usuário
    ALTER TABLE whatsapp_schedules DROP CONSTRAINT IF EXISTS whatsapp_schedules_user_id_schedule_index_key;
    ALTER TABLE whatsapp_schedules ADD CONSTRAINT whatsapp_schedules_user_id_schedule_index_key UNIQUE (user_id, schedule_index);

    ALTER TABLE whatsapp_schedules ADD COLUMN IF NOT EXISTS send_to_all BOOLEAN DEFAULT TRUE;
    ALTER TABLE whatsapp_schedules ADD COLUMN IF NOT EXISTS customer_ids TEXT[];
    ALTER TABLE whatsapp_schedules ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT FALSE;
    ALTER TABLE whatsapp_schedules ADD COLUMN IF NOT EXISTS days_of_week TEXT[];
    ALTER TABLE whatsapp_schedules ADD COLUMN IF NOT EXISTS send_time TIME;
    ALTER TABLE whatsapp_schedules ADD COLUMN IF NOT EXISTS message_template TEXT;
  `);
  console.log('✅ Banco de dados PostgreSQL inicializado e atualizado com sucesso!');
}