\encoding UTF8
/* =====================================================================
   CONTABILIDADE ÁGIL — 04_testes_e_transacoes.sql
   Demonstra: chamadas de functions/procedures, disparo de triggers,
   cenários transacionais (COMMIT, ROLLBACK, SAVEPOINT, falha atômica)
   e planos de execução (EXPLAIN ANALYZE) com e sem os índices.

   Erros ESPERADOS são capturados em blocos DO ... EXCEPTION e impressos
   como NOTICE "OK (erro esperado)". A única exceção é o cenário T4,
   que mostra de propósito um erro real dentro de uma transação para
   demonstrar ROLLBACK TO SAVEPOINT.

   Execute com psql (os comandos \echo, \set e \connect são do psql).
   ===================================================================== */
\connect contabilidade_agil
SET search_path = contabil, public;
\pset null '∅'

\echo
\echo '=================================================================='
\echo ' 0. SANIDADE DA CARGA INICIAL'
\echo '=================================================================='
\echo '-- Todos os lançamentos respeitam partidas dobradas? (esperado: 0 linhas)'
SELECT lancamento_id,
       SUM(valor) FILTER (WHERE tipo_movimento = 'D') AS debitos,
       SUM(valor) FILTER (WHERE tipo_movimento = 'C') AS creditos
FROM   item_lancamento
GROUP  BY lancamento_id
HAVING SUM(valor) FILTER (WHERE tipo_movimento = 'D') <> SUM(valor) FILTER (WHERE tipo_movimento = 'C');

\echo '-- valor_total confere com a soma dos débitos? (esperado: 0 linhas)'
SELECT l.id, l.valor_total, SUM(i.valor) AS soma_debitos
FROM   lancamento l JOIN item_lancamento i ON i.lancamento_id = l.id AND i.tipo_movimento = 'D'
GROUP  BY l.id, l.valor_total
HAVING l.valor_total <> SUM(i.valor);

\echo
\echo '=================================================================='
\echo ' 1. FUNCTIONS'
\echo '=================================================================='
\echo '-- 1.1 fn_validar_cnpj'
SELECT '12345678000195' AS cnpj, fn_validar_cnpj('12345678000195') AS valido
UNION ALL SELECT '12.345.678/0001-90', fn_validar_cnpj('12.345.678/0001-90')   -- CNPJ do protótipo: DV errado
UNION ALL SELECT '11111111111111',     fn_validar_cnpj('11111111111111');

\echo '-- 1.2 fn_classificar_confianca'
SELECT v AS confianca, fn_classificar_confianca(v) AS faixa
FROM   (VALUES (97.3), (78.2), (41.5), (NULL::NUMERIC)) t(v);

\echo '-- 1.3 fn_usuario_responsavel (Carlos→ABC = true; Mariana→ABC = false; João (cliente)→ABC = false)'
SELECT fn_usuario_responsavel(3, 1) AS carlos_abc,
       fn_usuario_responsavel(4, 1) AS mariana_abc,
       fn_usuario_responsavel(7, 1) AS joao_abc;

\echo '-- 1.4 fn_saldo_conta — Empresa ABC: conta analítica (Bancos) e sintética (1 - ATIVO, soma subcontas)'
SELECT cc.codigo, cc.nome, cc.analitica,
       fn_saldo_conta(cc.id)                                  AS saldo_total,
       fn_saldo_conta(cc.id, '2026-10-01', '2026-10-31')      AS saldo_outubro
FROM   conta_contabil cc
WHERE  cc.cliente_id = 1 AND cc.codigo IN ('1', '1.1.01.002', '2.3.01.001', '4')
ORDER  BY cc.codigo;

\echo '-- 1.5 fn_razao_conta — Razão da conta Bancos (ABC), out–nov/2026'
SELECT *
FROM   fn_razao_conta((SELECT id FROM conta_contabil WHERE cliente_id = 1 AND codigo = '1.1.01.002'),
                      '2026-10-01', '2026-11-30');

\echo
\echo '=================================================================='
\echo ' 2. VIEWS'
\echo '=================================================================='
\echo '-- 2.1 vw_balancete — Empresa ABC, competência out/2026'
SELECT codigo, conta, natureza, total_debito, total_credito, saldo
FROM   vw_balancete
WHERE  cliente_id = 1 AND competencia = '2026-10-01'
ORDER  BY codigo;

