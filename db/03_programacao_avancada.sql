\encoding UTF8
/* =====================================================================
   CONTABILIDADE ÁGIL — 03_programacao_avancada.sql
   Functions, Views, Triggers e Stored Procedures (PL/pgSQL).
   Requer PostgreSQL 14+ (parâmetros OUT em procedures).

   Toda function/procedure fixa "SET search_path = contabil, public":
   ela encontra as tabelas mesmo quando a sessão usa outro search_path
   (ex.: pool de conexões do Neon) e não pode ser enganada por uma
   tabela homônima criada em outro schema (boa prática de segurança).

   Sumário
     A. Functions ............ fn_validar_cnpj, fn_classificar_confianca,
                               fn_usuario_responsavel, fn_saldo_conta,
                               fn_razao_conta
     B. Views ................ vw_balancete, vw_fila_revisao,
                               vw_painel_pendencias
     C. Triggers ............. auditoria, validação de item, partidas
                               dobradas (deferida), valor_total,
                               regras do lançamento, atualizado_em
     D. Stored Procedures .... sp_registrar_lancamento,
                               sp_aprovar_lancamento,
                               sp_reprovar_documento,
                               sp_exportar_lancamentos
   ===================================================================== */
\connect contabilidade_agil
SET search_path = contabil, public;

/* =====================================================================
   A. FUNCTIONS
   ===================================================================== */

