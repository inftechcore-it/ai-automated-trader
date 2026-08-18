# Prediction System - Plan of Action (POA)

## Objective
Build a high-accuracy trading prediction system targeting **70-85% accuracy** (95% is unrealistic due to market randomness, but we can maximize through multi-modal analysis).

---

## Phase 1: Data Infrastructure (Week 1-2)

### 1.1 Historical Data Collection
```
├── Data Sources
│   ├── Binance API (crypto) - Free, 1000 candles/request
│   ├── Yahoo Finance (stocks) - yfinance library
│   ├── Alpha Vantage (forex) - Free API key
│   └── CryptoCompare (sentiment) - Social data
│
├── Data Requirements
│   ├── OHLCV (Open, High, Low, Close, Volume)
│   ├── Timeframes: 1m, 5m, 15m, 1h, 4h, 1D
│   ├── History: Minimum 2 years for daily, 90 days for minute
│   └── Storage: PostgreSQL + TimescaleDB for time-series
```

### 1.2 Database Schema
```sql
CREATE TABLE ohlcv (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20),
    timeframe VARCHAR(10),
    timestamp TIMESTAMPTZ,
    open DECIMAL(20,8),
    high DECIMAL(20,8),
    low DECIMAL(20,8),
    close DECIMAL(20,8),
    volume DECIMAL(30,8),
    UNIQUE(symbol, timeframe, timestamp)
);

-- Enable TimescaleDB
SELECT create_hypertable('ohlcv', 'timestamp');
```

### 1.3 Data Pipeline Service
```javascript
// backend/services/dataCollector.js
class DataCollector {
  async collectHistorical(symbol, timeframe, startDate, endDate) {}
  async streamRealtime(symbols, callback) {}
  async validateData(data) {} // Check for gaps, anomalies
}
```

---

## Phase 2: Feature Engineering (Week 2-3)

### 2.1 Technical Indicators (100+ features)

| Category | Indicators | Count |
|----------|------------|-------|
| Trend | SMA, EMA, MACD, ADX, Aroon, Ichimoku | 15 |
| Momentum | RSI, Stochastic, CCI, Williams %R, ROC | 12 |
| Volatility | ATR, Bollinger Bands, Keltner, Donchian | 10 |
| Volume | OBV, MFI, VWAP, A/D Line, CMF | 8 |
| Custom | Price ratios, returns, volatility ratios | 15 |

### 2.2 Pattern Detection (61 Candlestick + Chart Patterns)

```python
# Feature extraction pipeline
import talib
import pandas as pd

class PatternDetector:
    CANDLESTICK_PATTERNS = [
        'CDLENGULFING', 'CDLHAMMER', 'CDLDOJI', 'CDLMORNINGSTAR',
        'CDLEVENINGSTAR', 'CDLSHOOTINGSTAR', 'CDLHARAMI',
        'CDL3WHITESOLDIERS', 'CDL3BLACKCROWS', 'CDLPIERCING',
        # ... all 61 patterns
    ]
    
    def detect_all_patterns(self, df):
        results = {}
        for pattern in self.CANDLESTICK_PATTERNS:
            func = getattr(talib, pattern)
            results[pattern] = func(df['open'], df['high'], 
                                    df['low'], df['close'])
        return pd.DataFrame(results)
    
    def detect_chart_patterns(self, df):
        # Head & Shoulders, Double Top/Bottom, Triangles, etc.
        # Using peak/trough detection algorithms
        pass
```

### 2.3 Feature Categories

```python
def create_feature_matrix(df):
    features = pd.DataFrame()
    
    # 1. Price Features
    features['return_1'] = df['close'].pct_change(1)
    features['return_5'] = df['close'].pct_change(5)
    features['return_20'] = df['close'].pct_change(20)
    features['log_return'] = np.log(df['close']).diff()
    
    # 2. Technical Indicators
    features['rsi_14'] = ta.momentum.rsi(df['close'], 14)
    features['macd'] = ta.trend.macd_diff(df['close'])
    features['bb_position'] = (df['close'] - bb_low) / (bb_high - bb_low)
    
    # 3. Pattern Signals (-100, 0, 100)
    features['engulfing'] = talib.CDLENGULFING(o, h, l, c)
    features['hammer'] = talib.CDLHAMMER(o, h, l, c)
    
    # 4. Time Features
    features['hour'] = df.index.hour
    features['day_of_week'] = df.index.dayofweek
    features['is_weekend'] = (df.index.dayofweek >= 5).astype(int)
    
    # 5. Volatility Features
    features['atr'] = ta.volatility.average_true_range(h, l, c)
    features['volatility_20'] = df['close'].rolling(20).std()
    
    return features
```

