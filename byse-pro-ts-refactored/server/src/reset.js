// script-reset.js
import { db } from './db.js';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';

async function seed() {
  const email = 'teste@exemplo.com';
  const password = 'senha123';
  const name = 'Usuario Teste';

  db.prepare('DELETE FROM users WHERE email = ?').run(email);

  const hash = await bcrypt.hash(password, 10);

  db.prepare(
    'INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)'
  ).run(randomUUID(), name, email, hash);

  console.log('✅ Usuário gravado com sucesso no banco correto!');
}

seed();