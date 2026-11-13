\encoding UTF8
/* =====================================================================
   CONTABILIDADE ÁGIL — 02_dml_carga_inicial.sql
   Massa de dados coerente com o domínio (escritório em Sorocaba/SP,
   competência out–nov/2026).

   - IDs explícitos (OVERRIDING SYSTEM VALUE) para que os testes e a
     apresentação possam citar "lançamento 7", "documento 5" etc.
     Ao final, as sequences são reposicionadas.
   - CNPJs com dígitos verificadores válidos (validados no script 03).
   - Todos os lançamentos respeitam partidas dobradas (conferido no 04).
   ===================================================================== */
\connect contabilidade_agil
SET search_path = contabil, public;

BEGIN;

/* ---------------------------------------------------------------------
   ESCRITORIO (2)
   --------------------------------------------------------------------- */
INSERT INTO escritorio (id, razao_social, cnpj, email, telefone, criado_em) OVERRIDING SYSTEM VALUE VALUES
 (1, 'Ágil Assessoria Contábil Ltda', '11222333000181', 'contato@agilcontabil.com.br', '(15) 3211-4000', '2026-01-10 09:00-03'),
 (2, 'Prisma Contabilidade S/S',      '12121212000106', 'contato@prismacontabil.com.br', '(15) 3302-1100', '2026-03-02 10:00-03');

/* ---------------------------------------------------------------------
   USUARIO (22)
   1 admin | 2 serviço de IA | 3–6 contadores | 7–21 usuários-cliente
   (usuário do cliente k = k + 6) | 22 admin do segundo escritório
   senha_hash: hash bcrypt real da senha de demonstração "senha123"
   (gerado com bcryptjs, custo 10). O serviço de IA (id 2) tem um valor
   que não é hash válido, então ninguém consegue entrar com ele.
   --------------------------------------------------------------------- */
INSERT INTO usuario (id, escritorio_id, nome, email, senha_hash, perfil, crc, ativo, criado_em) OVERRIDING SYSTEM VALUE VALUES
 ( 1, 1, 'Fernanda Rocha',            'fernanda.rocha@agilcontabil.com.br', '$2b$10$0wJG6lBiAkx77fnNZYTko.ILn6UP90D3z.VPCyKBfHtU7CbQPlnsa', 'ADMIN',    NULL,              TRUE,  '2026-01-10 09:05-03'),
 ( 2, 1, 'Serviço de Processamento IA','ia@agilcontabil.com.br',            '!login-desabilitado', 'ADMIN',    NULL,              TRUE,  '2026-01-10 09:06-03'),
 ( 3, 1, 'Carlos Silva',              'carlos.silva@agilcontabil.com.br',   '$2b$10$0wJG6lBiAkx77fnNZYTko.ILn6UP90D3z.VPCyKBfHtU7CbQPlnsa', 'CONTADOR', 'SP-198234/O-5',   TRUE,  '2026-01-12 08:30-03'),
 ( 4, 1, 'Mariana Costa',             'mariana.costa@agilcontabil.com.br',  '$2b$10$0wJG6lBiAkx77fnNZYTko.ILn6UP90D3z.VPCyKBfHtU7CbQPlnsa', 'CONTADOR', 'SP-201876/O-2',   TRUE,  '2026-01-12 08:35-03'),
 ( 5, 1, 'Rafael Oliveira',           'rafael.oliveira@agilcontabil.com.br','$2b$10$0wJG6lBiAkx77fnNZYTko.ILn6UP90D3z.VPCyKBfHtU7CbQPlnsa', 'CONTADOR', 'SP-215440/O-9',   TRUE,  '2026-02-01 08:00-03'),
 ( 6, 1, 'Beatriz Santos',            'beatriz.santos@agilcontabil.com.br', '$2b$10$0wJG6lBiAkx77fnNZYTko.ILn6UP90D3z.VPCyKBfHtU7CbQPlnsa', 'CONTADOR', 'SP-187652/O-1',   TRUE,  '2026-02-15 08:00-03'),
 ( 7, 1, 'João Silva',                'joao@abccomercio.com.br',            '$2b$10$0wJG6lBiAkx77fnNZYTko.ILn6UP90D3z.VPCyKBfHtU7CbQPlnsa', 'CLIENTE',  NULL, TRUE,  '2026-02-20 10:00-03'),
 ( 8, 1, 'Marcos Lima',               'marcos@xyzcomercio.com.br',          '$2b$10$0wJG6lBiAkx77fnNZYTko.ILn6UP90D3z.VPCyKBfHtU7CbQPlnsa', 'CLIENTE',  NULL, TRUE,  '2026-02-20 10:10-03'),
 ( 9, 1, 'Ana Ribeiro',               'ana.ribeiro@techsolutions.com.br',   '$2b$10$0wJG6lBiAkx77fnNZYTko.ILn6UP90D3z.VPCyKBfHtU7CbQPlnsa', 'CLIENTE',  NULL, TRUE,  '2026-02-21 11:00-03'),
 (10, 1, 'Roberto Silva',             'roberto@comerciosilva.com.br',       '$2b$10$0wJG6lBiAkx77fnNZYTko.ILn6UP90D3z.VPCyKBfHtU7CbQPlnsa', 'CLIENTE',  NULL, TRUE,  '2026-02-22 09:00-03'),
 (11, 1, 'Luciana Ferreira',          'luciana@paodourado.com.br',          '$2b$10$0wJG6lBiAkx77fnNZYTko.ILn6UP90D3z.VPCyKBfHtU7CbQPlnsa', 'CLIENTE',  NULL, TRUE,  '2026-03-01 09:00-03'),
 (12, 1, 'Eduardo Martins',           'eduardo@autopecasrodovia.com.br',    '$2b$10$0wJG6lBiAkx77fnNZYTko.ILn6UP90D3z.VPCyKBfHtU7CbQPlnsa', 'CLIENTE',  NULL, TRUE,  '2026-03-03 14:00-03'),
 (13, 1, 'Dra. Camila Duarte',        'camila@clinicasorriso.com.br',       '$2b$10$0wJG6lBiAkx77fnNZYTko.ILn6UP90D3z.VPCyKBfHtU7CbQPlnsa', 'CLIENTE',  NULL, TRUE,  '2026-03-05 15:00-03'),
 (14, 1, 'Gustavo Prado',             'gustavo@construtorahorizonte.com.br','$2b$10$0wJG6lBiAkx77fnNZYTko.ILn6UP90D3z.VPCyKBfHtU7CbQPlnsa', 'CLIENTE',  NULL, TRUE,  '2026-03-10 08:00-03'),
 (15, 1, 'Sérgio Almeida',            'sergio@mercadobompreco.com.br',      '$2b$10$0wJG6lBiAkx77fnNZYTko.ILn6UP90D3z.VPCyKBfHtU7CbQPlnsa', 'CLIENTE',  NULL, TRUE,  '2026-03-12 10:00-03'),
 (16, 1, 'Paula Mendes',              'paula@studiofit.com.br',             '$2b$10$0wJG6lBiAkx77fnNZYTko.ILn6UP90D3z.VPCyKBfHtU7CbQPlnsa', 'CLIENTE',  NULL, TRUE,  '2026-04-01 09:30-03'),
 (17, 1, 'Henrique Castro',           'henrique@viasultransportes.com.br',  '$2b$10$0wJG6lBiAkx77fnNZYTko.ILn6UP90D3z.VPCyKBfHtU7CbQPlnsa', 'CLIENTE',  NULL, TRUE,  '2026-04-03 11:00-03'),
 (18, 1, 'Juliana Barros',            'juliana@farmaciavida.com.br',        '$2b$10$0wJG6lBiAkx77fnNZYTko.ILn6UP90D3z.VPCyKBfHtU7CbQPlnsa', 'CLIENTE',  NULL, TRUE,  '2026-04-10 16:00-03'),
 (19, 1, 'Tiago Nunes',               'tiago@graficaexpress.com.br',        '$2b$10$0wJG6lBiAkx77fnNZYTko.ILn6UP90D3z.VPCyKBfHtU7CbQPlnsa', 'CLIENTE',  NULL, TRUE,  '2026-05-02 09:00-03'),
 (20, 1, 'Cláudia Moraes',            'claudia@saborcaseiro.com.br',        '$2b$10$0wJG6lBiAkx77fnNZYTko.ILn6UP90D3z.VPCyKBfHtU7CbQPlnsa', 'CLIENTE',  NULL, FALSE, '2026-05-15 13:00-03'),
 (21, 1, 'Antônio Vieira',            'antonio@campoverdeagro.com.br',      '$2b$10$0wJG6lBiAkx77fnNZYTko.ILn6UP90D3z.VPCyKBfHtU7CbQPlnsa', 'CLIENTE',  NULL, TRUE,  '2026-06-01 08:00-03'),
 (22, 2, 'Paulo Teixeira',            'paulo@prismacontabil.com.br',        '$2b$10$0wJG6lBiAkx77fnNZYTko.ILn6UP90D3z.VPCyKBfHtU7CbQPlnsa', 'ADMIN',    NULL, TRUE,  '2026-03-02 10:05-03');