---

## Phase 3: Model Architecture (Week 3-5)

### 3.1 Multi-Model Ensemble Approach

```
┌─────────────────────────────────────────────────────────────┐
│                    INPUT: OHLCV + Features                  │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   CNN Model   │    │  LSTM Model   │    │ Transformer   │
│ (Patterns)    │    │ (Sequence)    │    │ (Attention)   │
└───────────────┘    └───────────────┘    └───────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              ▼
                    ┌───────────────┐
                    │   XGBoost     │
                    │ (Meta-Learner)│
                    └───────────────┘
                              │
                              ▼
                    ┌───────────────┐
                    │  Prediction   │
                    │ BUY/SELL/HOLD │
                    └───────────────┘
```

### 3.2 Model Implementations

#### CNN for Pattern Recognition
```python
def create_cnn_model(input_shape):
    model = keras.Sequential([
        # Conv Block 1
        layers.Conv1D(64, 3, padding='same'),
        layers.BatchNormalization(),
        layers.ReLU(),
        layers.MaxPooling1D(2),
        
        # Conv Block 2
        layers.Conv1D(128, 3, padding='same'),
        layers.BatchNormalization(),
        layers.ReLU(),
        layers.MaxPooling1D(2),
        
        # Conv Block 3
        layers.Conv1D(256, 3, padding='same'),
        layers.BatchNormalization(),
        layers.ReLU(),
        layers.GlobalAveragePooling1D(),
        
        # Classification
        layers.Dense(128, activation='relu'),
        layers.Dropout(0.5),
        layers.Dense(3, activation='softmax')  # Buy/Sell/Hold
    ])
    return model
```

#### LSTM for Sequence Learning
```python
def create_lstm_model(sequence_length, n_features):
    model = keras.Sequential([
        layers.LSTM(100, return_sequences=True, 
                   input_shape=(sequence_length, n_features)),
        layers.Dropout(0.2),
        layers.LSTM(100, return_sequences=True),
        layers.Dropout(0.2),
        layers.LSTM(50),
        layers.Dropout(0.2),
        layers.Dense(50, activation='relu'),
        layers.Dense(3, activation='softmax')
    ])
    return model
```

#### Transformer for Long-Range Dependencies
```python
def create_transformer_model(seq_len, n_features, d_model=64, n_heads=4):
    inputs = layers.Input(shape=(seq_len, n_features))
    
    # Positional encoding
    x = layers.Dense(d_model)(inputs)
    x = PositionalEncoding(seq_len, d_model)(x)
    
    # Transformer blocks
    for _ in range(4):
        x = TransformerBlock(d_model, n_heads, d_model * 4)(x)
    
    # Output
    x = layers.GlobalAveragePooling1D()(x)
    x = layers.Dense(64, activation='relu')(x)
    outputs = layers.Dense(3, activation='softmax')(x)
    
    return keras.Model(inputs, outputs)
```

### 3.3 Meta-Learner (Stacking)
```python
from xgboost import XGBClassifier

class EnsemblePredictor:
    def __init__(self):
        self.cnn = load_model('cnn_model.h5')
        self.lstm = load_model('lstm_model.h5')
        self.transformer = load_model('transformer_model.h5')
        self.meta_learner = XGBClassifier()
    
    def fit(self, X, y):
        # Get predictions from base models
        cnn_pred = self.cnn.predict(X)
        lstm_pred = self.lstm.predict(X)
        trans_pred = self.transformer.predict(X)
        
        # Stack predictions
        meta_features = np.hstack([cnn_pred, lstm_pred, trans_pred])
        
        # Train meta-learner
        self.meta_learner.fit(meta_features, y)
    
    def predict(self, X):
        cnn_pred = self.cnn.predict(X)
        lstm_pred = self.lstm.predict(X)
        trans_pred = self.transformer.predict(X)
        
        meta_features = np.hstack([cnn_pred, lstm_pred, trans_pred])
        return self.meta_learner.predict(meta_features)
```

---

## Phase 4: Training Pipeline (Week 5-6)

