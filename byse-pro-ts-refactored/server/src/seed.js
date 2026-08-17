import 'dotenv/config';
import bcrypt from 'bcrypt';
import { db } from './db.ts';

async function createUser(nome, email, plainPassword) {
  try {
    // 1. Gera o hash da senha
    const passwordHash = await bcrypt.hash(plainPassword, 10);
    const userId = `usr_${Date.now()}`;

    // 2. Insere na tabela usando better-sqlite3
    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, nome, email, passwordHash, new Date().toISOString());

    console.log(`✅ Usuário '${nome}' criado com sucesso!`);
    console.log(`Email: ${email}`);
    console.log(`Senha: ${plainPassword}`);
  } catch (err) {
    console.error("❌ Erro ao criar usuário:", err.message);
  }
}

// Executa para criar o seu usuário de teste
createUser('Usuário Teste', 'teste@exemplo.com', 'senha123');