/* ---------------------------------------------------------------------
   CLIENTE (15) — empresas atendidas pelo escritório 1
   --------------------------------------------------------------------- */
INSERT INTO cliente (id, escritorio_id, razao_social, nome_fantasia, cnpj, inscricao_estadual, inscricao_municipal,
                     regime_tributario, cnae, email, telefone, responsavel, logradouro, cidade, uf, cep, status, criado_em)
OVERRIDING SYSTEM VALUE VALUES
 ( 1, 1, 'Empresa ABC Ltda',                  'ABC Comércio',      '12345678000195', '110042490114', '34567890',  'SIMPLES_NACIONAL', '4711302', 'financeiro@abccomercio.com.br',   '(15) 3333-1000', 'Helena Souza',    'Rua das Flores, 120',          'Sorocaba',     'SP', '18035000', 'ATIVO',   '2026-02-20 09:50-03'),
 ( 2, 1, 'XYZ Comércio e Serviços Ltda',      'XYZ Comércio',      '98765432000198', '120003498118', '23451114',  'LUCRO_PRESUMIDO',  '4649499', 'contato@xyzcomercio.com.br',      '(15) 3222-4567', 'Marcos Lima',     'Av. Central, 450',             'Sorocaba',     'SP', '18046000', 'ATIVO',   '2026-02-20 10:05-03'),
 ( 3, 1, 'Tech Solutions Informática S.A.',   'Tech Solutions',    '45678901000175', NULL,           '99001201',  'LUCRO_REAL',       '6204000', 'fiscal@techsolutions.com.br',     '(11) 4002-8922', 'Ana Ribeiro',     'Alameda Tecnologia, 88',       'São Paulo',    'SP', '04567000', 'ATIVO',   '2026-02-21 10:30-03'),
 ( 4, 1, 'Comércio Silva Ltda',               'Comércio Silva',    '23456789000195', '669123456110', '11223344',  'SIMPLES_NACIONAL', '4789099', 'roberto@comerciosilva.com.br',    '(15) 3231-7788', 'Roberto Silva',   'Rua XV de Novembro, 300',      'Sorocaba',     'SP', '18010000', 'ATIVO',   '2026-02-22 08:40-03'),
 ( 5, 1, 'Padaria Pão Dourado Ltda',          'Pão Dourado',       '34567812000135', '669887766115', '22334455',  'SIMPLES_NACIONAL', '1091102', 'contato@paodourado.com.br',       '(15) 3224-1010', 'Luciana Ferreira','Av. General Osório, 1500',     'Sorocaba',     'SP', '18060000', 'ATIVO',   '2026-03-01 08:30-03'),
 ( 6, 1, 'Auto Peças Rodovia Ltda',           'Rodovia Auto Peças','56789023000181', '669554433116', '33445566',  'LUCRO_PRESUMIDO',  '4530703', 'fiscal@autopecasrodovia.com.br',  '(15) 3325-9090', 'Eduardo Martins', 'Rod. Raposo Tavares, km 101',  'Sorocaba',     'SP', '18052000', 'ATIVO',   '2026-03-03 13:30-03'),
 ( 7, 1, 'Clínica Odontológica Sorriso Ltda', 'Clínica Sorriso',   '67890134000104', NULL,           '44556677',  'LUCRO_PRESUMIDO',  '8630504', 'adm@clinicasorriso.com.br',       '(15) 3217-6060', 'Camila Duarte',   'Rua Barão de Tatuí, 410',      'Sorocaba',     'SP', '18030000', 'ATIVO',   '2026-03-05 14:30-03'),
 ( 8, 1, 'Construtora Horizonte Ltda',        'Horizonte',         '78901245000187', '669112233117', '55667788',  'LUCRO_REAL',       '4120400', 'financeiro@construtorahorizonte.com.br','(15) 3019-3030','Gustavo Prado', 'Av. Itavuvu, 2200',            'Sorocaba',     'SP', '18078000', 'ATIVO',   '2026-03-10 07:45-03'),
 ( 9, 1, 'Mercado Bom Preço Ltda',            'Bom Preço',         '89012356000159', '669445566118', '66778899',  'SIMPLES_NACIONAL', '4711302', 'compras@mercadobompreco.com.br',  '(15) 3236-2020', 'Sérgio Almeida',  'Av. Ipanema, 3100',            'Sorocaba',     'SP', '18071000', 'ATIVO',   '2026-03-12 09:30-03'),
 (10, 1, 'Studio Fit Academia Ltda',          'Studio Fit',        '90123467000111', NULL,           '77889900',  'SIMPLES_NACIONAL', '9313100', 'paula@studiofit.com.br',          '(15) 99812-4455','Paula Mendes',    'Rua Padre Luiz, 75',           'Votorantim',   'SP', '18110000', 'ATIVO',   '2026-04-01 09:00-03'),
 (11, 1, 'Transportadora Via Sul Ltda',       'Via Sul',           '13579246000101', '669778899119', '88990011',  'LUCRO_REAL',       '4930202', 'fiscal@viasultransportes.com.br', '(15) 3388-5000', 'Henrique Castro', 'Rod. Castello Branco, km 89',  'Sorocaba',     'SP', '18087000', 'ATIVO',   '2026-04-03 10:30-03'),
 (12, 1, 'Farmácia Vida Ltda',                'Farmácia Vida',     '24681357000140', '669001122110', '99001122',  'SIMPLES_NACIONAL', '4771701', 'juliana@farmaciavida.com.br',     '(15) 3229-8800', 'Juliana Barros',  'Rua Sete de Setembro, 222',    'Sorocaba',     'SP', '18035500', 'ATIVO',   '2026-04-10 15:30-03'),
 (13, 1, 'Gráfica Express Ltda',              'Gráfica Express',   '35792468000140', '669334455111', '10112233',  'SIMPLES_NACIONAL', '1813001', 'tiago@graficaexpress.com.br',     '(15) 3011-7070', 'Tiago Nunes',     'Rua Aparecida, 95',            'Sorocaba',     'SP', '18095000', 'ATIVO',   '2026-05-02 08:30-03'),
 (14, 1, 'Restaurante Sabor Caseiro Ltda',    'Sabor Caseiro',     '46803579000121', '669667788112', '12123434',  'SIMPLES_NACIONAL', '5611201', 'claudia@saborcaseiro.com.br',     '(15) 3233-4141', 'Cláudia Moraes',  'Rua da Penha, 640',            'Sorocaba',     'SP', '18010500', 'INATIVO', '2026-05-15 12:30-03'),
 (15, 1, 'Agro Campo Verde Ltda',             'Campo Verde',       '57914680000176', '416223344113', '13134545',  'LUCRO_PRESUMIDO',  '0115600', 'antonio@campoverdeagro.com.br',   '(15) 3271-9900', 'Antônio Vieira',  'Estrada Municipal, s/n',       'Itapetininga', 'SP', '18200000', 'ATIVO',   '2026-06-01 07:30-03');