\echo '-- 2.2 vw_fila_revisao — fila do contador (baixa confiança primeiro)'
SELECT lancamento_id, razao_social, descricao, valor_total, origem, status, nivel_confianca, faixa_confianca
FROM   vw_fila_revisao
ORDER  BY CASE faixa_confianca WHEN 'BAIXA' THEN 1 WHEN 'MEDIA' THEN 2 ELSE 3 END, lancamento_id;

\echo '-- 2.3 vw_painel_pendencias — dashboard gerencial (RF30)'
SELECT cliente_id, razao_social, documentos_total, documentos_em_processamento AS em_proc,
       documentos_com_falha AS falha, lancamentos_pendentes AS pend, lancamentos_aprovados AS aprov,
       tempo_medio_revisao_h AS tmr_h, taxa_acerto_ia_pct AS acerto_ia
FROM   vw_painel_pendencias
ORDER  BY cliente_id;

\echo
\echo '=================================================================='
\echo ' 3. STORED PROCEDURES'
\echo '=================================================================='
\echo '-- 3.1 sp_registrar_lancamento: Carlos lança compra de computador para a ABC (manual → já nasce APROVADO)'
CALL sp_registrar_lancamento(
    1, 3, '2026-11-12', 'Compra de notebook para o financeiro',
    '[{"conta":"1.2.03.003","tipo":"D","valor":4200.00,"historico":"Notebook Dell"},
      {"conta":"1.1.01.002","tipo":"C","valor":4200.00,"historico":"Transferência bancária"}]'::jsonb,
    NULL, 'MANUAL', NULL, NULL);

\echo '-- 3.2 sp_aprovar_lancamento: Carlos aprova a sugestão da IA do lançamento 1 (NF 145)'
CALL sp_aprovar_lancamento(1, 3, 'Conferido com a NF 145 e o pedido de compra.', NULL);
SELECT l.id, l.status, l.aprovado_por, d.id AS documento, d.status AS status_documento
FROM   lancamento l JOIN documento d ON d.id = l.documento_id WHERE l.id = 1;

\echo '-- 3.3 sp_reprovar_documento: Mariana rejeita o boleto (doc 20, confiança BAIXA)'
CALL sp_reprovar_documento(20, 4, 'Boleto sem autenticação bancária; enviar o comprovante de pagamento.', NULL);
SELECT d.id, d.status, d.motivo_rejeicao, l.id AS lancamento, l.status AS status_lanc
FROM   documento d JOIN lancamento l ON l.documento_id = d.id WHERE d.id = 20;

\echo '-- 3.4 sp_exportar_lancamentos: exporta ABC de novembro/2026 (RF26)'
CALL sp_exportar_lancamentos(1, 3, '2026-11-01', '2026-11-30', NULL, NULL);
SELECT e.id, e.nome_arquivo, string_agg(el.lancamento_id::TEXT, ', ' ORDER BY el.lancamento_id) AS lancamentos
FROM   exportacao e JOIN exportacao_lancamento el ON el.exportacao_id = e.id
WHERE  e.cliente_id = 1 GROUP BY e.id, e.nome_arquivo ORDER BY e.id;

\echo '-- 3.5 Tratamento de erros das procedures (todos devem ser barrados)'
DO $$
DECLARE   -- em PL/pgSQL os argumentos OUT de um CALL precisam ser variáveis
    v_txt VARCHAR; v_id BIGINT; v_qtd INTEGER;
BEGIN
    BEGIN   -- Mariana não é responsável pela ABC
        CALL sp_aprovar_lancamento(18, 4, NULL, v_txt);
        RAISE NOTICE 'FALHOU: deveria ter barrado';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'OK (erro esperado) [%] %', SQLSTATE, SQLERRM;
    END;

    BEGIN   -- lançamento já aprovado não pode ser aprovado de novo
        CALL sp_aprovar_lancamento(2, 3, NULL, v_txt);
        RAISE NOTICE 'FALHOU: deveria ter barrado';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'OK (erro esperado) [%] %', SQLSTATE, SQLERRM;
    END;

    BEGIN   -- débitos ≠ créditos
        CALL sp_registrar_lancamento(1, 3, '2026-11-12', 'Teste desbalanceado',
             '[{"conta":"1.1.01.001","tipo":"D","valor":100},{"conta":"4.1.01.001","tipo":"C","valor":90}]', NULL, 'MANUAL', v_id, v_txt);
        RAISE NOTICE 'FALHOU: deveria ter barrado';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'OK (erro esperado) [%] %', SQLSTATE, SQLERRM;
    END;

    BEGIN   -- cliente INATIVO (14 - Sabor Caseiro) não recebe lançamentos
        CALL sp_registrar_lancamento(14, 5, '2026-11-12', 'Teste cliente inativo',
             '[{"conta":"1.1.01.001","tipo":"D","valor":50},{"conta":"4.1.01.001","tipo":"C","valor":50}]', NULL, 'MANUAL', v_id, v_txt);
        RAISE NOTICE 'FALHOU: deveria ter barrado';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'OK (erro esperado) [%] %', SQLSTATE, SQLERRM;
    END;

    BEGIN   -- rejeição sem justificativa suficiente (RF24)
        CALL sp_reprovar_documento(11, 4, 'ruim', v_qtd);
        RAISE NOTICE 'FALHOU: deveria ter barrado';
    EXCEPTION WHEN invalid_parameter_value THEN
        RAISE NOTICE 'OK (erro esperado) [%] %', SQLSTATE, SQLERRM;
    END;

    BEGIN   -- exportar de novo o mesmo período: nada novo para exportar (RF27)
        CALL sp_exportar_lancamentos(1, 3, '2026-11-01', '2026-11-30', v_id, v_qtd);
        RAISE NOTICE 'FALHOU: deveria ter barrado';
    EXCEPTION WHEN no_data_found THEN
        RAISE NOTICE 'OK (erro esperado) [%] %', SQLSTATE, SQLERRM;
    END;
