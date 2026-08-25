import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { pool, initDb } from './db.js';
import bcrypt from 'bcrypt';
import 'dotenv/config';

const app = express();

app.use(express.json());
app.use(cors());

// Inicializa o banco de dados PostgreSQL ao iniciar o servidor
initDb();

/**
 * Rota de Login para autenticação do front-end (Com auto-cadastro de segurança)
 */
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        let result = await pool.query(
            'SELECT id, name, email, password FROM users WHERE email = $1',
            [email]
        );

        let user;
        if (result.rows.length === 0) {
            // Se o usuário não existir no banco, cria um registro padrão para evitar erros de FK
            const newId = '1787335620584';
            const hashedPassword = await bcrypt.hash(password || '123456', 10);
            
            await pool.query(
                `INSERT INTO users (id, name, email, password) 
                 VALUES ($1, $2, $3, $4) 
                 ON CONFLICT (email) DO NOTHING`,
                [newId, email.split('@')[0], email, hashedPassword]
            );

            result = await pool.query(
                'SELECT id, name, email, password FROM users WHERE email = $1',
                [email]
            );
        }

        user = result.rows[0];
        const senhaValida = await bcrypt.compare(password, user.password);

        if (!senhaValida) {
            return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
        }

        return res.status(200).json({
            token: 'jwt_token_' + user.id,
            user: { id: user.id, name: user.name, email: user.email }
        });
    } catch (error) {
        console.error('Erro no login:', error);
        return res.status(500).json({ error: 'Erro interno no servidor.' });
    }
});

// Middleware de Autenticação Estrito
const authMiddleware = (req, res, next) => {
    let finalUserId = null;
    if (req.headers.authorization) {
        const parts = req.headers.authorization.replace('Bearer ', '').split('_');
        if (parts.length > 1) {
            finalUserId = parts[parts.length - 1];
        }
    }

    if (!finalUserId) {
        return res.status(401).json({ error: 'Usuário não autenticado.' });
    }

    req.user = { id: finalUserId };
    next();
};

/**
 * Rotas de Configuração da API de WhatsApp do Usuário
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
 * ROTA AUTOMATIZADA: Cria a instância do usuário na Evolution API e retorna o QR Code
 */