/* ---------------------------------------------------------------------
   USUARIO_CLIENTE (N:M) — carteiras dos contadores e acessos dos clientes
   Carlos → 1–5 | Mariana → 6–10 | Rafael → 11–15 | Beatriz → 1–3 (apoio)
   João Silva (ABC) também é sócio e tem acesso ao Comércio Silva.
   --------------------------------------------------------------------- */
INSERT INTO usuario_cliente (usuario_id, cliente_id, papel, concedido_em)
SELECT 3, c, 'RESPONSAVEL', '2026-02-22 12:00-03'::timestamptz FROM generate_series(1, 5) c
UNION ALL SELECT 4, c, 'RESPONSAVEL', '2026-03-12 12:00-03' FROM generate_series(6, 10) c
UNION ALL SELECT 5, c, 'RESPONSAVEL', '2026-04-10 12:00-03' FROM generate_series(11, 15) c
UNION ALL SELECT 6, c, 'RESPONSAVEL', '2026-02-25 12:00-03' FROM generate_series(1, 3) c
UNION ALL SELECT c + 6, c, 'ACESSO', '2026-06-01 12:00-03' FROM generate_series(1, 15) c
UNION ALL SELECT 7, 4, 'ACESSO', '2026-06-01 12:00-03';

/* ---------------------------------------------------------------------
   CONTA_CONTABIL — plano referencial copiado para cada empresa (RF07)
   51 contas × 15 empresas = 765 contas. Depois o contador pode
   personalizar o plano de cada empresa.
   --------------------------------------------------------------------- */
WITH plano_modelo (codigo, nome, tipo, natureza, analitica) AS (VALUES
 ('1',          'ATIVO',                          'ATIVO',      'D', FALSE),
 ('1.1',        'Ativo Circulante',               'ATIVO',      'D', FALSE),
 ('1.1.01',     'Disponibilidades',               'ATIVO',      'D', FALSE),
 ('1.1.01.001', 'Caixa',                          'ATIVO',      'D', TRUE),
 ('1.1.01.002', 'Bancos Conta Movimento',         'ATIVO',      'D', TRUE),
 ('1.1.01.003', 'Aplicações Financeiras',         'ATIVO',      'D', TRUE),
 ('1.1.02',     'Créditos',                       'ATIVO',      'D', FALSE),
 ('1.1.02.001', 'Clientes',                       'ATIVO',      'D', TRUE),
 ('1.1.02.002', 'Duplicatas a Receber',           'ATIVO',      'D', TRUE),
 ('1.1.03',     'Estoques',                       'ATIVO',      'D', FALSE),
 ('1.1.03.001', 'Estoque de Mercadorias',         'ATIVO',      'D', TRUE),
 ('1.2',        'Ativo Não Circulante',           'ATIVO',      'D', FALSE),
 ('1.2.03',     'Imobilizado',                    'ATIVO',      'D', FALSE),
 ('1.2.03.001', 'Móveis e Utensílios',            'ATIVO',      'D', TRUE),
 ('1.2.03.002', 'Veículos',                       'ATIVO',      'D', TRUE),
 ('1.2.03.003', 'Computadores e Periféricos',     'ATIVO',      'D', TRUE),
 ('2',          'PASSIVO',                        'PASSIVO',    'C', FALSE),
 ('2.1',        'Passivo Circulante',             'PASSIVO',    'C', FALSE),
 ('2.1.01',     'Obrigações Trabalhistas',        'PASSIVO',    'C', FALSE),
 ('2.1.01.001', 'Salários a Pagar',               'PASSIVO',    'C', TRUE),
 ('2.1.01.002', 'INSS a Recolher',                'PASSIVO',    'C', TRUE),
 ('2.1.01.003', 'FGTS a Recolher',                'PASSIVO',    'C', TRUE),
 ('2.1.02',     'Fornecedores',                   'PASSIVO',    'C', FALSE),
 ('2.1.02.001', 'Fornecedores Nacionais',         'PASSIVO',    'C', TRUE),
 ('2.1.03',     'Obrigações Tributárias',         'PASSIVO',    'C', FALSE),
 ('2.1.03.001', 'Impostos a Recolher',            'PASSIVO',    'C', TRUE),
 ('2.1.03.002', 'Simples Nacional a Recolher',    'PASSIVO',    'C', TRUE),
 ('2.3',        'Patrimônio Líquido',             'PATRIMONIO', 'C', FALSE),
 ('2.3.01',     'Capital Social',                 'PATRIMONIO', 'C', FALSE),
 ('2.3.01.001', 'Capital Subscrito',              'PATRIMONIO', 'C', TRUE),
 ('3',          'DESPESAS',                       'DESPESA',    'D', FALSE),
 ('3.1',        'Despesas Operacionais',          'DESPESA',    'D', FALSE),
 ('3.1.01',     'Despesas Administrativas',       'DESPESA',    'D', FALSE),
 ('3.1.01.001', 'Água e Esgoto',                  'DESPESA',    'D', TRUE),
 ('3.1.01.002', 'Energia Elétrica',               'DESPESA',    'D', TRUE),
 ('3.1.01.003', 'Material de Escritório',         'DESPESA',    'D', TRUE),
 ('3.1.01.004', 'Aluguéis',                       'DESPESA',    'D', TRUE),
 ('3.1.01.005', 'Telefone e Internet',            'DESPESA',    'D', TRUE),
 ('3.1.01.006', 'Serviços de Terceiros',          'DESPESA',    'D', TRUE),
 ('3.1.02',     'Despesas Financeiras',           'DESPESA',    'D', FALSE),
 ('3.1.02.001', 'Despesa com Juros',              'DESPESA',    'D', TRUE),
 ('3.1.02.002', 'Tarifas Bancárias',              'DESPESA',    'D', TRUE),
 ('3.1.03',     'Despesas com Pessoal',           'DESPESA',    'D', FALSE),
 ('3.1.03.001', 'Salários e Ordenados',           'DESPESA',    'D', TRUE),
 ('4',          'RECEITAS',                       'RECEITA',    'C', FALSE),
 ('4.1',        'Receitas Operacionais',          'RECEITA',    'C', FALSE),
 ('4.1.01',     'Receita de Vendas',              'RECEITA',    'C', FALSE),
 ('4.1.01.001', 'Venda de Produtos',              'RECEITA',    'C', TRUE),
 ('4.1.01.002', 'Venda de Serviços',              'RECEITA',    'C', TRUE),
 ('4.1.02',     'Receitas Financeiras',           'RECEITA',    'C', FALSE),
 ('4.1.02.001', 'Rendimentos de Aplicações',      'RECEITA',    'C', TRUE)
)
INSERT INTO conta_contabil (cliente_id, codigo, nome, tipo, natureza, analitica)
SELECT c.id, p.codigo, p.nome, p.tipo, p.natureza, p.analitica
FROM cliente c
CROSS JOIN plano_modelo p
ORDER BY c.id, p.codigo;

