# Bot de lembretes WhatsApp — BYSE PRO

O bot registra clientes e compras e envia lembretes automaticamente **duas vezes por semana**, por padrão às **terças e sextas às 10:00 (horário de Brasília)**.

## Regras
- Só envia para clientes que tenham compra registrada.
- Só envia para clientes com `whatsappOptIn = true` e `remindersEnabled = true`.
- Cada cliente recebe no máximo 1 lembrete por dia agendado.
- O texto usa a compra mais recente do cliente.

## Configuração
1. Copie `.env.example` para `.env`.
2. Preencha as credenciais da WhatsApp Cloud API da Meta.
3. Rode `npm install`.
4. Rode `npm run server`.

O servidor fica em `http://localhost:3333`.
