-- Migration: Add BotLog table for persistent bot logging

CREATE TABLE IF NOT EXISTS BotLog (
  id VARCHAR(30) PRIMARY KEY,
  botId VARCHAR(30) NOT NULL,
  level VARCHAR(10) NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  metadata JSON,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_botlog_botid (botId),
  INDEX idx_botlog_createdat (createdAt),
  INDEX idx_botlog_level (level)
);
