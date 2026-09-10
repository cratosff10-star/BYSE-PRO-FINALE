import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { pool, initDb } from './db.js';
import bcrypt from 'bcrypt';
import 'dotenv/config';

// Importações do Baileys, utilitários e gerador de QR Code em imagem
import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cors());

if (typeof initDb === 'function') {
    initDb().catch(err => console.error('Erro na inicialização do DB:', err));
}

// ==========================================
// GERENCIAMENTO MULTI-USUÁRIO DA SESSÃO BAILEYS
// ==========================================
const activeSessions = {}; // Estrutura: { [userId]: { sock, status, qr } }

async function getOrCreateWhatsAppSession(userId) {
    console.log(`\n========================================`);
    console.log(`[WHATSAPP SESSION] Requisitando sessão para o User ID: ${userId}`);

    if (activeSessions[userId]?.sock) {
        console.log(`[WHATSAPP SESSION] Sessão em memória já existe para o usuário: ${userId}`);
        return activeSessions[userId];
    }

    const sessionPath = `auth_info_baileys_${userId}`;
    console.log(`[WHATSAPP SESSION] Carregando pasta de autenticação no disco: ${sessionPath}`);

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
    });

    activeSessions[userId] = {
        sock,
        status: 'disconnected',
        qr: null
    };

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            activeSessions[userId].status = 'qr_needed';
            try {
                activeSessions[userId].qr = await QRCode.toDataURL(qr, {
                    errorCorrectionLevel: 'M',
                    margin: 2,
                    scale: 6
                });
                console.log(`[WHATSAPP QR] 📷 Novo QR Code gerado e convertido para Base64 para o usuário: ${userId}`);
            } catch (err) {
                console.error(`[WHATSAPP QR ERROR] Erro ao converter QR Code para Base64 (User ${userId}):`, err);
            }
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            activeSessions[userId].status = 'disconnected';
            activeSessions[userId].qr = null;
            console.log(`[WHATSAPP CONNECTION] Conexão fechada para o usuário ${userId}. Deve reconectar?`, shouldReconnect);
            if (shouldReconnect) {
                delete activeSessions[userId];
                getOrCreateWhatsAppSession(userId);
            }
        } else if (connection === 'open') {
            activeSessions[userId].status = 'connected';
            activeSessions[userId].qr = null;
            console.log(`[WHATSAPP CONNECTION] ✅ WhatsApp conectado com SUCESSO para o usuário isolado: ${userId}!`);
        }
    });

    sock.ev.on('creds.update', saveCreds);

    return activeSessions[userId];
}

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log(`[LOGIN] Tentativa de login para o e-mail: ${email}`);
        
        let result = await pool.query(
            'SELECT id, name, email, password FROM users WHERE email = $1',
            [email]
        );

        let user;
        if (result.rows.length === 0) {
            // CORREÇÃO SÊNIOR: Geração de ID dinâmico e estritamente único para novos cadastros
            const newId = 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
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
            console.warn(`[LOGIN WARNING] Senha inválida para o e-mail: ${email}`);
            return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
        }

        console.log(`[LOGIN SUCCESS] Usuário autenticado com ID: ${user.id} (${user.email})`);
        return res.status(200).json({
            token: 'jwt_token_' + user.id,
            user: { id: user.id, name: user.name, email: user.email }
        });
    } catch (error) {
        console.error('[LOGIN ERROR] Erro interno no login:', error);
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

    if (!finalUserId && req.headers['x-user-id']) {
        finalUserId = req.headers['x-user-id'];
    }

    if (!finalUserId) {
        console.warn(`[AUTH SECURITY] Requisição bloqueada na rota ${req.method} ${req.originalUrl}: Usuário não autenticado ou ID ausente.`);
        return res.status(401).json({ error: 'Usuário não autenticado.' });
    }

    console.log(`[AUTH SECURITY] Request autorizado | Rota: ${req.method} ${req.originalUrl} | User ID identificado: ${finalUserId}`);
    req.user = { id: finalUserId };
    next();
};

