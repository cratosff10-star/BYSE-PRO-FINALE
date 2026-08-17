import { db } from './db.js';

try {
  const users = db.prepare('SELECT id, name, email, created_at FROM users').all();
  console.log('📌 Usuários cadastrados no banco:');
  console.table(users);
} catch (error) {
  console.error('Erro ao buscar usuários:', error.message);
}