import { db } from './db.js';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';

async function createUser(name, email, plainPassword) {
  try {
    // Normaliza o e-mail para evitar problemas de login depois
    const cleanEmail = email.trim().toLowerCase();

    // 1. Gera o ID único e o hash da senha
    const id = randomUUID();
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    // 2. Prepara e executa a inserção com a coluna correta (password_hash)
    const stmt = db.prepare(
      'INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)'
    );
    stmt.run(id, name, cleanEmail, passwordHash);

    console.log(`Usuário criado com sucesso! ID: ${id}`);
  } catch (err) {
    console.error('Erro ao criar usuário:', err.message);
  }
}

// Executa para criar o seu usuário de teste
createUser('Usuário CEO', 'matheusbyseceo@gmail.com', 'CEO@b2026');