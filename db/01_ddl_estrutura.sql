\encoding UTF8
/* =====================================================================
   CONTABILIDADE ÁGIL — Laboratório de Banco de Dados (Fatec Sorocaba)
   01_ddl_estrutura.sql
   Criação do banco, schema, tabelas, constraints e índices.
   SGBD: PostgreSQL 16 (requer 14+ por causa de OUT em procedures)

   Como executar (a partir da pasta db/):
     psql -U postgres -f 01_ddl_estrutura.sql
     psql -U postgres -d contabilidade_agil -f 02_dml_carga_inicial.sql
     psql -U postgres -d contabilidade_agil -f 03_programacao_avancada.sql
     psql -U postgres -d contabilidade_agil -f 04_testes_e_transacoes.sql
   ===================================================================== */

-- ---------------------------------------------------------------------
-- 0. Banco de dados (executado conectado ao banco "postgres")
--    O bloco entre @local-inicio e @local-fim só roda no psql local.
--    Em banco gerenciado (Neon, Render etc.) o banco já existe; o
--    script server/setup-db.js pula este bloco e roda o resto.
-- ---------------------------------------------------------------------
-- @local-inicio
DROP DATABASE IF EXISTS contabilidade_agil;
CREATE DATABASE contabilidade_agil
    WITH ENCODING = 'UTF8'
         TEMPLATE = template0;   -- locale padrão do servidor (funciona em Windows e Linux)

\connect contabilidade_agil

-- Todas as sessões deste banco enxergam o schema "contabil" primeiro.
ALTER DATABASE contabilidade_agil SET search_path = contabil, public;
ALTER DATABASE contabilidade_agil SET timezone = 'America/Sao_Paulo';
-- @local-fim

CREATE SCHEMA contabil;
COMMENT ON SCHEMA contabil IS 'Camada de persistência do sistema Contabilidade Ágil';

SET search_path = contabil, public;
SET timezone = 'America/Sao_Paulo';

/* =====================================================================
   1. ESCRITORIO — escritório de contabilidade (tenant do sistema)
   ===================================================================== */
