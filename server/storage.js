import { mkdir, writeFile, access } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';

/**
 * Armazenamento dos arquivos enviados.
 *
 * O banco guarda só metadados (nome, hash, caminho). O binário fica em
 * disco, na pasta UPLOAD_DIR. ATENÇÃO: no plano gratuito do Render o
 * disco é temporário — os arquivos somem a cada deploy/reinício, mas os
 * registros no banco continuam. Para produção, troque este módulo por
 * um armazenamento de objetos (S3, Cloudflare R2, Supabase Storage).
 */
const BASE = path.resolve(process.env.UPLOAD_DIR || 'uploads');

const seguro = (rel) => {
  const abs = path.resolve(BASE, rel);
  if (!abs.startsWith(BASE + path.sep)) throw new Error('Caminho inválido');
  return abs;
};

export async function salvarArquivo(caminhoRelativo, buffer) {
  const abs = seguro(caminhoRelativo);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, buffer);
}

export async function arquivoExiste(caminhoRelativo) {
  try {
    await access(seguro(caminhoRelativo));
    return true;
  } catch {
    return false;
  }
}

export const abrirArquivo = (caminhoRelativo) => createReadStream(seguro(caminhoRelativo));
