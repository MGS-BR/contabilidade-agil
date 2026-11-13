// Carrega o arquivo .env, se existir (desenvolvimento local).
// No Render as variáveis vêm do painel e não há .env — sem aviso no log.
try {
  process.loadEnvFile();
} catch {
  /* sem .env: usa só as variáveis de ambiente */
}