END $$;

\echo
\echo '=================================================================='
\echo ' 4. TRIGGERS'
\echo '=================================================================='
\echo '-- 4.1 Auditoria: Carlos atualiza o telefone da ABC; o log guarda antes/depois e quem fez'
BEGIN;
SET LOCAL app.usuario_id = '3';
UPDATE cliente SET telefone = '(15) 3333-2000' WHERE id = 1;
COMMIT;
SELECT id, tabela, registro_id, operacao,
       dados_anteriores->>'telefone' AS telefone_antes,
       dados_novos->>'telefone'      AS telefone_depois,
       usuario_app_id, ocorrido_em
FROM   log_auditoria
WHERE  tabela = 'cliente' AND registro_id = 1
ORDER  BY id DESC LIMIT 1;

\echo '-- 4.1b Auditoria do lançamento criado em 3.1 (I do cabeçalho, I dos itens, U da aprovação)'
SELECT tabela, operacao, registro_id, usuario_app_id,
       COALESCE(dados_novos->>'status', dados_novos->>'tipo_movimento') AS info
FROM   log_auditoria
WHERE  (tabela = 'lancamento' AND registro_id = (SELECT max(id) FROM lancamento))
   OR  (tabela = 'item_lancamento' AND (dados_novos->>'lancamento_id')::BIGINT = (SELECT max(id) FROM lancamento))
ORDER  BY id;

\echo '-- 4.1c Troca de senha: o evento é auditado, mas o hash é mascarado'
\echo '--      (dentro de BEGIN/ROLLBACK para não mudar a senha de demonstração)'
BEGIN;
UPDATE usuario SET senha_hash = '$2b$10$novaSenhaHashExemplo0000000000000000000000000000000000' WHERE id = 7;
SELECT operacao, dados_anteriores->>'senha_hash' AS senha_antes, dados_novos->>'senha_hash' AS senha_depois
FROM   log_auditoria WHERE tabela = 'usuario' AND registro_id = 7 ORDER BY id DESC LIMIT 1;
ROLLBACK;

\echo '-- 4.2 Integridade dos itens e do lançamento (todos devem ser barrados)'
DO $$
DECLARE
    v_conta_abc     BIGINT := (SELECT id FROM conta_contabil WHERE cliente_id = 1  AND codigo = '1.1.01.001');
    v_conta_xyz     BIGINT := (SELECT id FROM conta_contabil WHERE cliente_id = 2  AND codigo = '1.1.01.001');
    v_conta_sint    BIGINT := (SELECT id FROM conta_contabil WHERE cliente_id = 1  AND codigo = '1.1.01');
    v_conta_inativa BIGINT := (SELECT id FROM conta_contabil WHERE cliente_id = 10 AND codigo = '1.1.03.001');
