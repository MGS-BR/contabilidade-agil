import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { query } from './db.js';
import { errorHandler } from './errors.js';
import { autenticar } from './auth.js';
import authRoutes from './routes/auth.js';
import empresasRoutes from './routes/empresas.js';
import contasRoutes from './routes/contas.js';
import documentosRoutes from './routes/documentos.js';
import lancamentosRoutes from './routes/lancamentos.js';
import relatoriosRoutes from './routes/relatorios.js';
import dashboardRoutes from './routes/dashboard.js';

const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'client', 'dist');

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // atrás do proxy do Render
  app.use(express.json({ limit: '1mb' }));
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
  });

  // Health check usado pelo Render para saber se o deploy subiu.
  app.get('/api/health', async (_req, res) => {
    try {
      await query('SELECT 1');
      res.json({ ok: true, banco: 'conectado' });
    } catch (err) {
      res.status(503).json({ ok: false, banco: 'indisponível', erro: err.message });
    }
  });

  app.use('/api/auth', authRoutes);
  app.use('/api', autenticar); // todas as rotas abaixo exigem login
  app.use('/api/empresas', empresasRoutes);
  app.use('/api', contasRoutes);
  app.use('/api', documentosRoutes);
  app.use('/api', lancamentosRoutes);
  app.use('/api', relatoriosRoutes);
  app.use('/api', dashboardRoutes);
  app.use('/api', (_req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

  // Front-end compilado (npm run build). Qualquer rota que não seja /api
  // devolve o index.html (SPA).
  if (existsSync(DIST)) {
    app.use(express.static(DIST, { index: false, maxAge: '1h' }));
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      res.sendFile(path.join(DIST, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
