import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { pool, initDb } from './db.js';

const app = express();

app.use(express.json());
app.use(cors());

// Inicializa o banco de dados PostgreSQL ao iniciar o servidor[cite: 5]
initDb();

/**
 * Rota de Login para autenticação do front-end
 */
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const result = await pool.query(
            'SELECT id, name, email FROM users WHERE email = $1 AND password = $2',
            [email, password]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
        }

        const user = result.rows[0];
        return res.status(200).json({
            token: 'jwt_token_' + user.id,
            user: { id: user.id, name: user.name, email: user.email }
        });
    } catch (error) {
        console.error('Erro no login:', error);
        return res.status(500).json({ error: 'Erro interno no servidor.' });
    }
});

// Middleware de Autenticação[cite: 5]
const authMiddleware = (req, res, next) => {
    const userId = req.headers['x-user-id'];

    if (!userId) {
        return res.status(401).json({ error: 'Usuário não autenticado.' });
    }

    req.user = { id: userId };
    next();
};

/**
 * Rotas de Configuração da API de WhatsApp do Usuário[cite: 5]
 */
app.get('/api/user/whatsapp-config', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT whatsapp_api_url, whatsapp_api_key FROM users WHERE id = $1',
            [req.user.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }
        const user = result.rows[0];
        return res.status(200).json({
            apiUrl: user.whatsapp_api_url || '',
            apiKey: user.whatsapp_api_key || ''
        });
    } catch (error) {
        console.error('Erro ao buscar config do WhatsApp:', error);
        return res.status(500).json({ error: 'Erro interno no servidor.' });
    }
});

app.post('/api/user/whatsapp-config', authMiddleware, async (req, res) => {
    try {
        const { apiUrl, apiKey } = req.body;
        await pool.query(
            'UPDATE users SET whatsapp_api_url = $1, whatsapp_api_key = $2 WHERE id = $3',
            [apiUrl || '', apiKey || '', req.user.id]
        );
        return res.status(200).json({ message: 'Configurações salvas com sucesso!' });
    } catch (error) {
        console.error('Erro ao salvar config do WhatsApp:', error);
        return res.status(500).json({ error: 'Erro interno no servidor.' });
    }
});

/**
 * Rotas de Clientes (Compatibilidade com /api/customers e /api/clientes)[cite: 5]
 */
app.get('/api/customers', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await pool.query(
            'SELECT id, name, phone, whatsapp_opt_in as "whatsappOptIn", reminders_enabled as "remindersEnabled" FROM customers WHERE user_id = $1',
            [userId]
        );
        return res.status(200).json(result.rows);
    } catch (error) {
        console.error('Erro ao listar clientes:', error);
        return res.status(500).json({ error: 'Erro interno no servidor.' });
    }
});

app.post('/api/customers', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id, name, phone } = req.body;
        const clienteId = id || 'c' + Date.now();
        
        await pool.query(
            `INSERT INTO customers (id, user_id, name, phone) 
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (id) DO UPDATE SET name = $3, phone = $4`,
            [clienteId, userId, name, phone || '']
        );

        const clienteData = { id: clienteId, userId, name, phone: phone || '' };
        return res.status(201).json({ message: 'Cliente salvo', cliente: clienteData });
    } catch (error) {
        console.error('Erro ao salvar cliente:', error);
        return res.status(500).json({ error: 'Erro interno' });
    }
});

app.get('/api/clientes', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await pool.query(
            'SELECT id, name, phone, whatsapp_opt_in as "whatsappOptIn", reminders_enabled as "remindersEnabled" FROM customers WHERE user_id = $1',
            [userId]
        );
        return res.status(200).json(result.rows);
    } catch (error) {
        console.error('Erro ao listar clientes:', error);
        return res.status(500).json({ error: 'Erro interno no servidor.' });
    }
});

app.post('/api/clientes', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id, name, phone } = req.body;
        const clienteId = id || 'c' + Date.now();
        
        await pool.query(
            `INSERT INTO customers (id, user_id, name, phone) 
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (id) DO UPDATE SET name = $3, phone = $4`,
            [clienteId, userId, name, phone || '']
        );

        const clienteData = { id: clienteId, userId, name, phone: phone || '' };
        return res.status(201).json({ message: 'Cliente salvo', cliente: clienteData });
    } catch (error) {
        console.error('Erro ao salvar cliente:', error);
        return res.status(500).json({ error: 'Erro interno' });
    }
});

