-- Add last_verified column to exchange_connections table
ALTER TABLE exchange_connections
ADD COLUMN last_verified TIMESTAMP NULL AFTER is_active;
