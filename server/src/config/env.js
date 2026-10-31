// Central configuration. Values are read from process.env; tests can call reloadConfig().
const int = (v, d) => (Number.isFinite(parseInt(v, 10)) ? parseInt(v, 10) : d);
const list = (v) => (v || '').split(',').map((s) => s.trim()).filter(Boolean);

export function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development';
  const isProd = nodeEnv === 'production';
  const isTest = nodeEnv === 'test';
  return {
    nodeEnv, isProd, isTest,
    port: int(env.PORT, 5000),
    clientUrls: list(env.CLIENT_URL || 'http://localhost:5173'),
    mongodbUri: isTest
      ? env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/wordvault_test'
      : env.MONGODB_URI || 'mongodb://127.0.0.1:27017/wordvault',
    jwtSecret: env.JWT_SECRET || '',
    sessionDays: int(env.SESSION_DAYS, 7),
    bcryptRounds: isTest ? 4 : Math.min(15, Math.max(10, int(env.BCRYPT_ROUNDS, 12))),
    cookieSecure: env.COOKIE_SECURE === 'true' || isProd,
    ai: {
      provider: (env.AI_PROVIDER || '').toLowerCase(), apiKey: env.AI_API_KEY || '',
      model: env.AI_MODEL || '', baseUrl: env.AI_BASE_URL || '', timeoutMs: int(env.AI_TIMEOUT_MS, 60000),
    },
    aiGenerationsPerHour: int(env.AI_GENERATIONS_PER_HOUR, 20),
  };
}
export function assertConfig(cfg) {
  if (!cfg.jwtSecret || cfg.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET is missing or shorter than 32 characters. Generate one and put it in .env (see .env.example).');
  }
}
export const config = loadConfig();
export function reloadConfig() { Object.assign(config, loadConfig()); return config; }