-- ---------------------------------------------------------------------
-- A1. fn_validar_cnpj — valida os dígitos verificadores do CNPJ.
--     IMMUTABLE: o resultado depende só da entrada, por isso pode ser
--     usada dentro de CHECK constraint.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_validar_cnpj(p_cnpj TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE STRICT
SET search_path = contabil, public
AS $$
DECLARE
    v_cnpj  TEXT := regexp_replace(p_cnpj, '[^0-9]', '', 'g');
    v_pesos INT[] := ARRAY[6,5,4,3,2,9,8,7,6,5,4,3,2];
    v_soma  INT;
    v_dv1   INT;
    v_dv2   INT;
BEGIN
    IF length(v_cnpj) <> 14 OR v_cnpj ~ '^(\d)\1{13}$' THEN   -- rejeita 00000000000000 etc.
        RETURN FALSE;
    END IF;

    v_soma := 0;
    FOR i IN 1..12 LOOP
        v_soma := v_soma + substr(v_cnpj, i, 1)::INT * v_pesos[i + 1];
    END LOOP;
    v_dv1 := CASE WHEN v_soma % 11 < 2 THEN 0 ELSE 11 - v_soma % 11 END;

    v_soma := 0;
    FOR i IN 1..13 LOOP
        v_soma := v_soma + substr(v_cnpj, i, 1)::INT * v_pesos[i];
    END LOOP;
    v_dv2 := CASE WHEN v_soma % 11 < 2 THEN 0 ELSE 11 - v_soma % 11 END;

    RETURN substr(v_cnpj, 13, 1)::INT = v_dv1
       AND substr(v_cnpj, 14, 1)::INT = v_dv2;
END;
$$;
COMMENT ON FUNCTION fn_validar_cnpj(TEXT) IS 'Valida dígitos verificadores de CNPJ (usada em CHECK).';

-- Agora que a função existe, a regra vira constraint. O ALTER valida
-- também todas as linhas já carregadas pelo script 02.
ALTER TABLE escritorio ADD CONSTRAINT ck_escritorio_cnpj_dv CHECK (fn_validar_cnpj(cnpj));
ALTER TABLE cliente    ADD CONSTRAINT ck_cliente_cnpj_dv    CHECK (fn_validar_cnpj(cnpj));

-- ---------------------------------------------------------------------
-- A2. fn_classificar_confianca — faixa de confiança da IA (RF17).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_classificar_confianca(p_confianca NUMERIC)
RETURNS VARCHAR
LANGUAGE sql
IMMUTABLE
SET search_path = contabil, public
AS $$
    SELECT CASE
             WHEN p_confianca IS NULL THEN 'N/A'      -- parser XML/JSON: determinístico
             WHEN p_confianca >= 90   THEN 'ALTA'
             WHEN p_confianca >= 70   THEN 'MEDIA'
             ELSE                          'BAIXA'
           END;
$$;
COMMENT ON FUNCTION fn_classificar_confianca(NUMERIC) IS 'ALTA (>=90), MEDIA (>=70), BAIXA (<70) ou N/A (parser).';

-- ---------------------------------------------------------------------
-- A3. fn_usuario_responsavel — o usuário é contador ATIVO responsável
--     pela empresa? Centraliza a regra de autorização usada pelas
--     procedures (RF12, RNF03).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_usuario_responsavel(p_usuario_id BIGINT, p_cliente_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = contabil, public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM   usuario u
        JOIN   usuario_cliente uc ON uc.usuario_id = u.id
        WHERE  u.id = p_usuario_id
        AND    u.ativo
        AND    u.perfil = 'CONTADOR'
        AND    uc.cliente_id = p_cliente_id
        AND    uc.papel = 'RESPONSAVEL'
    );
$$;

-- ---------------------------------------------------------------------
-- A4. fn_saldo_conta — saldo de uma conta no período, somando também
--     as subcontas (conta sintética) via CTE recursiva. Considera só
--     lançamentos APROVADOS (RN01) e aplica a natureza da conta:
--     devedora = D − C ; credora = C − D.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_saldo_conta(
    p_conta_id    BIGINT,
    p_data_inicio DATE DEFAULT '-infinity',
    p_data_fim    DATE DEFAULT 'infinity')
RETURNS NUMERIC(15,2)
LANGUAGE plpgsql
STABLE
SET search_path = contabil, public
AS $$
DECLARE
    v_natureza CHAR(1);
    v_saldo    NUMERIC(15,2);
BEGIN
    SELECT natureza INTO v_natureza FROM conta_contabil WHERE id = p_conta_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Conta contábil % não encontrada', p_conta_id
              USING ERRCODE = 'no_data_found';
    END IF;

    WITH RECURSIVE arvore AS (
        SELECT id FROM conta_contabil WHERE id = p_conta_id
        UNION ALL
        SELECT f.id FROM conta_contabil f JOIN arvore a ON f.conta_pai_id = a.id
    )
    SELECT COALESCE(SUM(CASE WHEN i.tipo_movimento = v_natureza THEN i.valor ELSE -i.valor END), 0)
    INTO   v_saldo
    FROM   arvore a
    JOIN   item_lancamento i ON i.conta_contabil_id = a.id
    JOIN   lancamento      l ON l.id = i.lancamento_id
    WHERE  l.status = 'APROVADO'
    AND    l.data_lancamento BETWEEN p_data_inicio AND p_data_fim;

    RETURN v_saldo;
END;
$$;
COMMENT ON FUNCTION fn_saldo_conta(BIGINT, DATE, DATE) IS 'Saldo da conta (e subcontas) no período, pela natureza da conta.';

-- ---------------------------------------------------------------------
-- A5. fn_razao_conta — função de TABELA: livro Razão de uma conta
--     analítica, com saldo anterior e saldo acumulado (window function).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_razao_conta(
    p_conta_id    BIGINT,
    p_data_inicio DATE,
    p_data_fim    DATE)
RETURNS TABLE (
    data_lancamento DATE,
    lancamento_id   BIGINT,
    historico       TEXT,
    debito          NUMERIC(15,2),
    credito         NUMERIC(15,2),
    saldo           NUMERIC(15,2))
LANGUAGE plpgsql
STABLE
SET search_path = contabil, public
AS $$
DECLARE
    v_natureza       CHAR(1);
    v_saldo_anterior NUMERIC(15,2);
BEGIN
    SELECT natureza INTO v_natureza FROM conta_contabil WHERE id = p_conta_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Conta contábil % não encontrada', p_conta_id USING ERRCODE = 'no_data_found';
    END IF;

    v_saldo_anterior := fn_saldo_conta(p_conta_id, '-infinity', p_data_inicio - 1);

    RETURN QUERY
    SELECT NULL::DATE, NULL::BIGINT, 'SALDO ANTERIOR'::TEXT, NULL::NUMERIC(15,2), NULL::NUMERIC(15,2), v_saldo_anterior
    UNION ALL
    SELECT m.data_lancamento, m.lancamento_id, m.historico, m.debito, m.credito,
           (v_saldo_anterior + SUM(CASE WHEN v_natureza = 'D' THEN m.debito - m.credito
                                        ELSE m.credito - m.debito END)
                               OVER (ORDER BY m.data_lancamento, m.lancamento_id, m.item_id))::NUMERIC(15,2)
    FROM (
        SELECT l.data_lancamento, l.id AS lancamento_id, i.id AS item_id,
               COALESCE(i.historico, l.descricao)::TEXT AS historico,
               CASE WHEN i.tipo_movimento = 'D' THEN i.valor ELSE 0 END::NUMERIC(15,2) AS debito,
               CASE WHEN i.tipo_movimento = 'C' THEN i.valor ELSE 0 END::NUMERIC(15,2) AS credito
        FROM   item_lancamento i
        JOIN   lancamento l ON l.id = i.lancamento_id
        WHERE  i.conta_contabil_id = p_conta_id
        AND    l.status = 'APROVADO'
        AND    l.data_lancamento BETWEEN p_data_inicio AND p_data_fim
    ) m;
END;
$$;
COMMENT ON FUNCTION fn_razao_conta(BIGINT, DATE, DATE) IS 'Livro Razão de uma conta no período, com saldo acumulado.';

/* =====================================================================
   B. VIEWS
   ===================================================================== */

-- ---------------------------------------------------------------------
-- B1. vw_balancete — 4 tabelas, GROUP BY + HAVING.
--     Balancete mensal por empresa: movimento e saldo de cada conta
--     analítica que tenha saldo diferente de zero na competência.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_balancete AS
SELECT  c.id                                        AS cliente_id,
        c.razao_social,
        date_trunc('month', l.data_lancamento)::DATE AS competencia,
        cc.codigo,
        cc.nome                                     AS conta,
        cc.tipo,
        cc.natureza,
        SUM(i.valor) FILTER (WHERE i.tipo_movimento = 'D') AS total_debito,
        SUM(i.valor) FILTER (WHERE i.tipo_movimento = 'C') AS total_credito,
        SUM(CASE WHEN i.tipo_movimento = cc.natureza THEN i.valor ELSE -i.valor END) AS saldo,
        COUNT(DISTINCT l.id)                        AS qtd_lancamentos
FROM    cliente         c
JOIN    lancamento      l  ON l.cliente_id = c.id
JOIN    item_lancamento i  ON i.lancamento_id = l.id
JOIN    conta_contabil  cc ON cc.id = i.conta_contabil_id
WHERE   l.status = 'APROVADO'                       -- RN01: só o que foi aprovado
GROUP BY c.id, c.razao_social, date_trunc('month', l.data_lancamento),
         cc.codigo, cc.nome, cc.tipo, cc.natureza
HAVING  SUM(CASE WHEN i.tipo_movimento = cc.natureza THEN i.valor ELSE -i.valor END) <> 0;

COMMENT ON VIEW vw_balancete IS 'Balancete mensal por empresa e conta (somente lançamentos aprovados, contas com saldo).';

-- ---------------------------------------------------------------------
-- B2. vw_fila_revisao — fila do contador (RF20, RF17, RF21).
--     Lançamentos aguardando decisão, com documento, confiança da IA
--     e há quantas horas estão esperando.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_fila_revisao AS
SELECT  l.id                     AS lancamento_id,
        c.id                     AS cliente_id,
        c.razao_social,
        l.data_lancamento,
        l.descricao,
        l.valor_total,
        l.origem,
        l.status,
        d.id                     AS documento_id,
        d.nome_arquivo,
        d.caminho_arquivo,
        a.nivel_confianca,
        fn_classificar_confianca(a.nivel_confianca) AS faixa_confianca,
        round(EXTRACT(EPOCH FROM (now() - l.criado_em)) / 3600, 1) AS horas_aguardando
FROM    lancamento l
JOIN    cliente c                 ON c.id = l.cliente_id
LEFT JOIN documento d             ON d.id = l.documento_id
LEFT JOIN analise_documento a     ON a.documento_id = d.id
WHERE   l.status IN ('PENDENTE', 'CORRIGIDO');

COMMENT ON VIEW vw_fila_revisao IS 'Lançamentos aguardando aprovação, com confiança da IA (RF17, RF20).';

-- ---------------------------------------------------------------------
-- B3. vw_painel_pendencias — dashboard gerencial (RF30).
--     Agregações pré-calculadas em CTEs para evitar o "fan-out" de
--     JOIN documento × lançamento (que multiplicaria as contagens).
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_painel_pendencias AS
WITH docs AS (
    SELECT cliente_id,
           COUNT(*)                                                   AS documentos_total,
           COUNT(*) FILTER (WHERE status IN ('PENDENTE','PROCESSANDO')) AS documentos_em_processamento,
           COUNT(*) FILTER (WHERE status = 'FALHA')                   AS documentos_com_falha
    FROM documento GROUP BY cliente_id
), lanc AS (
    SELECT cliente_id,
           COUNT(*) FILTER (WHERE status IN ('PENDENTE','CORRIGIDO')) AS lancamentos_pendentes,
           COUNT(*) FILTER (WHERE status = 'APROVADO')                AS lancamentos_aprovados,
           round(AVG(EXTRACT(EPOCH FROM (aprovado_em - criado_em)) / 3600)
                 FILTER (WHERE status = 'APROVADO' AND origem <> 'MANUAL'), 1) AS tempo_medio_revisao_h
    FROM lancamento GROUP BY cliente_id
), ia AS (
    -- Taxa de acerto da IA: sugestões decididas que foram aprovadas sem correção.
    SELECT l.cliente_id,
           COUNT(*) FILTER (WHERE l.status IN ('APROVADO','REPROVADO'))          AS sugestoes_ia_decididas,
           COUNT(*) FILTER (WHERE l.status = 'APROVADO'
                              AND NOT EXISTS (SELECT 1 FROM revisao_contabil r
                                              WHERE r.lancamento_id = l.id AND r.acao = 'CORRECAO')) AS sugestoes_ia_aceitas
    FROM lancamento l
    WHERE l.origem = 'IA'
    GROUP BY l.cliente_id
)
SELECT  c.id AS cliente_id,
        c.razao_social,
        c.status,
        COALESCE(d.documentos_total, 0)            AS documentos_total,
        COALESCE(d.documentos_em_processamento, 0) AS documentos_em_processamento,
        COALESCE(d.documentos_com_falha, 0)        AS documentos_com_falha,
        COALESCE(l.lancamentos_pendentes, 0)       AS lancamentos_pendentes,
        COALESCE(l.lancamentos_aprovados, 0)       AS lancamentos_aprovados,
        l.tempo_medio_revisao_h,
        CASE WHEN ia.sugestoes_ia_decididas > 0
             THEN round(100.0 * ia.sugestoes_ia_aceitas / ia.sugestoes_ia_decididas, 1) END AS taxa_acerto_ia_pct
FROM    cliente c
LEFT JOIN docs d ON d.cliente_id = c.id
LEFT JOIN lanc l ON l.cliente_id = c.id
LEFT JOIN ia     ON ia.cliente_id = c.id;

COMMENT ON VIEW vw_painel_pendencias IS 'Indicadores por empresa: pendências, tempo médio de revisão e taxa de acerto da IA (RF30).';

/* =====================================================================
   C. TRIGGERS
   ===================================================================== */

-- ---------------------------------------------------------------------
-- C1. AUDITORIA (RF28/RNF15) — função genérica, reaproveitada em várias
--     tabelas. Grava o "antes" e o "depois" em JSONB. O usuário da
--     aplicação vem de SET LOCAL app.usuario_id (definido pela API).
--     O senha_hash nunca é copiado para o log: é mascarado, mas a TROCA
--     de senha continua sendo registrada (evento relevante de segurança).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_tg_auditoria()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = contabil, public
AS $$
DECLARE
    v_antigo  JSONB;
    v_novo    JSONB;
    v_usuario BIGINT := NULLIF(current_setting('app.usuario_id', TRUE), '')::BIGINT;
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN v_antigo := to_jsonb(OLD); END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') THEN v_novo   := to_jsonb(NEW); END IF;

    -- Mascara credenciais antes de gravar.
    IF COALESCE(v_novo, v_antigo) ? 'senha_hash' THEN
        IF v_antigo IS NOT NULL THEN
            v_antigo := jsonb_set(v_antigo, '{senha_hash}', '"***"');
        END IF;
        IF v_novo IS NOT NULL THEN
            v_novo := jsonb_set(v_novo, '{senha_hash}',
                CASE WHEN TG_OP = 'UPDATE' AND OLD IS DISTINCT FROM NEW
                          AND to_jsonb(OLD)->'senha_hash' IS DISTINCT FROM to_jsonb(NEW)->'senha_hash'
                     THEN '"*** (alterada)"'::JSONB ELSE '"***"'::JSONB END);
        END IF;
    END IF;

    -- UPDATE que não mudou nada relevante não gera log. Colunas passadas
    -- como argumento do trigger (TG_ARGV) são ignoradas na comparação —
    -- ex.: valor_total recalculado automaticamente a cada item inserido.
    IF TG_OP = 'UPDATE'
       AND (v_antigo - COALESCE(TG_ARGV, '{}'::TEXT[])) = (v_novo - COALESCE(TG_ARGV, '{}'::TEXT[])) THEN
        RETURN NULL;
    END IF;

    INSERT INTO log_auditoria (tabela, registro_id, operacao, dados_anteriores, dados_novos, usuario_app_id)
    VALUES (TG_TABLE_NAME,
            (COALESCE(v_novo, v_antigo)->>'id')::BIGINT,
            left(TG_OP, 1),
            v_antigo,
            v_novo,
            v_usuario);
    RETURN NULL;   -- AFTER trigger: retorno ignorado
END;
$$;

CREATE TRIGGER trg_auditoria_cliente         AFTER INSERT OR UPDATE OR DELETE ON cliente         FOR EACH ROW EXECUTE FUNCTION fn_tg_auditoria();
CREATE TRIGGER trg_auditoria_usuario         AFTER INSERT OR UPDATE OR DELETE ON usuario         FOR EACH ROW EXECUTE FUNCTION fn_tg_auditoria();
CREATE TRIGGER trg_auditoria_conta_contabil  AFTER INSERT OR UPDATE OR DELETE ON conta_contabil  FOR EACH ROW EXECUTE FUNCTION fn_tg_auditoria();
CREATE TRIGGER trg_auditoria_documento       AFTER INSERT OR UPDATE OR DELETE ON documento       FOR EACH ROW EXECUTE FUNCTION fn_tg_auditoria();
CREATE TRIGGER trg_auditoria_lancamento      AFTER INSERT OR UPDATE OR DELETE ON lancamento      FOR EACH ROW EXECUTE FUNCTION fn_tg_auditoria('valor_total', 'atualizado_em');
CREATE TRIGGER trg_auditoria_item_lancamento AFTER INSERT OR UPDATE OR DELETE ON item_lancamento FOR EACH ROW EXECUTE FUNCTION fn_tg_auditoria();

-- ---------------------------------------------------------------------
-- C2. VALIDAÇÃO DO ITEM (integridade) — BEFORE INSERT/UPDATE/DELETE
--     • lançamento APROVADO/REPROVADO não aceita alteração de itens (RN01);
--     • a conta precisa ser da MESMA empresa do lançamento (FK sozinha
--       não garante isso: ela só garante que a conta existe);
--     • a conta precisa ser analítica e estar ativa.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_tg_item_validar()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = contabil, public
AS $$
DECLARE
    v_lanc  RECORD;
    v_conta RECORD;
BEGIN
    SELECT id, cliente_id, status INTO v_lanc
    FROM   lancamento
    WHERE  id = CASE WHEN TG_OP = 'DELETE' THEN OLD.lancamento_id ELSE NEW.lancamento_id END;

    IF TG_OP = 'DELETE' THEN
        -- Em ON DELETE CASCADE o lançamento já foi removido: nada a validar.
        IF FOUND AND v_lanc.status IN ('APROVADO', 'REPROVADO') THEN
            RAISE EXCEPTION 'Lançamento % está % e não pode ter itens removidos', v_lanc.id, v_lanc.status
                  USING ERRCODE = 'integrity_constraint_violation';
        END IF;
        RETURN OLD;
    END IF;

    IF v_lanc.status IN ('APROVADO', 'REPROVADO') THEN
        RAISE EXCEPTION 'Lançamento % está % e não pode ser alterado', v_lanc.id, v_lanc.status
              USING ERRCODE = 'integrity_constraint_violation',
                    HINT    = 'Lançamentos aprovados são imutáveis; registre um lançamento de estorno.';
    END IF;

    SELECT id, cliente_id, codigo, analitica, ativa INTO v_conta
    FROM   conta_contabil WHERE id = NEW.conta_contabil_id;

    IF v_conta.cliente_id <> v_lanc.cliente_id THEN
        RAISE EXCEPTION 'Conta % pertence a outra empresa (cliente %), lançamento é do cliente %',
              v_conta.codigo, v_conta.cliente_id, v_lanc.cliente_id
              USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF NOT v_conta.analitica THEN
        RAISE EXCEPTION 'Conta % é sintética; lance apenas em contas analíticas', v_conta.codigo
              USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF NOT v_conta.ativa THEN
        RAISE EXCEPTION 'Conta % está inativa no plano desta empresa', v_conta.codigo
              USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_item_validar
    BEFORE INSERT OR UPDATE OR DELETE ON item_lancamento
    FOR EACH ROW EXECUTE FUNCTION fn_tg_item_validar();

-- ---------------------------------------------------------------------
-- C3. PARTIDAS DOBRADAS (RF23) — CONSTRAINT TRIGGER DEFERRABLE.
--     A checagem roda no COMMIT, não a cada linha: assim é possível
--     inserir o cabeçalho e os itens um por um dentro da transação.
--     Se no COMMIT Σ débitos ≠ Σ créditos, a transação inteira é desfeita.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_tg_partidas_dobradas()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = contabil, public
AS $$
DECLARE
    v_lancamento_id BIGINT;
    v_debito        NUMERIC(15,2);
    v_credito       NUMERIC(15,2);
BEGIN
    IF TG_TABLE_NAME = 'lancamento' THEN
        v_lancamento_id := NEW.id;
    ELSIF TG_OP = 'DELETE' THEN
        v_lancamento_id := OLD.lancamento_id;
    ELSE
        v_lancamento_id := NEW.lancamento_id;
    END IF;

    -- Lançamento excluído na mesma transação: nada a conferir.
    IF NOT EXISTS (SELECT 1 FROM lancamento WHERE id = v_lancamento_id) THEN
        RETURN NULL;
    END IF;

    SELECT COALESCE(SUM(valor) FILTER (WHERE tipo_movimento = 'D'), 0),
           COALESCE(SUM(valor) FILTER (WHERE tipo_movimento = 'C'), 0)
    INTO   v_debito, v_credito
    FROM   item_lancamento
    WHERE  lancamento_id = v_lancamento_id;

    IF v_debito = 0 OR v_credito = 0 THEN
        RAISE EXCEPTION 'Lançamento % precisa de ao menos uma partida a débito e uma a crédito', v_lancamento_id
              USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF v_debito <> v_credito THEN
        RAISE EXCEPTION 'Partidas dobradas violadas no lançamento %: débitos = %, créditos = %',
              v_lancamento_id, v_debito, v_credito
              USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_item_partidas_dobradas
    AFTER INSERT OR UPDATE OR DELETE ON item_lancamento
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION fn_tg_partidas_dobradas();

-- Também no cabeçalho: impede COMMIT de lançamento sem itens.
CREATE CONSTRAINT TRIGGER trg_lancamento_partidas_dobradas
    AFTER INSERT ON lancamento
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION fn_tg_partidas_dobradas();

-- ---------------------------------------------------------------------
-- C4. VALOR_TOTAL (desnormalização controlada) — mantém
--     lancamento.valor_total = Σ débitos sempre que um item muda.
--     Atualização INCREMENTAL (soma/subtrai só o delta da linha), em vez
--     de recalcular SUM() a cada item: custo O(1) por linha, o que
--     importa em importações em lote (XML/JSON com centenas de itens).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_tg_item_valor_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = contabil, public
AS $$
BEGIN
    -- Remove a contribuição antiga (UPDATE/DELETE)
    IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.tipo_movimento = 'D' THEN
        UPDATE lancamento SET valor_total = valor_total - OLD.valor WHERE id = OLD.lancamento_id;
    END IF;
    -- Soma a contribuição nova (INSERT/UPDATE)
    IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.tipo_movimento = 'D' THEN
        UPDATE lancamento SET valor_total = valor_total + NEW.valor WHERE id = NEW.lancamento_id;
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_item_valor_total
    AFTER INSERT OR UPDATE OR DELETE ON item_lancamento
    FOR EACH ROW EXECUTE FUNCTION fn_tg_item_valor_total();

-- ---------------------------------------------------------------------
-- C5. REGRAS DO LANÇAMENTO — BEFORE INSERT/UPDATE/DELETE
--     • documento vinculado precisa ser da mesma empresa;
--     • APROVADO/REPROVADO é estado final (imutável);
--     • não pode excluir lançamento aprovado ou já exportado;
--     • mantém atualizado_em.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_tg_lancamento_regras()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = contabil, public
AS $$
DECLARE
    v_doc_cliente BIGINT;
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.status IN ('APROVADO', 'REPROVADO') THEN
            RAISE EXCEPTION 'Lançamento % está % e não pode ser excluído (RN02/RN07)', OLD.id, OLD.status
                  USING ERRCODE = 'integrity_constraint_violation';
        END IF;
        RETURN OLD;
    END IF;

    IF NEW.documento_id IS NOT NULL THEN
        SELECT cliente_id INTO v_doc_cliente FROM documento WHERE id = NEW.documento_id;
        IF v_doc_cliente <> NEW.cliente_id THEN
            RAISE EXCEPTION 'Documento % pertence ao cliente %, mas o lançamento é do cliente %',
                  NEW.documento_id, v_doc_cliente, NEW.cliente_id
                  USING ERRCODE = 'integrity_constraint_violation';
        END IF;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD.status IN ('APROVADO', 'REPROVADO') AND NEW IS DISTINCT FROM OLD THEN
            RAISE EXCEPTION 'Lançamento % está % e não pode ser alterado', OLD.id, OLD.status
                  USING ERRCODE = 'integrity_constraint_violation',
                        HINT    = 'Para corrigir um lançamento aprovado, registre um estorno.';
        END IF;
        NEW.atualizado_em := now();
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lancamento_regras
    BEFORE INSERT OR UPDATE OR DELETE ON lancamento
    FOR EACH ROW EXECUTE FUNCTION fn_tg_lancamento_regras();

-- ---------------------------------------------------------------------
-- C6. atualizado_em genérico (cliente, documento)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_tg_atualizado_em()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = contabil, public
AS $$
BEGIN
    NEW.atualizado_em := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cliente_atualizado_em   BEFORE UPDATE ON cliente   FOR EACH ROW EXECUTE FUNCTION fn_tg_atualizado_em();
CREATE TRIGGER trg_documento_atualizado_em BEFORE UPDATE ON documento FOR EACH ROW EXECUTE FUNCTION fn_tg_atualizado_em();

/* =====================================================================
   D. STORED PROCEDURES
   Convenção de erros: validações de negócio usam RAISE EXCEPTION com
   SQLSTATE adequado; violações de constraint são capturadas e
   relançadas com mensagem amigável. Como CALL é uma instrução atômica,
   qualquer erro desfaz TODAS as escritas feitas pela procedure.
   ===================================================================== */

-- ---------------------------------------------------------------------
-- D1. sp_registrar_lancamento — lançamento simples ou múltiplo.
--     Escreve em lancamento + item_lancamento (+ revisao_contabil).
--     p_itens: [{"conta":"1.1.01.001","tipo":"D","valor":100.00,"historico":"..."}, ...]
--     Lançamento MANUAL feito por contador já nasce APROVADO (é a própria
--     revisão humana — RN01); origem IA/IMPORTACAO nasce PENDENTE.
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_registrar_lancamento(
    IN  p_cliente_id      BIGINT,
    IN  p_usuario_id      BIGINT,
    IN  p_data            DATE,
    IN  p_descricao       VARCHAR,
    IN  p_itens           JSONB,
    IN  p_documento_id    BIGINT,          -- NULL = lançamento manual
    IN  p_origem          VARCHAR,         -- MANUAL | IA | IMPORTACAO
    OUT p_lancamento_id   BIGINT,
    OUT p_status          VARCHAR)
LANGUAGE plpgsql
SET search_path = contabil, public
AS $$
DECLARE
    v_perfil   VARCHAR;
    v_cliente  RECORD;
    v_item     JSONB;
    v_conta_id BIGINT;
    v_debito   NUMERIC(15,2) := 0;
    v_credito  NUMERIC(15,2) := 0;
BEGIN
    PERFORM set_config('app.usuario_id', p_usuario_id::TEXT, TRUE);   -- para a auditoria

    -- 1) Validações de entrada -----------------------------------------
    SELECT perfil INTO v_perfil FROM usuario WHERE id = p_usuario_id AND ativo;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Usuário % inexistente ou inativo', p_usuario_id USING ERRCODE = 'insufficient_privilege';
    END IF;

    SELECT id, status INTO v_cliente FROM cliente WHERE id = p_cliente_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cliente % não encontrado', p_cliente_id USING ERRCODE = 'no_data_found';
    ELSIF v_cliente.status <> 'ATIVO' THEN
        RAISE EXCEPTION 'Cliente % está INATIVO e não aceita lançamentos', p_cliente_id
              USING ERRCODE = 'check_violation';
    END IF;

    IF p_origem = 'MANUAL' AND NOT fn_usuario_responsavel(p_usuario_id, p_cliente_id) THEN
        RAISE EXCEPTION 'Usuário % não é contador responsável pelo cliente %', p_usuario_id, p_cliente_id
              USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) < 2 THEN
        RAISE EXCEPTION 'Informe ao menos duas partidas (débito e crédito)' USING ERRCODE = 'invalid_parameter_value';
    END IF;

    SELECT COALESCE(SUM((e->>'valor')::NUMERIC) FILTER (WHERE e->>'tipo' = 'D'), 0),
           COALESCE(SUM((e->>'valor')::NUMERIC) FILTER (WHERE e->>'tipo' = 'C'), 0)
    INTO   v_debito, v_credito
    FROM   jsonb_array_elements(p_itens) e;

    IF v_debito <> v_credito THEN
        RAISE EXCEPTION 'Débitos (%) diferentes de créditos (%)', v_debito, v_credito
              USING ERRCODE = 'check_violation',
                    HINT    = 'O total de débitos precisa ser igual ao total de créditos.';
    END IF;

    -- 2) Cabeçalho -----------------------------------------------------
    INSERT INTO lancamento (cliente_id, documento_id, criado_por, data_lancamento, descricao, origem, status)
    VALUES (p_cliente_id, p_documento_id, p_usuario_id, p_data, p_descricao, p_origem, 'PENDENTE')
    RETURNING id INTO p_lancamento_id;

    -- 3) Itens (conta resolvida pelo código no plano da própria empresa)
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
        SELECT id INTO v_conta_id
        FROM   conta_contabil
        WHERE  cliente_id = p_cliente_id AND codigo = v_item->>'conta';
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Conta % não existe no plano de contas do cliente %', v_item->>'conta', p_cliente_id
                  USING ERRCODE = 'foreign_key_violation';
        END IF;

        INSERT INTO item_lancamento (lancamento_id, conta_contabil_id, tipo_movimento, valor, historico)
        VALUES (p_lancamento_id, v_conta_id, v_item->>'tipo', (v_item->>'valor')::NUMERIC, v_item->>'historico');
    END LOOP;

    -- 4) Lançamento manual do contador = já revisado por humano --------
    IF p_origem = 'MANUAL' THEN
        UPDATE lancamento
        SET    status = 'APROVADO', aprovado_por = p_usuario_id, aprovado_em = now()
        WHERE  id = p_lancamento_id;

        INSERT INTO revisao_contabil (lancamento_id, usuario_id, acao, observacao)
        VALUES (p_lancamento_id, p_usuario_id, 'APROVACAO', 'Lançamento manual do contador.');
    END IF;

    SELECT status INTO p_status FROM lancamento WHERE id = p_lancamento_id;

