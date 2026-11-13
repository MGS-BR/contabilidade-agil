# Contabilidade Ágil — aplicação

Sistema de gestão contábil para escritórios de contabilidade: o cliente envia documentos fiscais, a IA sugere o lançamento contábil e o contador aprova, corrige ou reprova. Trabalho de Graduação — Fatec Sorocaba.

A documentação do produto (requisitos, casos de uso, DER e documento de banco de dados) fica no repositório de documentação do projeto.

## Arquitetura

```
client/   React 19 + Vite + Tailwind CSS 4  →  telas (compiladas em client/dist)
server/   Node.js + Express 5               →  API REST em /api e serve as telas
db/       Scripts PostgreSQL da disciplina de Laboratório de Banco de Dados
tests/    Testes da API (node:test) e de ponta a ponta no navegador (Playwright)
```

Um único processo Node atende tudo, então a hospedagem precisa de **um** serviço web + **um** PostgreSQL. Regras de negócio críticas (partidas dobradas, imutabilidade do lançamento aprovado, auditoria, CNPJ válido, duplicidade de documentos) ficam no banco — a API chama as procedures `sp_registrar_lancamento`, `sp_aprovar_lancamento`, `sp_reprovar_documento` e `sp_exportar_lancamentos` e usa as views e functions dos scripts `db/`.

## Rodar no seu computador

Pré-requisitos: **Node.js 22.12+** e **PostgreSQL 14+**.

```bash
npm install
cp .env.example .env            # ajuste DATABASE_URL e JWT_SECRET
createdb contabilidade_agil      # ou crie pelo pgAdmin
npm run db:setup                 # cria tabelas, carga inicial, views, functions, procedures e triggers
npm run dev                      # API em :3000 e telas em http://localhost:5173
```

Para testar como em produção (telas servidas pelo Express):

```bash
npm run build
npm start                        # http://localhost:3000
```

### Contas de demonstração (senha `senha123`)

| Perfil | E-mail |
|---|---|
| Contador — empresas 1 a 5 | `carlos.silva@agilcontabil.com.br` |
| Contador — empresas 6 a 10 | `mariana.costa@agilcontabil.com.br` |
| Contador — empresas 11 a 15 | `rafael.oliveira@agilcontabil.com.br` |
| Cliente — Empresa ABC e Comércio Silva | `joao@abccomercio.com.br` |

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | API com recarga automática + Vite com hot reload |
| `npm run build` | Compila as telas para `client/dist` |
| `npm start` | Sobe o servidor (cria o banco na 1ª vez se `DB_AUTO_SETUP=true`) |
| `npm run db:setup` | Cria a estrutura se o schema `contabil` não existir |
| `npm run db:reset` | **Apaga** o schema `contabil` e recria com a carga inicial |
| `npm test` | 14 testes de integração da API (**apaga e recria o banco do `DATABASE_URL`** — use um banco de teste) |
| `npm run test:e2e` | Testa todas as telas em desktop, tablet e celular (precisa do servidor rodando e do Chrome; veja o cabeçalho de `tests/e2e.mjs`) |

## Publicar

Hospedagem gratuita com **Render** (aplicação) + **Neon** (banco): passo a passo em [`docs/DEPLOY.md`](docs/DEPLOY.md). O `render.yaml` na raiz já configura o serviço.

## API

Todas as rotas exceto `/api/health` e `/api/auth/login` exigem `Authorization: Bearer <token>`.

| Método e rota | Perfil | Descrição |
|---|---|---|
| `POST /api/auth/login` | — | E-mail, senha e aba (CONTADOR/CLIENTE) → token |
| `GET /api/auth/me` | todos | Usuário e empresas que ele acessa |
| `GET /api/dashboard/contador` | contador | Indicadores da carteira e pendências por empresa |
| `GET /api/dashboard/cliente?empresa&inicio&fim` | todos | Receita, despesa, lucro, índices e documentos |
| `GET/POST /api/empresas`, `PUT /api/empresas/:id`, `PATCH /api/empresas/:id/status` | contador | Cadastro de empresas (cria plano de contas e acesso do cliente) |
| `GET/POST /api/empresas/:id/contas`, `PUT/DELETE /api/contas/:id` | contador | Plano de contas |
| `GET /api/documentos?empresa`, `POST /api/empresas/:id/documentos` | todos | Lista e upload (multipart, campo `arquivos`) |
| `GET /api/documentos/:id/arquivo` | todos | Abre/baixa o arquivo |
| `POST /api/documentos/:id/rejeitar` | contador | Rejeição com justificativa |
| `GET/POST /api/lancamentos`, `PUT/DELETE /api/lancamentos/:id` | contador | Lançamentos (novo, correção, exclusão de pendentes) |
| `POST /api/lancamentos/:id/aprovar` · `/reprovar` | contador | Revisão das sugestões |
| `POST /api/empresas/:id/exportacoes`, `GET /api/exportacoes/:id/csv` | contador | Exportação CSV sem duplicidade |
| `GET/POST /api/relatorios`, `GET /api/relatorios/:id`, `POST /api/relatorios/:id/enviar` | todos / contador | Balanço, balancete, DRE, razão e diário |

## O que é simulado nesta versão

- **OCR/IA**: os documentos enviados ficam "Aguardando análise". As sugestões de lançamento da carga inicial representam o que a IA produziria. XML de NF-e e JSON são importados direto (a chave de acesso é lida do XML).
- **Arquivos**: guardados em disco (`UPLOAD_DIR`). No Render gratuito o disco é temporário.
- **E-mail** (recuperação de senha e notificações): não implementado.
