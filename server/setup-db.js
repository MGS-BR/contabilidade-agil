import './env.js';
/**
 * Cria a estrutura do banco a partir dos scripts da pasta db/.
 *
 *   npm run db:setup            → cria se o schema "contabil" ainda não existir
 *   npm run db:reset            → APAGA o schema "contabil" e recria com a carga inicial
 *
 * Roda 01 (DDL), 02 (carga inicial) e 03 (programação avançada).
 * O 04 (testes) não roda aqui porque altera os dados de demonstração.
 *
 * Em banco gerenciado (Neon etc.) o banco já existe, então o bloco
 * marcado com @local-inicio/@local-fim do script 01 é ignorado, assim
 * como os comandos do psql (linhas que começam com "\").
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool } from './db.js';

const DB_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'db');
const SCRIPTS = ['01_ddl_estrutura.sql', '02_dml_carga_inicial.sql', '03_programacao_avancada.sql'];

export function prepararScript(sql) {
  return sql
    .replace(/-- @local-inicio[\s\S]*?-- @local-fim/g, '')
    .split('\n')
    .filter((linha) => !linha.trimStart().startsWith('\\'))
    .join('\n');
}

export async function schemaExiste(client) {
  const { rows } = await client.query("SELECT to_regclass('contabil.lancamento') IS NOT NULL AS existe");
  return rows[0].existe;
}

export async function setupDatabase({ reset = false, log = console.log } = {}) {
  const client = await pool.connect();
  try {
    if (!reset && (await schemaExiste(client))) {
      log('[db] Schema "contabil" já existe. Nada a fazer (use npm run db:reset para recriar).');
      return false;
    }
    if (reset) {
      log('[db] Apagando o schema "contabil"...');
      await client.query('DROP SCHEMA IF EXISTS contabil CASCADE');
    }
    for (const arquivo of SCRIPTS) {
      log(`[db] Executando ${arquivo}...`);
      const sql = prepararScript(readFileSync(path.join(DB_DIR, arquivo), 'utf8'));
      await client.query(sql);
    }
    // Padrões do usuário do banco: valem para qualquer conexão nova,
    // inclusive as abertas pelo pool de conexões do provedor.
    await client.query("ALTER ROLE CURRENT_USER SET search_path = contabil, public");
    await client.query("ALTER ROLE CURRENT_USER SET timezone = 'America/Sao_Paulo'");
    log('[db] Banco pronto. Senha de todos os usuários de demonstração: senha123');
    return true;
  } finally {
    client.release();
  }
}

// Execução direta: node server/setup-db.js [--reset]
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const reset = process.argv.includes('--reset');
  setupDatabase({ reset })
    .then(() => pool.end())
    .catch(async (err) => {
      console.error('[db] Falhou:', err.message);
      await pool.end();
      process.exit(1);
    });
}
