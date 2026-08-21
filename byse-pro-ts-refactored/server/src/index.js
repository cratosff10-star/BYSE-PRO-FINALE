import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool, initDb } from './db.js';
import { getSettings, runReminderBatch, startReminderScheduler } from './reminders.js';

const app = express();
const port = Number(process.env.PORT ?? 3333);
const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_aqui';

// 1. Configuração do CORS
const corsOptions = {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
};

app.use(cors(corsOptions));
app.use(express.json());

// ==========================================
// 1. ROTA DE SAÚDE / HEALTHCHECK
// ==========================================
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'byse-pro-reminder-bot' });
});

// ==========================================
// 2. MIDDLEWARE DE AUTENTICAÇÃO
// ==========================================
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Acesso negado. Token não fornecido.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Token inválido ou expirado.' });
    }
    req.userId = decoded.userId || decoded.id;
    next();
  });
}

// ==========================================
// 3. AUTENTICAÇÃO E USUÁRIOS
// ==========================================

app.post('/api/users', async (req, res) => {
  try {
    const { nome, email, password } = req.body ?? {};

    if (!nome || !email || !password || typeof email !== 'string') {
      return res.status(400).json({ message: 'Nome, e-mail e senha são obrigatórios.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [cleanEmail]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: 'Este e-mail já está cadastrado no sistema!' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = `usr_${Date.now()}`;

    await pool.query(
      `INSERT INTO users (id, name, email, password, created_at) VALUES ($1, $2, $3, $4, $5)`,
      [userId, nome.trim(), cleanEmail, passwordHash, new Date().toISOString()]
    );

    return res.status(201).json({
      message: 'Usuário criado com sucesso!',
      user: { id: userId, name: nome.trim(), email: cleanEmail }
    });
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    return res.status(500).json({ message: 'Erro interno ao criar usuário.' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body ?? {};

    if (!email || !password || typeof email !== 'string') {
      return res.status(400).json({ message: 'E-mail e senha são obrigatórios.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [cleanEmail]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ message: 'E-mail ou senha incorretos.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'E-mail ou senha incorretos.' });
    }

    const token = jwt.sign(
      { id: user.id, userId: user.id, email: user.email },
      JWT_SECRET
    );

    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (error) {
    console.error('ERRO NO PROCESSO DE LOGIN:', error);
    return res.status(500).json({ message: 'Erro interno ao processar login.' });
  }
});

// ==========================================
// 4. GESTÃO DE DADOS ISOLADOS POR USUÁRIO (GET / POST)
// ==========================================

// Clientes (Vinculados estritamente ao user_id logado)
app.get('/api/customers', authenticateToken, async (req, res) => {
  try {
    const customers = await pool.query('SELECT * FROM customers WHERE user_id = $1', [req.userId]);[cite, 6]
    res.json(customers.rows);
  } catch (error) {
    console.error('Erro ao buscar clientes:', error);
    res.status(500).json({ message: 'Erro ao buscar clientes.' });
  }
});

app.post('/api/customers', authenticateToken, async (req, res) => {
  try {
    const { id, name, phone, whatsappOptIn = false, remindersEnabled = true } = req.body ?? {};
    if (!id || !name || !phone) {
      return res.status(400).json({ error: 'id, name e phone são obrigatórios.' });
    }

    await pool.query(
      `INSERT INTO customers (id, user_id, name, phone, whatsapp_opt_in, reminders_enabled)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         phone = EXCLUDED.phone,
         whatsapp_opt_in = EXCLUDED.whatsapp_opt_in,
         reminders_enabled = EXCLUDED.reminders_enabled`,
      [id, req.userId, name, phone, whatsappOptIn ? 1 : 0, remindersEnabled ? 1 : 0]
    );

    res.json({ ok: true });
  } catch (error) {
    console.error('Erro ao salvar cliente:', error);
    res.status(500).json({ message: 'Erro ao salvar cliente.' });
  }
});

// Compras / Vendas (Vinculadas ao cliente do respectivo usuário)
app.get('/api/purchases', authenticateToken, async (req, res) => {
  try {
    const purchases = await pool.query(`
      SELECT p.* FROM purchases p 
      JOIN customers c ON p.customer_id = c.id 
      WHERE c.user_id = $1
    `, [req.userId]);[cite, 6]
    res.json(purchases.rows);
  } catch (error) {
    console.error('Erro ao buscar compras:', error);
    res.status(500).json({ message: 'Erro ao buscar compras.' });
  }
});

app.post('/api/purchases', authenticateToken, async (req, res) => {
  try {
    const { id, customerId, total, items, purchasedAt } = req.body ?? {};
    if (!id || !customerId || !Array.isArray(items)) {
      return res.status(400).json({ error: 'id, customerId e items são obrigatórios.' });
    }

    // Valida se o cliente pertence de fato ao usuário autenticado
    const customer = await pool.query('SELECT id FROM customers WHERE id = $1 AND user_id = $2', [customerId, req.userId]);[cite, 6]
    if (customer.rows.length === 0) {
      return res.status(403).json({ error: 'Cliente não encontrado ou não pertence a este usuário.' });
    }

    await pool.query(
      `INSERT INTO purchases (id, customer_id, total, items_json, purchased_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         total = EXCLUDED.total,
         items_json = EXCLUDED.items_json,
         purchased_at = EXCLUDED.purchased_at`,
      [id, customerId, Number(total ?? 0), JSON.stringify(items), purchasedAt ?? new Date().toISOString()]
    );

    res.json({ ok: true });
  } catch (error) {
    console.error('Erro ao salvar compra:', error);
    res.status(500).json({ message: 'Erro ao salvar compra.' });
  }
});

// ==========================================
// 5. INICIALIZAÇÃO DO SERVIDOR
// ==========================================
app.listen(port, '0.0.0.0', async () => {
  await initDb();[cite, 6]
  console.log(`🚀 Servidor PostgreSQL rodando com sucesso na porta ${port}`);[cite, 6]
  startReminderScheduler();
});