-- Liga cada conta à sua conta-pai (código sem o último segmento).
UPDATE conta_contabil filha
SET    conta_pai_id = pai.id
FROM   conta_contabil pai
WHERE  pai.cliente_id = filha.cliente_id
AND    pai.codigo = regexp_replace(filha.codigo, '\.[0-9]+$', '')
AND    filha.codigo LIKE '%.%';

-- Personalização: o Studio Fit (10) não trabalha com estoque e inativou a conta.
UPDATE conta_contabil SET ativa = FALSE WHERE cliente_id = 10 AND codigo = '1.1.03.001';

/* ---------------------------------------------------------------------
   DOCUMENTO (22)
   hash_sha256 calculado a partir de um conteúdo fictício único.
   Docs 17 e 19 são a MESMA NF-e (venda XYZ → compra Bom Preço): a chave
   se repete em empresas diferentes, o que o UNIQUE(cliente_id, chave) permite.
   --------------------------------------------------------------------- */
INSERT INTO documento (id, cliente_id, enviado_por, nome_arquivo, tipo_documento, formato, tamanho_bytes,
                       hash_sha256, chave_acesso_nfe, caminho_arquivo, status, motivo_rejeicao, data_upload, atualizado_em)
OVERRIDING SYSTEM VALUE
SELECT d.id, d.cliente_id, d.enviado_por, d.nome_arquivo, d.tipo_documento, d.formato, d.tamanho_bytes,
       encode(sha256(convert_to(d.nome_arquivo || '#' || d.id, 'UTF8')), 'hex'),
       d.chave, 'storage/clientes/' || d.cliente_id || '/' || to_char(d.data_upload, 'YYYY/MM') || '/' || d.nome_arquivo,
       d.status, d.motivo, d.data_upload, d.data_upload + interval '20 minutes'