BEGIN
    BEGIN   -- item em lançamento APROVADO (lançamento 2)
        INSERT INTO item_lancamento (lancamento_id, conta_contabil_id, tipo_movimento, valor)
        VALUES (2, v_conta_xyz, 'D', 10);
        RAISE NOTICE 'FALHOU';
    EXCEPTION WHEN integrity_constraint_violation THEN
        RAISE NOTICE 'OK (erro esperado) %', SQLERRM;
    END;

    BEGIN   -- conta de OUTRA empresa (conta da XYZ no lançamento 18, que é da ABC)
        INSERT INTO item_lancamento (lancamento_id, conta_contabil_id, tipo_movimento, valor)
        VALUES (18, v_conta_xyz, 'D', 10);
        RAISE NOTICE 'FALHOU';
    EXCEPTION WHEN integrity_constraint_violation THEN
        RAISE NOTICE 'OK (erro esperado) %', SQLERRM;
    END;

    BEGIN   -- conta sintética
        INSERT INTO item_lancamento (lancamento_id, conta_contabil_id, tipo_movimento, valor)
        VALUES (18, v_conta_sint, 'D', 10);
        RAISE NOTICE 'FALHOU';
    EXCEPTION WHEN integrity_constraint_violation THEN
        RAISE NOTICE 'OK (erro esperado) %', SQLERRM;
    END;

    BEGIN   -- conta inativa (Studio Fit não usa estoque) no lançamento 11 (Studio Fit)
        INSERT INTO item_lancamento (lancamento_id, conta_contabil_id, tipo_movimento, valor)
        VALUES (11, v_conta_inativa, 'D', 10);
        RAISE NOTICE 'FALHOU';
    EXCEPTION WHEN integrity_constraint_violation THEN
        RAISE NOTICE 'OK (erro esperado) %', SQLERRM;
    END;

    BEGIN   -- alterar lançamento APROVADO
        UPDATE lancamento SET descricao = 'alterado' WHERE id = 2;
        RAISE NOTICE 'FALHOU';
    EXCEPTION WHEN integrity_constraint_violation THEN
        RAISE NOTICE 'OK (erro esperado) %', SQLERRM;
    END;

    BEGIN   -- excluir lançamento APROVADO
        DELETE FROM lancamento WHERE id = 2;
        RAISE NOTICE 'FALHOU';
    EXCEPTION WHEN integrity_constraint_violation THEN
        RAISE NOTICE 'OK (erro esperado) %', SQLERRM;
    END;

    BEGIN   -- lançamento da ABC apontando para documento da XYZ
        INSERT INTO lancamento (cliente_id, documento_id, criado_por, data_lancamento, descricao, origem)
        VALUES (1, 2, 2, '2026-11-12', 'Documento de outra empresa', 'IA');
        RAISE NOTICE 'FALHOU';
    EXCEPTION WHEN integrity_constraint_violation THEN
        RAISE NOTICE 'OK (erro esperado) %', SQLERRM;
    END;
END $$;

\echo '-- 4.3 Partidas dobradas (constraint trigger DEFERRABLE)'
\echo '--     a) Itens inseridos um a um na mesma transação: só confere no COMMIT → sucesso'
BEGIN;
INSERT INTO lancamento (cliente_id, criado_por, data_lancamento, descricao, origem)
VALUES (7, 4, '2026-11-12', 'Compra de material odontológico à vista', 'MANUAL');
INSERT INTO item_lancamento (lancamento_id, conta_contabil_id, tipo_movimento, valor)
SELECT currval(pg_get_serial_sequence('contabil.lancamento', 'id')), id, 'D', 860.00
FROM conta_contabil WHERE cliente_id = 7 AND codigo = '3.1.01.003';
--   neste ponto o lançamento está desbalanceado, mas a checagem ainda não rodou
INSERT INTO item_lancamento (lancamento_id, conta_contabil_id, tipo_movimento, valor)
SELECT currval(pg_get_serial_sequence('contabil.lancamento', 'id')), id, 'C', 860.00
FROM conta_contabil WHERE cliente_id = 7 AND codigo = '1.1.01.001';
COMMIT;
SELECT id, descricao, valor_total, status FROM lancamento ORDER BY id DESC LIMIT 1;

\echo '--     b) Lançamento desbalanceado / sem itens: barrado (SET CONSTRAINTS IMMEDIATE antecipa a checagem do COMMIT)'
DO $$
DECLARE v_id BIGINT;
BEGIN
    BEGIN
        INSERT INTO lancamento (cliente_id, criado_por, data_lancamento, descricao, origem)
        VALUES (7, 4, '2026-11-12', 'Desbalanceado', 'MANUAL') RETURNING id INTO v_id;
        INSERT INTO item_lancamento (lancamento_id, conta_contabil_id, tipo_movimento, valor)
        SELECT v_id, id, 'D', 500 FROM conta_contabil WHERE cliente_id = 7 AND codigo = '3.1.01.003';
        INSERT INTO item_lancamento (lancamento_id, conta_contabil_id, tipo_movimento, valor)
        SELECT v_id, id, 'C', 450 FROM conta_contabil WHERE cliente_id = 7 AND codigo = '1.1.01.001';
        SET CONSTRAINTS ALL IMMEDIATE;
        RAISE NOTICE 'FALHOU';
    EXCEPTION WHEN integrity_constraint_violation THEN
        RAISE NOTICE 'OK (erro esperado) %', SQLERRM;
    END;

    BEGIN
        INSERT INTO lancamento (cliente_id, criado_por, data_lancamento, descricao, origem)
        VALUES (7, 4, '2026-11-12', 'Sem itens', 'MANUAL');
        SET CONSTRAINTS ALL IMMEDIATE;
        RAISE NOTICE 'FALHOU';
    EXCEPTION WHEN integrity_constraint_violation THEN
        RAISE NOTICE 'OK (erro esperado) %', SQLERRM;
    END;
