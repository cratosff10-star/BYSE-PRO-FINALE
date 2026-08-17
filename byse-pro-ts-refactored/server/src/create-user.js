const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const db = new sqlite3.Database('./database.sqlite'); // Caminho do seu arquivo .sqlite / .db

async function createUser(email, plainPassword) {
  // 1. Gera o hash da senha por segurança
  const passwordHash = await bcrypt.hash(plainPassword, 10);

  // 2. Insere o usuário na tabela
  const query = `INSERT INTO users (email, password) VALUES (?, ?)`;

  db.run(query, [email, passwordHash], function (err) {
    if (err) {
      console.error("Erro ao criar usuário:", err.message);
    } else {
      console.log(`Usuário criado com sucesso! ID: ${this.lastID}`);
    }
    db.close();
  });
}

// Executa para criar o seu usuário de teste
createUser('teste@exemplo.com', 'senha123');