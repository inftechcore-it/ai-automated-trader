export const logger = {
  debug: (...args) => console.log('[debug]', ...args),
  info: (...args) => console.log('[info]', ...args),
  warn: (...args) => console.warn('[warn]', ...args),
  error: (...args) => console.error('[error]', ...args)
};
