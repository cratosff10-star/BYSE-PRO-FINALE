import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { pool, initDb } from './db.js';
import bcrypt from 'bcrypt';
import 'dotenv/config';

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cors());

if (typeof initDb === 'function') {
    initDb().catch(err => console.error('Erro na inicialização do DB:', err));
}

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        let result = await pool.query(
            'SELECT id, name, email, password FROM users WHERE email = $1',
            [email]
        );

        let user;
        if (result.rows.length === 0) {
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

// ==========================================
// ROTAS PÚBLICAS DO CATÁLOGO (SEM AUTH)
// ==========================================
app.get('/api/public/catalogo/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        
        // Buscar dados do usuário/loja
        const userRes = await pool.query(
            'SELECT id, name FROM users WHERE id = $1',
            [userId]
        );

        if (userRes.rows.length === 0) {
            return res.status(404).json({ error: 'Loja não encontrada.' });
        }

        // Buscar produtos do usuário
        const result = await pool.query(
            'SELECT * FROM products WHERE user_id = $1',
            [userId]
        );
        
        const produtosFormatados = result.rows.map(p => ({
            ...p,
            cost: Number(p.cost || 0),
            price: Number(p.price || 0),
            imposto: Number(p.imposto || 0),
            frete: Number(p.frete || 0),
            controlStock: p.control_stock,
            control_stock: p.control_stock,
            vipPrice: p.vip_price !== null ? Number(p.vip_price) : null,
            vip_price: p.vip_price !== null ? Number(p.vip_price) : null,
            vipPrice3x: p.vip_price_3x !== null ? Number(p.vip_price_3x) : null,
            vip_price_3x: p.vip_price_3x !== null ? Number(p.vip_price_3x) : null,
            imageUrl: p.image_url,
            image_url: p.image_url,
            stocks: typeof p.stocks === 'string' ? JSON.parse(p.stocks || '{}') : (p.stocks || {})
        }));

        return res.status(200).json({
            storeName: userRes.rows[0].name || 'Minha Loja',
            products: produtosFormatados
        });
    } catch (error) {
        console.error('Erro ao buscar catálogo público:', error);
        return res.status(500).json({ error: 'Erro interno no servidor.' });
    }
});

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
        const userApiUrl = `${evolutionUrl}/message/sendText/${instanceName}`;
        
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
                        text: mensagemFinal,
                        options: {
                            delay: 1200,
                            presence: "composing"
                        }
                    })
                });

                if (response.ok) {
                    enviados++;
                }
            } catch (err) {
                console.error(`Erro de conexão ao disparar mensagem para ${phoneClean}:`, err);
            }
        }

        return res.status(200).json({ message: `Disparo imediato concluído! ${enviados} mensagem(ns) enviada(s).` });
    } catch (error) {
        console.error('Erro no disparo manual:', error);
        return res.status(500).json({ error: 'Erro interno ao enviar mensagem.' });
    }
});

const handleGetCustomers = async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, name, phone, cpf, data_aniversario, cashback, status, status_mensalidade, data_vencimento, valor_mensalidade FROM customers WHERE user_id = $1',
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
        const { id, name, phone, cpf, data_aniversario, birthDate, cashback, status, status_mensalidade, data_vencimento, valor_mensalidade } = req.body;
        const clienteId = id || 'c' + Date.now();
        const aniversarioFinal = data_aniversario || birthDate || null;
        
        await pool.query(
            `INSERT INTO customers (id, user_id, name, phone, cpf, data_aniversario, cashback, status, status_mensalidade, data_vencimento, valor_mensalidade) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (id) DO UPDATE SET 
                name = $3, 
                phone = $4, 
                cpf = COALESCE($5, customers.cpf),
                data_aniversario = COALESCE($6, customers.data_aniversario),
                cashback = COALESCE($7, customers.cashback),
                status = COALESCE($8, customers.status),
                status_mensalidade = COALESCE($9, customers.status_mensalidade), 
                data_vencimento = COALESCE($10, customers.data_vencimento), 
                valor_mensalidade = COALESCE($11, customers.valor_mensalidade)`,
            [
                clienteId, 
                userId, 
                name, 
                phone || '', 
                cpf || '', 
                aniversarioFinal,
                cashback || 0, 
                status || 'Ativo', 
                status_mensalidade || 'Pendente (Não Pago)', 
                data_vencimento || null, 
                valor_mensalidade || 0
            ]
        );

        const clienteData = { id: clienteId, userId, name, phone: phone || '', data_aniversario: aniversarioFinal, status: status || 'Ativo' };
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