/**
 * Rotas de Produtos e Estoque[cite: 5]
 */
app.get('/api/produtos', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await pool.query(
            'SELECT * FROM products WHERE user_id = $1',
            [userId]
        ).catch(() => ({ rows: [] }));
        
        const produtosFormatados = result.rows.map(p => ({
            ...p,
            controlStock: p.control_stock,
            vipPrice: p.vip_price,
            vipPrice3x: p.vip_price_3x,
            imageUrl: p.image_url,
            stocks: typeof p.stocks === 'string' ? JSON.parse(p.stocks || '{}') : (p.stocks || {})
        }));

        return res.status(200).json(produtosFormatados);
    } catch (error) {
        console.error('Erro ao buscar produtos:', error);
        return res.status(200).json([]);
    }
});

app.post('/api/produtos', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const p = req.body;
        const prodId = p.id || 'p' + Date.now();

        await pool.query(`
            INSERT INTO products (id, user_id, name, category, barcode, code, cost, price, imposto, frete, vip_price, vip_price_3x, description, control_stock, image_url, stocks)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            ON CONFLICT (id) DO UPDATE SET
                name = $3, category = $4, barcode = $5, code = $6, cost = $7, price = $8,
                imposto = $9, frete = $10, vip_price = $11, vip_price_3x = $12, description = $13,
                control_stock = $14, image_url = $15, stocks = $16
        `, [
            prodId, userId, p.name, p.category, p.barcode, p.code, 
            p.cost || 0, p.price || 0, p.imposto || 0, p.frete || 0, 
            p.vipPrice || null, p.vipPrice3x || null, p.description || '', 
            p.controlStock !== false, p.imageUrl || null, JSON.stringify(p.stocks || {})
        ]);

        return res.status(201).json({ message: 'Produto salvo com sucesso', produto: p });
    } catch (error) {
        console.error('Erro ao salvar produto:', error);
        return res.status(500).json({ error: 'Erro interno ao salvar produto' });
    }
});

app.delete('/api/produtos/:id', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const prodId = req.params.id;
        await pool.query('DELETE FROM products WHERE id = $1 AND user_id = $2', [prodId, userId]);
        return res.status(200).json({ message: 'Produto removido com sucesso' });
    } catch (error) {
        console.error('Erro ao remover produto:', error);
        return res.status(500).json({ error: 'Erro interno ao remover produto' });
    }
});

app.get('/api/locais', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await pool.query(
            'SELECT id, name FROM stock_locations WHERE user_id = $1',
            [userId]
        ).catch(() => ({ rows: [] }));

        if (result.rows.length === 0) {
            const defaultLocId = 'loc_main_' + userId;
            await pool.query(
                'INSERT INTO stock_locations (id, user_id, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
                [defaultLocId, userId, 'Estoque Principal']
            ).catch(() => {});
            return res.status(200).json([{ id: defaultLocId, name: 'Estoque Principal' }]);
        }

        return res.status(200).json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar locais:', error);
        return res.status(200).json([{ id: 'loc_main_' + req.user.id, name: 'Estoque Principal' }]);
    }
});

app.post('/api/locais', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id, name } = req.body;

        if (id && name) {
            await pool.query(
                'UPDATE stock_locations SET name = $1 WHERE id = $2 AND user_id = $3',
                [name, id, userId]
            );
        } else if (name) {
            const newId = 'loc_' + Date.now();
            await pool.query(
                'INSERT INTO stock_locations (id, user_id, name) VALUES ($1, $2, $3)',
                [newId, userId, name]
            );
        }

        const result = await pool.query('SELECT id, name FROM stock_locations WHERE user_id = $1', [userId]);
        return res.status(200).json(result.rows);
    } catch (error) {
        console.error('Erro ao gerenciar locais:', error);
        return res.status(500).json({ error: 'Erro interno ao salvar local' });
    }
});

/**
 * Rotas de Programação do WhatsApp[cite: 5]
 */
