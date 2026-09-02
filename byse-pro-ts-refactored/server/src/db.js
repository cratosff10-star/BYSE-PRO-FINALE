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
      cpf VARCHAR(50),
      data_aniversario DATE,
      cashback NUMERIC DEFAULT 0,
      status VARCHAR(100) DEFAULT 'Ativo',
      whatsapp_opt_in INT DEFAULT 0,
      reminders_enabled INT DEFAULT 1,
      status_mensalidade VARCHAR(100) DEFAULT 'Pendente (Não Pago)',
      data_vencimento DATE,
      valor_mensalidade NUMERIC DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE customers ADD COLUMN IF NOT EXISTS data_aniversario DATE;

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
      stocks JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE products ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS vip_price_3x NUMERIC;

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
      enabled BOOLEAN DEFAULT FALSE,
      CONSTRAINT unique_user_schedule UNIQUE (user_id, schedule_index)
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
    
    ALTER TABLE sellers ADD COLUMN IF NOT EXISTS commission_pct NUMERIC DEFAULT 5;

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

    CREATE TABLE IF NOT EXISTS pre_treino (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255),
      title VARCHAR(255) NOT NULL,
      description TEXT,
      exercises JSONB DEFAULT '[]',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS pre_treino_produtos (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255),
      name VARCHAR(255) NOT NULL,
      cost NUMERIC DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS pre_treino_registros (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255),
      customer_id VARCHAR(255),
      nome_cliente VARCHAR(255),
      produto_id VARCHAR(255),
      nome_produto VARCHAR(255),
      custo NUMERIC DEFAULT 0,
      data VARCHAR(50),
      horario VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('✅ Banco de dados PostgreSQL inicializado e atualizado com sucesso!');
}
