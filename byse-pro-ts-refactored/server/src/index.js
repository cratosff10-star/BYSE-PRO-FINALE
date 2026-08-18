import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from './db.js';
import { getSettings, runReminderBatch, startReminderScheduler } from './reminders.js';

const app = express();
const port = Number(process.env.PORT ?? 3333);
const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_aqui';

// Configuração do CORS e JSON
app.use(cors({ origin: 'http://localhost:5173' }));
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
  const token = authHeader && authHeader.split(' ')[1]; // Formato "Bearer <TOKEN>"

  if (!token) {
    return res.status(401).json({ message: 'Acesso negado. Token não fornecido.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Token inválido ou expirado.' });
    }
    req.userId = decoded.userId; // Salva o ID do usuário verificado na requisição
    next();
  });
}

// ==========================================
// 3. AUTENTICAÇÃO E USUÁRIOS
// ==========================================

// Criar / Cadastrar Novo Usuário
app.post('/api/users', async (req, res) => {
    try {
        const { nome, email, password } = req.body ?? {};

        if (!nome || !email || !password) {
            return res.status(400).json({ message: 'Nome, e-mail e senha são obrigatórios.' });
        }

        const cleanEmail = email.trim().toLowerCase();

        // 1. Verificar se o e-mail já existe
        const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
        if (existingUser) {
            return res.status(400).json({ message: 'Este e-mail já está cadastrado no sistema!' });
        }

        // 2. Criptografar a senha
        const passwordHash = await bcrypt.hash(password, 10);
        const userId = `usr_${Date.now()}`;

        // 3. Inserir no banco de dados SQLite (usando a hash da senha)
        db.prepare(`
            INSERT INTO users (id, name, email, password, created_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(userId, nome.trim(), cleanEmail, passwordHash, new Date().toISOString());

        return res.status(201).json({
            message: 'Usuário criado com sucesso!',
            user: { id: userId, name: nome.trim(), email: cleanEmail }
        });
    }
    catch (error) {
        console.error('Erro ao criar usuário:', error);
        return res.status(500).json({ message: 'Erro interno ao criar usuário.' });
    }
});

// Login de Usuário
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      return res.status(400).json({ message: 'E-mail e senha são obrigatórios.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Busca usuário no banco
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail);

    if (!user || !user.password) {
      return res.status(401).json({ message: 'E-mail ou senha incorretos.' });
    }

    // Compara a senha informada com a hash salva no banco
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'E-mail ou senha incorretos.' });
    }

    // 🔒 Gerando o token JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (error) {
    console.error('❌ ERRO DETALHADO NO LOGIN:', error);
    return res.status(500).json({ message: 'Erro interno ao processar login.', details: error.message });
  }
});

// ==========================================
// 4. GESTÃO DE CLIENTES & COMPRAS (PROTEGIDAS POR TOKEN)
// ==========================================

// Buscar clientes do usuário logado
app.get('/api/customers', authenticateToken, (req, res) => {
    try {
        const customers = db.prepare('SELECT * FROM customers WHERE user_id = ?').all(req.userId);
        res.json(customers);
    } catch (error) {
        console.error('Erro ao buscar clientes:', error);
        res.status(500).json({ message: 'Erro ao buscar clientes.' });
    }
});

// Criar / Atualizar Cliente (Vinculado ao usuário logado)
app.post('/api/customers', authenticateToken, (req, res) => {
    const { id, name, phone, whatsappOptIn = false, remindersEnabled = true } = req.body ?? {};
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
  `).run(id, req.userId, name, phone, whatsappOptIn ? 1 : 0, remindersEnabled ? 1 : 0);

    res.json({ ok: true });
});

// Buscar compras dos clientes do usuário logado
app.post('/api/purchases', authenticateToken, (req, res) => {
    const { id, customerId, total, items, purchasedAt } = req.body ?? {};
    if (!id || !customerId || !Array.isArray(items)) {
        return res.status(400).json({ error: 'id, customerId e items são obrigatórios.' });
    }

    // 🔒 Verifica se o cliente pertence ao usuário logado antes de salvar
    const customer = db.prepare('SELECT id FROM customers WHERE id = ? AND user_id = ?').get(customerId, req.userId);
    if (!customer) {
        return res.status(403).json({ error: 'Cliente não encontrado ou não pertence a este usuário.' });
    }

    db.prepare(`
        INSERT OR REPLACE INTO purchases (id, customer_id, total, items_json, purchased_at)
        VALUES (?, ?, ?, ?, ?)
    `).run(id, customerId, Number(total ?? 0), JSON.stringify(items), purchasedAt ?? new Date().toISOString());

    res.json({ ok: true });
});
// Registrar Compra
app.post('/api/purchases', authenticateToken, (req, res) => {
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
// 5. LEMBRETES E CASHBACK (CONFIGURAÇÕES)
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
// 6. INICIALIZAÇÃO DO SERVIDOR E SCHEDULER
// ==========================================
app.listen(port, () => {
    console.log(`BYSE PRO reminder bot running on http://localhost:${port}`);
    startReminderScheduler();
});