### 4.1 Data Preparation
```python
class DataPreparer:
    def __init__(self, sequence_length=60):
        self.seq_len = sequence_length
        self.scaler = StandardScaler()
    
    def prepare(self, df):
        # 1. Create features
        features = create_feature_matrix(df)
        
        # 2. Create labels (next candle direction)
        labels = self.create_labels(df, lookahead=5)
        
        # 3. Scale features
        features_scaled = self.scaler.fit_transform(features)
        
        # 4. Create sequences
        X, y = self.create_sequences(features_scaled, labels)
        
        # 5. Train/Val/Test split (70/15/15)
        return self.split_data(X, y)
    
    def create_labels(self, df, lookahead=5, threshold=0.5):
        """
        Labels:
        0 = SELL (price drops > threshold%)
        1 = HOLD (price within threshold%)
        2 = BUY (price rises > threshold%)
        """
        future_return = df['close'].pct_change(lookahead).shift(-lookahead) * 100
        
        labels = np.where(future_return > threshold, 2,
                 np.where(future_return < -threshold, 0, 1))
        return labels
```

### 4.2 Training Configuration
```python
training_config = {
    'batch_size': 64,
    'epochs': 200,
    'learning_rate': 0.001,
    'early_stopping_patience': 20,
    'reduce_lr_patience': 10,
    'validation_split': 0.15,
    
    'callbacks': [
        EarlyStopping(monitor='val_accuracy', patience=20, restore_best_weights=True),
        ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=10),
        ModelCheckpoint('best_model.h5', save_best_only=True),
        TensorBoard(log_dir='./logs')
    ]
}
```

### 4.3 Class Imbalance Handling
```python
from imblearn.over_sampling import SMOTE

# Option 1: Class weights
class_weights = compute_class_weight('balanced', classes=[0,1,2], y=y_train)

# Option 2: SMOTE oversampling
smote = SMOTE(random_state=42)
X_resampled, y_resampled = smote.fit_resample(X_train, y_train)

# Option 3: Focal Loss (for deep learning)
def focal_loss(gamma=2.0, alpha=0.25):
    def loss(y_true, y_pred):
        ce = -y_true * tf.math.log(y_pred + 1e-7)
        weight = alpha * y_true * tf.pow(1 - y_pred, gamma)
        return tf.reduce_sum(weight * ce, axis=-1)
    return loss
```

---

## Phase 5: Backtesting & Validation (Week 6-7)

### 5.1 Walk-Forward Validation
```python
class WalkForwardValidator:
    def __init__(self, train_size=252, test_size=21):  # 1 year train, 1 month test
        self.train_size = train_size
        self.test_size = test_size
    
    def validate(self, model, data):
        results = []
        
        for i in range(0, len(data) - self.train_size - self.test_size, self.test_size):
            train = data[i:i + self.train_size]
            test = data[i + self.train_size:i + self.train_size + self.test_size]
            
            model.fit(train)
            predictions = model.predict(test)
            
            accuracy = accuracy_score(test['label'], predictions)
            results.append({
                'period': i,
                'accuracy': accuracy,
                'profit': self.calculate_profit(test, predictions)
            })
        
        return pd.DataFrame(results)
```

### 5.2 Performance Metrics
```python
def evaluate_model(y_true, y_pred, y_prob):
    metrics = {
        'accuracy': accuracy_score(y_true, y_pred),
        'precision': precision_score(y_true, y_pred, average='weighted'),
        'recall': recall_score(y_true, y_pred, average='weighted'),
        'f1': f1_score(y_true, y_pred, average='weighted'),
        'confusion_matrix': confusion_matrix(y_true, y_pred),
        
        # Trading-specific
        'win_rate': (y_pred == y_true).mean(),
        'profit_factor': calculate_profit_factor(y_true, y_pred),
        'sharpe_ratio': calculate_sharpe_ratio(y_true, y_pred),
        'max_drawdown': calculate_max_drawdown(y_true, y_pred),
    }
    return metrics
```

---

## Phase 6: Integration (Week 7-8)