const handleGetProducts = async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await pool.query(
            'SELECT * FROM products WHERE user_id = $1',
            [userId]
        );
        
        const produtosFormatados = result.rows.map(p => ({
            ...p,
            cost: Number(p.cost || 0),
            price: Number(p.price || 0),
            imposto: Number(p.imposto || 0),
            frete: Number(p.frete || 0),
            controlStock: p.control_stock,
            control_stock: p.control_stock,
            vipPrice: p.vip_price !== null ? Number(p.vip_price) : null,
            vip_price: p.vip_price !== null ? Number(p.vip_price) : null,
            vipPrice3x: p.vip_price_3x !== null ? Number(p.vip_price_3x) : null,
            vip_price_3x: p.vip_price_3x !== null ? Number(p.vip_price_3x) : null,
            imageUrl: p.image_url,
            image_url: p.image_url,
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
        const prodId = req.params.id || p.id || 'prod_' + Date.now();

        const vipPriceVal = p.vipPrice !== undefined ? p.vipPrice : p.vip_price;
        const vipPrice3xVal = p.vipPrice3x !== undefined ? p.vipPrice3x : p.vip_price_3x;
        const controlStockVal = p.controlStock !== undefined ? p.controlStock : (p.control_stock !== undefined ? p.control_stock : true);
        const imageUrlVal = p.imageUrl !== undefined ? p.imageUrl : p.image_url;
        const stocksVal = p.stocks !== undefined ? p.stocks : p.stock;

        await pool.query(`
            INSERT INTO products (
                id, user_id, name, category, barcode, code, cost, price, 
                imposto, frete, vip_price, vip_price_3x, description, 
                control_stock, image_url, stocks
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            ON CONFLICT (id) DO UPDATE SET
                name = $3, 
                category = $4, 
                barcode = $5, 
                code = $6, 
                cost = $7, 
                price = $8,
                imposto = $9, 
                frete = $10, 
                vip_price = $11, 
                vip_price_3x = $12, 
                description = $13,
                control_stock = $14, 
                image_url = $15, 
                stocks = $16
        `, [
            prodId, 
            userId, 
            p.name, 
            p.category || 'Sem categoria', 
            p.barcode || null, 
            p.code || null, 
            parseFloat(p.cost) || 0, 
            parseFloat(p.price) || 0, 
            parseFloat(p.imposto) || 0, 
            parseFloat(p.frete) || 0, 
            vipPriceVal !== null && vipPriceVal !== '' && vipPriceVal !== undefined ? parseFloat(vipPriceVal) : null, 
            vipPrice3xVal !== null && vipPrice3xVal !== '' && vipPrice3xVal !== undefined ? parseFloat(vipPrice3xVal) : null, 
            p.description || null, 
            controlStockVal ?? true, 
            imageUrlVal || null, 
            JSON.stringify(stocksVal || {})
        ]);

        const updatedRes = await pool.query('SELECT * FROM products WHERE id = $1 AND user_id = $2', [prodId, userId]);
        const savedProduct = updatedRes.rows[0];

        return res.status(201).json({
            ...savedProduct,
            cost: Number(savedProduct.cost || 0),
            price: Number(savedProduct.price || 0),
            imposto: Number(savedProduct.imposto || 0),
            frete: Number(savedProduct.frete || 0),
            controlStock: savedProduct.control_stock,
            control_stock: savedProduct.control_stock,
            vipPrice: savedProduct.vip_price !== null ? Number(savedProduct.vip_price) : null,
            vip_price: savedProduct.vip_price !== null ? Number(savedProduct.vip_price) : null,
            vipPrice3x: savedProduct.vip_price_3x !== null ? Number(savedProduct.vip_price_3x) : null,
            vip_price_3x: savedProduct.vip_price_3x !== null ? Number(savedProduct.vip_price_3x) : null,
            imageUrl: savedProduct.image_url,
            image_url: savedProduct.image_url,
            stocks: typeof savedProduct.stocks === 'string' ? JSON.parse(savedProduct.stocks || '{}') : (savedProduct.stocks || {})
        });
    } catch (error) {
        console.error('Erro ao salvar produto:', error);
        return res.status(500).json({ error: 'Erro interno ao salvar produto' });
    }
};

const handlePutProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const p = req.body;

        const vipPriceVal = p.vipPrice !== undefined ? p.vipPrice : p.vip_price;
        const vipPrice3xVal = p.vipPrice3x !== undefined ? p.vipPrice3x : p.vip_price_3x;
        const controlStockVal = p.controlStock !== undefined ? p.controlStock : (p.control_stock !== undefined ? p.control_stock : true);
        const imageUrlVal = p.imageUrl !== undefined ? p.imageUrl : p.image_url;
        const stocksVal = p.stocks !== undefined ? p.stocks : p.stock;

        const query = `
            UPDATE products 
            SET name = $1, 
                category = $2, 
                barcode = $3, 
                code = $4, 
                cost = $5, 
                price = $6, 
                imposto = $7, 
                frete = $8, 
                vip_price = $9, 
                vip_price_3x = $10, 
                description = $11, 
                control_stock = $12, 
                image_url = $13, 
                stocks = $14
            WHERE id = $15 AND user_id = $16
            RETURNING *;
        `;

        const values = [
            p.name,
            p.category || 'Sem categoria',
            p.barcode || null,
            p.code || null,
            parseFloat(p.cost) || 0,
            parseFloat(p.price) || 0,
            parseFloat(p.imposto) || 0,
            parseFloat(p.frete) || 0,
            vipPriceVal !== null && vipPriceVal !== '' && vipPriceVal !== undefined ? parseFloat(vipPriceVal) : null,
            vipPrice3xVal !== null && vipPrice3xVal !== '' && vipPrice3xVal !== undefined ? parseFloat(vipPrice3xVal) : null,
            p.description || null,
            controlStockVal ?? true,
            imageUrlVal || null,
            JSON.stringify(stocksVal || {}),
            id,
            userId
        ];

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Produto não encontrado ou sem permissão.' });
        }

        const updatedProduct = result.rows[0];
        res.json({
            ...updatedProduct,
            cost: Number(updatedProduct.cost || 0),
            price: Number(updatedProduct.price || 0),
            imposto: Number(updatedProduct.imposto || 0),
            frete: Number(updatedProduct.frete || 0),
            controlStock: updatedProduct.control_stock,
            control_stock: updatedProduct.control_stock,
            vipPrice: updatedProduct.vip_price !== null ? Number(updatedProduct.vip_price) : null,
            vip_price: updatedProduct.vip_price !== null ? Number(updatedProduct.vip_price) : null,
            vipPrice3x: updatedProduct.vip_price_3x !== null ? Number(updatedProduct.vip_price_3x) : null,
            vip_price_3x: updatedProduct.vip_price_3x !== null ? Number(updatedProduct.vip_price_3x) : null,
            imageUrl: updatedProduct.image_url,
            image_url: updatedProduct.image_url,
            stocks: typeof updatedProduct.stocks === 'string' ? JSON.parse(updatedProduct.stocks || '{}') : (updatedProduct.stocks || {})
        });
    } catch (error) {
        console.error("Erro ao atualizar produto:", error);
        res.status(500).json({ error: "Erro interno ao atualizar produto." });
    }
};

