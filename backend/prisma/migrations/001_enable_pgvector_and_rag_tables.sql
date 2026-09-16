-- ==============================================================================
-- AI-BDM RAG Vector Storage Migration (Phase 1)
-- PostgreSQL with pgvector (768 Dimensions for Gemini text-embedding-004)
-- HNSW (Hierarchical Navigable Small World) Cosine Distance Indexes
-- ==============================================================================

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Internal KB Collection 1: Strategy Playbooks
CREATE TABLE IF NOT EXISTS kb_strategy_playbooks (
    id VARCHAR(64) PRIMARY KEY,
    strategy_type VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    summary TEXT,
    content TEXT NOT NULL,
    parameters JSONB,
    backtest_presets JSONB,
    tags JSONB,
    embedding vector(768),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_strat_type ON kb_strategy_playbooks (strategy_type);
CREATE INDEX IF NOT EXISTS idx_hnsw_kb_strategy_playbooks ON kb_strategy_playbooks 
    USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- 3. Internal KB Collection 2: RMS Rules & Risk Engine Playbooks
CREATE TABLE IF NOT EXISTS kb_rms_rules (
    id VARCHAR(64) PRIMARY KEY,
    rule_code VARCHAR(64) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(64) NOT NULL,       -- DRAWDOWN, CIRCUIT_BREAKER, SEBI_PEAK_MARGIN, SEC_LEVERAGE, POSITION_LIMIT
    jurisdiction VARCHAR(64) NOT NULL,   -- GLOBAL, SEBI_INDIA, SEC_US, CRYPTO
    content TEXT NOT NULL,
    thresholds JSONB,
    action_on_breach VARCHAR(64) NOT NULL, -- LIQUIDATE, PAUSE_BOTS, COOL_OFF, REDUCE_SIZE
    embedding vector(768),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_rms_category ON kb_rms_rules (category);
CREATE INDEX IF NOT EXISTS idx_kb_rms_jurisdiction ON kb_rms_rules (jurisdiction);
CREATE INDEX IF NOT EXISTS idx_hnsw_kb_rms_rules ON kb_rms_rules 
    USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- 4. Internal KB Collection 3: Broker & Adapter Diagnostics
CREATE TABLE IF NOT EXISTS kb_broker_diagnostics (
    id VARCHAR(64) PRIMARY KEY,
    broker_or_adapter VARCHAR(64) NOT NULL, -- ANGEL_ONE, UPSTOX, BINANCE, BYBIT, KRAKEN, PIONEX, JUPITER_DEX, ALPACA
    error_code VARCHAR(64) NOT NULL,
    error_name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    root_cause TEXT NOT NULL,
    resolution_steps TEXT NOT NULL,
    recovery_action VARCHAR(64) NOT NULL,   -- RETRY, RECONNECT, REAUTHENTICATE, LIQUIDATE, ABORT, ADJUST_PARAM
    embedding vector(768),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_broker_error UNIQUE (broker_or_adapter, error_code)
);
CREATE INDEX IF NOT EXISTS idx_kb_diag_broker ON kb_broker_diagnostics (broker_or_adapter);
CREATE INDEX IF NOT EXISTS idx_kb_diag_error ON kb_broker_diagnostics (error_code);
CREATE INDEX IF NOT EXISTS idx_hnsw_kb_broker_diagnostics ON kb_broker_diagnostics 
    USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- 5. Internal KB Collection 4: Historical Trade Logs & Execution Metrics
CREATE TABLE IF NOT EXISTS kb_trade_history (
    id VARCHAR(64) PRIMARY KEY,
    trade_id VARCHAR(64),
    adapter VARCHAR(64) NOT NULL,
    symbol VARCHAR(64) NOT NULL,
    side VARCHAR(16) NOT NULL,
    order_type VARCHAR(32) NOT NULL,
    expected_price NUMERIC(30, 10),
    executed_price NUMERIC(30, 10) NOT NULL,
    slippage_bps NUMERIC(10, 4),
    latency_ms INTEGER,
    fee_deducted NUMERIC(30, 10),
    fee_asset VARCHAR(16),
    market_condition VARCHAR(64),
    narrative_summary TEXT,
    embedding vector(768),
    metadata JSONB,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_trade_adapter_symbol ON kb_trade_history (adapter, symbol);
CREATE INDEX IF NOT EXISTS idx_kb_trade_executed_at ON kb_trade_history (executed_at);
CREATE INDEX IF NOT EXISTS idx_hnsw_kb_trade_history ON kb_trade_history 
    USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- 6. Internal KB Collection 5: Technical Indicators & Chart Patterns
CREATE TABLE IF NOT EXISTS kb_indicators_ta (
    id VARCHAR(64) PRIMARY KEY,
    indicator_name VARCHAR(128) UNIQUE NOT NULL,
    category VARCHAR(64) NOT NULL, -- MOMENTUM, VOLATILITY, VOLUME_FLOW, PATTERN, TREND
    formula_or_logic TEXT NOT NULL,
    signal_rules JSONB,
    interpretation TEXT NOT NULL,
    optimal_timeframes JSONB,
    embedding vector(768),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_ind_category ON kb_indicators_ta (category);
CREATE INDEX IF NOT EXISTS idx_hnsw_kb_indicators_ta ON kb_indicators_ta 
    USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- 7. Internal KB Collection 6: DEX & On-Chain Mechanics (Solana / Jupiter / Raydium / Orca)
CREATE TABLE IF NOT EXISTS kb_dex_onchain (
    id VARCHAR(64) PRIMARY KEY,
    protocol VARCHAR(64) NOT NULL, -- JUPITER, RAYDIUM, ORCA, PUMP_FUN
    chain VARCHAR(32) NOT NULL DEFAULT 'SOLANA',
    topic VARCHAR(64) NOT NULL,    -- ROUTE_RULES, AMM_MECHANICS, PRIORITY_FEES, JITO_MEV_PROTECTION, SLIPPAGE_CALC
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    code_sample TEXT,
    embedding vector(768),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_dex_protocol ON kb_dex_onchain (protocol);
CREATE INDEX IF NOT EXISTS idx_kb_dex_topic ON kb_dex_onchain (topic);
CREATE INDEX IF NOT EXISTS idx_hnsw_kb_dex_onchain ON kb_dex_onchain 
    USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- 8. Internal KB Collection 7: Arbitrage Playbooks & Execution Routes
CREATE TABLE IF NOT EXISTS kb_arbitrage_playbooks (
    id VARCHAR(64) PRIMARY KEY,
    arbitrage_type VARCHAR(64) NOT NULL, -- CROSS_EXCHANGE, TRIANGULAR, SPATIAL_DEX_CEX, FUTURES_SPOT
    pair_or_route VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    execution_steps JSONB,
    min_spread_threshold NUMERIC(10, 4),
    transfer_delay_risk TEXT,
    fee_model JSONB,
    content TEXT NOT NULL,
    embedding vector(768),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_arb_type ON kb_arbitrage_playbooks (arbitrage_type);
CREATE INDEX IF NOT EXISTS idx_hnsw_kb_arbitrage_playbooks ON kb_arbitrage_playbooks 
    USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- 9. Internal KB Collection 8: Fundamental & Valuation Frameworks
CREATE TABLE IF NOT EXISTS kb_fundamental_frameworks (
    id VARCHAR(64) PRIMARY KEY,
    asset_class VARCHAR(64) NOT NULL,     -- EQUITY_NSE, EQUITY_US, CRYPTO_TOKEN
    ticker_or_symbol VARCHAR(64) NOT NULL,
    framework_type VARCHAR(64) NOT NULL,  -- DCF, PE_BENCHMARK, TOKENOMICS_VESTING, REVENUE_GROWTH
    title VARCHAR(255) NOT NULL,
    summary TEXT,
    metrics JSONB,
    content TEXT NOT NULL,
    embedding vector(768),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_fund_asset_class ON kb_fundamental_frameworks (asset_class);
CREATE INDEX IF NOT EXISTS idx_kb_fund_ticker ON kb_fundamental_frameworks (ticker_or_symbol);
CREATE INDEX IF NOT EXISTS idx_hnsw_kb_fundamental_frameworks ON kb_fundamental_frameworks 
    USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- 10. External News & Macro Feed Vectors
CREATE TABLE IF NOT EXISTS external_market_news (
    id VARCHAR(64) PRIMARY KEY,
    source VARCHAR(64) NOT NULL,          -- CRYPTOPANIC, COINDESK, BINANCE_STATUS, BYBIT_STATUS, MONEYCONTROL, NSE_ANNOUNCEMENTS, BSE_ANNOUNCEMENTS, SEBI_PRESS, SEC_EDGAR, BENZINGA, FMP, TRADING_ECONOMICS, FOREX_FACTORY
    source_url TEXT,
    content_hash VARCHAR(128) UNIQUE,
    title VARCHAR(512) NOT NULL,
    summary TEXT,
    content TEXT NOT NULL,
    symbols JSONB,
    market_impact VARCHAR(32),            -- BULLISH, BEARISH, NEUTRAL, HIGH_VOLATILITY
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    embedding vector(768),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ext_news_source ON external_market_news (source);
CREATE INDEX IF NOT EXISTS idx_ext_news_published_at ON external_market_news (published_at);
CREATE INDEX IF NOT EXISTS idx_hnsw_external_market_news ON external_market_news 
    USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
