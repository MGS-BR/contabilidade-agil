# Publicar gratuitamente: Render (aplicação) + Neon (banco)

A aplicação é um único serviço Node.js: o Express responde a API em `/api` e entrega as telas React já compiladas. Ela precisa só de um PostgreSQL acessível pela internet.

| Peça | Serviço | Plano | O que saber |
|---|---|---|---|
| Aplicação (API + telas) | **Render** — Web Service | Free | Dorme após 15 min sem acesso; a primeira visita depois disso leva cerca de 1 minuto para acordar. 750 h/mês por conta. |
| Banco PostgreSQL | **Neon** | Free | Permanente, sem cartão. Limite de armazenamento por projeto (a carga de demonstração usa poucos MB). Também "dorme" após 5 min e acorda sozinho em segundos. |

> Por que não o banco gratuito do Render? Ele **expira 30 dias** depois de criado (e é apagado após um período de carência). O Neon não expira.

Tempo total: ~15 minutos.

---

## 1. Criar o banco no Neon

1. Acesse **neon.com** e crie uma conta (pode entrar com o GitHub).
2. **Create project**
   - *Project name*: `contabilidade-agil`
   - *Postgres version*: a mais recente (14 ou superior)
   - *Region*: **AWS US East (N. Virginia)** — a mesma região do Render escolhida no `render.yaml` (menor latência entre app e banco).
3. No painel do projeto, clique em **Connect**.
4. **Desligue a chave "Connection pooling"**. A string deve ficar **sem** `-pooler` no endereço:
   ```
   postgresql://neondb_owner:SENHA@ep-xxxx-xxxx.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   ```
5. Copie essa string. Ela é o seu `DATABASE_URL` — trate como senha (não coloque no GitHub).

> Por que sem pooling? A criação das tabelas roda scripts longos que precisam de uma conexão direta. A aplicação também funcionaria pelo pool (o setup grava `ALTER ROLE ... SET search_path` e todas as functions fixam o próprio `search_path`), mas com um único servidor e poucas conexões a conexão direta é mais simples.

Não é preciso rodar nenhum SQL à mão: na primeira subida a aplicação percebe que o banco está vazio e executa os scripts `db/01`, `db/02` e `db/03`.

---

## 2. Subir a aplicação no Render

### Opção A — Blueprint (recomendado, usa o `render.yaml` do repositório)

1. Acesse **render.com** e entre com o GitHub.
2. **New + → Blueprint**.
3. Escolha o repositório da aplicação (dê permissão ao Render, se pedir).
4. O Render lê o `render.yaml` e mostra o serviço `contabilidade-agil`. No campo **DATABASE_URL**, cole a string do Neon.
5. **Apply**. O primeiro deploy leva 3–5 minutos (instala dependências, compila as telas e sobe o servidor).

### Opção B — manual

**New + → Web Service →** escolha o repositório e preencha:

| Campo | Valor |
|---|---|
| Language | Node |
| Branch | `main` |
| Region | Virginia (US East) |
| Build Command | `npm ci && npm run build` |
| Start Command | `npm start` |
| Instance Type | **Free** |
| Health Check Path (em *Advanced*) | `/api/health` |

Variáveis de ambiente (*Environment*):

| Nome | Valor |
|---|---|
| `DATABASE_URL` | string do Neon (sem `-pooler`) |
| `JWT_SECRET` | uma frase longa e aleatória (ex.: gere em https://www.uuidgenerator.net e junte duas) |
| `NODE_ENV` | `production` |
| `DB_AUTO_SETUP` | `true` |

Não defina `PORT`: o Render informa a porta sozinho.

---

## 3. Conferir

1. Nos **Logs** do serviço, o primeiro deploy deve mostrar:
   ```
   [db] Executando 01_ddl_estrutura.sql...
   [db] Executando 02_dml_carga_inicial.sql...
   [db] Executando 03_programacao_avancada.sql...
   [db] Banco pronto. Senha de todos os usuários de demonstração: senha123
   [api] Contabilidade Ágil rodando na porta 10000
   ```
   Nos deploys seguintes aparece `Schema "contabil" já existe. Nada a fazer` — os dados são preservados.
2. Abra `https://SEU-SERVICO.onrender.com/api/health` → deve responder `{"ok":true,"banco":"conectado"}`.
3. Abra `https://SEU-SERVICO.onrender.com` e entre com uma conta de demonstração (botão "Usar conta de demonstração" na tela de login):

| Perfil | E-mail | Senha |
|---|---|---|
| Contador (empresas 1–5) | `carlos.silva@agilcontabil.com.br` | `senha123` |
| Contador (empresas 6–10) | `mariana.costa@agilcontabil.com.br` | `senha123` |
| Cliente (ABC e Comércio Silva) | `joao@abccomercio.com.br` | `senha123` |

---

## 4. Rotina depois de publicado

- **Atualizar**: cada `git push` na branch `main` gera um deploy novo automaticamente.
- **Zerar os dados de demonstração** (antes da banca, por exemplo), no seu computador:
  ```bash
  DATABASE_URL="string-do-neon" npm run db:reset
  ```
  Isso apaga o schema `contabil` e recria tudo com a carga inicial. **Apaga todos os dados.**
- **Rodar os testes da disciplina contra o Neon**: use o `psql` com a string do Neon e os scripts da pasta `db/` (o `01` tem um bloco só para uso local, que cria o banco; no Neon pule as linhas entre `@local-inicio` e `@local-fim` ou use `npm run db:reset`, que já faz isso).
- **Antes de apresentar**: abra o site uns 2 minutos antes para o Render e o Neon "acordarem".

## 5. Limitações do plano gratuito (vale citar na banca)

| Limitação | Efeito | Saída em produção |
|---|---|---|
| Disco do Render é temporário | Arquivos enviados (PDF/XML) somem a cada deploy ou reinício; os registros no banco continuam e a tela avisa que o arquivo não está mais disponível | Trocar `server/storage.js` por um armazenamento de objetos (S3, Cloudflare R2, Supabase Storage) |
| Serviço dorme após 15 min | Primeira visita demora ~1 min | Plano pago do Render (a partir do Starter) |
| Neon dorme após 5 min | Primeira consulta leva alguns segundos (a conexão espera até 15 s) | Plano pago do Neon ou desligar o *scale to zero* |
| Sem e-mail | Recuperação de senha e notificações (RF02, RF31) não estão implementadas | Serviço de e-mail transacional (Resend, Brevo) |

## 6. Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| `/api/health` responde `banco: indisponível` | `DATABASE_URL` errada ou com espaço no fim | Copie de novo do Neon e salve em *Environment* (o Render reinicia sozinho) |
| Log mostra `relation "lancamento" does not exist` | String com `-pooler` e o setup não rodou | Use a string sem `-pooler` e rode `npm run db:setup` com ela |
| Log mostra `password authentication failed` | Senha do Neon foi trocada | Gere a string de novo no botão **Connect** |
| Deploy falha em `npm ci` | `package-lock.json` não foi enviado ao GitHub | Faça commit do `package-lock.json` |
| Tela em branco | Build não rodou | Confira se o Build Command é `npm ci && npm run build` |
| Login funciona e depois "Sessão expirada" após um deploy | `JWT_SECRET` mudou | Normal: entre de novo. Mantenha o mesmo valor entre deploys |
