import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import cron from 'node-cron';
import { Boom } from '@hapi/boom';
import pkg from 'pg';
const { Pool } = pkg;

let sock = null;

// Inicializa a conexão persistente com o WhatsApp
export async function connectToWhatsApp(poolInstance) {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        browser: ['BYSE PRO', 'Chrome', '10.0']
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('[WhatsApp] Escaneie o QR Code abaixo com o seu celular:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('[WhatsApp] Conexão fechada. Reconectando...', shouldReconnect);
            if (shouldReconnect) {
                setTimeout(() => connectToWhatsApp(poolInstance), 5000);
            }
        } else if (connection === 'open') {
            console.log('[WhatsApp] Conectado com sucesso!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // Configurar o agendamento com node-cron (roda a cada minuto para verificar horários)
    cron.schedule('* * * * *', async () => {
        try {
            const now = new Date();
            const diasSemana = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
            const diaAtual = diasSemana[now.getDay()];
            const horaAtual = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

            // Busca todos os agendamentos ativos no banco
            const resSchedules = await poolInstance.query('SELECT user_id, schedules FROM user_whatsapp_schedules');
            
            for (const row of resSchedules.rows) {
                const userId = row.user_id;
                const schedules = typeof row.schedules === 'string' ? JSON.parse(row.schedules) : row.schedules;

                if (!Array.isArray(schedules)) continue;

                for (const sch of schedules) {
                    if (!sch.enabled) continue;
                    
                    const matchDay = Array.isArray(sch.days) && sch.days.includes(diaAtual);
                    const matchTime = sch.time === horaAtual;

                    if (matchDay && matchTime) {
                        console.log(`[Cron] Disparando automação "${sch.label}" para o usuário ${userId} às ${horaAtual}`);
                        await executeBatchSend(poolInstance, userId, sch);
                    }
                }
            }
        } catch (err) {
            console.error('[Cron Error] Erro ao processar agendamentos do WhatsApp:', err);
        }
    });
}

// Função para disparar mensagens em lote pelo Baileys
async function executeBatchSend(pool, userId, schedule) {
    if (!sock) {
        console.log('[WhatsApp] Cliente Baileys não está conectado no momento.');
        return;
    }

    try {
        let query = 'SELECT name, phone, cashback FROM customers WHERE user_id = $1 AND phone IS NOT NULL AND phone != \'\'';
        let params = [userId];

        if (!schedule.sendToAll && Array.isArray(schedule.customerIds) && schedule.customerIds.length > 0) {
            query += ' AND id = ANY($2)';
            params.push(schedule.customerIds);
        }

        const customersRes = await pool.query(query, params);
        const customers = customersRes.rows;

        for (const c of customers) {
            let message = (schedule.text || '')
                .replace(/{nome}/g, c.name || 'Cliente')
                .replace(/{saldo}/g, `R$ ${Number(c.cashback || 0).toFixed(2)}`);

            let phoneClean = c.phone.replace(/\D/g, '');
            if (!phoneClean.startsWith('55')) {
                phoneClean = '55' + phoneClean;
            }

            const jid = `${phoneClean}@s.whatsapp.net`;
            
            try {
                await sock.sendMessage(jid, { text: message });
                console.log(`[WhatsApp] Mensagem enviada com sucesso para ${c.name} (${phoneClean})`);
                // Delay de 2 segundos entre as mensagens para evitar bloqueio
                await new Promise(r => setTimeout(r, 2000));
            } catch (err) {
                console.error(`[WhatsApp] Erro ao enviar para ${phoneClean}:`, err.message);
            }
        }
    } catch (error) {
        console.error('[WhatsApp] Erro no lote de envio automático:', error);
    }
}