END $$;

\echo '-- 4.4 valor_total recalculado pelo trigger ao corrigir uma sugestão (lançamento 7, CORRIGIDO)'
SELECT id, valor_total FROM lancamento WHERE id = 7;
BEGIN;
SET LOCAL app.usuario_id = '4';
UPDATE item_lancamento SET valor = 7590.00 WHERE lancamento_id = 7;   -- débito e crédito juntos
INSERT INTO revisao_contabil (lancamento_id, usuario_id, acao, observacao)
VALUES (7, 4, 'CORRECAO', 'Desconto comercial de R$ 60,00 não considerado pela IA.');
COMMIT;
SELECT id, valor_total FROM lancamento WHERE id = 7;

\echo '-- 4.5 Constraints declarativas (todas devem ser barradas)'
DO $$
BEGIN
    BEGIN   -- RF10: mesmo arquivo (hash) para a mesma empresa
        INSERT INTO documento (cliente_id, enviado_por, nome_arquivo, tipo_documento, formato, tamanho_bytes, hash_sha256, caminho_arquivo)
        SELECT cliente_id, enviado_por, 'copia_' || nome_arquivo, tipo_documento, formato, tamanho_bytes, hash_sha256, caminho_arquivo
        FROM documento WHERE id = 1;
        RAISE NOTICE 'FALHOU';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'OK (erro esperado) %', SQLERRM;
    END;

    BEGIN   -- RF09: arquivo maior que 10 MB
        INSERT INTO documento (cliente_id, enviado_por, nome_arquivo, tipo_documento, formato, tamanho_bytes, hash_sha256, caminho_arquivo)
        VALUES (1, 7, 'scan_gigante.pdf', 'NOTA_FISCAL', 'PDF', 15000000, repeat('a', 64), 'x');
        RAISE NOTICE 'FALHOU';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'OK (erro esperado) %', SQLERRM;
    END;

    BEGIN   -- tipo XML_NFE com formato PDF
        INSERT INTO documento (cliente_id, enviado_por, nome_arquivo, tipo_documento, formato, tamanho_bytes, hash_sha256, caminho_arquivo)
        VALUES (1, 7, 'nfe.pdf', 'XML_NFE', 'PDF', 1000, repeat('b', 64), 'x');
        RAISE NOTICE 'FALHOU';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'OK (erro esperado) %', SQLERRM;
    END;

    BEGIN   -- RF24: rejeitar sem motivo
        UPDATE documento SET status = 'REJEITADO' WHERE id = 11;
        RAISE NOTICE 'FALHOU';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'OK (erro esperado) %', SQLERRM;
    END;

    BEGIN   -- CNPJ com dígito verificador errado (o do protótipo)
        INSERT INTO cliente (escritorio_id, razao_social, cnpj, email)
        VALUES (1, 'Empresa Teste', '12345678000190', 'teste@teste.com.br');
        RAISE NOTICE 'FALHOU';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'OK (erro esperado) %', SQLERRM;
    END;

    BEGIN   -- contador sem CRC
        INSERT INTO usuario (escritorio_id, nome, email, senha_hash, perfil)
        VALUES (1, 'Contador sem CRC', 'semcrc@agilcontabil.com.br', 'x', 'CONTADOR');
        RAISE NOTICE 'FALHOU';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'OK (erro esperado) %', SQLERRM;
    END;

    BEGIN   -- RF27: reexportar lançamento já exportado
        INSERT INTO exportacao_lancamento (exportacao_id, lancamento_id) VALUES (2, 14);
        RAISE NOTICE 'FALHOU';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'OK (erro esperado) %', SQLERRM;
    END;
END $$;

\echo '-- 4.6 Coluna gerada tipo_processamento (RN04)'
SELECT id, nome_arquivo, formato, tipo_processamento FROM documento WHERE id IN (1, 3, 13) ORDER BY id;

