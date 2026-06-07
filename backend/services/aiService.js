export async function analyzeMarket() {
  const error = new Error('AI analysis requires product and provider approval before implementation');
  error.status = 501;
  error.code = 'AI_ANALYSIS_PENDING_CONSULTATION';
  error.publicMessage = 'AI analysis is pending consultation before development';
  throw error;
}
