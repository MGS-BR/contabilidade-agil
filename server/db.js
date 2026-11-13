import pg from 'pg';

// DATE (1082) volta como texto 'AAAA-MM-DD': evita o JS converter para
// meia-noite UTC e mostrar o dia anterior no Brasil.
pg.types.setTypeParser(1082, (v) => v);
// NUMERIC (1700) e BIGINT (20) viram number (valores e ids cabem com folga).
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/contabilidade_agil';

export const pool = new pg.Pool({
  connectionString,
  max: Number(process.env.DB_POOL_MAX || 5),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 15_000, // Neon pode levar alguns segundos para "acordar"
});

// Garante o schema certo e o fuso do Brasil em toda conexão nova.
pool.on('connect', (client) => {
  client.query("SET search_path TO contabil, public; SET TIME ZONE 'America/Sao_Paulo'").catch(() => {});
});

export const query = (text, params) => pool.query(text, params);

/**
 * Executa fn dentro de uma transação. O id do usuário logado vai para
 * app.usuario_id (SET LOCAL), que os triggers de auditoria leem.
 */
export async function withTransaction(usuarioId, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (usuarioId) {
      await client.query("SELECT set_config('app.usuario_id', $1, true)", [String(usuarioId)]);
    }
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
