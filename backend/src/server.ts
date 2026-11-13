import 'dotenv/config';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { logger } from './logger.js';
import { selectProvider } from './providers/index.js';

const config = loadConfig(process.env);
const provider = selectProvider(config);
const app = createApp({
  provider,
  timeoutMs: config.AI_TIMEOUT_MS,
  corsOrigin: config.CORS_ORIGIN,
  trustProxy: config.TRUST_PROXY,
  rateLimit: { max: config.RATE_LIMIT_MAX, windowMs: config.RATE_LIMIT_WINDOW_MS },
});

app.listen(config.PORT, () => {
  logger.info(`API escuchando en http://localhost:${config.PORT} (proveedor: ${provider.name})`);
});