app.get('/api/produtos', authMiddleware, handleGetProducts);
app.get('/api/products', authMiddleware, handleGetProducts);
app.post('/api/produtos', authMiddleware, handlePostProduct);
app.post('/api/products', authMiddleware, handlePostProduct);
app.put('/api/produtos/:id', authMiddleware, handlePutProduct);
app.put('/api/products/:id', authMiddleware, handlePutProduct);

app.delete('/api/produtos/:id', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const prodId = req.params.id;
        const result = await pool.query('DELETE FROM products WHERE id = $1 AND user_id = $2 RETURNING id', [prodId, userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Produto não encontrado.' });
        }
        return res.status(200).json({ success: true, id: prodId, message: 'Produto removido com sucesso' });
    } catch (error) {
        console.error('Erro ao remover produto:', error);
        return res.status(500).json({ error: 'Erro interno ao remover produto' });
    }
});

app.delete('/api/products/:id', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const prodId = req.params.id;
        const result = await pool.query('DELETE FROM products WHERE id = $1 AND user_id = $2 RETURNING id', [prodId, userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Produto não encontrado.' });
        }
        return res.status(200).json({ success: true, id: prodId, message: 'Produto removido com sucesso' });
    } catch (error) {
        console.error('Erro ao remover produto:', error);
        return res.status(500).json({ error: 'Erro interno ao remover produto' });
    }
});

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
            discount: Number(s.discount || 0),
            subtotal: Number(s.subtotal || 0),
            total: Number(s.total || 0),
            gender: s.gender,
            salesChannel: s.sales_channel,
            sales_channel: s.sales_channel,
            deliveryType: s.delivery_type,
            delivery_type: s.delivery_type,
            items: typeof s.items === 'string' ? JSON.parse(s.items || '[]') : (s.items || []),
            date: s.date ? new Date(s.date).toISOString() : new Date().toISOString()
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

