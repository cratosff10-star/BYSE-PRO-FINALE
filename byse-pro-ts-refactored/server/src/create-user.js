import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

// Força o carregamento do .env da pasta raiz "server"
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Importação dinâmica do pool após carregar as variáveis
const { pool } = await import('./db.js');

async function createUser() {
  const nome = 'Seu Nome';
  const email = 'seu_email@exemplo.com';
  const password = 'sua_senha_aqui';

  try {
    const cleanEmail = email.trim().toLowerCase();

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [cleanEmail]);
    if (existing.rows.length > 0) {
      console.log('⚠️ Este e-mail já está cadastrado!');
      process.exit(0);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = `usr_${Date.now()}`;

    await pool.query(
      `INSERT INTO users (id, name, email, password, created_at) 
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, nome.trim(), cleanEmail, passwordHash, new Date().toISOString()]
    );

    console.log('✅ Usuário criado com sucesso no PostgreSQL!');
    console.log(`Email: ${cleanEmail}`);
  } catch (error) {
    console.error('❌ Erro ao criar usuário:', error);
  } finally {
    await pool.end();
  }
}

createUser("MATHEUS CEO","matheusbyseceo@gmail.com","CEO@b2026");