app.get('/api/public/catalogo/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        
        const userRes = await pool.query(
            'SELECT id, name FROM users WHERE id = $1',
            [userId]
        );

        if (userRes.rows.length === 0) {
            return res.status(404).json({ error: 'Loja não encontrada.' });
        }

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

const handleGetCustomers = async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, name, phone, cpf, data_aniversario, cashback, status, status_mensalidade, data_vencimento, valor_mensalidade FROM customers WHERE user_id = $1',
            [req.user.id]
        );
        
        const mappedRows = result.rows.map(c => ({
            ...c,
            nome: c.name,
            telefone: c.phone,
            statusMensalidade: c.status_mensalidade,
            dataVencimento: c.data_vencimento,
            valorMensalidade: Number(c.valor_mensalidade || 0)
        }));

        return res.status(200).json(mappedRows);
    } catch (error) {
        console.error('Erro ao listar clientes:', error);
        return res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

const handlePostCustomer = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id, name, nome, phone, telefone, cpf, data_aniversario, birthDate, cashback, status, status_mensalidade, statusMensalidade, data_vencimento, dataVencimento, valor_mensalidade, valorMensalidade } = req.body;
        
        const clienteId = id || 'c' + Date.now();
        const nomeFinal = name || nome || 'Cliente';
        const telefoneFinal = phone || telefone || '';
        const statusMensalidadeFinal = status_mensalidade || statusMensalidade || 'Pendente (Não Pago)';
        const vencimentoFinal = data_vencimento || dataVencimento || null;
        const valorMensalidadeFinal = parseFloat(valor_mensalidade || valorMensalidade || 0);
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
                nomeFinal, 
                telefoneFinal, 
                cpf || '', 
                aniversarioFinal,
                cashback || 0, 
                status || 'Ativo', 
                statusMensalidadeFinal, 
                vencimentoFinal, 
                valorMensalidadeFinal
            ]
        );

        const clienteData = { 
            id: clienteId, 
            userId, 
            name: nomeFinal, 
            nome: nomeFinal, 
            phone: telefoneFinal, 
            telefone: telefoneFinal, 
            statusMensalidade: statusMensalidadeFinal,
            status_mensalidade: statusMensalidadeFinal,
            dataVencimento: vencimentoFinal,
            data_vencimento: vencimentoFinal,
            valorMensalidade: valorMensalidadeFinal,
            valor_mensalidade: valorMensalidadeFinal,
            cashback: cashback || 0, 
            status: status || 'Ativo' 
        };
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

        const salesFormatted = result.rows.map(s => {
            let normalizedGender = s.gender || 'Prefiro não informar';
            if (normalizedGender === 'Não informado') normalizedGender = 'Prefiro não informar';
            
            return {
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
                gender: normalizedGender,
                salesChannel: s.sales_channel || 'Loja física',
                sales_channel: s.sales_channel || 'Loja física',
                deliveryType: s.delivery_type || 'Retirada',
                delivery_type: s.delivery_type || 'Retirada',
                items: typeof s.items === 'string' ? JSON.parse(s.items || '[]') : (s.items || []),
                date: s.date ? new Date(s.date).toISOString() : new Date().toISOString()
            };
        });

        return res.status(200).json(salesFormatted);
    } catch (error) {
        console.error('Erro ao buscar vendas:', error);
        return res.status(200).json([]);
    }
});