FROM (VALUES
 ( 1,  1,  7, 'nfe_000145_fornecedor_delta.pdf', 'NOTA_FISCAL',   'PDF',  412330, NULL::char(44), 'ANALISADO',  NULL::text, '2026-11-10 14:30-03'::timestamptz),
 ( 2,  2,  8, 'comprovante_venda_0511.pdf',      'COMPROVANTE',   'PDF',  188412, NULL, 'APROVADO',   NULL, '2026-11-05 10:15-03'),
 ( 3,  3,  9, 'nfe_2201_servicos_software.xml',  'XML_NFE',       'XML',   14820, '35261045678901000175550010000022011123456781', 'APROVADO', NULL, '2026-10-28 09:00-03'),
 ( 4,  1,  7, 'comprovante_bancario_001.pdf',    'COMPROVANTE',   'PDF',  230118, NULL, 'PENDENTE',   NULL, '2026-11-11 16:45-03'),
 ( 5,  4, 10, 'nf_45678.pdf',                    'NOTA_FISCAL',   'PDF',  998120, NULL, 'REJEITADO',
       'Documento ilegível na área do valor total; reenviar digitalização em melhor resolução.', '2026-11-03 11:20-03'),
 ( 6,  5, 11, 'nfe_8812_farinha_trigo.xml',      'XML_NFE',       'XML',   16204, '35261134567812000135550010000088121876543219', 'IMPORTADO', NULL, '2026-11-09 08:10-03'),
 ( 7,  6, 12, 'nf_3310_pecas.pdf',               'NOTA_FISCAL',   'PDF',  520771, NULL, 'ANALISADO',  NULL, '2026-11-08 09:40-03'),
 ( 8,  7, 13, 'extrato_banco_out2026.pdf',       'EXTRATO',       'PDF',  301655, NULL, 'APROVADO',   NULL, '2026-11-02 17:05-03'),
 ( 9,  8,  4, 'nf_55120_cimento.pdf',            'NOTA_FISCAL',   'PDF',  610342, NULL, 'APROVADO',   NULL, '2026-10-20 15:30-03'),
 (10,  9, 15, 'recibo_aluguel_out2026.jpg',      'COMPROVANTE',   'JPG', 1830222, NULL, 'APROVADO',   NULL, '2026-10-31 18:00-03'),
 (11, 10, 16, 'conta_energia_out2026.pdf',       'COMPROVANTE',   'PDF',  145903, NULL, 'ANALISADO',  NULL, '2026-11-10 07:55-03'),
 (12, 11, 17, 'nfe_4410_frete.xml',              'XML_NFE',       'XML',   15377, '35261113579246000101550010000044101234987652', 'IMPORTADO', NULL, '2026-11-11 13:20-03'),
 (13, 12, 18, 'vendas_outubro_2026.json',        'JSON_CONTABIL', 'JSON',  48211, NULL, 'APROVADO',   NULL, '2026-11-01 09:00-03'),
 (14, 13, 19, 'foto_nota_papel.jpg',             'NOTA_FISCAL',   'JPG', 2741008, NULL, 'FALHA',      NULL, '2026-11-07 19:45-03'),
 (15, 15, 21, 'contrato_arrendamento_2026.pdf',  'CONTRATO',      'PDF', 3104550, NULL, 'ANALISADO',  NULL, '2026-10-15 10:00-03'),
 (16,  1,  3, 'extrato_aplicacao_out2026.pdf',   'EXTRATO',       'PDF',  210004, NULL, 'APROVADO',   NULL, '2026-11-04 08:20-03'),
 (17,  2,  8, 'nfe_7781_venda_bom_preco.xml',    'XML_NFE',       'XML',   17012, '35261098765432000198550010000077811555444336', 'APROVADO', NULL, '2026-10-25 11:00-03'),
 (18,  3,  9, 'nota_servico_cloud.pdf',          'NOTA_FISCAL',   'PDF',  177650, NULL, 'PROCESSANDO', NULL, '2026-11-12 08:05-03'),
 (19,  9, 15, 'nfe_7781_compra_xyz.xml',         'XML_NFE',       'XML',   17012, '35261098765432000198550010000077811555444336', 'APROVADO', NULL, '2026-10-26 08:30-03'),
 (20,  6, 12, 'boleto_aluguel_nov2026.png',      'COMPROVANTE',   'PNG',  884120, NULL, 'ANALISADO',  NULL, '2026-11-11 10:10-03'),
 (21,  1,  7, 'nf_980_servico_limpeza.pdf',      'NOTA_FISCAL',   'PDF',  256300, NULL, 'ANALISADO',  NULL, '2026-11-12 07:40-03'),
 (22,  4, 10, 'nf_45678_reenvio.pdf',            'NOTA_FISCAL',   'PDF',  701455, NULL, 'ANALISADO',  NULL, '2026-11-06 09:15-03')
) AS d (id, cliente_id, enviado_por, nome_arquivo, tipo_documento, formato, tamanho_bytes, chave, status, motivo, data_upload);

/* ---------------------------------------------------------------------
   ANALISE_DOCUMENTO (20) — documentos 4 e 18 ainda não foram analisados
   --------------------------------------------------------------------- */
INSERT INTO analise_documento (id, documento_id, motor, nivel_confianca, dados_extraidos, status, data_analise) OVERRIDING SYSTEM VALUE VALUES
 ( 1,  1, 'OCR_IA',      91.40, '{"emitente":"Fornecedor Delta Ltda","cnpj_emitente":"33444555000172","numero":"145","valor_total":1850.00,"data_emissao":"2026-11-09"}', 'CONCLUIDA', '2026-11-10 14:33-03'),
 ( 2,  2, 'OCR_IA',      96.80, '{"tipo":"recibo","valor":3500.00,"forma_pagamento":"dinheiro","data":"2026-11-05"}',                                                 'CONCLUIDA', '2026-11-05 10:17-03'),
 ( 3,  3, 'XML_PARSER',  NULL,  '{"nNF":"2201","vNF":12800.00,"natOp":"Prestação de serviços","dest":"Cliente Final"}',                                             'CONCLUIDA', '2026-10-28 09:00-03'),
 ( 4,  5, 'OCR_IA',      41.50, '{"emitente":"Papelaria Central","numero":"45678","valor_total":null,"observacao":"campo valor ilegível"}',                          'CONCLUIDA', '2026-11-03 11:24-03'),
 ( 5,  6, 'XML_PARSER',  NULL,  '{"nNF":"8812","vNF":4320.00,"emit":"Moinho Paulista Ltda"}',                                                                       'CONCLUIDA', '2026-11-09 08:10-03'),
 ( 6,  7, 'OCR_IA',      78.20, '{"emitente":"Distribuidora Peças Brasil","numero":"3310","valor_total":7650.00}',                                                  'CONCLUIDA', '2026-11-08 09:44-03'),
 ( 7,  8, 'OCR_IA',      93.10, '{"banco":"341","periodo":"10/2026","tarifas":89.90}',                                                                              'CONCLUIDA', '2026-11-02 17:09-03'),
 ( 8,  9, 'OCR_IA',      84.00, '{"emitente":"Cimentos do Vale S.A.","numero":"55120","valor_total":18400.00}',                                                     'CONCLUIDA', '2026-10-20 15:35-03'),
 ( 9, 10, 'OCR_IA',      88.70, '{"tipo":"recibo de aluguel","competencia":"10/2026","valor":6500.00}',                                                             'CONCLUIDA', '2026-10-31 18:04-03'),
 (10, 11, 'OCR_IA',      97.30, '{"concessionaria":"CPFL","competencia":"10/2026","valor":1287.45}',                                                                'CONCLUIDA', '2026-11-10 07:58-03'),
 (11, 12, 'XML_PARSER',  NULL,  '{"nNF":"4410","vNF":9300.00,"natOp":"Prestação de serviço de transporte"}',                                                        'CONCLUIDA', '2026-11-11 13:20-03'),
 (12, 13, 'JSON_IMPORT', NULL,  '{"registros":2,"competencia":"10/2026","total":23680.50}',                                                                         'CONCLUIDA', '2026-11-01 09:00-03'),
 (13, 14, 'OCR_IA',      NULL,  '{"erro":"imagem desfocada; nenhum campo reconhecido"}',                                                                            'FALHA',     '2026-11-07 19:49-03'),
 (14, 15, 'OCR_IA',      90.00, '{"tipo":"contrato","partes":["Agro Campo Verde","Fazenda Santa Rita"],"vigencia":"2026-2028"}',                                   'CONCLUIDA', '2026-10-15 10:06-03'),
 (15, 16, 'OCR_IA',      95.60, '{"tipo":"rendimento aplicação","competencia":"10/2026","valor":312.18}',                                                           'CONCLUIDA', '2026-11-04 08:22-03'),
 (16, 17, 'XML_PARSER',  NULL,  '{"nNF":"7781","vNF":5640.00,"dest_cnpj":"89012356000159"}',                                                                       'CONCLUIDA', '2026-10-25 11:00-03'),
 (17, 19, 'XML_PARSER',  NULL,  '{"nNF":"7781","vNF":5640.00,"emit_cnpj":"98765432000198"}',                                                                       'CONCLUIDA', '2026-10-26 08:30-03'),
 (18, 20, 'OCR_IA',      62.00, '{"tipo":"boleto","beneficiario":"Imobiliária Central","valor":3200.00,"vencimento":"2026-11-15"}',                                 'CONCLUIDA', '2026-11-11 10:14-03'),
 (19, 21, 'OCR_IA',      88.30, '{"emitente":"Limpa Bem Serviços","numero":"980","valor_total":1450.00}',                                                           'CONCLUIDA', '2026-11-12 07:43-03'),
 (20, 22, 'OCR_IA',      95.10, '{"emitente":"Papelaria Central","numero":"45678","valor_total":980.00}',                                                           'CONCLUIDA', '2026-11-06 09:18-03');