### 6.1 Prediction Service
```javascript
// backend/services/predictionService.js
class PredictionService {
    constructor() {
        this.model = null;
        this.featureExtractor = new FeatureExtractor();
    }
    
    async loadModel() {
        // Load TensorFlow.js model or call Python service
    }
    
    async predict(symbol, timeframe) {
        // 1. Get latest OHLCV data
        const ohlcv = await this.getOHLCV(symbol, timeframe, 100);
        
        // 2. Extract features
        const features = this.featureExtractor.extract(ohlcv);
        
        // 3. Run prediction
        const prediction = await this.model.predict(features);
        
        // 4. Detect patterns
        const patterns = this.detectPatterns(ohlcv);
        
        return {
            signal: prediction.class,  // BUY, SELL, HOLD
            confidence: prediction.probability,
            patterns: patterns,
            indicators: features.summary,
            timestamp: Date.now()
        };
    }
}
```

### 6.2 API Endpoints
```javascript
// backend/routes/predictionRoutes.js
router.get('/predict/:symbol', async (req, res) => {
    const { symbol } = req.params;
    const { timeframe = '1h' } = req.query;
    
    const prediction = await predictionService.predict(symbol, timeframe);
    return res.json({ success: true, prediction });
});

router.get('/patterns/:symbol', async (req, res) => {
    const patterns = await patternService.detect(req.params.symbol);
    return res.json({ success: true, patterns });
});

router.get('/backtest', async (req, res) => {
    const { symbol, startDate, endDate, strategy } = req.query;
    const results = await backtestService.run(symbol, startDate, endDate, strategy);
    return res.json({ success: true, results });
});
```

---

## Phase 7: UI Integration (Week 8-9)

### 7.1 Prediction Dashboard Components
```jsx
// frontend/src/components/PredictionPanel.jsx
const PredictionPanel = ({ symbol }) => {
    const [prediction, setPrediction] = useState(null);
    
    return (
        <div className="prediction-panel">
            {/* Signal Badge */}
            <SignalBadge signal={prediction.signal} confidence={prediction.confidence} />
            
            {/* Pattern Detection */}
            <PatternList patterns={prediction.patterns} />
            
            {/* Technical Indicators */}
            <IndicatorGrid indicators={prediction.indicators} />
            
            {/* Confidence Meter */}
            <ConfidenceMeter value={prediction.confidence} />
            
            {/* Historical Accuracy */}
            <AccuracyChart data={historicalAccuracy} />
        </div>
    );
};
```

---

## Technology Stack

### Backend (Python ML Service)
```
Python 3.10+
├── tensorflow / keras (deep learning)
├── scikit-learn (ML utilities)
├── xgboost (gradient boosting)
├── ta-lib (technical analysis - 150+ indicators)
├── pandas-ta (additional indicators)
├── numpy / pandas (data processing)
├── fastapi (API server)
└── redis (caching predictions)
```

### Integration with Node.js Backend
```
Option 1: Python microservice (FastAPI)
    Node.js <--HTTP--> Python ML Service

Option 2: TensorFlow.js
    Run models directly in Node.js

Option 3: ONNX Runtime
    Export models to ONNX, run in Node.js
```

---

## Expected Performance

| Metric | Target | Realistic |
|--------|--------|-----------|
| Accuracy | 95% | 70-80% |
| Precision | 90% | 65-75% |
| Win Rate | 70% | 55-65% |
| Profit Factor | 2.0 | 1.3-1.8 |
| Sharpe Ratio | 2.0 | 1.0-1.5 |

### Why 95% is Unrealistic
1. Markets have random component (EMH)
2. Pattern recognition is subjective
3. Black swan events
4. Overfitting on historical data

### How to Maximize Accuracy
1. **Multi-timeframe analysis** - Confirm signals across timeframes
2. **Ensemble models** - Combine CNN + LSTM + XGBoost
3. **Confidence threshold** - Only trade high-confidence signals (>80%)
4. **Risk management** - Position sizing based on confidence

---

## Timeline Summary

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Phase 1: Data | Week 1-2 | Data pipeline, database |
| Phase 2: Features | Week 2-3 | 100+ features, pattern detection |
| Phase 3: Models | Week 3-5 | CNN, LSTM, Transformer, Ensemble |
| Phase 4: Training | Week 5-6 | Trained models, validation |
| Phase 5: Backtest | Week 6-7 | Performance metrics, tuning |
| Phase 6: Integration | Week 7-8 | API, services |
| Phase 7: UI | Week 8-9 | Dashboard, visualizations |

**Total: 9 weeks to production-ready system**

---

## Next Steps

1. **Approve this POA** - Confirm scope and timeline
2. **Set up Python ML environment** - Install dependencies
3. **Start Phase 1** - Data collection infrastructure
4. **Choose priority symbols** - Focus on 10-20 high-volume pairs first
