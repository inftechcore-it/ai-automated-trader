USE trading_system;

INSERT INTO users (id, email, password_hash, name)
VALUES
  (
    1,
    'demo@trading.com',
    '$2a$12$R5yGb9hau6lGYEC9bcnXxeaTjE.qWbFDFnF0A3U3G1VS/Cl2dp/4y',
    'Demo Trader'
  )
ON DUPLICATE KEY UPDATE
  email = VALUES(email),
  password_hash = VALUES(password_hash),
  name = VALUES(name);

INSERT INTO paper_wallet (user_id, balance, currency)
VALUES (1, 10000.00, 'USD')
ON DUPLICATE KEY UPDATE
  balance = VALUES(balance),
  currency = VALUES(currency);

INSERT INTO watchlist (user_id, symbol, exchange_name)
VALUES
  (1, 'BTC/USDT', 'Binance'),
  (1, 'ETH/USDT', 'Binance'),
  (1, 'AAPL', 'NASDAQ'),
  (1, 'INFY', 'NSE')
ON DUPLICATE KEY UPDATE
  symbol = VALUES(symbol),
  exchange_name = VALUES(exchange_name);
