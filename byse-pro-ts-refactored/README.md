# BYSE PRO — React + TypeScript + Bot de lembretes WhatsApp

Sistema de gerenciamento de mercadorias com Dashboard, Clientes, Estoque, PDV, Vendedores, Catálogo, Cashback, Fiados, DRE, Marketing e integração com bot de lembretes via WhatsApp.

## Bot de lembretes

O bot foi integrado ao fluxo do PDV:

1. O cliente é cadastrado com telefone e escolha de recebimento de mensagens no WhatsApp.
2. Ao finalizar uma compra para um cliente cadastrado, a compra é enviada ao backend.
3. O backend salva cliente + compra em SQLite.
4. O bot consulta a compra mais recente de cada cliente autorizado.
5. O envio automático ocorre duas vezes por semana, por padrão terça e sexta às 10:00 no horário de Brasília.
6. Cada cliente recebe no máximo um lembrete por dia agendado.
7. A tela WhatsApp permite ativar/pausar o bot, trocar dias/horário, editar a mensagem e executar um teste manual.

## Rodar

Terminal 1 — frontend:

```bash
npm install
npm run dev
```

Terminal 2 — bot/backend:

```bash
npm run server
```

Frontend: http://localhost:5173
Backend: http://localhost:3333

## WhatsApp Cloud API

Copie `.env.example` para `.env` e preencha:

```env
WHATSAPP_GRAPH_VERSION=versao-da-api
WHATSAPP_PHONE_NUMBER_ID=seu-id
WHATSAPP_ACCESS_TOKEN=seu-token
```

O token fica somente no backend. Nunca coloque o token da Meta em `VITE_*` ou no código React.

## Observação de consentimento

O sistema registra o consentimento do cliente para receber mensagens no WhatsApp. Clientes sem autorização não entram no lote automático. Isso evita disparos para pessoas que não autorizaram comunicação.