\echo
\echo '=================================================================='
\echo ' 5. CONTROLE TRANSACIONAL (ACID)'
\echo '=================================================================='

\echo '-- T1. ROLLBACK explícito: contador começa a corrigir o lançamento 6 e desiste'
SELECT id, valor_total FROM lancamento WHERE id = 6;
BEGIN;
UPDATE item_lancamento SET valor = 4230.00 WHERE lancamento_id = 6;
SELECT id, valor_total AS valor_dentro_da_transacao FROM lancamento WHERE id = 6;
ROLLBACK;
SELECT id, valor_total AS valor_apos_rollback FROM lancamento WHERE id = 6;

\echo '-- T2. Falha no meio da procedure → nada é gravado (atomicidade)'
\echo '--     O cabeçalho e o 1º item são inseridos; o 2º item usa conta inexistente.'
DO $$
DECLARE
    v_lanc_antes  BIGINT := (SELECT count(*) FROM lancamento);
    v_itens_antes BIGINT := (SELECT count(*) FROM item_lancamento);
    v_log_antes   BIGINT := (SELECT count(*) FROM log_auditoria);
    v_id BIGINT; v_st VARCHAR;
BEGIN
    BEGIN
        CALL sp_registrar_lancamento(1, 3, '2026-11-12', 'Lançamento que vai falhar',
             '[{"conta":"1.1.01.001","tipo":"D","valor":300},{"conta":"9.9.99.999","tipo":"C","valor":300}]',
             NULL, 'MANUAL', v_id, v_st);
    EXCEPTION WHEN foreign_key_violation THEN
        RAISE NOTICE 'Erro capturado: %', SQLERRM;
    END;
    RAISE NOTICE 'lancamento: % → %  | item_lancamento: % → %  | log_auditoria: % → %',
        v_lanc_antes,  (SELECT count(*) FROM lancamento),
        v_itens_antes, (SELECT count(*) FROM item_lancamento),
        v_log_antes,   (SELECT count(*) FROM log_auditoria);
    IF v_lanc_antes = (SELECT count(*) FROM lancamento) AND v_itens_antes = (SELECT count(*) FROM item_lancamento) THEN
        RAISE NOTICE 'OK: rollback completo, nenhuma escrita parcial ficou no banco';
    ELSE
        RAISE NOTICE 'FALHOU: sobrou escrita parcial';
    END IF;
END $$;

\echo '-- T3. COMMIT de uma unidade de trabalho com várias tabelas:'
\echo '--     o pipeline de IA grava a análise do doc 4, muda o status e registra a sugestão — tudo ou nada'
BEGIN;
SET LOCAL app.usuario_id = '2';
INSERT INTO analise_documento (documento_id, motor, nivel_confianca, dados_extraidos, status)
VALUES (4, 'OCR_IA', 92.50, '{"tipo":"comprovante","favorecido":"Fornecedor Delta Ltda","valor":1850.00}', 'CONCLUIDA');
UPDATE documento SET status = 'ANALISADO' WHERE id = 4;
CALL sp_registrar_lancamento(1, 2, '2026-11-11', 'Pagamento ao Fornecedor Delta - NF 145',
     '[{"conta":"2.1.02.001","tipo":"D","valor":1850.00,"historico":"Baixa NF 145"},
       {"conta":"1.1.01.002","tipo":"C","valor":1850.00,"historico":"TED"}]', 4, 'IA', NULL, NULL);
COMMIT;
SELECT d.id AS documento, d.status, a.nivel_confianca, l.id AS lancamento, l.status AS status_lanc, l.valor_total
FROM   documento d
JOIN   analise_documento a ON a.documento_id = d.id
JOIN   lancamento l        ON l.documento_id = d.id
WHERE  d.id = 4;

\echo '-- T4. SAVEPOINT: Rafael aprova o lançamento 12; em seguida tenta aprovar o 11,'
\echo '--     que não é da carteira dele. O erro abaixo é ESPERADO; voltamos ao savepoint'
\echo '--     e o COMMIT mantém só a primeira aprovação.'
\set ON_ERROR_STOP off
BEGIN;
CALL sp_aprovar_lancamento(12, 5, 'NF-e conferida.', NULL);
SAVEPOINT antes_do_segundo;
CALL sp_aprovar_lancamento(11, 5, NULL, NULL);
ROLLBACK TO SAVEPOINT antes_do_segundo;
COMMIT;
\set ON_ERROR_STOP on
SELECT id, status, aprovado_por FROM lancamento WHERE id IN (11, 12) ORDER BY id;

