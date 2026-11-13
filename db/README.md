# Banco de dados — Contabilidade Ágil (PostgreSQL)

Scripts da disciplina de Laboratório de Banco de Dados. São os mesmos que a aplicação usa: `npm run db:setup` executa 01, 02 e 03.

Documentação completa (DER, dicionário de dados, normalização e justificativas): `docs/banco-de-dados/projeto-banco-de-dados.md`, no repositório de documentação do projeto.

| Ordem | Script | Conteúdo |
|---|---|---|
| 1 | `01_ddl_estrutura.sql` | Banco, schema `contabil`, 14 tabelas, constraints, 6 índices, comentários |
| 2 | `02_dml_carga_inicial.sql` | 15 empresas, 22 usuários, 765 contas, 22 documentos, 22 lançamentos (49 partidas)… |
| 3 | `03_programacao_avancada.sql` | 5 functions, 3 views, 13 triggers, 4 procedures |
| 4 | `04_testes_e_transacoes.sql` | Testes de tudo acima, 4 cenários transacionais, EXPLAIN ANALYZE com e sem índice |

```bash
psql -U postgres -f 01_ddl_estrutura.sql
psql -U postgres -d contabilidade_agil -f 02_dml_carga_inicial.sql
psql -U postgres -d contabilidade_agil -f 03_programacao_avancada.sql
psql -U postgres -d contabilidade_agil -f 04_testes_e_transacoes.sql > saida_04.txt
```

Requer PostgreSQL 14+ e `psql`. O 01 apaga e recria o banco, então a sequência pode ser repetida. `saida_04_testes.txt` é a saída de referência do script 04 (PostgreSQL 16).

Usuários da carga inicial: senha de demonstração `senha123` (hash bcrypt real). Em banco gerenciado (Neon), use `npm run db:setup` / `npm run db:reset` na raiz do projeto: eles pulam o bloco `@local-inicio`/`@local-fim` do 01, que cria o banco e só faz sentido no PostgreSQL local.
