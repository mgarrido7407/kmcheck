import Anthropic from '@anthropic-ai/sdk';
import type { AppConfig } from '../config.js';
import { logger, registerSecret } from '../logger.js';
import { ClaudeProvider } from './claudeProvider.js';
import { RulesProvider } from './rulesProvider.js';
import type { DiagnosticProvider } from './types.js';

export type { DiagnosticProvider } from './types.js';

export function selectProvider(config: AppConfig): DiagnosticProvider {
  if (config.AI_PROVIDER === 'claude') {
    if (!config.ANTHROPIC_API_KEY) {
      logger.warn('AI_PROVIDER=claude pero falta ANTHROPIC_API_KEY; se usa el motor de reglas local.');
      return new RulesProvider();
    }
    registerSecret(config.ANTHROPIC_API_KEY);
    const client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
    return new ClaudeProvider(client, {
      model: config.AI_MODEL,
      timeoutMs: config.AI_TIMEOUT_MS,
      cacheTtlMs: config.AI_CACHE_TTL_MS,
    });
  }
  return new RulesProvider();
}