app.post('/api/sales', authMiddleware, async (req, res) => {
    const client = await pool.connect();
    try {
        const userId = req.user.id;
        const s = req.body;
        const saleId = s.id || `sale_${Date.now()}`;
        const items = Array.isArray(s.items) ? s.items : [];
        const discountVal = Number(s.discount || 0);
        const subtotalVal = Number(s.subtotal || 0);
        const totalVal = Number(s.total || 0);
        const customerId = s.customerId || s.customer_id || null;

        let rawGender = s.gender || 'Prefiro não informar';
        if (rawGender === 'Não informado') rawGender = 'Prefiro não informar';
        const normalizedGender = (rawGender.trim() !== '') ? rawGender : 'Prefiro não informar';

        await client.query('BEGIN');

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
            customerId,
            s.customer_name || s.customerName || 'Cliente Geral',
            s.seller || '',
            s.payment_method || s.paymentMethod || 'Pix',
            discountVal,
            subtotalVal,
            totalVal,
            normalizedGender,
            s.sales_channel || s.salesChannel || 'Loja física',
            s.delivery_type || s.deliveryType || 'Retirada',
            JSON.stringify(items),
            s.date || new Date().toISOString()
        ]);
        
        if (customerId) {
            const earnedCashback = totalVal * 0.03;
            await client.query(
                `UPDATE customers SET cashback = COALESCE(cashback, 0) + $1 WHERE id = $2 AND user_id = $3`,
                [earnedCashback, customerId, userId]
            );
        }

        const locaisRes = await client.query('SELECT id, name FROM stock_locations WHERE user_id = $1', [userId]);
        const locaisMap = {};
        locaisRes.rows.forEach(l => {
            locaisMap[l.id] = l.name;
            locaisMap[l.name] = l.name;
        });

        for (const item of items) {
            const prodId = item.id || item.productId;
            const qtdVendida = Number(item.quantity || item.qty || 1);
            const rawLocal = item.local || item.location || item.stockLocationId || 'Loja Física';
            const localName = locaisMap[rawLocal] || rawLocal;

            if (prodId) {
                const prodRes = await client.query('SELECT stocks, control_stock FROM products WHERE id = $1 AND user_id = $2', [prodId, userId]);
                
                if (prodRes.rows.length > 0) {
                    const prod = prodRes.rows[0];
                    if (prod.control_stock !== false) {
                        let stocksObj = typeof prod.stocks === 'string' ? JSON.parse(prod.stocks || '{}') : (prod.stocks || {});
                        if (!stocksObj || typeof stocksObj !== 'object') {
                            stocksObj = {};
                        }

                        let chaveAlvo = localName;
                        if (stocksObj[rawLocal] !== undefined) {
                            chaveAlvo = rawLocal;
                        } else if (!stocksObj[chaveAlvo]) {
                            const chaveEncontrada = Object.keys(stocksObj).find(k => k.toLowerCase() === localName.toLowerCase());
                            if (chaveEncontrada) {
                                chaveAlvo = chaveEncontrada;
                            } else if (stocksObj['Estoque Principal'] !== undefined && (localName === 'Loja Física' || localName === 'loja-fisica')) {
                                chaveAlvo = 'Estoque Principal';
                            } else if (Object.keys(stocksObj).length === 1) {
                                chaveAlvo = Object.keys(stocksObj)[0];
                            }
                        }

                        const estoqueAtual = Number(stocksObj[chaveAlvo] || 0);
                        const novoEstoque = Math.max(0, estoqueAtual - qtdVendida);
                        stocksObj[chaveAlvo] = novoEstoque;

                        await client.query(
                            'UPDATE products SET stocks = $1 WHERE id = $2 AND user_id = $3',
                            [JSON.stringify(stocksObj), prodId, userId]
                        );
                    }
                }
            }
        }

        await client.query('COMMIT');
        return res.status(201).json({ message: 'Venda salva, estoque atualizado e cashback computado com sucesso!', saleId });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erro ao salvar venda e atualizar estoque/cashback:', error);
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
                [defaultLocId, userId, 'Loja Física']
            ).catch(() => {});
            return res.status(200).json([{ id: defaultLocId, name: 'Loja Física' }]);
        }

        return res.status(200).json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar locais:', error);
        return res.status(200).json([{ id: 'loc_main_' + req.user.id, name: 'Loja Física' }]);
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
            return res.status(200).json(defaultProds.map(p => ({ ...p, nome: p.name, custo: p.cost })));
        }
        return res.status(200).json(result.rows.map(p => ({ 
            id: p.id,
            name: p.name,
            nome: p.name,
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
        const { id, name, nome, cost, custo } = req.body;
        const finalName = name || nome || 'Produto';
        const finalCost = cost !== undefined ? cost : (custo !== undefined ? custo : 0);
        const prodId = id || 'pt_prod_' + Date.now();
        
        await pool.query(
            `INSERT INTO pre_treino_produtos (id, user_id, name, cost) VALUES ($1, $2, $3, $4)
             ON CONFLICT (id) DO UPDATE SET name = $3, cost = $4`,
            [prodId, userId, finalName, parseFloat(finalCost) || 0]
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
            customer_id: r.customer_id,
            customerName: r.nome_cliente,
            nomeCliente: r.nome_cliente,
            productId: r.produto_id,
            productName: r.nome_produto,
            nomeProduto: r.nome_produto,
            cost: Number(r.custo || 0),
            custo: Number(r.custo || 0),
            date: r.data || new Date().toISOString(),
            data: r.data,
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
        const nomeCliente = r.customerName || r.nomeCliente || r.nome_cliente || 'Cliente';
        const produtoId = r.productId || r.produto_id || '';
        const nomeProduto = r.productName || r.nomeProduto || r.nome_produto || '';
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

// ==========================================
// ROTAS DE WHATSAPP & INTEGRAÇÃO BAILEYS ISOLADAS POR USER_ID
// ==========================================

app.get('/api/whatsapp/status', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    console.log(`[WHATSAPP ROUTE] GET /api/whatsapp/status chamado para o User ID: ${userId}`);
    const session = await getOrCreateWhatsAppSession(userId);
    return res.json({ status: session.status, qr: session.qr });
});

app.get('/api/whatsapp/qr', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    console.log(`[WHATSAPP ROUTE] GET /api/whatsapp/qr chamado para o User ID: ${userId}`);
    const session = await getOrCreateWhatsAppSession(userId);

    if (session.status === 'connected') {
        console.log(`[WHATSAPP QR] Tentativa de gerar QR para o usuário ${userId}, mas o WhatsApp já está conectado.`);
        return res.status(400).json({ error: 'WhatsApp já está conectado para este usuário!' });
    }
    if (!session.qr) {
        console.log(`[WHATSAPP QR] session.qr está nulo para o usuário ${userId}.`);
        return res.status(200).json({ success: false, message: 'QR Code ainda não foi gerado. Aguarde alguns instantes e tente novamente.' });
    }
    console.log(`[WHATSAPP QR] Enviando QR Code Base64 para o front-end do usuário ${userId}.`);
    return res.json({ success: true, qr: session.qr });
});

// ROTA DE RESET / FORÇAR NOVO QR CODE
app.post('/api/whatsapp/reset', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    console.log(`[WHATSAPP ROUTE] POST /api/whatsapp/reset chamado para o User ID: ${userId}`);

    try {
        if (activeSessions[userId]?.sock) {
            try {
                await activeSessions[userId].sock.logout();
            } catch (e) {}
            try {
                activeSessions[userId].sock.end(undefined);
            } catch (e) {}
        }
        delete activeSessions[userId];

        const sessionPath = `auth_info_baileys_${userId}`;
        if (fs.existsSync(sessionPath)) {
            fs.rmSync(sessionPath, { recursive: true, force: true });
            console.log(`[WHATSAPP RESET] Pasta de sessão ${sessionPath} removida com sucesso.`);
        }

        const newSession = await getOrCreateWhatsAppSession(userId);

        return res.json({ success: true, message: 'Sessão reiniciada com sucesso. Aguarde o novo QR Code.' });
    } catch (error) {
        console.error('[WHATSAPP RESET ERROR] Erro ao resetar sessão:', error);
        return res.status(500).json({ error: 'Erro ao reiniciar sessão do WhatsApp.' });
    }
});

app.get('/api/whatsapp', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await pool.query('SELECT schedules FROM user_whatsapp_schedules WHERE user_id = $1', [userId]);
        if (result.rows.length > 0) {
            return res.json(result.rows[0].schedules);
        }
        return res.json([]);
    } catch (e) {
        return res.json([]);
    }
});

