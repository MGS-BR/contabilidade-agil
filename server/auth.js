import jwt from 'jsonwebtoken';
import { query } from './db.js';
import { HttpError, forbidden } from './errors.js';

const DEV_SECRET = 'dev-secret-troque-em-producao';
export const JWT_SECRET = process.env.JWT_SECRET || DEV_SECRET;

if (process.env.NODE_ENV === 'production' && JWT_SECRET === DEV_SECRET) {
  console.warn('[aviso] JWT_SECRET não definido: defina uma chave forte nas variáveis de ambiente.');
}

export function gerarToken(usuario) {
  return jwt.sign({ sub: usuario.id }, JWT_SECRET, { expiresIn: '8h' });
}

/**
 * Carrega o usuário do token e a lista de empresas que ele pode acessar.
 * Consulta o banco a cada requisição: um usuário desativado perde o
 * acesso na hora, sem esperar o token expirar.
 */
export async function carregarUsuario(id) {
  const { rows } = await query(
    `SELECT u.id, u.nome, u.email, u.perfil, u.escritorio_id, u.ativo,
            COALESCE(json_agg(json_build_object(
                'id', c.id, 'nome', COALESCE(c.nome_fantasia, c.razao_social),
                'razaoSocial', c.razao_social, 'cnpj', c.cnpj,
                'status', c.status, 'papel', uc.papel)
              ORDER BY COALESCE(c.nome_fantasia, c.razao_social)) FILTER (WHERE c.id IS NOT NULL), '[]') AS empresas
     FROM usuario u
     LEFT JOIN usuario_cliente uc ON uc.usuario_id = u.id
     LEFT JOIN cliente c ON c.id = uc.cliente_id
                        AND (u.perfil = 'CONTADOR' OR c.status = 'ATIVO')
     WHERE u.id = $1
     GROUP BY u.id`,
    [id],
  );
  const u = rows[0];
  if (!u || !u.ativo) return null;
  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    perfil: u.perfil,
    tipo: u.perfil === 'CLIENTE' ? 'CLIENTE' : 'CONTADOR',
    escritorioId: u.escritorio_id,
    empresas: u.empresas,
  };
}

export async function autenticar(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Faça login para continuar.'));
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return next(new HttpError(401, 'Sessão expirada. Entre novamente.'));
  }
  const usuario = await carregarUsuario(payload.sub);
  if (!usuario) return next(new HttpError(401, 'Usuário inativo ou removido.'));
  req.usuario = usuario;
  next();
}

export function somenteContador(req, _res, next) {
  if (req.usuario?.perfil !== 'CONTADOR') return next(forbidden('Ação disponível apenas para contadores.'));
  next();
}

/** Garante que o usuário tem vínculo com a empresa e devolve o id numérico. */
export function exigirEmpresa(req, empresaId) {
  const id = Number(empresaId);
  if (!Number.isInteger(id) || !req.usuario.empresas.some((e) => e.id === id)) {
    throw forbidden('Você não tem acesso a esta empresa.');
  }
  return id;
}

export const idsEmpresas = (req) => req.usuario.empresas.map((e) => e.id);