EXCEPTION
    WHEN check_violation THEN
        RAISE EXCEPTION 'Lançamento rejeitado: %', SQLERRM USING ERRCODE = 'check_violation';
    WHEN foreign_key_violation THEN
        RAISE EXCEPTION 'Referência inválida: %', SQLERRM USING ERRCODE = 'foreign_key_violation';
END;
$$;

-- ---------------------------------------------------------------------
-- D2. sp_aprovar_lancamento (RF23, RN01) — aprova a sugestão.
--     Escreve em lancamento + revisao_contabil + documento.
--     SELECT ... FOR UPDATE bloqueia a linha: dois contadores não
--     conseguem aprovar/alterar o mesmo lançamento ao mesmo tempo.
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_aprovar_lancamento(
    IN  p_lancamento_id    BIGINT,
    IN  p_usuario_id       BIGINT,
    IN  p_observacao       TEXT,           -- opcional (pode ser NULL)
    OUT p_documento_status VARCHAR)
LANGUAGE plpgsql
SET search_path = contabil, public
AS $$
DECLARE
    v_lanc    RECORD;
    v_debito  NUMERIC(15,2);
    v_credito NUMERIC(15,2);
BEGIN
    PERFORM set_config('app.usuario_id', p_usuario_id::TEXT, TRUE);

    SELECT id, cliente_id, documento_id, status INTO v_lanc
    FROM   lancamento WHERE id = p_lancamento_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lançamento % não encontrado', p_lancamento_id USING ERRCODE = 'no_data_found';
    END IF;
    IF NOT fn_usuario_responsavel(p_usuario_id, v_lanc.cliente_id) THEN
        RAISE EXCEPTION 'Usuário % não é contador responsável pelo cliente %', p_usuario_id, v_lanc.cliente_id
              USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF v_lanc.status NOT IN ('PENDENTE', 'CORRIGIDO') THEN
        RAISE EXCEPTION 'Lançamento % já está % e não pode ser aprovado', p_lancamento_id, v_lanc.status
              USING ERRCODE = 'check_violation';
    END IF;

    -- Confere partidas dobradas já agora (o trigger deferido conferiria só no COMMIT).
    SELECT COALESCE(SUM(valor) FILTER (WHERE tipo_movimento = 'D'), 0),
           COALESCE(SUM(valor) FILTER (WHERE tipo_movimento = 'C'), 0)
    INTO   v_debito, v_credito
    FROM   item_lancamento WHERE lancamento_id = p_lancamento_id;
    IF v_debito = 0 OR v_debito <> v_credito THEN
        RAISE EXCEPTION 'Lançamento % desbalanceado (D=% C=%)', p_lancamento_id, v_debito, v_credito
              USING ERRCODE = 'check_violation';
    END IF;

    UPDATE lancamento
    SET    status = 'APROVADO', aprovado_por = p_usuario_id, aprovado_em = now()
    WHERE  id = p_lancamento_id;

    INSERT INTO revisao_contabil (lancamento_id, usuario_id, acao, observacao)
    VALUES (p_lancamento_id, p_usuario_id, 'APROVACAO', p_observacao);

    -- Documento só fica APROVADO quando não sobra lançamento dele em aberto.
    IF v_lanc.documento_id IS NOT NULL THEN
        UPDATE documento d
        SET    status = 'APROVADO'
        WHERE  d.id = v_lanc.documento_id
        AND    NOT EXISTS (SELECT 1 FROM lancamento l
                           WHERE l.documento_id = d.id AND l.status IN ('PENDENTE', 'CORRIGIDO'));
        SELECT status INTO p_documento_status FROM documento WHERE id = v_lanc.documento_id;
    END IF;