CREATE TABLE escritorio (
    id            BIGINT GENERATED ALWAYS AS IDENTITY,
    razao_social  VARCHAR(150) NOT NULL,
    cnpj          CHAR(14)     NOT NULL,
    email         VARCHAR(150) NOT NULL,
    telefone      VARCHAR(20),
    criado_em     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT pk_escritorio        PRIMARY KEY (id),
    CONSTRAINT uq_escritorio_cnpj   UNIQUE (cnpj),
    CONSTRAINT ck_escritorio_cnpj   CHECK (cnpj ~ '^[0-9]{14}$'),
    CONSTRAINT ck_escritorio_email  CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

/* =====================================================================
   2. USUARIO — administradores, contadores e usuários de clientes
   ===================================================================== */
CREATE TABLE usuario (
    id             BIGINT GENERATED ALWAYS AS IDENTITY,
    escritorio_id  BIGINT       NOT NULL,
    nome           VARCHAR(120) NOT NULL,
    email          VARCHAR(150) NOT NULL,
    senha_hash     VARCHAR(255) NOT NULL,
    perfil         VARCHAR(10)  NOT NULL,
    crc            VARCHAR(20),
    ativo          BOOLEAN      NOT NULL DEFAULT TRUE,
    criado_em      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT pk_usuario         PRIMARY KEY (id),
    CONSTRAINT uq_usuario_email   UNIQUE (email),
    CONSTRAINT fk_usuario_escritorio FOREIGN KEY (escritorio_id)
        REFERENCES escritorio (id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT ck_usuario_perfil  CHECK (perfil IN ('ADMIN', 'CONTADOR', 'CLIENTE')),
    -- Regra de negócio: todo contador precisa de registro no CRC.
    CONSTRAINT ck_usuario_crc     CHECK (perfil <> 'CONTADOR' OR crc IS NOT NULL),
    CONSTRAINT ck_usuario_email   CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

/* =====================================================================
   3. CLIENTE — empresa atendida pelo escritório
   ===================================================================== */
CREATE TABLE cliente (
    id                   BIGINT GENERATED ALWAYS AS IDENTITY,
    escritorio_id        BIGINT       NOT NULL,
    razao_social         VARCHAR(150) NOT NULL,
    nome_fantasia        VARCHAR(150),
    cnpj                 CHAR(14)     NOT NULL,
    inscricao_estadual   VARCHAR(20),
    inscricao_municipal  VARCHAR(20),
    regime_tributario    VARCHAR(20)  NOT NULL DEFAULT 'SIMPLES_NACIONAL',
    cnae                 CHAR(7),
    email                VARCHAR(150) NOT NULL,
    telefone             VARCHAR(20),
    responsavel          VARCHAR(120),
    logradouro           VARCHAR(150),
    cidade               VARCHAR(80),
    uf                   CHAR(2)      NOT NULL DEFAULT 'SP',
    cep                  CHAR(8),
    status               VARCHAR(10)  NOT NULL DEFAULT 'ATIVO',
    criado_em            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    atualizado_em        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT pk_cliente PRIMARY KEY (id),
    CONSTRAINT fk_cliente_escritorio FOREIGN KEY (escritorio_id)
        REFERENCES escritorio (id) ON UPDATE CASCADE ON DELETE RESTRICT,
    -- Um CNPJ só pode ser cadastrado uma vez por escritório.
    CONSTRAINT uq_cliente_escritorio_cnpj UNIQUE (escritorio_id, cnpj),
    CONSTRAINT ck_cliente_cnpj    CHECK (cnpj ~ '^[0-9]{14}$'),
    CONSTRAINT ck_cliente_regime  CHECK (regime_tributario IN
        ('SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL', 'MEI')),
    CONSTRAINT ck_cliente_cnae    CHECK (cnae IS NULL OR cnae ~ '^[0-9]{7}$'),
    CONSTRAINT ck_cliente_uf      CHECK (uf IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO',
        'MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
    CONSTRAINT ck_cliente_cep     CHECK (cep IS NULL OR cep ~ '^[0-9]{8}$'),
    CONSTRAINT ck_cliente_status  CHECK (status IN ('ATIVO', 'INATIVO')),
    CONSTRAINT ck_cliente_email   CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);
-- Obs.: a validação dos dígitos verificadores do CNPJ é adicionada no
-- script 03, depois da criação da função fn_validar_cnpj().

/* =====================================================================
   4. USUARIO_CLIENTE — associativa N:M
      Contador responsável por várias empresas; uma empresa atendida por
      vários contadores; usuário-cliente com acesso a uma ou mais empresas.
   ===================================================================== */
CREATE TABLE usuario_cliente (
    usuario_id    BIGINT      NOT NULL,
    cliente_id    BIGINT      NOT NULL,
    papel         VARCHAR(12) NOT NULL,
    concedido_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_usuario_cliente PRIMARY KEY (usuario_id, cliente_id),
    CONSTRAINT fk_uc_usuario FOREIGN KEY (usuario_id)
        REFERENCES usuario (id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_uc_cliente FOREIGN KEY (cliente_id)
        REFERENCES cliente (id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT ck_uc_papel CHECK (papel IN ('RESPONSAVEL', 'ACESSO'))
);

/* =====================================================================
   5. CONTA_CONTABIL — plano de contas individualizado por empresa (RF07)
      Hierárquico (autorrelacionamento conta_pai_id).
   ===================================================================== */
CREATE TABLE conta_contabil (
    id            BIGINT GENERATED ALWAYS AS IDENTITY,
    cliente_id    BIGINT       NOT NULL,
    conta_pai_id  BIGINT,
    codigo        VARCHAR(20)  NOT NULL,
    nome          VARCHAR(120) NOT NULL,
    tipo          VARCHAR(10)  NOT NULL,
    natureza      CHAR(1)      NOT NULL,
    analitica     BOOLEAN      NOT NULL DEFAULT FALSE,
    ativa         BOOLEAN      NOT NULL DEFAULT TRUE,
    CONSTRAINT pk_conta_contabil PRIMARY KEY (id),
    CONSTRAINT fk_conta_cliente FOREIGN KEY (cliente_id)
        REFERENCES cliente (id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_conta_pai FOREIGN KEY (conta_pai_id)
        REFERENCES conta_contabil (id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT uq_conta_cliente_codigo UNIQUE (cliente_id, codigo),
    CONSTRAINT ck_conta_codigo   CHECK (codigo ~ '^[0-9]+(\.[0-9]+)*$'),
    CONSTRAINT ck_conta_tipo     CHECK (tipo IN ('ATIVO', 'PASSIVO', 'PATRIMONIO', 'RECEITA', 'DESPESA')),
    -- D = devedora, C = credora
    CONSTRAINT ck_conta_natureza CHECK (natureza IN ('D', 'C')),
    CONSTRAINT ck_conta_pai      CHECK (conta_pai_id IS NULL OR conta_pai_id <> id)
);

/* =====================================================================
   6. DOCUMENTO — arquivo enviado pelo cliente ou pelo contador
   ===================================================================== */
CREATE TABLE documento (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY,
    cliente_id          BIGINT       NOT NULL,
    enviado_por         BIGINT       NOT NULL,
    nome_arquivo        VARCHAR(255) NOT NULL,
    tipo_documento      VARCHAR(15)  NOT NULL,
    formato             VARCHAR(4)   NOT NULL,
    tamanho_bytes       INTEGER      NOT NULL,
    hash_sha256         CHAR(64)     NOT NULL,
    chave_acesso_nfe    CHAR(44),
    caminho_arquivo     VARCHAR(500) NOT NULL,
    -- RN04: XML e JSON são importados diretamente, sem IA.
    tipo_processamento  VARCHAR(6)   GENERATED ALWAYS AS (
        CASE WHEN formato IN ('XML', 'JSON') THEN 'DIRETO' ELSE 'IA' END) STORED,
    status              VARCHAR(12)  NOT NULL DEFAULT 'PENDENTE',
    motivo_rejeicao     TEXT,
    data_upload         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    atualizado_em       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT pk_documento PRIMARY KEY (id),
    CONSTRAINT fk_documento_cliente FOREIGN KEY (cliente_id)
        REFERENCES cliente (id) ON UPDATE CASCADE ON DELETE RESTRICT,   -- RN02/RN07
    CONSTRAINT fk_documento_usuario FOREIGN KEY (enviado_por)
        REFERENCES usuario (id) ON UPDATE CASCADE ON DELETE RESTRICT,
    -- RF10: o mesmo arquivo não pode ser enviado duas vezes para a mesma empresa.
    CONSTRAINT uq_documento_hash  UNIQUE (cliente_id, hash_sha256),
    -- RF10: a mesma NF-e não pode ser escriturada duas vezes na mesma empresa
    -- (mas pode existir em duas empresas: emitente e destinatário).
    CONSTRAINT uq_documento_chave UNIQUE (cliente_id, chave_acesso_nfe),
    CONSTRAINT ck_documento_tipo  CHECK (tipo_documento IN
        ('NOTA_FISCAL', 'COMPROVANTE', 'EXTRATO', 'XML_NFE', 'JSON_CONTABIL', 'CONTRATO', 'OUTRO')),
    CONSTRAINT ck_documento_formato CHECK (formato IN ('PDF', 'JPG', 'JPEG', 'PNG', 'XML', 'JSON')),
    -- RF09: tamanho máximo de 10 MB.
    CONSTRAINT ck_documento_tamanho CHECK (tamanho_bytes > 0 AND tamanho_bytes <= 10485760),
    CONSTRAINT ck_documento_hash  CHECK (hash_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_documento_chave CHECK (chave_acesso_nfe IS NULL OR chave_acesso_nfe ~ '^[0-9]{44}$'),
    -- Coerência entre tipo e formato.
    CONSTRAINT ck_documento_tipo_formato CHECK (
        (tipo_documento = 'XML_NFE'       AND formato = 'XML')  OR
        (tipo_documento = 'JSON_CONTABIL' AND formato = 'JSON') OR
        (tipo_documento IN ('NOTA_FISCAL', 'COMPROVANTE', 'EXTRATO', 'CONTRATO')
                                          AND formato IN ('PDF', 'JPG', 'JPEG', 'PNG')) OR
        (tipo_documento = 'OUTRO')),
    CONSTRAINT ck_documento_status CHECK (status IN
        ('PENDENTE', 'PROCESSANDO', 'ANALISADO', 'IMPORTADO', 'APROVADO', 'REJEITADO', 'FALHA')),
    -- RF24: rejeição exige justificativa. O "IS NOT NULL" é obrigatório:
    -- length(trim(NULL)) >= 10 dá NULL, e CHECK com resultado NULL é ACEITO.
    CONSTRAINT ck_documento_rejeicao CHECK (status <> 'REJEITADO' OR
        (motivo_rejeicao IS NOT NULL AND length(trim(motivo_rejeicao)) >= 10))
);

/* =====================================================================
   7. ANALISE_DOCUMENTO — resultado do OCR/IA ou do parser XML/JSON (1:1)
   ===================================================================== */
CREATE TABLE analise_documento (
    id               BIGINT GENERATED ALWAYS AS IDENTITY,
    documento_id     BIGINT       NOT NULL,
    motor            VARCHAR(12)  NOT NULL,
    nivel_confianca  NUMERIC(5,2),
    dados_extraidos  JSONB        NOT NULL DEFAULT '{}'::jsonb,
    status           VARCHAR(10)  NOT NULL,
    data_analise     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT pk_analise_documento PRIMARY KEY (id),
    CONSTRAINT uq_analise_documento UNIQUE (documento_id),          -- garante 1:1
    CONSTRAINT fk_analise_documento FOREIGN KEY (documento_id)
        REFERENCES documento (id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT ck_analise_motor  CHECK (motor IN ('OCR_IA', 'XML_PARSER', 'JSON_IMPORT')),
    CONSTRAINT ck_analise_conf   CHECK (nivel_confianca IS NULL OR nivel_confianca BETWEEN 0 AND 100),
    CONSTRAINT ck_analise_status CHECK (status IN ('CONCLUIDA', 'FALHA')),
    -- Leitura por IA sempre informa confiança (RF17); parser determinístico não precisa.
    CONSTRAINT ck_analise_conf_ia CHECK (motor <> 'OCR_IA' OR status = 'FALHA' OR nivel_confianca IS NOT NULL)
);

/* =====================================================================
   8. LANCAMENTO — cabeçalho do lançamento contábil
   ===================================================================== */
CREATE TABLE lancamento (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY,
    cliente_id         BIGINT        NOT NULL,
    documento_id       BIGINT,                         -- NULL = lançamento manual
    criado_por         BIGINT        NOT NULL,
    data_lancamento    DATE          NOT NULL,
    descricao          VARCHAR(255)  NOT NULL,
    -- Desnormalização controlada: soma dos débitos dos itens, mantida por trigger.
    valor_total        NUMERIC(15,2) NOT NULL DEFAULT 0,
    origem             VARCHAR(10)   NOT NULL,
    status             VARCHAR(10)   NOT NULL DEFAULT 'PENDENTE',
    motivo_reprovacao  TEXT,
    aprovado_por       BIGINT,
    aprovado_em        TIMESTAMPTZ,
    criado_em          TIMESTAMPTZ   NOT NULL DEFAULT now(),
    atualizado_em      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT pk_lancamento PRIMARY KEY (id),
    CONSTRAINT fk_lancamento_cliente FOREIGN KEY (cliente_id)
        REFERENCES cliente (id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lancamento_documento FOREIGN KEY (documento_id)
        REFERENCES documento (id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lancamento_criado_por FOREIGN KEY (criado_por)
        REFERENCES usuario (id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lancamento_aprovado_por FOREIGN KEY (aprovado_por)
        REFERENCES usuario (id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT ck_lancamento_origem CHECK (origem IN ('IA', 'MANUAL', 'IMPORTACAO')),
    CONSTRAINT ck_lancamento_status CHECK (status IN ('PENDENTE', 'CORRIGIDO', 'APROVADO', 'REPROVADO')),
    CONSTRAINT ck_lancamento_valor  CHECK (valor_total >= 0),
    -- Lançamento gerado por IA ou importação sempre nasce de um documento.
    CONSTRAINT ck_lancamento_doc    CHECK (origem = 'MANUAL' OR documento_id IS NOT NULL),
    -- RN01: aprovado exige quem aprovou e quando.
    CONSTRAINT ck_lancamento_aprov  CHECK (status <> 'APROVADO' OR (aprovado_por IS NOT NULL AND aprovado_em IS NOT NULL)),
    CONSTRAINT ck_lancamento_reprov CHECK (status <> 'REPROVADO' OR motivo_reprovacao IS NOT NULL)
);

/* =====================================================================
   9. ITEM_LANCAMENTO — partidas (débito/crédito) do lançamento
   ===================================================================== */
CREATE TABLE item_lancamento (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY,
    lancamento_id      BIGINT        NOT NULL,
    conta_contabil_id  BIGINT        NOT NULL,
    tipo_movimento     CHAR(1)       NOT NULL,
    valor              NUMERIC(15,2) NOT NULL,
    historico          VARCHAR(255),
    CONSTRAINT pk_item_lancamento PRIMARY KEY (id),
    CONSTRAINT fk_item_lancamento FOREIGN KEY (lancamento_id)
        REFERENCES lancamento (id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_item_conta FOREIGN KEY (conta_contabil_id)
        REFERENCES conta_contabil (id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT ck_item_tipo  CHECK (tipo_movimento IN ('D', 'C')),
    CONSTRAINT ck_item_valor CHECK (valor > 0)
);

/* =====================================================================
   10. REVISAO_CONTABIL — histórico de aprovações/reprovações/correções
       do contador (RF25, RF30)
   ===================================================================== */
CREATE TABLE revisao_contabil (
    id             BIGINT GENERATED ALWAYS AS IDENTITY,
    lancamento_id  BIGINT      NOT NULL,
    usuario_id     BIGINT      NOT NULL,
    acao           VARCHAR(10) NOT NULL,
    observacao     TEXT,
    data_revisao   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_revisao_contabil PRIMARY KEY (id),
    CONSTRAINT fk_revisao_lancamento FOREIGN KEY (lancamento_id)
        REFERENCES lancamento (id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_revisao_usuario FOREIGN KEY (usuario_id)
        REFERENCES usuario (id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT ck_revisao_acao CHECK (acao IN ('APROVACAO', 'REPROVACAO', 'CORRECAO')),
    CONSTRAINT ck_revisao_obs  CHECK (acao = 'APROVACAO' OR observacao IS NOT NULL)
);

/* =====================================================================
   11. RELATORIO — relatórios gerados e liberados ao cliente
   ===================================================================== */
CREATE TABLE relatorio (
    id               BIGINT GENERATED ALWAYS AS IDENTITY,
    cliente_id       BIGINT      NOT NULL,
    gerado_por       BIGINT      NOT NULL,
    tipo             VARCHAR(10) NOT NULL,
    periodo_inicio   DATE        NOT NULL,
    periodo_fim      DATE        NOT NULL,
    data_geracao     TIMESTAMPTZ NOT NULL DEFAULT now(),
    enviado_cliente  BOOLEAN     NOT NULL DEFAULT FALSE,
    enviado_em       TIMESTAMPTZ,
    CONSTRAINT pk_relatorio PRIMARY KEY (id),
    CONSTRAINT fk_relatorio_cliente FOREIGN KEY (cliente_id)
        REFERENCES cliente (id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_relatorio_usuario FOREIGN KEY (gerado_por)
        REFERENCES usuario (id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT ck_relatorio_tipo    CHECK (tipo IN ('BALANCO', 'BALANCETE', 'DRE', 'RAZAO', 'DIARIO')),
    CONSTRAINT ck_relatorio_periodo CHECK (periodo_fim >= periodo_inicio),
    CONSTRAINT ck_relatorio_envio   CHECK (enviado_cliente = (enviado_em IS NOT NULL))
);

/* =====================================================================
   12. EXPORTACAO — lote de lançamentos exportados em CSV (RF26)
   ===================================================================== */
CREATE TABLE exportacao (
    id              BIGINT GENERATED ALWAYS AS IDENTITY,
    cliente_id      BIGINT       NOT NULL,
    usuario_id      BIGINT       NOT NULL,
    periodo_inicio  DATE         NOT NULL,
    periodo_fim     DATE         NOT NULL,
    nome_arquivo    VARCHAR(255) NOT NULL,
    gerado_em       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT pk_exportacao PRIMARY KEY (id),
    CONSTRAINT fk_exportacao_cliente FOREIGN KEY (cliente_id)
        REFERENCES cliente (id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_exportacao_usuario FOREIGN KEY (usuario_id)
        REFERENCES usuario (id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT ck_exportacao_periodo CHECK (periodo_fim >= periodo_inicio)
);

/* =====================================================================
   13. EXPORTACAO_LANCAMENTO — associativa N:M exportação × lançamento
       UNIQUE(lancamento_id) impede que um lançamento seja exportado duas
       vezes (RF27).
   ===================================================================== */
CREATE TABLE exportacao_lancamento (
    exportacao_id  BIGINT NOT NULL,
    lancamento_id  BIGINT NOT NULL,
    CONSTRAINT pk_exportacao_lancamento PRIMARY KEY (exportacao_id, lancamento_id),
    CONSTRAINT uq_exportacao_lancamento UNIQUE (lancamento_id),
    CONSTRAINT fk_el_exportacao FOREIGN KEY (exportacao_id)
        REFERENCES exportacao (id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_el_lancamento FOREIGN KEY (lancamento_id)
        REFERENCES lancamento (id) ON UPDATE CASCADE ON DELETE RESTRICT
);

/* =====================================================================
   14. LOG_AUDITORIA — trilha de auditoria genérica (RF28, RF29, RNF15)
       Sem FKs de propósito: o log precisa sobreviver à exclusão do registro.
   ===================================================================== */
CREATE TABLE log_auditoria (
    id                BIGINT GENERATED ALWAYS AS IDENTITY,
    tabela            VARCHAR(40)  NOT NULL,
    registro_id       BIGINT       NOT NULL,
    operacao          CHAR(1)      NOT NULL,
    dados_anteriores  JSONB,
    dados_novos       JSONB,
    usuario_app_id    BIGINT,                -- usuário logado na aplicação
    usuario_banco     VARCHAR(63)  NOT NULL DEFAULT current_user,
    ocorrido_em       TIMESTAMPTZ  NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT pk_log_auditoria PRIMARY KEY (id),
    CONSTRAINT ck_log_operacao  CHECK (operacao IN ('I', 'U', 'D')),
    CONSTRAINT ck_log_dados     CHECK (
        (operacao = 'I' AND dados_anteriores IS NULL AND dados_novos IS NOT NULL) OR
        (operacao = 'U' AND dados_anteriores IS NOT NULL AND dados_novos IS NOT NULL) OR
        (operacao = 'D' AND dados_anteriores IS NOT NULL AND dados_novos IS NULL))
);

/* =====================================================================
   ÍNDICES CUSTOMIZADOS (além das PKs/UNIQUEs automáticas)
   Justificativas completas no documento de projeto; prova via EXPLAIN
   no script 04.
   ===================================================================== */

-- IDX1 — Fila de revisão do contador (RF20): filtra por empresa + status
-- e ordena pelos mais recentes. Composto na ordem igualdade → igualdade → ordenação.
CREATE INDEX idx_documento_cliente_status_data
    ON documento (cliente_id, status, data_upload DESC);

-- IDX2 — Relatórios por período (balancete, razão, DRE, exportação CSV):
-- filtro por empresa + intervalo de datas.
CREATE INDEX idx_lancamento_cliente_data
    ON lancamento (cliente_id, data_lancamento);

-- IDX3 — O PostgreSQL NÃO indexa FKs automaticamente. Este índice acelera
-- o JOIN item → conta (razão/saldo por conta) e a verificação do
-- ON DELETE RESTRICT ao excluir uma conta do plano.
CREATE INDEX idx_item_conta
    ON item_lancamento (conta_contabil_id);

-- IDX4 — JOIN lançamento → itens (usado em todas as telas de lançamento,
-- no trigger de partidas dobradas e no ON DELETE CASCADE).
CREATE INDEX idx_item_lancamento
    ON item_lancamento (lancamento_id);

-- IDX5 — Índice PARCIAL: só lançamentos aguardando revisão. A fila de
-- pendências é uma fração pequena da tabela; o índice fica pequeno e quente.
CREATE INDEX idx_lancamento_pendente
    ON lancamento (cliente_id, criado_em)
    WHERE status IN ('PENDENTE', 'CORRIGIDO');

-- IDX6 — Consulta do histórico de auditoria de um registro (RF29).
CREATE INDEX idx_log_auditoria_registro
    ON log_auditoria (tabela, registro_id, ocorrido_em DESC);

/* =====================================================================
   COMENTÁRIOS (aparecem no \d+ e em ferramentas como DBeaver/pgAdmin)
   ===================================================================== */
COMMENT ON TABLE escritorio            IS 'Escritório de contabilidade que usa o sistema (tenant).';
COMMENT ON TABLE usuario               IS 'Usuários do sistema: ADMIN, CONTADOR ou CLIENTE (RF01, RF03).';
COMMENT ON TABLE cliente               IS 'Empresas clientes atendidas pelo escritório (RF04, RF06).';
COMMENT ON TABLE usuario_cliente       IS 'N:M usuário × empresa: carteira do contador e acesso do usuário-cliente (RF05, RF12).';
COMMENT ON TABLE conta_contabil        IS 'Plano de contas hierárquico e individualizado por empresa (RF07).';
COMMENT ON TABLE documento             IS 'Arquivos fiscais enviados para processamento (RF08–RF11, RN02, RN06, RN07).';
COMMENT ON TABLE analise_documento     IS 'Resultado da leitura OCR/IA ou do parser XML/JSON (RF13–RF17).';
COMMENT ON TABLE lancamento            IS 'Cabeçalho do lançamento contábil (RF15, RF22, RF23, RN01).';
COMMENT ON TABLE item_lancamento       IS 'Partidas de débito e crédito de cada lançamento (partidas dobradas).';
COMMENT ON TABLE revisao_contabil      IS 'Aprovações, reprovações e correções feitas pelo contador (RF25, RN03).';
COMMENT ON TABLE relatorio             IS 'Relatórios contábeis gerados e liberados ao cliente.';
COMMENT ON TABLE exportacao            IS 'Lotes de exportação CSV de lançamentos aprovados (RF26).';
COMMENT ON TABLE exportacao_lancamento IS 'N:M exportação × lançamento; impede reexportação (RF27).';
COMMENT ON TABLE log_auditoria         IS 'Trilha de auditoria com valores anteriores e posteriores (RF28, RF29).';

COMMENT ON COLUMN documento.tipo_processamento IS 'Coluna gerada: DIRETO para XML/JSON, IA para os demais (RN04).';
COMMENT ON COLUMN documento.hash_sha256        IS 'Hash do conteúdo do arquivo, usado para barrar duplicatas (RF10).';
COMMENT ON COLUMN lancamento.valor_total       IS 'Soma dos débitos dos itens. Desnormalizada e mantida por trigger.';
COMMENT ON COLUMN log_auditoria.usuario_app_id IS 'Lido de current_setting(''app.usuario_id''), definido pela aplicação a cada transação.';

/* =====================================================================
   DICIONÁRIO DE DADOS NO CATÁLOGO — descrição semântica de cada coluna.
   O dicionário do documento de projeto é gerado a partir daqui.
   ===================================================================== */
-- escritorio
COMMENT ON COLUMN escritorio.id            IS 'Identificador do escritório.';
COMMENT ON COLUMN escritorio.razao_social  IS 'Razão social do escritório de contabilidade.';
COMMENT ON COLUMN escritorio.cnpj          IS 'CNPJ, só dígitos (14). DV validado por fn_validar_cnpj.';
COMMENT ON COLUMN escritorio.email         IS 'E-mail institucional.';
COMMENT ON COLUMN escritorio.telefone      IS 'Telefone de contato.';
COMMENT ON COLUMN escritorio.criado_em     IS 'Data/hora de cadastro.';
-- usuario
COMMENT ON COLUMN usuario.id               IS 'Identificador do usuário.';
COMMENT ON COLUMN usuario.escritorio_id    IS 'Escritório ao qual o usuário pertence.';
COMMENT ON COLUMN usuario.nome             IS 'Nome completo.';
COMMENT ON COLUMN usuario.email            IS 'Login do usuário; único no sistema (RF01).';
COMMENT ON COLUMN usuario.senha_hash       IS 'Hash da senha (bcrypt gerado pela aplicação). Nunca a senha em texto.';
COMMENT ON COLUMN usuario.perfil           IS 'ADMIN, CONTADOR ou CLIENTE (RNF03).';
COMMENT ON COLUMN usuario.crc              IS 'Registro no Conselho Regional de Contabilidade; obrigatório para CONTADOR.';
COMMENT ON COLUMN usuario.ativo            IS 'FALSE desativa o acesso sem apagar o histórico (RF03, RF06).';
COMMENT ON COLUMN usuario.criado_em        IS 'Data/hora de cadastro.';
-- cliente
COMMENT ON COLUMN cliente.id                  IS 'Identificador da empresa cliente.';
COMMENT ON COLUMN cliente.escritorio_id       IS 'Escritório que atende a empresa.';
COMMENT ON COLUMN cliente.razao_social        IS 'Razão social.';
COMMENT ON COLUMN cliente.nome_fantasia       IS 'Nome fantasia.';
COMMENT ON COLUMN cliente.cnpj                IS 'CNPJ, só dígitos (14). Único por escritório; DV validado.';
COMMENT ON COLUMN cliente.inscricao_estadual  IS 'Inscrição estadual (NULL = isento).';
COMMENT ON COLUMN cliente.inscricao_municipal IS 'Inscrição municipal.';
COMMENT ON COLUMN cliente.regime_tributario   IS 'SIMPLES_NACIONAL, LUCRO_PRESUMIDO, LUCRO_REAL ou MEI (RF04).';
COMMENT ON COLUMN cliente.cnae                IS 'CNAE principal, 7 dígitos.';
COMMENT ON COLUMN cliente.email               IS 'E-mail para notificações (RF31).';
COMMENT ON COLUMN cliente.telefone            IS 'Telefone de contato.';
COMMENT ON COLUMN cliente.responsavel         IS 'Pessoa de contato na empresa.';
COMMENT ON COLUMN cliente.logradouro          IS 'Endereço (rua e número).';
COMMENT ON COLUMN cliente.cidade              IS 'Município.';
COMMENT ON COLUMN cliente.uf                  IS 'Sigla da UF.';
COMMENT ON COLUMN cliente.cep                 IS 'CEP, só dígitos (8).';
COMMENT ON COLUMN cliente.status              IS 'ATIVO ou INATIVO (RF06). Inativo não recebe lançamentos.';
COMMENT ON COLUMN cliente.criado_em           IS 'Data/hora de cadastro.';
COMMENT ON COLUMN cliente.atualizado_em       IS 'Última alteração (mantida por trigger).';
-- usuario_cliente
COMMENT ON COLUMN usuario_cliente.usuario_id   IS 'Usuário (contador ou usuário-cliente).';
COMMENT ON COLUMN usuario_cliente.cliente_id   IS 'Empresa à qual o usuário está vinculado.';
COMMENT ON COLUMN usuario_cliente.papel        IS 'RESPONSAVEL (contador da carteira) ou ACESSO (usuário da empresa).';
COMMENT ON COLUMN usuario_cliente.concedido_em IS 'Data/hora em que o vínculo foi criado.';
-- conta_contabil
COMMENT ON COLUMN conta_contabil.id           IS 'Identificador da conta.';
COMMENT ON COLUMN conta_contabil.cliente_id   IS 'Empresa dona deste plano de contas (RF07).';
COMMENT ON COLUMN conta_contabil.conta_pai_id IS 'Conta sintética imediatamente superior (NULL = grupo raiz).';
COMMENT ON COLUMN conta_contabil.codigo       IS 'Código estruturado, ex.: 1.1.01.001. Único por empresa.';
COMMENT ON COLUMN conta_contabil.nome         IS 'Nome da conta.';
COMMENT ON COLUMN conta_contabil.tipo         IS 'ATIVO, PASSIVO, PATRIMONIO, RECEITA ou DESPESA.';
COMMENT ON COLUMN conta_contabil.natureza     IS 'D (devedora) ou C (credora): define o sinal do saldo.';
COMMENT ON COLUMN conta_contabil.analitica    IS 'TRUE = recebe lançamentos; FALSE = conta sintética (agrupadora).';
COMMENT ON COLUMN conta_contabil.ativa        IS 'FALSE impede novos lançamentos na conta.';
-- documento
COMMENT ON COLUMN documento.id               IS 'Identificador do documento.';
COMMENT ON COLUMN documento.cliente_id       IS 'Empresa dona do documento (RN06).';
COMMENT ON COLUMN documento.enviado_por      IS 'Usuário que fez o upload (cliente ou contador — RF12).';
COMMENT ON COLUMN documento.nome_arquivo     IS 'Nome original do arquivo.';
COMMENT ON COLUMN documento.tipo_documento   IS 'NOTA_FISCAL, COMPROVANTE, EXTRATO, XML_NFE, JSON_CONTABIL, CONTRATO ou OUTRO (RF16).';
COMMENT ON COLUMN documento.formato          IS 'Extensão: PDF, JPG, JPEG, PNG, XML ou JSON (RF09, RNF10).';
COMMENT ON COLUMN documento.tamanho_bytes    IS 'Tamanho do arquivo; máximo 10 MB (RF09).';
COMMENT ON COLUMN documento.chave_acesso_nfe IS 'Chave de 44 dígitos da NF-e, quando houver (RF10).';
COMMENT ON COLUMN documento.caminho_arquivo  IS 'Local do arquivo no storage (o binário não fica no banco).';
COMMENT ON COLUMN documento.status           IS 'PENDENTE, PROCESSANDO, ANALISADO, IMPORTADO, APROVADO, REJEITADO ou FALHA (RF11, RF18).';
COMMENT ON COLUMN documento.motivo_rejeicao  IS 'Justificativa obrigatória quando REJEITADO (RF24).';
COMMENT ON COLUMN documento.data_upload      IS 'Data/hora do envio.';
COMMENT ON COLUMN documento.atualizado_em    IS 'Última alteração (mantida por trigger).';
-- analise_documento
COMMENT ON COLUMN analise_documento.id              IS 'Identificador da análise.';
COMMENT ON COLUMN analise_documento.documento_id    IS 'Documento analisado (relação 1:1).';
COMMENT ON COLUMN analise_documento.motor           IS 'OCR_IA, XML_PARSER ou JSON_IMPORT.';
COMMENT ON COLUMN analise_documento.nivel_confianca IS 'Confiança da IA de 0 a 100 (RF17). NULL para parser determinístico.';
COMMENT ON COLUMN analise_documento.dados_extraidos IS 'Campos extraídos (emitente, valor, data...). JSONB porque variam por tipo de documento.';
COMMENT ON COLUMN analise_documento.status          IS 'CONCLUIDA ou FALHA (RF18).';
COMMENT ON COLUMN analise_documento.data_analise    IS 'Data/hora da análise.';
-- lancamento
COMMENT ON COLUMN lancamento.id                IS 'Identificador do lançamento.';
COMMENT ON COLUMN lancamento.cliente_id        IS 'Empresa do lançamento. Precisa coincidir com a do documento (trigger).';
COMMENT ON COLUMN lancamento.documento_id      IS 'Documento de origem; NULL em lançamento manual.';
COMMENT ON COLUMN lancamento.criado_por        IS 'Usuário (ou serviço de IA) que criou o lançamento.';
COMMENT ON COLUMN lancamento.data_lancamento   IS 'Data contábil (competência) do fato.';
COMMENT ON COLUMN lancamento.descricao         IS 'Histórico do lançamento.';
COMMENT ON COLUMN lancamento.origem            IS 'IA, MANUAL ou IMPORTACAO (XML/JSON — RN04).';
COMMENT ON COLUMN lancamento.status            IS 'PENDENTE, CORRIGIDO, APROVADO ou REPROVADO. APROVADO e REPROVADO são finais (RN01).';
COMMENT ON COLUMN lancamento.motivo_reprovacao IS 'Motivo obrigatório quando REPROVADO.';
COMMENT ON COLUMN lancamento.aprovado_por      IS 'Contador que aprovou (RN01).';
COMMENT ON COLUMN lancamento.aprovado_em       IS 'Data/hora da aprovação; base do tempo médio de revisão (RF30).';
COMMENT ON COLUMN lancamento.criado_em         IS 'Data/hora de criação.';
COMMENT ON COLUMN lancamento.atualizado_em     IS 'Última alteração (mantida por trigger).';
-- item_lancamento
COMMENT ON COLUMN item_lancamento.id                IS 'Identificador da partida.';
COMMENT ON COLUMN item_lancamento.lancamento_id     IS 'Lançamento ao qual a partida pertence.';
COMMENT ON COLUMN item_lancamento.conta_contabil_id IS 'Conta analítica, ativa, do plano da mesma empresa (trigger).';
COMMENT ON COLUMN item_lancamento.tipo_movimento    IS 'D (débito) ou C (crédito).';
COMMENT ON COLUMN item_lancamento.valor             IS 'Valor da partida, sempre positivo.';
COMMENT ON COLUMN item_lancamento.historico         IS 'Complemento do histórico desta partida.';
-- revisao_contabil
COMMENT ON COLUMN revisao_contabil.id            IS 'Identificador da revisão.';
COMMENT ON COLUMN revisao_contabil.lancamento_id IS 'Lançamento revisado.';
COMMENT ON COLUMN revisao_contabil.usuario_id    IS 'Contador que revisou.';
COMMENT ON COLUMN revisao_contabil.acao          IS 'APROVACAO, REPROVACAO ou CORRECAO (RF25).';
COMMENT ON COLUMN revisao_contabil.observacao    IS 'Justificativa; obrigatória para REPROVACAO e CORRECAO.';
COMMENT ON COLUMN revisao_contabil.data_revisao  IS 'Data/hora da revisão.';
-- relatorio
COMMENT ON COLUMN relatorio.id              IS 'Identificador do relatório.';
COMMENT ON COLUMN relatorio.cliente_id      IS 'Empresa do relatório.';
COMMENT ON COLUMN relatorio.gerado_por      IS 'Contador que gerou.';
COMMENT ON COLUMN relatorio.tipo            IS 'BALANCO, BALANCETE, DRE, RAZAO ou DIARIO.';
COMMENT ON COLUMN relatorio.periodo_inicio  IS 'Início do período apurado.';
COMMENT ON COLUMN relatorio.periodo_fim     IS 'Fim do período apurado (>= início).';
COMMENT ON COLUMN relatorio.data_geracao    IS 'Data/hora da geração.';
COMMENT ON COLUMN relatorio.enviado_cliente IS 'TRUE = liberado para o cliente ver.';
COMMENT ON COLUMN relatorio.enviado_em      IS 'Data/hora da liberação; preenchida se e somente se enviado_cliente.';
-- exportacao
COMMENT ON COLUMN exportacao.id             IS 'Identificador do lote de exportação.';
COMMENT ON COLUMN exportacao.cliente_id     IS 'Empresa exportada.';
COMMENT ON COLUMN exportacao.usuario_id     IS 'Contador que exportou.';
COMMENT ON COLUMN exportacao.periodo_inicio IS 'Início do período exportado.';
COMMENT ON COLUMN exportacao.periodo_fim    IS 'Fim do período exportado.';
COMMENT ON COLUMN exportacao.nome_arquivo   IS 'Nome do CSV gerado.';
COMMENT ON COLUMN exportacao.gerado_em      IS 'Data/hora da exportação.';
-- exportacao_lancamento
COMMENT ON COLUMN exportacao_lancamento.exportacao_id IS 'Lote de exportação.';
COMMENT ON COLUMN exportacao_lancamento.lancamento_id IS 'Lançamento exportado; UNIQUE impede reexportação (RF27).';
-- log_auditoria
COMMENT ON COLUMN log_auditoria.id               IS 'Identificador do registro de log.';
COMMENT ON COLUMN log_auditoria.tabela           IS 'Tabela alterada.';
COMMENT ON COLUMN log_auditoria.registro_id      IS 'id da linha alterada.';
COMMENT ON COLUMN log_auditoria.operacao         IS 'I (insert), U (update) ou D (delete).';
COMMENT ON COLUMN log_auditoria.dados_anteriores IS 'Linha antes da alteração (JSONB). Credenciais mascaradas.';
COMMENT ON COLUMN log_auditoria.dados_novos      IS 'Linha depois da alteração (JSONB). Credenciais mascaradas.';
COMMENT ON COLUMN log_auditoria.usuario_banco    IS 'Usuário do PostgreSQL que executou o comando.';
COMMENT ON COLUMN log_auditoria.ocorrido_em      IS 'Momento exato (clock_timestamp).';
