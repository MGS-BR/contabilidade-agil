import './env.js';
import { createApp } from './app.js';
import { setupDatabase } from './setup-db.js';

const PORT = Number(process.env.PORT || 3000);

async function iniciar() {
  // Na primeira subida em um banco vazio, cria tabelas e carga inicial.
  // Desligue com DB_AUTO_SETUP=false se preferir rodar "npm run db:setup" à mão.
  if (process.env.DB_AUTO_SETUP !== 'false') {
    try {
      await setupDatabase();
    } catch (err) {
      console.error('[db] Não foi possível preparar o banco:', err.message);
      console.error('[db] Confira a variável DATABASE_URL. O servidor sobe mesmo assim; /api/health mostra o estado.');
    }
  }
  createApp().listen(PORT, () => console.log(`[api] Contabilidade Ágil rodando na porta ${PORT}`));
}

iniciar();