/* ---------------------------------------------------------------------
   LANCAMENTO (22)
   criado_por = 2 (serviço de IA) para origem IA/IMPORTACAO; contador para MANUAL.
   valor_total é preenchido após os itens (abaixo).
   --------------------------------------------------------------------- */
INSERT INTO lancamento (id, cliente_id, documento_id, criado_por, data_lancamento, descricao, origem, status,
                        motivo_reprovacao, aprovado_por, aprovado_em, criado_em, atualizado_em)
OVERRIDING SYSTEM VALUE VALUES
 ( 1,  1,    1, 2, '2026-11-09', 'Compra de mercadorias com frete - NF 145 Fornecedor Delta', 'IA',         'PENDENTE',  NULL, NULL, NULL, '2026-11-10 14:34-03', '2026-11-10 14:34-03'),
 ( 2,  2,    2, 2, '2026-11-05', 'Venda de produtos à vista',                                  'IA',         'APROVADO',  NULL, 3, '2026-11-05 15:00-03', '2026-11-05 10:18-03', '2026-11-05 15:00-03'),
 ( 3,  1, NULL, 3, '2026-11-04', 'Pagamento de fornecedor com juros',                          'MANUAL',     'APROVADO',  NULL, 3, '2026-11-04 16:45-03', '2026-11-04 16:45-03', '2026-11-04 16:45-03'),
 ( 4,  3,    3, 2, '2026-10-27', 'Venda de serviços de software - NF-e 2201',                  'IMPORTACAO', 'APROVADO',  NULL, 6, '2026-10-28 14:00-03', '2026-10-28 09:01-03', '2026-10-28 14:00-03'),
 ( 5,  4,    5, 2, '2026-11-02', 'Compra de material de escritório - NF 45678',                'IA',         'REPROVADO', 'Valor total ilegível no documento; confiança da leitura abaixo do aceitável.', NULL, NULL, '2026-11-03 11:25-03', '2026-11-03 16:00-03'),
 ( 6,  5,    6, 2, '2026-11-08', 'Compra de farinha de trigo - NF-e 8812',                     'IMPORTACAO', 'PENDENTE',  NULL, NULL, NULL, '2026-11-09 08:11-03', '2026-11-09 08:11-03'),
 ( 7,  6,    7, 2, '2026-11-07', 'Compra de peças para revenda - NF 3310',                     'IA',         'CORRIGIDO', NULL, NULL, NULL, '2026-11-08 09:45-03', '2026-11-08 11:30-03'),
 ( 8,  7,    8, 2, '2026-10-31', 'Tarifas bancárias outubro/2026',                             'IA',         'APROVADO',  NULL, 4, '2026-11-03 09:10-03', '2026-11-02 17:10-03', '2026-11-03 09:10-03'),
 ( 9,  8,    9, 2, '2026-10-19', 'Compra de cimento para estoque de obra - NF 55120',          'IA',         'APROVADO',  NULL, 4, '2026-10-21 10:00-03', '2026-10-20 15:36-03', '2026-10-21 10:00-03'),
 (10,  9,   10, 2, '2026-10-31', 'Aluguel do galpão outubro/2026',                             'IA',         'APROVADO',  NULL, 4, '2026-11-01 09:30-03', '2026-10-31 18:05-03', '2026-11-01 09:30-03'),
 (11, 10,   11, 2, '2026-10-30', 'Conta de energia elétrica outubro/2026',                     'IA',         'PENDENTE',  NULL, NULL, NULL, '2026-11-10 07:59-03', '2026-11-10 07:59-03'),
 (12, 11,   12, 2, '2026-11-10', 'Prestação de serviço de frete - NF-e 4410',                  'IMPORTACAO', 'PENDENTE',  NULL, NULL, NULL, '2026-11-11 13:21-03', '2026-11-11 13:21-03'),
 (13, 12,   13, 2, '2026-10-31', 'Vendas de outubro/2026 - importação JSON',                   'IMPORTACAO', 'APROVADO',  NULL, 5, '2026-11-01 11:00-03', '2026-11-01 09:01-03', '2026-11-01 11:00-03'),
 (14,  1,   16, 2, '2026-10-31', 'Rendimento de aplicação financeira outubro/2026',            'IA',         'APROVADO',  NULL, 3, '2026-11-04 10:00-03', '2026-11-04 08:23-03', '2026-11-04 10:00-03'),
 (15,  2,   17, 2, '2026-10-24', 'Venda de mercadorias a prazo - NF-e 7781 (Mercado Bom Preço)','IMPORTACAO','APROVADO',  NULL, 3, '2026-10-25 15:00-03', '2026-10-25 11:01-03', '2026-10-25 15:00-03'),
 (16,  9,   19, 2, '2026-10-24', 'Compra de mercadorias - NF-e 7781 (XYZ Comércio)',          'IMPORTACAO', 'APROVADO',  NULL, 4, '2026-10-26 14:00-03', '2026-10-26 08:31-03', '2026-10-26 14:00-03'),
 (17,  6,   20, 2, '2026-11-11', 'Aluguel da loja novembro/2026',                              'IA',         'PENDENTE',  NULL, NULL, NULL, '2026-11-11 10:15-03', '2026-11-11 10:15-03'),
 (18,  1,   21, 2, '2026-11-11', 'Serviço de limpeza - NF 980',                                'IA',         'PENDENTE',  NULL, NULL, NULL, '2026-11-12 07:44-03', '2026-11-12 07:44-03'),
 (19,  4,   22, 2, '2026-11-02', 'Compra de material de escritório - NF 45678 (reenvio)',      'IA',         'PENDENTE',  NULL, NULL, NULL, '2026-11-06 09:19-03', '2026-11-06 09:19-03'),
 (20,  1, NULL, 3, '2026-10-01', 'Integralização de capital social',                           'MANUAL',     'APROVADO',  NULL, 3, '2026-10-01 10:00-03', '2026-10-01 10:00-03', '2026-10-01 10:00-03'),
 (21,  3, NULL, 6, '2026-10-31', 'Folha de pagamento outubro/2026',                            'MANUAL',     'APROVADO',  NULL, 6, '2026-11-03 17:00-03', '2026-11-03 17:00-03', '2026-11-03 17:00-03'),
 (22,  8, NULL, 4, '2026-10-31', 'Folha de pagamento outubro/2026',                            'MANUAL',     'APROVADO',  NULL, 4, '2026-11-03 17:30-03', '2026-11-03 17:30-03', '2026-11-03 17:30-03');

