import { query } from '../config/db.js';
import { ok, fail } from '../utils/apiResponse.js';
import { analyzePrediction, analyzeRnD } from '../services/aiService.js';
import { chatQuery } from '../services/geminiService.js';

export async function prediction(req, res) {
  const { symbol, exchange } = req.body;

  const result = await analyzePrediction({ symbol, exchange });

  // Log the analysis
  await query(
    `INSERT INTO ai_analysis_logs (user_id, symbol, exchange_name, analysis_text, prediction, confidence_score, created_at)
     VALUES (:userId, :symbol, :exchange, :analysisText, :prediction, :confidence, NOW())`,
    {
      userId: req.user.id,
      symbol,
      exchange,
      analysisText: `Prediction analysis - ${result.signals.length} signals detected`,
      prediction: result.prediction.decision,
      confidence: result.prediction.confidence
    }
  ).catch(() => {}); // Don't fail if logging fails

  return ok(res, { analysis: result });
}

export async function research(req, res) {
  const { exchange, criteria } = req.body;

  const result = await analyzeRnD({ exchange, criteria });

  // Log the R&D analysis
  await query(
    `INSERT INTO ai_analysis_logs (user_id, symbol, exchange_name, analysis_text, prediction, confidence_score, created_at)
     VALUES (:userId, :symbol, :exchange, :analysisText, :prediction, :confidence, NOW())`,
    {
      userId: req.user.id,
      symbol: 'MARKET_SCAN',
      exchange,
      analysisText: `R&D scan - ${result.summary.totalScanned} symbols analyzed`,
      prediction: `${result.summary.strongBuys} strong buys`,
      confidence: result.summary.averageConfidence
    }
  ).catch(() => {});

  return ok(res, { analysis: result });
}

export async function history(req, res) {
  const logs = await query(
    `SELECT id, symbol, exchange_name as exchange, analysis_text as analysis_type,
            prediction as decision, confidence_score as confidence, created_at
     FROM ai_analysis_logs
     WHERE user_id = :userId
     ORDER BY created_at DESC
     LIMIT 50`,
    { userId: req.user.id }
  );
  return ok(res, { logs });
}

// AI Chat endpoint
export async function chat(req, res) {
  const { message, exchange } = req.body;

  if (!message || message.trim().length === 0) {
    return fail(res, 400, 'Message is required');
  }

  const result = await chatQuery(message, { exchange });

  if (result.error) {
    return fail(res, 500, result.error);
  }

  // Log the chat
  await query(
    `INSERT INTO ai_analysis_logs (user_id, symbol, exchange_name, analysis_text, prediction, confidence_score, created_at)
     VALUES (:userId, :symbol, :exchange, :analysisText, :prediction, :confidence, NOW())`,
    {
      userId: req.user.id,
      symbol: 'AI_CHAT',
      exchange: exchange || 'general',
      analysisText: message.substring(0, 200),
      prediction: result.type || 'chat',
      confidence: result.stocks?.length || 0
    }
  ).catch(() => {});

  return ok(res, { response: result });
}

// Legacy endpoint for backward compatibility
export async function analyze(req, res) {
  return prediction(req, res);
}