app.post('/api/whatsapp', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const schedules = req.body;
        
        await pool.query(
            `INSERT INTO user_whatsapp_schedules (user_id, schedules) VALUES ($1, $2)
             ON CONFLICT (user_id) DO UPDATE SET schedules = $2`,
            [userId, JSON.stringify(schedules)]
        );

        return res.json({ success: true, message: 'Agendamentos salvos com sucesso!' });
    } catch (error) {
        console.error('Erro ao salvar agendamentos:', error);
        return res.status(500).json({ error: 'Erro ao salvar programações.' });
    }
});

app.post('/api/whatsapp/send-batch', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log(`[WHATSAPP BATCH] Iniciando disparo em lote para o User ID: ${userId}`);
        
        const session = await getOrCreateWhatsAppSession(userId);

        if (session.status !== 'connected' || !session.sock) {
            console.warn(`[WHATSAPP BATCH WARNING] Tentativa de disparo sem conexão ativa para o User ID: ${userId}`);
            return res.status(400).json({ error: 'WhatsApp não está conectado no backend. Escaneie o QR Code na tela primeiro.' });
        }

        const { text, sendToAll, customerIds } = req.body;

        let query = 'SELECT name, phone, cashback FROM customers WHERE user_id = $1 AND phone IS NOT NULL AND phone != \'\'';
        let params = [userId];

        if (!sendToAll && Array.isArray(customerIds) && customerIds.length > 0) {
            query += ' AND id = ANY($2)';
            params.push(customerIds);
        }

        const customersRes = await pool.query(query, params);
        const customers = customersRes.rows;

        if (customers.length === 0) {
            return res.status(400).json({ error: 'Nenhum cliente com telefone válido encontrado.' });
        }

        let sentCount = 0;
        for (const c of customers) {
            let message = (text || '')
                .replace(/{nome}/g, c.name || 'Cliente')
                .replace(/{saldo}/g, `R$ ${Number(c.cashback || 0).toFixed(2)}`);

            let phoneClean = c.phone.replace(/\D/g, '');
            if (!phoneClean.startsWith('55')) {
                phoneClean = '55' + phoneClean;
            }

            const jid = `${phoneClean}@s.whatsapp.net`;
            try {
                await session.sock.sendMessage(jid, { text: message });
                sentCount++;
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (err) {
                console.error(`[WHATSAPP BATCH ERROR] Falha ao enviar mensagem para ${phoneClean} (User ${userId}):`, err);
            }
        }

        console.log(`[WHATSAPP BATCH SUCCESS] ${sentCount} mensagens enviadas para o usuário ${userId}.`);
        return res.json({ success: true, message: `${sentCount} mensagens enviadas com sucesso via Baileys!` });
    } catch (error) {
        console.error('Erro ao enviar lote pelo Baileys:', error);
        return res.status(500).json({ error: 'Erro ao processar envio em lote.' });
    }
});