END;
$$;

-- ---------------------------------------------------------------------
-- D3. sp_reprovar_documento (RF24, RN07) — rejeita o documento com
--     justificativa obrigatória e reprova os lançamentos sugeridos.
--     Escreve em documento + lancamento + revisao_contabil.
--     O documento NÃO é apagado: continua armazenado para auditoria.
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_reprovar_documento(
    IN  p_documento_id      BIGINT,
    IN  p_usuario_id        BIGINT,
    IN  p_motivo            TEXT,
    OUT p_qtd_reprovados    INTEGER)
LANGUAGE plpgsql
SET search_path = contabil, public
AS $$
DECLARE
    v_doc RECORD;
BEGIN
    PERFORM set_config('app.usuario_id', p_usuario_id::TEXT, TRUE);

    IF p_motivo IS NULL OR length(trim(p_motivo)) < 10 THEN
        RAISE EXCEPTION 'Justificativa obrigatória (mínimo 10 caracteres) para rejeitar documento'
              USING ERRCODE = 'invalid_parameter_value';
    END IF;

    SELECT id, cliente_id, status INTO v_doc FROM documento WHERE id = p_documento_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Documento % não encontrado', p_documento_id USING ERRCODE = 'no_data_found';
    END IF;
    IF NOT fn_usuario_responsavel(p_usuario_id, v_doc.cliente_id) THEN
        RAISE EXCEPTION 'Usuário % não é contador responsável pelo cliente %', p_usuario_id, v_doc.cliente_id
              USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF v_doc.status IN ('APROVADO', 'REJEITADO') THEN
        RAISE EXCEPTION 'Documento % já está % e não pode ser rejeitado', p_documento_id, v_doc.status
              USING ERRCODE = 'check_violation';
    END IF;

    UPDATE documento
    SET    status = 'REJEITADO', motivo_rejeicao = p_motivo
    WHERE  id = p_documento_id;

    -- Registra a revisão de cada lançamento em aberto e depois reprova todos.
    INSERT INTO revisao_contabil (lancamento_id, usuario_id, acao, observacao)
    SELECT id, p_usuario_id, 'REPROVACAO', p_motivo
    FROM   lancamento
    WHERE  documento_id = p_documento_id AND status IN ('PENDENTE', 'CORRIGIDO');

    UPDATE lancamento
    SET    status = 'REPROVADO', motivo_reprovacao = p_motivo
    WHERE  documento_id = p_documento_id AND status IN ('PENDENTE', 'CORRIGIDO');

    GET DIAGNOSTICS p_qtd_reprovados = ROW_COUNT;