\echo
\echo '=================================================================='
\echo ' 6. DESEMPENHO — EXPLAIN ANALYZE com e sem índice'
\echo '    Com 15–20 linhas o PostgreSQL sempre prefere Seq Scan (é mais'
\echo '    barato). Por isso geramos um volume realista DENTRO de uma'
\echo '    transação, medimos, e no final damos ROLLBACK: o banco volta'
\echo '    ao estado da carga inicial.'
\echo '=================================================================='
BEGIN;

-- Volume: 60 mil documentos e 30 mil lançamentos (60 mil itens) em 2025–2026.
-- Os triggers continuam ativos: a carga também passa pelas regras de negócio.
INSERT INTO documento (cliente_id, enviado_por, nome_arquivo, tipo_documento, formato, tamanho_bytes,
                       hash_sha256, caminho_arquivo, status, data_upload)
SELECT c, c + 6, 'vol_' || g || '.pdf', 'NOTA_FISCAL', 'PDF', 100000 + g,
       encode(sha256(convert_to('volume#' || g, 'UTF8')), 'hex'), 'storage/volume/' || g || '.pdf',
       CASE WHEN g % 50 = 0 THEN 'PENDENTE' WHEN g % 50 = 1 THEN 'ANALISADO' ELSE 'APROVADO' END,
       timestamptz '2025-01-01 08:00-03' + (g % 670) * interval '1 day' + (g % 600) * interval '1 minute'
FROM   generate_series(1, 60000) g
CROSS  JOIN LATERAL (SELECT 1 + (g % 13) AS c) x;      -- clientes 1..13 (ativos)

INSERT INTO lancamento (cliente_id, criado_por, data_lancamento, descricao, origem, criado_em)
SELECT 1 + (g % 13), 2, date '2025-01-01' + (g % 640), 'Lançamento de volume #' || g, 'MANUAL',
       timestamptz '2025-01-01 08:00-03' + (g % 640) * interval '1 day'
FROM   generate_series(1, 30000) g;

-- Atualiza as estatísticas ANTES dos itens: os triggers de item consultam
-- lancamento/conta_contabil por id; sem estatísticas novas, o plano em
-- cache (feito quando a tabela tinha 20 linhas) seria Seq Scan por linha.
ANALYZE lancamento;
ANALYZE conta_contabil;

INSERT INTO item_lancamento (lancamento_id, conta_contabil_id, tipo_movimento, valor)
SELECT l.id, cc.id, m.tipo, 100 + (l.id % 900)
FROM   lancamento l
CROSS  JOIN (VALUES ('D', '3.1.01.003'), ('C', '1.1.01.002')) m(tipo, codigo)
JOIN   conta_contabil cc ON cc.cliente_id = l.cliente_id AND cc.codigo = m.codigo
WHERE  l.descricao LIKE 'Lançamento de volume #%';

-- 97% aprovados, 3% pendentes (fila de revisão realista)
UPDATE lancamento l
SET    status = 'APROVADO', aprovado_por = 3, aprovado_em = l.criado_em + interval '6 hours'
WHERE  l.descricao LIKE 'Lançamento de volume #%' AND l.id % 33 <> 0;

ANALYZE documento;
ANALYZE lancamento;
ANALYZE item_lancamento;

SELECT 'documento' AS tabela, count(*) FROM documento
UNION ALL SELECT 'lancamento', count(*) FROM lancamento
UNION ALL SELECT 'item_lancamento', count(*) FROM item_lancamento;

\echo '------------------------------------------------------------------'
\echo ' IDX1 idx_documento_cliente_status_data — fila de documentos (RF20)'
\echo '------------------------------------------------------------------'
\echo '>>> COM índice'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT id, nome_arquivo, status, data_upload
FROM   documento
WHERE  cliente_id = 5 AND status = 'PENDENTE'
ORDER  BY data_upload DESC
LIMIT  20;

SAVEPOINT sem_idx1;
DROP INDEX idx_documento_cliente_status_data;
\echo '>>> SEM índice'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT id, nome_arquivo, status, data_upload
FROM   documento
WHERE  cliente_id = 5 AND status = 'PENDENTE'
ORDER  BY data_upload DESC
LIMIT  20;
ROLLBACK TO SAVEPOINT sem_idx1;

\echo '------------------------------------------------------------------'
\echo ' IDX2 idx_lancamento_cliente_data — lançamentos do mês (balancete/DRE/CSV)'
\echo '------------------------------------------------------------------'
\echo '>>> COM índice'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT l.id, l.data_lancamento, l.descricao, l.valor_total
FROM   lancamento l
WHERE  l.cliente_id = 3
AND    l.data_lancamento BETWEEN '2026-03-01' AND '2026-03-31';