/* ---------------------------------------------------------------------
   ITEM_LANCAMENTO (49) — a conta é resolvida pelo código no plano da
   própria empresa do lançamento.
   --------------------------------------------------------------------- */
INSERT INTO item_lancamento (lancamento_id, conta_contabil_id, tipo_movimento, valor, historico)
SELECT i.lancamento_id, cc.id, i.tipo, i.valor, i.historico
FROM (VALUES
 ( 1, '1.1.03.001', 'D',  1500.00, 'Mercadorias NF 145'),
 ( 1, '3.1.01.003', 'D',   350.00, 'Material de escritório NF 145'),
 ( 1, '2.1.02.001', 'C',  1850.00, 'Fornecedor Delta Ltda'),
 ( 2, '1.1.01.001', 'D',  3500.00, 'Recebimento à vista'),
 ( 2, '4.1.01.001', 'C',  3500.00, 'Venda de produtos'),
 ( 3, '2.1.02.001', 'D',  2100.00, 'Baixa de fornecedor'),
 ( 3, '3.1.02.001', 'D',    20.00, 'Juros por atraso'),
 ( 3, '1.1.01.002', 'C',  2120.00, 'Pagamento via banco'),
 ( 4, '1.1.02.001', 'D', 12800.00, 'NF-e 2201'),
 ( 4, '4.1.01.002', 'C', 12800.00, 'Serviços de software'),
 ( 5, '3.1.01.003', 'D',   980.00, 'Material de escritório'),
 ( 5, '1.1.01.001', 'C',   980.00, 'Pagamento em caixa'),
 ( 6, '1.1.03.001', 'D',  4320.00, 'Farinha de trigo NF-e 8812'),
 ( 6, '2.1.02.001', 'C',  4320.00, 'Moinho Paulista Ltda'),
 ( 7, '1.1.03.001', 'D',  7650.00, 'Peças para revenda NF 3310'),
 ( 7, '2.1.02.001', 'C',  7650.00, 'Distribuidora Peças Brasil'),
 ( 8, '3.1.02.002', 'D',    89.90, 'Tarifas out/2026'),
 ( 8, '1.1.01.002', 'C',    89.90, 'Débito em conta'),
 ( 9, '1.1.03.001', 'D', 18400.00, 'Cimento NF 55120'),
 ( 9, '2.1.02.001', 'C', 18400.00, 'Cimentos do Vale S.A.'),
 (10, '3.1.01.004', 'D',  6500.00, 'Aluguel galpão out/2026'),
 (10, '1.1.01.002', 'C',  6500.00, 'Transferência bancária'),
 (11, '3.1.01.002', 'D',  1287.45, 'Energia out/2026'),
 (11, '1.1.01.002', 'C',  1287.45, 'Débito automático'),
 (12, '1.1.02.001', 'D',  9300.00, 'NF-e 4410'),
 (12, '4.1.01.002', 'C',  9300.00, 'Serviço de frete'),
 (13, '1.1.01.001', 'D', 15230.50, 'Vendas à vista out/2026'),
 (13, '1.1.02.002', 'D',  8450.00, 'Vendas a prazo out/2026'),
 (13, '4.1.01.001', 'C', 23680.50, 'Receita de vendas out/2026'),
 (14, '1.1.01.003', 'D',   312.18, 'Rendimento CDB out/2026'),
 (14, '4.1.02.001', 'C',   312.18, 'Receita financeira'),
 (15, '1.1.02.002', 'D',  5640.00, 'Duplicata NF-e 7781'),
 (15, '4.1.01.001', 'C',  5640.00, 'Venda a prazo'),
 (16, '1.1.03.001', 'D',  5640.00, 'Mercadorias NF-e 7781'),
 (16, '2.1.02.001', 'C',  5640.00, 'XYZ Comércio'),
 (17, '3.1.01.004', 'D',  3200.00, 'Aluguel loja nov/2026'),
 (17, '1.1.01.002', 'C',  3200.00, 'Boleto Imobiliária Central'),
 (18, '3.1.01.006', 'D',  1450.00, 'Limpeza NF 980'),
 (18, '2.1.02.001', 'C',  1450.00, 'Limpa Bem Serviços'),
 (19, '3.1.01.003', 'D',   980.00, 'Material de escritório (reenvio)'),
 (19, '1.1.01.001', 'C',   980.00, 'Pagamento em caixa'),
 (20, '1.1.01.002', 'D', 50000.00, 'Depósito dos sócios'),
 (20, '2.3.01.001', 'C', 50000.00, 'Capital integralizado'),
 (21, '3.1.03.001', 'D', 42000.00, 'Folha out/2026'),
 (21, '2.1.01.001', 'C', 38640.00, 'Líquido a pagar'),
 (21, '2.1.01.002', 'C',  3360.00, 'INSS retido'),
 (22, '3.1.03.001', 'D', 28500.00, 'Folha out/2026'),
 (22, '2.1.01.001', 'C', 26220.00, 'Líquido a pagar'),
 (22, '2.1.01.002', 'C',  2280.00, 'INSS retido')
) AS i (lancamento_id, codigo, tipo, valor, historico)
JOIN lancamento     l  ON l.id = i.lancamento_id
JOIN conta_contabil cc ON cc.cliente_id = l.cliente_id AND cc.codigo = i.codigo
ORDER BY i.lancamento_id;

-- valor_total = soma dos débitos (na carga inicial os triggers ainda não existem)
UPDATE lancamento l
SET    valor_total = s.total
FROM  (SELECT lancamento_id, sum(valor) AS total
       FROM item_lancamento WHERE tipo_movimento = 'D' GROUP BY lancamento_id) s
WHERE  s.lancamento_id = l.id;

/* ---------------------------------------------------------------------
   REVISAO_CONTABIL (16)
   --------------------------------------------------------------------- */
