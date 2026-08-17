import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import { db } from './db.js';
import { getSettings, runReminderBatch, startReminderScheduler } from './reminders.js';

interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  created_at: string;
}

const app = express();
const port = Number(process.env.PORT ?? 3333);

app.use(cors());
app.use(express.json());

// ==========================================
// 1. ROTA DE SAÚDE / HEALTHCHECK
// ==========================================
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'byse-pro-reminder-bot' });
});

// ==========================================
// 2. AUTENTICAÇÃO E USUÁRIOS
// ==========================================

// Criar / Cadastrar Novo Usuário (Admin/Lojista)
app.post('/api/users', async (req, res) => {
  try {
    const { nome, email, password } = req.body ?? {};

    if (!nome || !email || !password) {
      return res.status(400).json({ message: 'Nome, e-mail e senha são obrigatórios.' });
    }

    // 1. Verificar se o e-mail já existe
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(400).json({ message: 'Este e-mail já está cadastrado no sistema!' });
    }

    // 2. Criptografar a senha
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = `usr_${Date.now()}`;

    // 3. Inserir no banco de dados SQLite
    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, nome, email, passwordHash, new Date().toISOString());

    return res.status(201).json({
      message: 'Usuário criado com sucesso!',
      user: { id: userId, nome, email }
    });
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    return res.status(500).json({ message: 'Erro interno ao criar usuário.' });
  }
});

// Login de Usuário
// Login de Usuário
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      return res.status(400).json({ message: 'E-mail e senha são obrigatórios.' });
    }

    // 1. Buscar usuário informando o tipo genérico <UserRow> ou fazendo 'as UserRow | undefined'
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;

    if (!user) {
      return res.status(401).json({ message: 'E-mail ou senha incorretos.' });
    }

    // 2. Agora o TypeScript reconhece user.password_hash normalmente!
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ message: 'E-mail ou senha incorretos.' });
    }

    return res.json({
      ok: true,
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (error) {
    console.error('Erro no login:', error);
    return res.status(500).json({ message: 'Erro interno ao processar login.' });
  }
});
// ==========================================
// 3. GESTÃO DE CLIENTES & COMPRAS
// ==========================================

app.post('/api/customers', (req, res) => {
  const { id, userId, name, phone, whatsappOptIn = false, remindersEnabled = true } = req.body ?? {};
  
  if (!id || !name || !phone) {
    return res.status(400).json({ error: 'id, name e phone são obrigatórios.' });
  }

  db.prepare(`
    INSERT INTO customers (id, user_id, name, phone, whatsapp_opt_in, reminders_enabled)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      phone = excluded.phone,
      whatsapp_opt_in = excluded.whatsapp_opt_in,
      reminders_enabled = excluded.reminders_enabled
  `).run(id, userId ?? null, name, phone, whatsappOptIn ? 1 : 0, remindersEnabled ? 1 : 0);

  res.json({ ok: true });
});

app.post('/api/purchases', (req, res) => {
  const { id, customerId, total, items, purchasedAt } = req.body ?? {};
  
  if (!id || !customerId || !Array.isArray(items)) {
    return res.status(400).json({ error: 'id, customerId e items são obrigatórios.' });
  }

  db.prepare(`
    INSERT OR REPLACE INTO purchases (id, customer_id, total, items_json, purchased_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, customerId, Number(total ?? 0), JSON.stringify(items), purchasedAt ?? new Date().toISOString());

  res.json({ ok: true });
});

// ==========================================
// 4. LEMBRETES E CASHBACK (3 DIAS PROGRAMADOS)
// ==========================================

app.get('/api/reminders/settings', (_req, res) => res.json(getSettings()));

app.put('/api/reminders/settings', (req, res) => {
  const { enabled, firstDay, secondDay, thirdDay, hour, minute, template } = req.body ?? {};

  db.prepare(`
    UPDATE reminder_settings 
    SET enabled=?, first_day=?, second_day=?, third_day=?, hour=?, minute=?, template=? 
    WHERE id=1
  `).run(
    enabled ? 1 : 0,
    firstDay ?? 'tuesday',
    secondDay ?? 'thursday',
    thirdDay ?? 'saturday',
    Number(hour ?? 10),
    Number(minute ?? 0),
    template ?? getSettings().template
  );

  res.json(getSettings());
});

app.get('/api/reminders/stats', (_req, res) => {
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status='sent' THEN 1 ELSE 0 END) as sent,
      SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed
    FROM reminder_logs
  `).get();
  
  res.json(stats);
});

app.post('/api/reminders/run-now', async (_req, res) => {
  res.json(await runReminderBatch());
});

// ==========================================
// 5. INICIALIZAÇÃO DO SERVIDOR E SCHEDULER
// ==========================================
app.listen(port, () => {
  console.log(`BYSE PRO reminder bot running on http://localhost:${port}`);
  startReminderScheduler();
});

//REGISTRO USUÁRIO

app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'E-mail e senha são obrigatórios.' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    db.run(
      `INSERT INTO users (email, password) VALUES (?, ?)`,
      [email, passwordHash],
      function (err) {
        if (err) {
          return res.status(400).json({ message: 'E-mail já cadastrado.' });
        }
        return res.status(201).json({ message: 'Usuário cadastrado com sucesso!' });
      }
    );
  } catch (error) {
    return res.status(500).json({ message: 'Erro interno no servidor.' });
  }
});