SAVEPOINT sem_idx2;
DROP INDEX idx_lancamento_cliente_data;
DROP INDEX idx_lancamento_pendente;
\echo '>>> SEM índice'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT l.id, l.data_lancamento, l.descricao, l.valor_total
FROM   lancamento l
WHERE  l.cliente_id = 3
AND    l.data_lancamento BETWEEN '2026-03-01' AND '2026-03-31';
ROLLBACK TO SAVEPOINT sem_idx2;

\echo '------------------------------------------------------------------'
\echo ' IDX3 idx_item_conta — Razão de uma conta (JOIN item → lançamento)'
\echo '------------------------------------------------------------------'
\echo '>>> COM índice'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT l.data_lancamento, i.tipo_movimento, i.valor
FROM   item_lancamento i
JOIN   lancamento l ON l.id = i.lancamento_id
WHERE  i.conta_contabil_id = (SELECT id FROM conta_contabil WHERE cliente_id = 4 AND codigo = '3.1.01.003')
AND    l.status = 'APROVADO';

SAVEPOINT sem_idx3;
DROP INDEX idx_item_conta;
\echo '>>> SEM índice'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT l.data_lancamento, i.tipo_movimento, i.valor
FROM   item_lancamento i
JOIN   lancamento l ON l.id = i.lancamento_id
WHERE  i.conta_contabil_id = (SELECT id FROM conta_contabil WHERE cliente_id = 4 AND codigo = '3.1.01.003')
AND    l.status = 'APROVADO';
ROLLBACK TO SAVEPOINT sem_idx3;

\echo '>>> IDX3 também protege o ON DELETE RESTRICT: excluir 13 contas não usadas'
\echo '    obriga o PostgreSQL a verificar se algum item referencia cada uma delas.'
\echo '>>> COM índice (veja "Trigger for constraint fk_item_conta")'
SAVEPOINT del_com_idx;
EXPLAIN (ANALYZE, COSTS OFF)
DELETE FROM conta_contabil WHERE codigo = '1.2.03.002' AND cliente_id <= 13;
ROLLBACK TO SAVEPOINT del_com_idx;

SAVEPOINT del_sem_idx;
DROP INDEX idx_item_conta;
\echo '>>> SEM índice'
EXPLAIN (ANALYZE, COSTS OFF)
DELETE FROM conta_contabil WHERE codigo = '1.2.03.002' AND cliente_id <= 13;
ROLLBACK TO SAVEPOINT del_sem_idx;

\echo '------------------------------------------------------------------'
\echo ' IDX5 idx_lancamento_pendente (PARCIAL) — fila de lançamentos a revisar'
\echo '------------------------------------------------------------------'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT id, descricao, criado_em
FROM   lancamento
WHERE  cliente_id = 6 AND status IN ('PENDENTE', 'CORRIGIDO')
ORDER  BY criado_em;

\echo '>>> Tamanho: índice parcial x índice completo sobre as MESMAS colunas.'
\echo '    Medido numa cópia da tabela: dentro desta transação os índices originais'
\echo '    ainda guardam as versões antigas das linhas alteradas pelo UPDATE (MVCC).'
CREATE TEMP TABLE lancamento_copia AS SELECT * FROM lancamento;
CREATE INDEX ix_copia_completo ON lancamento_copia (cliente_id, criado_em);
CREATE INDEX ix_copia_parcial  ON lancamento_copia (cliente_id, criado_em)
    WHERE status IN ('PENDENTE', 'CORRIGIDO');
SELECT 'completo (todas as linhas)' AS indice, count(*) AS linhas_indexadas,
       pg_size_pretty(pg_relation_size('ix_copia_completo')) AS tamanho
FROM   lancamento_copia
UNION ALL
SELECT 'parcial (só pendentes)', count(*) FILTER (WHERE status IN ('PENDENTE', 'CORRIGIDO')),
       pg_size_pretty(pg_relation_size('ix_copia_parcial'))
FROM   lancamento_copia;

ROLLBACK;   -- descarta o volume: o banco volta ao estado da carga inicial

\echo
\echo '=================================================================='
\echo ' 7. ESTADO FINAL'
\echo '=================================================================='
SELECT status, count(*) FROM lancamento GROUP BY status ORDER BY status;
SELECT tabela, operacao, count(*) FROM log_auditoria GROUP BY tabela, operacao ORDER BY tabela, operacao;