app.post('/api/whatsapp/prepare-batch', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { text, sendToAll, customerIds } = req.body;

        let query = 'SELECT name, phone, cashback FROM customers WHERE user_id = $1 AND phone IS NOT NULL AND phone != \'\'';
        let params = [userId];

        if (!sendToAll && Array.isArray(customerIds) && customerIds.length > 0) {
            query += ' AND id = ANY($2)';
            params.push(customerIds);
        }

        const customersRes = await pool.query(query, params);
        const customers = customersRes.rows;

        if (customers.length === 0) {
            return res.status(400).json({ error: 'Nenhum cliente com telefone válido encontrado.' });
        }

        const messagesList = customers.map(c => {
            let message = (text || '')
                .replace(/{nome}/g, c.name || 'Cliente')
                .replace(/{saldo}/g, `R$ ${Number(c.cashback || 0).toFixed(2)}`);

            let phoneClean = c.phone.replace(/\D/g, '');
            if (!phoneClean.startsWith('55')) {
                phoneClean = '55' + phoneClean;
            }

            return {
                phone: phoneClean,
                name: c.name,
                whatsappUrl: `https://wa.me/${phoneClean}?text=${encodeURIComponent(message)}`
            };
        });

        return res.json({ success: true, targets: messagesList });
    } catch (error) {
        console.error('Erro ao preparar lote do WhatsApp:', error);
        return res.status(500).json({ error: 'Erro ao preparar lote.' });
    }
});

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});