import cron from 'node-cron';
import { pool } from './db.js';
import { sendWhatsAppText } from './whatsapp.js';

function renderTemplate(template, customer) {
    return template.replaceAll('{nome}', customer.name.split(' ')[0]);
}

export async function runScheduleBatch(schedule) {
    // Busca clientes opt-in do usuário dono da programação
    const customers = await pool.query(
        `SELECT * FROM customers WHERE user_id = $1 AND whatsapp_opt_in = 1`,
        [schedule.user_id]
    );

    for (const customer of customers.rows) {
        const message = renderTemplate(schedule.message_template, customer);
        await sendWhatsAppText(customer.phone, message);
    }
}

export function startReminderScheduler() {
    // Roda a cada minuto
    cron.schedule('* * * * *', async () => {
        const now = new Date();
        const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        
        // Formata hora atual para comparar com TIME do banco (HH:MM)
        const currentTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ':00';

        // Busca todas as programações que coincidem com o dia e hora atuais
        const schedules = await pool.query(`
            SELECT * FROM whatsapp_schedules 
            WHERE $1 = ANY(days_of_week) AND send_time = $2
        `, [currentDay, currentTime]);

        for (const schedule of schedules.rows) {
            await runScheduleBatch(schedule);
        }
    }, { timezone: 'America/Sao_Paulo' });
}