-- Migration: 007_user_strategy_scripts.sql
-- Create Strategy Script Vault table for storing vision-generated and quant strategy scripts

CREATE TABLE IF NOT EXISTS `user_strategy_scripts` (
  `id` VARCHAR(64) PRIMARY KEY,
  `user_id` VARCHAR(64) NOT NULL DEFAULT 'default-user',
  `name` VARCHAR(255) NOT NULL,
  `symbol` VARCHAR(64) NOT NULL,
  `timeframe` VARCHAR(32) NOT NULL DEFAULT '15m',
  `exchange` VARCHAR(64) NOT NULL DEFAULT 'Binance',
  `methodology` VARCHAR(64) NOT NULL DEFAULT 'HYBRID_ENSEMBLE',
  `snapshot_image` LONGTEXT NULL,
  `patterns_detected` JSON NULL,
  `summary` TEXT NULL,
  `pine_script` LONGTEXT NULL,
  `python_script` LONGTEXT NULL,
  `backtest_kpis` JSON NULL,
  `trading_parameters` JSON NULL,
  `is_archived` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_user_created` (`user_id`, `created_at`),
  INDEX `idx_symbol` (`symbol`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
