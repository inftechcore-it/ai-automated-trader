-- ==============================================================================
-- AI-BDM RAG Vector & Knowledge Base Storage Migration
-- MySQL Compatible Schema (Embeddings stored as JSON arrays for 768-dim vectors)
-- ==============================================================================

-- 1. Internal KB Collection 1: Strategy Playbooks
CREATE TABLE IF NOT EXISTS kb_strategy_playbooks (
    id VARCHAR(64) PRIMARY KEY,
    strategy_type VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    summary TEXT,
    content MEDIUMTEXT NOT NULL,
    parameters JSON,
    backtest_presets JSON,
    tags JSON,
    embedding JSON,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_kb_strat_type (strategy_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Internal KB Collection 2: RMS Rules & Risk Engine Playbooks
CREATE TABLE IF NOT EXISTS kb_rms_rules (
    id VARCHAR(64) PRIMARY KEY,
    rule_code VARCHAR(64) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(64) NOT NULL,
    jurisdiction VARCHAR(64) NOT NULL,
    content MEDIUMTEXT NOT NULL,
    thresholds JSON,
    action_on_breach VARCHAR(64) NOT NULL,
    embedding JSON,
    metadata JSON,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_kb_rms_category (category),
    INDEX idx_kb_rms_jurisdiction (jurisdiction)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Internal KB Collection 3: Broker & Adapter Diagnostics
CREATE TABLE IF NOT EXISTS kb_broker_diagnostics (
    id VARCHAR(64) PRIMARY KEY,
    broker_or_adapter VARCHAR(64) NOT NULL,
    error_code VARCHAR(64) NOT NULL,
    error_name VARCHAR(255) NOT NULL,
    description MEDIUMTEXT NOT NULL,
    root_cause MEDIUMTEXT NOT NULL,
    resolution_steps MEDIUMTEXT NOT NULL,
    recovery_action VARCHAR(64) NOT NULL,
    embedding JSON,
    metadata JSON,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_broker_error (broker_or_adapter, error_code),
    INDEX idx_kb_diag_broker (broker_or_adapter),
    INDEX idx_kb_diag_error (error_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Internal KB Collection 4: Historical Trade Logs & Execution Metrics
CREATE TABLE IF NOT EXISTS kb_trade_history (
    id VARCHAR(64) PRIMARY KEY,
    trade_id VARCHAR(64),
    adapter VARCHAR(64) NOT NULL,
    symbol VARCHAR(64) NOT NULL,
    side VARCHAR(16) NOT NULL,
    order_type VARCHAR(32) NOT NULL,
    expected_price DECIMAL(30, 10),
    executed_price DECIMAL(30, 10) NOT NULL,
    slippage_bps DECIMAL(10, 4),
    latency_ms INT,
    fee_deducted DECIMAL(30, 10),
    fee_asset VARCHAR(16),
    market_condition VARCHAR(64),
    narrative_summary MEDIUMTEXT,
    embedding JSON,
    metadata JSON,
    executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_kb_trade_adapter_symbol (adapter, symbol),
    INDEX idx_kb_trade_executed_at (executed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Internal KB Collection 5: Technical Indicators & Chart Patterns
CREATE TABLE IF NOT EXISTS kb_indicators_ta (
    id VARCHAR(64) PRIMARY KEY,
    indicator_name VARCHAR(128) UNIQUE NOT NULL,
    category VARCHAR(64) NOT NULL,
    formula_or_logic MEDIUMTEXT NOT NULL,
    signal_rules JSON,
    interpretation MEDIUMTEXT NOT NULL,
    optimal_timeframes JSON,
    embedding JSON,
    metadata JSON,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_kb_ind_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Internal KB Collection 6: DEX & On-Chain Mechanics
CREATE TABLE IF NOT EXISTS kb_dex_onchain (
    id VARCHAR(64) PRIMARY KEY,
    protocol VARCHAR(64) NOT NULL,
    chain VARCHAR(32) NOT NULL DEFAULT 'SOLANA',
    topic VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content MEDIUMTEXT NOT NULL,
    code_sample MEDIUMTEXT,
    embedding JSON,
    metadata JSON,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_kb_dex_protocol (protocol),
    INDEX idx_kb_dex_topic (topic)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Internal KB Collection 7: Arbitrage Playbooks & Execution Routes
CREATE TABLE IF NOT EXISTS kb_arbitrage_playbooks (
    id VARCHAR(64) PRIMARY KEY,
    arbitrage_type VARCHAR(64) NOT NULL,
    pair_or_route VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    execution_steps JSON,
    min_spread_threshold DECIMAL(10, 4),
    transfer_delay_risk MEDIUMTEXT,
    fee_model JSON,
    content MEDIUMTEXT NOT NULL,
    embedding JSON,
    metadata JSON,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_kb_arb_type (arbitrage_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Internal KB Collection 8: Fundamental & Valuation Frameworks
CREATE TABLE IF NOT EXISTS kb_fundamental_frameworks (
    id VARCHAR(64) PRIMARY KEY,
    asset_class VARCHAR(64) NOT NULL,
    ticker_or_symbol VARCHAR(64) NOT NULL,
    framework_type VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    summary MEDIUMTEXT,
    metrics JSON,
    content MEDIUMTEXT NOT NULL,
    embedding JSON,
    metadata JSON,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_kb_fund_asset_class (asset_class),
    INDEX idx_kb_fund_ticker (ticker_or_symbol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. External News & Macro Feed Vectors
CREATE TABLE IF NOT EXISTS external_market_news (
    id VARCHAR(64) PRIMARY KEY,
    source VARCHAR(64) NOT NULL,
    source_url TEXT,
    content_hash VARCHAR(128) UNIQUE,
    title VARCHAR(512) NOT NULL,
    summary MEDIUMTEXT,
    content MEDIUMTEXT NOT NULL,
    symbols JSON,
    market_impact VARCHAR(32),
    published_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    embedding JSON,
    metadata JSON,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ext_news_source (source),
    INDEX idx_ext_news_published_at (published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