app.get('/api/whatsapp', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await pool.query(
            `SELECT schedule_index as id, days_of_week as days, send_time as time, 
                    message_template as text, send_to_all as "sendToAll", 
                    customer_ids as "customerIds", enabled 
             FROM whatsapp_schedules WHERE user_id = $1 ORDER BY schedule_index`,
            [userId]
        );

        const schedules = result.rows.map(row => ({
            ...row,
            id: `wa-sched-${row.id}`,
            label: `Mensagem ${row.id}`,
            time: row.time ? row.time.substring(0, 5) : "10:00",
            days: row.days || [],
            customerIds: row.customerIds || []
        }));

        return res.status(200).json(schedules);
    } catch (error) {
        console.error('Erro ao buscar programações do WhatsApp:', error);
        return res.status(500).json({ error: 'Erro interno no servidor.' });
    }
});

app.post('/api/whatsapp', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const newSchedules = req.body; 

        if (!Array.isArray(newSchedules)) {
            return res.status(400).json({ error: 'O corpo da requisição deve ser um array de programações.' });
        }

        for (let i = 0; i < newSchedules.length; i++) {
            const s = newSchedules[i];
            const index = i + 1;
            const days = s.days || [];
            const time = s.time || "10:00";
            const text = s.text || "";
            const sendToAll = s.sendToAll !== false;
            const customerIds = s.customerIds || [];
            const enabled = s.enabled ? true : false;

            await pool.query(`
                INSERT INTO whatsapp_schedules (user_id, schedule_index, days_of_week, send_time, message_template, send_to_all, customer_ids, enabled)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (user_id, schedule_index) 
                DO UPDATE SET days_of_week = $3, send_time = $4, message_template = $5, send_to_all = $6, customer_ids = $7, enabled = $8
            `, [userId, index, days, time, text, sendToAll, customerIds, enabled]);
        }

        return res.status(200).json({ message: 'Programações salvas com sucesso!' });
    } catch (error) {
        console.error('Erro ao salvar programações do WhatsApp:', error);
        return res.status(500).json({ error: 'Erro interno no servidor.' });
    }
});

/**
 * 🤖 CRON JOB: Disparador Automático Multi-tenant Integrado ao PostgreSQL[cite: 5]
 */
cron.schedule('* * * * *', async () => {
    try {
        const agora = new Date();
        const diasSemanaMap = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
        const diaAtual = diasSemanaMap[agora.getDay()];
        const horaAtual = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

        const { rows: schedules } = await pool.query(`
            SELECT ws.*, u.whatsapp_api_url, u.whatsapp_api_key 
            FROM whatsapp_schedules ws
            JOIN users u ON ws.user_id = u.id
            WHERE ws.enabled = TRUE
        `);

        for (const schedule of schedules) {
            const days = schedule.days_of_week || [];
            const schedTime = schedule.send_time ? schedule.send_time.substring(0, 5) : "";

            const matchDay = days.includes(diaAtual);
            const matchTime = schedTime === horaAtual;

            if (matchDay && matchTime) {
                if (!schedule.whatsapp_api_url) continue;

                const { rows: clientes } = await pool.query(
                    'SELECT * FROM customers WHERE user_id = $1',
                    [schedule.user_id]
                );

                const destinatarios = schedule.send_to_all 
                    ? clientes 
                    : clientes.filter(c => schedule.customer_ids && schedule.customer_ids.includes(c.id));

                for (const cliente of destinatarios) {
                    if (!cliente.phone) continue;
                    const phoneClean = cliente.phone.replace(/\D/g, '');

                    let saldoCashback = 0;
                    try {
                        const cbRes = await pool.query(
                            'SELECT SUM(amount) as total FROM customer_cashback WHERE customer_id = $1 AND expires_at > NOW()',
                            [cliente.id]
                        );
                        saldoCashback = cbRes.rows[0]?.total || 0;
                    } catch (e) {}

                    let mensagemFinal = schedule.message_template
                        .replace(/{nome}/g, cliente.name || 'Cliente')
                        .replace(/{saldo}/g, `R$ ${Number(saldoCashback).toFixed(2)}`);

                    try {
                        await fetch(schedule.whatsapp_api_url, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'apikey': schedule.whatsapp_api_key || ''
                            },
                            body: JSON.stringify({
                                number: phoneClean,
                                textMessage: { text: mensagemFinal }
                            })
                        });
                    } catch (err) {
                        console.error(`Erro ao enviar mensagem para ${phoneClean}:`, err);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Erro no processamento do cron job do WhatsApp:', error);
    }
});

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});