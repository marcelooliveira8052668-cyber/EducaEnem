-- =============================================================================
-- EducaEnem — Esquema de banco de dados de exemplo
-- Compatível com PostgreSQL e MySQL (ajuste tipos se necessário).
-- Use como ponto de partida para guardar os dados de verdade.
-- =============================================================================

-- ------------------------------- Usuários -----------------------------------
CREATE TABLE usuarios (
  id         VARCHAR(40)  PRIMARY KEY,
  nome       VARCHAR(160) NOT NULL,
  login      VARCHAR(80)  NOT NULL UNIQUE,
  senha_hash VARCHAR(255) NOT NULL,          -- use bcrypt/argon2 no servidor
  papel      VARCHAR(20)  NOT NULL DEFAULT 'aluno', -- 'aluno' | 'professor'
  email      VARCHAR(180),
  turma      VARCHAR(40),
  ativo      BOOLEAN      NOT NULL DEFAULT TRUE,
  criado_em  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------- Matrículas ---------------------------------
CREATE TABLE matriculas (
  id         SERIAL PRIMARY KEY,
  aluno_id   VARCHAR(40) NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  curso      VARCHAR(120) NOT NULL,
  situacao   VARCHAR(30)  NOT NULL DEFAULT 'ativo',
  desde      DATE         NOT NULL DEFAULT CURRENT_DATE
);

-- ------------------------------- Notas --------------------------------------
CREATE TABLE notas (
  id          VARCHAR(40) PRIMARY KEY,
  aluno_id    VARCHAR(40) NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  disciplina  VARCHAR(40) NOT NULL,
  trimestre   SMALLINT    NOT NULL,
  tipo        VARCHAR(20) NOT NULL DEFAULT 'media', -- atividade|prova|participacao|media
  valor       NUMERIC(4,2) NOT NULL,
  descricao   VARCHAR(200),
  data_iso    TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lancado_por VARCHAR(40)
);

-- --------------------------- Submissões (provas) ----------------------------
CREATE TABLE submissoes (
  id          VARCHAR(40) PRIMARY KEY,
  aluno_id    VARCHAR(40) NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo        VARCHAR(20) NOT NULL,          -- texto|atividade|prova
  ref_id      VARCHAR(60),
  titulo      VARCHAR(200),
  disciplina  VARCHAR(40),
  trimestre   SMALLINT DEFAULT 1,
  respostas   JSON,
  acertos     INTEGER,
  total       INTEGER,
  nota        NUMERIC(4,2),
  data_iso    TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------- Pedidos da loja ----------------------------
CREATE TABLE pedidos (
  id           VARCHAR(40) PRIMARY KEY,      -- ex.: ENEM-XXXXX
  aluno_id     VARCHAR(40) REFERENCES usuarios(id) ON DELETE SET NULL,
  subtotal     NUMERIC(10,2) NOT NULL,
  desconto     NUMERIC(10,2) NOT NULL DEFAULT 0,
  total        NUMERIC(10,2) NOT NULL,
  cupom        VARCHAR(30),
  metodo       VARCHAR(20) NOT NULL DEFAULT 'PIX',
  status       VARCHAR(40) NOT NULL DEFAULT 'aguardando pagamento',
  cliente_nome VARCHAR(160),
  cliente_email VARCHAR(180),
  cliente_cpf  VARCHAR(20),
  cliente_zap  VARCHAR(20),
  txid_pix     VARCHAR(40),                  -- identificador do PIX
  pago_em      TIMESTAMP,
  data_iso     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE pedido_itens (
  id        SERIAL PRIMARY KEY,
  pedido_id VARCHAR(40) NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  tipo      VARCHAR(20) NOT NULL,            -- curso|area|disciplina
  item_id   VARCHAR(60) NOT NULL,
  nome      VARCHAR(200) NOT NULL,
  preco     NUMERIC(10,2) NOT NULL
);

-- --------------------------- Textos de apoio --------------------------------
CREATE TABLE textos (
  id         VARCHAR(60) PRIMARY KEY,
  disciplina VARCHAR(40) NOT NULL,
  trimestre  SMALLINT DEFAULT 1,
  titulo     VARCHAR(200) NOT NULL,
  fonte      VARCHAR(200),
  corpo      TEXT,
  questoes   JSON,
  criado_em  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------- Aulas ao vivo ------------------------------
CREATE TABLE aulas (
  id         VARCHAR(40) PRIMARY KEY,
  disciplina VARCHAR(40) NOT NULL,
  trimestre  SMALLINT NOT NULL,
  titulo     VARCHAR(200) NOT NULL,
  descricao  TEXT,
  plataforma VARCHAR(20),                    -- zoom|meet
  link       VARCHAR(300),
  senha      VARCHAR(60),
  data_iso   TIMESTAMP,
  duracao    INTEGER,
  status     VARCHAR(20) DEFAULT 'agendada',
  gravacao   VARCHAR(300)
);

-- ------------------------------- Índices úteis ------------------------------
CREATE INDEX idx_notas_aluno      ON notas (aluno_id);
CREATE INDEX idx_notas_disc       ON notas (aluno_id, disciplina, trimestre);
CREATE INDEX idx_sub_aluno        ON submissoes (aluno_id);
CREATE INDEX idx_pedidos_aluno    ON pedidos (aluno_id);
CREATE INDEX idx_pedidos_status   ON pedidos (status);
CREATE INDEX idx_textos_disc      ON textos (disciplina);
CREATE INDEX idx_aulas_disc       ON aulas (disciplina, trimestre);