INSERT INTO revisao_contabil (lancamento_id, usuario_id, acao, observacao, data_revisao) VALUES
 ( 2, 3, 'APROVACAO',  NULL, '2026-11-05 15:00-03'),
 ( 3, 3, 'APROVACAO',  'Lançamento manual do contador.', '2026-11-04 16:45-03'),
 ( 4, 6, 'APROVACAO',  NULL, '2026-10-28 14:00-03'),
 ( 5, 3, 'REPROVACAO', 'Valor total ilegível no documento; confiança da leitura abaixo do aceitável.', '2026-11-03 16:00-03'),
 ( 7, 4, 'CORRECAO',   'IA classificou parte do valor como Material de Escritório; corrigido para Estoque de Mercadorias.', '2026-11-08 11:30-03'),
 ( 8, 4, 'APROVACAO',  NULL, '2026-11-03 09:10-03'),
 ( 9, 4, 'CORRECAO',   'IA sugeriu despesa; cimento comprado para estoque de obra.', '2026-10-21 09:40-03'),
 ( 9, 4, 'APROVACAO',  NULL, '2026-10-21 10:00-03'),
 (10, 4, 'APROVACAO',  NULL, '2026-11-01 09:30-03'),
 (13, 5, 'APROVACAO',  NULL, '2026-11-01 11:00-03'),
 (14, 3, 'APROVACAO',  NULL, '2026-11-04 10:00-03'),
 (15, 3, 'APROVACAO',  NULL, '2026-10-25 15:00-03'),
 (16, 4, 'APROVACAO',  NULL, '2026-10-26 14:00-03'),
 (20, 3, 'APROVACAO',  'Lançamento manual do contador.', '2026-10-01 10:00-03'),
 (21, 6, 'APROVACAO',  'Lançamento manual do contador.', '2026-11-03 17:00-03'),
 (22, 4, 'APROVACAO',  'Lançamento manual do contador.', '2026-11-03 17:30-03');

/* ---------------------------------------------------------------------
   RELATORIO (15)
   --------------------------------------------------------------------- */
INSERT INTO relatorio (cliente_id, gerado_por, tipo, periodo_inicio, periodo_fim, data_geracao, enviado_cliente, enviado_em) VALUES
 ( 1, 3, 'BALANCO',   '2026-01-01', '2026-10-31', '2026-11-05 15:30-03', TRUE,  '2026-11-05 16:00-03'),
 ( 1, 3, 'BALANCETE', '2026-10-01', '2026-10-31', '2026-11-05 15:35-03', TRUE,  '2026-11-05 16:00-03'),
 ( 1, 3, 'DRE',       '2026-10-01', '2026-10-31', '2026-11-05 15:40-03', FALSE, NULL),
 ( 2, 3, 'DRE',       '2026-10-01', '2026-10-31', '2026-11-06 14:20-03', FALSE, NULL),
 ( 2, 6, 'RAZAO',     '2026-10-01', '2026-11-10', '2026-11-11 10:15-03', FALSE, NULL),
 ( 3, 6, 'BALANCETE', '2026-10-01', '2026-10-31', '2026-11-04 16:45-03', TRUE,  '2026-11-04 17:00-03'),
 ( 3, 6, 'DIARIO',    '2026-10-01', '2026-10-31', '2026-11-04 16:50-03', FALSE, NULL),
 ( 7, 4, 'BALANCETE', '2026-10-01', '2026-10-31', '2026-11-03 10:00-03', TRUE,  '2026-11-03 10:30-03'),
 ( 8, 4, 'DRE',       '2026-10-01', '2026-10-31', '2026-11-04 09:00-03', TRUE,  '2026-11-04 09:10-03'),
 ( 8, 4, 'BALANCO',   '2026-01-01', '2026-10-31', '2026-11-04 09:05-03', FALSE, NULL),
 ( 9, 4, 'BALANCETE', '2026-10-01', '2026-10-31', '2026-11-02 08:45-03', TRUE,  '2026-11-02 09:00-03'),
 ( 9, 4, 'RAZAO',     '2026-10-01', '2026-10-31', '2026-11-02 08:50-03', FALSE, NULL),
 (12, 5, 'DRE',       '2026-10-01', '2026-10-31', '2026-11-02 11:00-03', TRUE,  '2026-11-02 11:15-03'),
 (12, 5, 'BALANCETE', '2026-10-01', '2026-10-31', '2026-11-02 11:05-03', TRUE,  '2026-11-02 11:15-03'),
 (11, 5, 'DIARIO',    '2026-10-01', '2026-10-31', '2026-11-03 14:00-03', FALSE, NULL);

/* ---------------------------------------------------------------------
   EXPORTACAO (2) + EXPORTACAO_LANCAMENTO (N:M)
   --------------------------------------------------------------------- */
INSERT INTO exportacao (id, cliente_id, usuario_id, periodo_inicio, periodo_fim, nome_arquivo, gerado_em) OVERRIDING SYSTEM VALUE VALUES
 (1, 1, 3, '2026-10-01', '2026-10-31', 'export_12345678000195_202610.csv', '2026-11-05 17:00-03'),
 (2, 2, 3, '2026-10-01', '2026-10-31', 'export_98765432000198_202610.csv', '2026-11-05 17:05-03');

INSERT INTO exportacao_lancamento (exportacao_id, lancamento_id) VALUES
 (1, 14), (1, 20),
 (2, 15);

/* ---------------------------------------------------------------------
   Reposiciona as sequences das colunas IDENTITY após os IDs explícitos
   --------------------------------------------------------------------- */
SELECT setval(pg_get_serial_sequence('contabil.escritorio',        'id'), (SELECT max(id) FROM escritorio));
SELECT setval(pg_get_serial_sequence('contabil.usuario',           'id'), (SELECT max(id) FROM usuario));
SELECT setval(pg_get_serial_sequence('contabil.cliente',           'id'), (SELECT max(id) FROM cliente));
SELECT setval(pg_get_serial_sequence('contabil.documento',         'id'), (SELECT max(id) FROM documento));
SELECT setval(pg_get_serial_sequence('contabil.analise_documento', 'id'), (SELECT max(id) FROM analise_documento));
SELECT setval(pg_get_serial_sequence('contabil.lancamento',        'id'), (SELECT max(id) FROM lancamento));
SELECT setval(pg_get_serial_sequence('contabil.exportacao',        'id'), (SELECT max(id) FROM exportacao));

COMMIT;

-- Resumo da carga
SELECT 'escritorio' AS tabela, count(*) FROM escritorio
UNION ALL SELECT 'usuario',               count(*) FROM usuario
UNION ALL SELECT 'cliente',               count(*) FROM cliente
UNION ALL SELECT 'usuario_cliente',       count(*) FROM usuario_cliente
UNION ALL SELECT 'conta_contabil',        count(*) FROM conta_contabil
UNION ALL SELECT 'documento',             count(*) FROM documento
UNION ALL SELECT 'analise_documento',     count(*) FROM analise_documento
UNION ALL SELECT 'lancamento',            count(*) FROM lancamento
UNION ALL SELECT 'item_lancamento',       count(*) FROM item_lancamento
UNION ALL SELECT 'revisao_contabil',      count(*) FROM revisao_contabil
UNION ALL SELECT 'relatorio',             count(*) FROM relatorio
UNION ALL SELECT 'exportacao',            count(*) FROM exportacao
UNION ALL SELECT 'exportacao_lancamento', count(*) FROM exportacao_lancamento;