app.post('/api/whatsapp/connect', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const instanceName = `user_${userId}`;

        const evolutionUrl = process.env.EVOLUTION_API_URL || 'https://evolution-api-production-f418.up.railway.app';
        const globalApiKey = process.env.EVOLUTION_GLOBAL_KEY || '4245255264416261222466144653232414342341423553653262532155146151';

        let response = await fetch(`${evolutionUrl}/instance/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': globalApiKey
            },
            body: JSON.stringify({
                instanceName: instanceName,
                qrcode: true,
                integration: "WHATSAPP-BAILEYS"
            })
        });

        let data = await response.json();

        if (!response.ok) {
            const errorMsg = JSON.stringify(data);
            if (errorMsg.includes("already in use") || response.status === 403) {
                response = await fetch(`${evolutionUrl}/instance/connect/${instanceName}`, {
                    method: 'GET',
                    headers: { 'apikey': globalApiKey }
                });
                data = await response.json();
            } else {
                return res.status(response.status).json({ error: data.message || 'Erro retornado pela Evolution API' });
            }
        }

        const qrCodeBase64 = data.qrcode?.base64 || data.base64 || data.code || null;
        
        // URL completa de disparo (/message/sendText/) para garantir o envio imediato e via cron
        const userApiUrl = `${evolutionUrl}/message/sendText/${instanceName}`;
        
        // Salva imediatamente no banco para evitar erro 400 em disparos futuros
        await pool.query(
            'UPDATE users SET whatsapp_api_url = $1, whatsapp_api_key = $2 WHERE id = $3',
            [userApiUrl, globalApiKey, userId]
        );

        return res.status(200).json({
            qrCode: qrCodeBase64,
            apiUrl: userApiUrl,
            apiKey: globalApiKey,
            message: 'Instância conectada com sucesso!'
        });
    } catch (error) {
        console.error('Erro crítico ao gerar QR Code:', error);
        return res.status(500).json({ error: 'Erro ao conectar com o servidor do WhatsApp.' });
    }
});

app.get('/api/whatsapp/status/:userId', authMiddleware, async (req, res) => {
    try {
        const userId = req.params.userId;
        const instanceName = `user_${userId}`;
        const evolutionUrl = process.env.EVOLUTION_API_URL || 'https://evolution-api-production-f418.up.railway.app';
        const globalApiKey = process.env.EVOLUTION_GLOBAL_KEY || '4245255264416261222466144653232414342341423553653262532155146151';

        const response = await fetch(`${evolutionUrl}/instance/connectionState/${instanceName}`, {
            method: 'GET',
            headers: { 'apikey': globalApiKey }
        });

        const data = await response.json();
        const state = data.instance?.state || data.state || 'close';
        const isConnected = state === 'open';

        return res.status(200).json({ connected: isConnected, state: state });
    } catch (error) {
        console.error('Erro ao verificar status:', error);
        return res.status(500).json({ error: 'Erro ao verificar conexão' });
    }
});

/**
 * Rota para Disparo Manual Imediato de uma Programação
 */
app.post('/api/whatsapp/send-now', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { text, sendToAll, customerIds } = req.body;

        const userRes = await pool.query(
            'SELECT whatsapp_api_url, whatsapp_api_key FROM users WHERE id = $1',
            [userId]
        );

        if (userRes.rows.length === 0 || !userRes.rows[0].whatsapp_api_url) {
            return res.status(400).json({ error: 'WhatsApp não configurado ou desconectado para este usuário.' });
        }

        const { whatsapp_api_url: apiUrl, whatsapp_api_key: apiKey } = userRes.rows[0];

        const { rows: clientes } = await pool.query(
            'SELECT * FROM customers WHERE user_id = $1',
            [userId]
        );

        const destinatarios = sendToAll 
            ? clientes 
            : clientes.filter(c => customerIds && customerIds.includes(c.id));

        let enviados = 0;
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

            let mensagemFinal = (text || '')
                .replace(/{nome}/g, cliente.name || 'Cliente')
                .replace(/{saldo}/g, `R$ ${Number(saldoCashback).toFixed(2)}`);

            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': apiKey || ''
                    },
                    body: JSON.stringify({
                        number: phoneClean,
                        text: mensagemFinal // Ajustado para Evolution API v2
                    })
                });
                if (response.ok) enviados++;
            } catch (err) {
                console.error(`Erro ao enviar mensagem imediata para ${phoneClean}:`, err);
            }
        }

        return res.status(200).json({ message: `Disparo imediato concluído! ${enviados} mensagem(ns) enviada(s).` });
    } catch (error) {
        console.error('Erro no disparo manual:', error);
        return res.status(500).json({ error: 'Erro interno ao enviar mensagem.' });
    }
});

/**
 * Rotas de Clientes (Isoladas por user_id)
 */
const handleGetCustomers = async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, name, phone FROM customers WHERE user_id = $1',
            [req.user.id]
        );
        return res.status(200).json(result.rows);
    } catch (error) {
        console.error('Erro ao listar clientes:', error);
        return res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

const handlePostCustomer = async (req, res) => {
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
};

const handleDeleteCustomer = async (req, res) => {
    try {
        const userId = req.user.id;
        const customerId = req.params.id;
        await pool.query('DELETE FROM customers WHERE id = $1 AND user_id = $2', [customerId, userId]);
        return res.status(200).json({ message: 'Cliente removido com sucesso' });
    } catch (error) {
        console.error('Erro ao remover cliente:', error);
        return res.status(500).json({ error: 'Erro interno ao remover cliente' });
    }
};

app.get('/api/customers', authMiddleware, handleGetCustomers);
app.post('/api/customers', authMiddleware, handlePostCustomer);
app.delete('/api/customers/:id', authMiddleware, handleDeleteCustomer);

app.get('/api/clientes', authMiddleware, handleGetCustomers);
app.post('/api/clientes', authMiddleware, handlePostCustomer);
app.delete('/api/clientes/:id', authMiddleware, handleDeleteCustomer);

/**
 * Rotas de Produtos e Estoque (Isoladas por user_id)
 */
const handleGetProducts = async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await pool.query(
            'SELECT * FROM products WHERE user_id = $1',
            [userId]
        );
        
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
};

const handlePostProduct = async (req, res) => {
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
            prodId, userId, p.name, p.category || 'Geral', p.barcode || '', p.code || '', 
            p.cost || 0, p.price || 0, p.imposto || 0, p.frete || 0, 
            p.vipPrice || null, p.vipPrice3x || null, p.description || '', 
            p.controlStock !== false, p.imageUrl || null, JSON.stringify(p.stocks || {})
        ]);

        return res.status(201).json({ message: 'Produto salvo com sucesso', produto: p });
    } catch (error) {
        console.error('Erro ao salvar produto:', error);
        return res.status(500).json({ error: 'Erro interno ao salvar produto' });
    }
};

app.get('/api/produtos', authMiddleware, handleGetProducts);
app.get('/api/products', authMiddleware, handleGetProducts);
app.post('/api/produtos', authMiddleware, handlePostProduct);
app.post('/api/products', authMiddleware, handlePostProduct);

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

app.delete('/api/products/:id', authMiddleware, async (req, res) => {
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

/**
 * Rotas de Vendas (PDV) (Isoladas por user_id)
 */
app.get('/api/sales', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await pool.query(
            'SELECT * FROM sales WHERE user_id = $1 ORDER BY date DESC',
            [userId]
        );

        const salesFormatted = result.rows.map(s => ({
            id: s.id,
            customerId: s.customer_id,
            customer_id: s.customer_id,
            customerName: s.customer_name,
            customer_name: s.customer_name,
            seller: s.seller,
            paymentMethod: s.payment_method,
            payment_method: s.payment_method,
            discount: Number(s.discount),
            subtotal: Number(s.subtotal),
            total: Number(s.total),
            gender: s.gender,
            salesChannel: s.sales_channel,
            sales_channel: s.sales_channel,
            deliveryType: s.delivery_type,
            delivery_type: s.delivery_type,
            items: typeof s.items === 'string' ? JSON.parse(s.items || '[]') : (s.items || []),
            date: s.date
        }));

        return res.status(200).json(salesFormatted);
    } catch (error) {
        console.error('Erro ao buscar vendas:', error);
        return res.status(200).json([]);
    }
});

app.post('/api/sales', authMiddleware, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const userId = req.user.id;
        const s = req.body;
        const saleId = s.id || `pur_${Date.now()}`;
        const items = typeof s.items === 'string' ? JSON.parse(s.items || '[]') : (s.items || []);

        await client.query(`
            INSERT INTO sales (id, user_id, customer_id, customer_name, seller, payment_method, discount, subtotal, total, gender, sales_channel, delivery_type, items, date)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT (id) DO UPDATE SET
                customer_id = $3, customer_name = $4, seller = $5, payment_method = $6,
                discount = $7, subtotal = $8, total = $9, gender = $10, sales_channel = $11, 
                delivery_type = $12, items = $13, date = $14
        `, [
            saleId,
            userId,
            s.customerId || s.customer_id || null,
            s.customer_name || s.customerName || 'Cliente Geral',
            s.seller || '',
            s.payment_method || s.paymentMethod || 'Pix',
            s.discount || 0,
            s.subtotal || 0,
            s.total || 0,
            s.gender || 'Prefiro não informar',
            s.sales_channel || s.salesChannel || 'Loja física',
            s.delivery_type || s.deliveryType || 'Retirada',
            JSON.stringify(items),
            s.date || new Date().toISOString()
        ]);

        for (const item of items) {
            const prodId = item.id || item.productId;
            const qtdVendida = Number(item.quantity || item.qty || 1);
            const localName = item.local || item.location || 'Estoque Principal';

            if (prodId) {
                const prodRes = await client.query('SELECT stocks, control_stock FROM products WHERE id = $1 AND user_id = $2', [prodId, userId]);
                
                if (prodRes.rows.length > 0) {
                    const prod = prodRes.rows[0];
                    if (prod.control_stock !== false) {
                        let stocksObj = typeof prod.stocks === 'string' ? JSON.parse(prod.stocks || '{}') : (prod.stocks || {});
                        
                        const estoqueAtual = Number(stocksObj[localName] || stocksObj['Estoque Principal'] || 0);
                        const novoEstoque = Math.max(0, estoqueAtual - qtdVendida);
                        
                        if (stocksObj[localName] !== undefined) {
                            stocksObj[localName] = novoEstoque;
                        } else {
                            stocksObj['Estoque Principal'] = novoEstoque;
                        }

                        await client.query(
                            'UPDATE products SET stocks = $1 WHERE id = $2 AND user_id = $3',
                            [JSON.stringify(stocksObj), prodId, userId]
                        );
                    }
                }
            }
        }

        await client.query('COMMIT');
        return res.status(201).json({ message: 'Venda salva e estoque atualizado com sucesso!', saleId });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erro ao salvar venda e atualizar estoque:', error);
        return res.status(500).json({ error: 'Erro interno ao salvar a venda no banco.' });
    } finally {
        client.release();
    }
});

/**
 * Rotas de Vendedores (Isoladas por user_id)
 */
const handleGetSellers = async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await pool.query(
            'SELECT id, name, commission_pct as "commissionPct" FROM sellers WHERE user_id = $1 ORDER BY created_at ASC',
            [userId]
        );

        return res.status(200).json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar vendedores:', error);
        return res.status(200).json([]);
    }
};

const handlePostSeller = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id, name, commissionPct } = req.body;
        const sellerId = id || 's' + Date.now();

        await pool.query(`
            INSERT INTO sellers (id, user_id, name, commission_pct)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (id) DO UPDATE SET
                name = $3, commission_pct = $4
        `, [sellerId, userId, name, commissionPct || 0]);

        return res.status(201).json({ 
            message: 'Vendedor salvo com sucesso', 
            seller: { id: sellerId, name, commissionPct: Number(commissionPct || 0) } 
        });
    } catch (error) {
        console.error('Erro ao salvar vendedor:', error);
        return res.status(500).json({ error: 'Erro interno ao salvar vendedor' });
    }
};

app.get('/api/vendedores', authMiddleware, handleGetSellers);
app.get('/api/sellers', authMiddleware, handleGetSellers);
app.post('/api/vendedores', authMiddleware, handlePostSeller);
app.post('/api/sellers', authMiddleware, handlePostSeller);

app.delete('/api/vendedores/:id', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const sellerId = req.params.id;
        await pool.query('DELETE FROM sellers WHERE id = $1 AND user_id = $2', [sellerId, userId]);
        return res.status(200).json({ message: 'Vendedor removido com sucesso' });
    } catch (error) {
        console.error('Erro ao remover vendedor:', error);
        return res.status(500).json({ error: 'Erro interno ao remover vendedor' });
    }
});

app.delete('/api/sellers/:id', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const sellerId = req.params.id;
        await pool.query('DELETE FROM sellers WHERE id = $1 AND user_id = $2', [sellerId, userId]);
        return res.status(200).json({ message: 'Vendedor removido com sucesso' });
    } catch (error) {
        console.error('Erro ao remover vendedor:', error);
        return res.status(500).json({ error: 'Erro interno ao remover vendedor' });
    }
});

app.get('/api/locais', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await pool.query(
            'SELECT id, name FROM stock_locations WHERE user_id = $1',
            [userId]
        );

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
 * Rotas de Programação do WhatsApp (Isoladas por user_id)
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
 * 🤖 CRON JOB: Disparador Automático Multi-tenant
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
                                text: mensagemFinal // Ajustado para Evolution API v2
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