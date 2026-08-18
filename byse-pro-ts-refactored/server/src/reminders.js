import cron from 'node-cron';
import { db } from './db.js';
import { sendWhatsAppText } from './whatsapp.js';
export function getSettings() {
    return db.prepare('SELECT * FROM reminder_settings WHERE id = 1').get();
}
function renderTemplate(template, customer, purchase) {
    const items = JSON.parse(purchase.items_json);
    const products = items.map((item) => `${item.qty}x ${item.name}`).join(', ');
    return template
        .replaceAll('{nome}', customer.name.split(' ')[0])
        .replaceAll('{produtos}', products)
        .replaceAll('{total}', Number(purchase.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
}
export async function runReminderBatch() {
    const settings = getSettings();
    if (!settings.enabled)
        return { sent: 0, skipped: 0, failed: 0 };
    const scheduledDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const customers = db.prepare(`
    SELECT c.*, p.id purchase_id, p.total, p.items_json, p.purchased_at
    FROM customers c
    JOIN purchases p ON p.customer_id = c.id
    WHERE c.whatsapp_opt_in = 1 AND c.reminders_enabled = 1
      AND p.id = (SELECT p2.id FROM purchases p2 WHERE p2.customer_id = c.id ORDER BY datetime(p2.purchased_at) DESC LIMIT 1)
  `).all();
    let sent = 0, skipped = 0, failed = 0;
    for (const customer of customers) {
        const exists = db.prepare('SELECT 1 FROM reminder_logs WHERE customer_id = ? AND scheduled_date = ?').get(customer.id, scheduledDate);
        if (exists) {
            skipped++;
            continue;
        }
        const message = renderTemplate(settings.template, customer, customer);
        const result = await sendWhatsAppText(customer.phone, message);
        db.prepare(`INSERT INTO reminder_logs (customer_id, scheduled_date, sent_at, status, message, error) VALUES (?, ?, ?, ?, ?, ?)`)
            .run(customer.id, scheduledDate, new Date().toISOString(), result.ok ? 'sent' : 'failed', message, result.ok ? null : result.error);
        if (result.ok)
            sent++;
        else
            failed++;
    }
    return { sent, skipped, failed };
}
export function startReminderScheduler() {
    cron.schedule('* * * * *', async () => {
        const settings = getSettings();
        if (!settings.enabled)
            return;
        const now = new Date();
        const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
        const weekday = parts.find((p) => p.type === 'weekday')?.value.toLowerCase();
        const hour = Number(parts.find((p) => p.type === 'hour')?.value);
        const minute = Number(parts.find((p) => p.type === 'minute')?.value);
        const allowedDays = [settings.first_day, settings.second_day];
        if (allowedDays.includes(weekday) && hour === Number(settings.hour) && minute === Number(settings.minute)) {
            await runReminderBatch();
        }
    }, { timezone: 'America/Sao_Paulo' });
}