app.get('/api/fiados', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await pool.query(
            'SELECT * FROM fiados WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );

        const fiadosFormatted = result.rows.map(f => ({
            id: f.id,
            customerId: f.customer_id,
            customer_id: f.customer_id,
            customerName: f.customer_name,
            customer_name: f.customer_name,
            products: f.products || '',
            origin: f.origin || 'manual',
            installments: typeof f.installments === 'string' ? JSON.parse(f.installments || '[]') : (f.installments || []),
            date: f.created_at
        }));

        return res.status(200).json(fiadosFormatted);
    } catch (error) {
        console.error('Erro ao buscar fiados:', error);
        return res.status(200).json([]);
    }
});

app.post('/api/fiados', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const f = req.body;
        const fiadoId = f.id || `fd_${Date.now()}`;
        const installments = typeof f.installments === 'string' ? JSON.parse(f.installments || '[]') : (f.installments || []);

        await pool.query(`
            INSERT INTO fiados (id, user_id, customer_id, customer_name, products, origin, installments)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (id) DO UPDATE SET
                customer_id = $3, customer_name = $4, products = $5, origin = $6, installments = $7
        `, [
            fiadoId,
            userId,
            f.customerId || f.customer_id || null,
            f.customerName || f.customer_name || 'Cliente',
            f.products || '',
            f.origin || 'manual',
            JSON.stringify(installments)
        ]);

        return res.status(201).json({ message: 'Fiado salvo com sucesso!', fiadoId });
    } catch (error) {
        console.error('Erro ao salvar fiado:', error);
        return res.status(500).json({ error: 'Erro interno ao salvar o fiado no banco.' });
    }
});

app.delete('/api/fiados/:id', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const fiadoId = req.params.id;
        await pool.query('DELETE FROM fiados WHERE id = $1 AND user_id = $2', [fiadoId, userId]);
        return res.status(200).json({ message: 'Fiado removido com sucesso' });
    } catch (error) {
        console.error('Erro ao remover fiado:', error);
        return res.status(500).json({ error: 'Erro interno ao remover fiado' });
    }
});

const handleGetSellers = async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await pool.query(
            'SELECT id, name, commission_pct FROM sellers WHERE user_id = $1 ORDER BY created_at ASC',
            [userId]
        );

        const sellersFormatted = result.rows.map(s => ({
            id: s.id,
            name: s.name,
            commissionPct: Number(s.commission_pct || 0)
        }));

        return res.status(200).json(sellersFormatted);
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
        const parsedCommission = parseFloat(commissionPct) || 0;

        await pool.query(`
            INSERT INTO sellers (id, user_id, name, commission_pct)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (id) DO UPDATE SET
                name = $3, commission_pct = $4
        `, [sellerId, userId, name, parsedCommission]);

        return res.status(201).json({ 
            message: 'Vendedor salvo com sucesso', 
            seller: { id: sellerId, name, commissionPct: parsedCommission } 
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

app.get('/api/pre-treino/products', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await pool.query(
            'SELECT id, name, cost FROM pre_treino_produtos WHERE user_id = $1',
            [userId]
        );
        if (result.rows.length === 0) {
            const defaultProds = [
                { id: 'p1', name: 'Dragon Pharma (Dose)', cost: 5.00 },
                { id: 'p2', name: 'Insane Labz (Dose)', cost: 6.00 }
            ];
            for (const p of defaultProds) {
                await pool.query(
                    'INSERT INTO pre_treino_produtos (id, user_id, name, cost) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
                    [p.id, userId, p.name, p.cost]
                );
            }
            return res.status(200).json(defaultProds.map(p => ({ ...p, custo: p.cost })));
        }
        return res.status(200).json(result.rows.map(p => ({ 
            id: p.id,
            name: p.name,
            cost: Number(p.cost || 0),
            custo: Number(p.cost || 0) 
        })));
    } catch (error) {
        console.error('Erro ao buscar produtos de pré-treino:', error);
        return res.status(500).json({ error: 'Erro interno' });
    }
});