END;
$$;

-- ---------------------------------------------------------------------
-- D4. sp_exportar_lancamentos (RF26, RF27) — gera um lote de exportação
--     com os lançamentos APROVADOS do período ainda não exportados.
--     Escreve em exportacao + exportacao_lancamento.
--     O UNIQUE(lancamento_id) garante, mesmo com duas exportações
--     concorrentes, que nenhum lançamento sai duas vezes.
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_exportar_lancamentos(
    IN  p_cliente_id     BIGINT,
    IN  p_usuario_id     BIGINT,
    IN  p_inicio         DATE,
    IN  p_fim            DATE,
    OUT p_exportacao_id  BIGINT,
    OUT p_qtd            INTEGER)
LANGUAGE plpgsql
SET search_path = contabil, public
AS $$
DECLARE
    v_cnpj CHAR(14);
BEGIN
    PERFORM set_config('app.usuario_id', p_usuario_id::TEXT, TRUE);

    IF p_fim < p_inicio THEN
        RAISE EXCEPTION 'Período inválido: % a %', p_inicio, p_fim USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF NOT fn_usuario_responsavel(p_usuario_id, p_cliente_id) THEN
        RAISE EXCEPTION 'Usuário % não é contador responsável pelo cliente %', p_usuario_id, p_cliente_id
              USING ERRCODE = 'insufficient_privilege';
    END IF;

    SELECT cnpj INTO v_cnpj FROM cliente WHERE id = p_cliente_id;

    INSERT INTO exportacao (cliente_id, usuario_id, periodo_inicio, periodo_fim, nome_arquivo)
    VALUES (p_cliente_id, p_usuario_id, p_inicio, p_fim,
            format('export_%s_%s_%s.csv', v_cnpj, to_char(p_inicio, 'YYYYMMDD'), to_char(p_fim, 'YYYYMMDD')))
    RETURNING id INTO p_exportacao_id;

    INSERT INTO exportacao_lancamento (exportacao_id, lancamento_id)
    SELECT p_exportacao_id, l.id
    FROM   lancamento l
    WHERE  l.cliente_id = p_cliente_id
    AND    l.status = 'APROVADO'
    AND    l.data_lancamento BETWEEN p_inicio AND p_fim
    AND    NOT EXISTS (SELECT 1 FROM exportacao_lancamento el WHERE el.lancamento_id = l.id);

    GET DIAGNOSTICS p_qtd = ROW_COUNT;

    IF p_qtd = 0 THEN
        -- Aborta: a linha de exportacao inserida acima também é desfeita.
        RAISE EXCEPTION 'Nenhum lançamento aprovado e não exportado no período % a %', p_inicio, p_fim
              USING ERRCODE = 'no_data_found';
    END IF;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION 'Outro processo exportou parte destes lançamentos ao mesmo tempo; tente novamente'
              USING ERRCODE = 'serialization_failure';
END;
$$;

-- ---------------------------------------------------------------------
-- Inventário dos objetos criados
-- ---------------------------------------------------------------------
SELECT routine_type AS tipo, routine_name AS nome
FROM   information_schema.routines
WHERE  routine_schema = 'contabil'
ORDER  BY 1, 2;

SELECT table_name AS view FROM information_schema.views WHERE table_schema = 'contabil' ORDER BY 1;

SELECT event_object_table AS tabela, trigger_name, string_agg(event_manipulation, '/' ORDER BY event_manipulation) AS eventos,
       action_timing AS momento
FROM   information_schema.triggers
WHERE  trigger_schema = 'contabil'
GROUP  BY 1, 2, 4
ORDER  BY 1, 2;
