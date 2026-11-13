import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { autenticar, carregarUsuario, gerarToken } from '../auth.js';
import { HttpError, badRequest } from '../errors.js';

const router = Router();

router.post('/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const senha = String(req.body?.senha || '');
  const perfilEsperado = req.body?.perfil; // 'CONTADOR' | 'CLIENTE' (aba escolhida na tela)
  if (!email || !senha) throw badRequest('Informe e-mail e senha.');

  const { rows } = await query('SELECT id, senha_hash, perfil, ativo FROM usuario WHERE lower(email) = $1', [email]);
  const u = rows[0];
  let ok = false;
  if (u) {
    try {
      ok = await bcrypt.compare(senha, u.senha_hash);
    } catch {
      ok = false; // hash inválido (ex.: conta de serviço) → login negado
    }
  }
  if (!ok) throw new HttpError(401, 'E-mail ou senha incorretos.');
  if (!u.ativo) throw new HttpError(403, 'Usuário desativado. Fale com o escritório.');
  if (u.perfil === 'ADMIN') throw new HttpError(403, 'O perfil administrador ainda não tem telas nesta versão.');
  if (perfilEsperado && perfilEsperado !== u.perfil) {
    const aba = u.perfil === 'CONTADOR' ? 'Contador' : 'Cliente';
    throw new HttpError(403, `Este usuário é do perfil ${aba}. Selecione a aba "${aba}" para entrar.`);
  }

  const usuario = await carregarUsuario(u.id);
  res.json({ token: gerarToken(usuario), usuario });
});

router.get('/me', autenticar, (req, res) => res.json({ usuario: req.usuario }));

export default router;
