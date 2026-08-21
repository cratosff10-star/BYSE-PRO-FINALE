import cron from 'node-cron';
import { pool } from './db.js';
import { sendWhatsAppText } from './whatsapp.js';

export async function getSettings() {
    const result = await pool.query('SELECT * FROM reminder_settings WHERE id = 1');
    return result.rows[0];
}

function renderTemplate(template, customer, purchase) {
    const items = typeof purchase.items_json === 'string' 
        ? JSON.parse(purchase.items_json) 
        : purchase.items_json;
        
    const products = items.map((item) => `${item.qty}x ${item.name}`).join(', ');
    
    return template
        .replaceAll('{nome}', customer.name.split(' ')[0])
        .replaceAll('{produtos}', products)
        .replaceAll('{total}', Number(purchase.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
}

export async function runReminderBatch() {
    const settings = await getSettings();
    if (!settings || !settings.enabled)
        return { sent: 0, skipped: 0, failed: 0 };

    const scheduledDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

    // Consulta adaptada para PostgreSQL usando subquery com DISTINCT ON
    const customersQuery = await pool.query(`
        SELECT DISTINCT ON (c.id) 
            c.*, 
            p.id as purchase_id, 
            p.total, 
            p.items_json, 
            p.purchased_at
        FROM customers c
        JOIN purchases p ON p.customer_id = c.id
        WHERE c.whatsapp_opt_in = 1 AND c.reminders_enabled = 1
        ORDER BY c.id, p.purchased_at DESC
    `);

    const customers = customersQuery.rows;
    let sent = 0, skipped = 0, failed = 0;

    for (const customer of customers) {
        const existsQuery = await pool.query(
            'SELECT 1 FROM reminder_logs WHERE customer_id = $1 AND scheduled_date = $2',
            [customer.id, scheduledDate]
        );

        if (existsQuery.rows.length > 0) {
            skipped++;
            continue;
        }

        const message = renderTemplate(settings.template, customer, customer);
        const result = await sendWhatsAppText(customer.phone, message);

        await pool.query(`
            INSERT INTO reminder_logs (customer_id, scheduled_date, sent_at, status, message, error) 
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [
            customer.id, 
            scheduledDate, 
            new Date().toISOString(), 
            result.ok ? 'sent' : 'failed', 
            message, 
            result.ok ? null : result.error
        ]);

        if (result.ok)
            sent++;
        else
            failed++;
    }

    return { sent, skipped, failed };
}

export function startReminderScheduler() {
    cron.schedule('* * * * *', async () => {
        const settings = await getSettings();
        if (!settings || !settings.enabled)
            return;

        const now = new Date();
        const parts = new Intl.DateTimeFormat('en-US', { 
            timeZone: 'America/Sao_Paulo', 
            weekday: 'long', 
            hour: '2-digit', 
            minute: '2-digit', 
            hour12: false 
        }).formatToParts(now);

        const weekday = parts.find((p) => p.type === 'weekday')?.value.toLowerCase();
        const hour = Number(parts.find((p) => p.type === 'hour')?.value);
        const minute = Number(parts.find((p) => p.type === 'minute')?.value);

        const allowedDays = [settings.first_day, settings.second_day, settings.third_day].filter(Boolean);

        if (allowedDays.includes(weekday) && hour === Number(settings.hour) && minute === Number(settings.minute)) {
            await runReminderBatch();
        }
    }, { timezone: 'America/Sao_Paulo' });
}