app.post('/api/pre-treino/products', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id, name, cost, custo } = req.body;
        const finalCost = cost !== undefined ? cost : (custo !== undefined ? custo : 0);
        const prodId = id || 'pt_prod_' + Date.now();
        await pool.query(
            `INSERT INTO pre_treino_produtos (id, user_id, name, cost) VALUES ($1, $2, $3, $4)
             ON CONFLICT (id) DO UPDATE SET name = $3, cost = $4`,
            [prodId, userId, name, parseFloat(finalCost) || 0]
        );
        return res.status(201).json({ message: 'Produto de pré-treino salvo!' });
    } catch (error) {
        console.error('Erro ao salvar produto de pré-treino:', error);
        return res.status(500).json({ error: 'Erro interno' });
    }
});

app.delete('/api/pre-treino/products/:id', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const produtoId = req.params.id;
        await pool.query('DELETE FROM pre_treino_produtos WHERE id = $1 AND user_id = $2', [produtoId, userId]);
        return res.status(200).json({ message: 'Produto de pré-treino excluído com sucesso.' });
    } catch (error) {
        console.error('Erro ao excluir produto de pré-treino:', error);
        return res.status(500).json({ error: 'Erro ao excluir produto de pré-treino.' });
    }
});

app.get('/api/pre-treino/records', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await pool.query(
            'SELECT id, customer_id, nome_cliente, produto_id, nome_produto, custo, data, horario FROM pre_treino_registros WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );
        const formatted = result.rows.map(r => ({
            id: r.id,
            customerId: r.customer_id,
            customerName: r.nome_cliente,
            productId: r.produto_id,
            productName: r.nome_produto,
            cost: Number(r.custo || 0),
            price: Number(r.custo || 0),
            date: r.data || new Date().toISOString(),
            horario: r.horario
        }));
        return res.status(200).json(formatted);
    } catch (error) {
        console.error('Erro ao buscar registros de pré-treino:', error);
        return res.status(500).json({ error: 'Erro interno' });
    }
});

app.post('/api/pre-treino/records', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const r = req.body;
        const recordId = r.id || 'pt_rec_' + Date.now();
        const customerId = r.customerId || r.customer_id || null;
        const nomeCliente = r.customerName || r.nome_cliente || 'Cliente';
        const produtoId = r.productId || r.produto_id || '';
        const nomeProduto = r.productName || r.nome_produto || '';
        const custo = Number(r.cost !== undefined ? r.cost : (r.custo !== undefined ? r.custo : 0));
        const data = r.date || r.data || new Date().toISOString().split('T')[0];
        const horario = r.horario || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        await pool.query(
            `INSERT INTO pre_treino_registros (id, user_id, customer_id, nome_cliente, produto_id, nome_produto, custo, data, horario)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (id) DO UPDATE SET customer_id = $3, nome_cliente = $4, produto_id = $5, nome_produto = $6, custo = $7, data = $8, horario = $9`,
            [recordId, userId, customerId, nomeCliente, produtoId, nomeProduto, custo, data, horario]
        );
        return res.status(201).json({ message: 'Registro de pré-treino salvo!' });
    } catch (error) {
        console.error('Erro ao salvar registro de pré-treino:', error);
        return res.status(500).json({ error: 'Erro interno' });
    }
});

app.delete('/api/pre-treino/records/:id', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const recordId = req.params.id;
        await pool.query('DELETE FROM pre_treino_registros WHERE id = $1 AND user_id = $2', [recordId, userId]);
        return res.status(200).json({ message: 'Registro removido com sucesso' });
    } catch (error) {
        console.error('Erro ao remover registro de pré-treino:', error);
        return res.status(500).json({ error: 'Erro interno' });
    }
});

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
                                text: mensagemFinal,
                                options: {
                                    delay: 1200,
                                    presence: "composing"
                                }
                            })
                        });
                    } catch (err) {
                        console.error(`Erro ao enviar mensagem automática para ${phoneClean}:`, err);
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
    console.log(`Servidor rodando na porta ${PORT}`)
});