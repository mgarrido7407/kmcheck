---
name: security-audit
description: Audita KmCheck antes de un commit o despliegue para confirmar que el frontend React nunca llama a la IA ni expone secretos (API keys, .env, VITE_*). Usar cuando el usuario diga "security audit", "auditoría de seguridad", "revisa secretos" o antes de hacer commit/deploy.
---

# /security-audit — Auditoría de seguridad de KmCheck

Objetivo: verificar el criterio de aceptación 2 del plan. El navegador solo habla con `POST /api/maintenance/check`
y las credenciales nunca salen del servidor.

## Pasos

1. Genera el bundle de producción para auditarlo también: `npm run build`.
2. Ejecuta el escáner automático: `npm run audit:security`.
   Revisa: imports de SDKs de IA o `dotenv` en `frontend/src`, `process.env`, variables `VITE_*` con nombre de secreto,
   URLs absolutas en `fetch`, API keys en el código o en el bundle, `.env` versionados y la API key en `wrangler.jsonc`.
3. Revisión manual complementaria (el escáner no la cubre):
   - `frontend/src/services/`: todas las llamadas de red usan rutas relativas `/api/...`.
   - `backend/src/logger.ts`: ningún `console.*` directo en el backend (lo vigila ESLint con `no-console`).
   - `backend/src/core/check.ts`: los errores al cliente son genéricos; los detalles solo van al log.
   - `wrangler.jsonc`: la API key se configura con `npx wrangler secret put ANTHROPIC_API_KEY`, nunca en `vars`.
4. Si hay hallazgos: muéstralos con `archivo:línea`, explica el riesgo y propone el arreglo mínimo. **No hagas commit**
   mientras haya hallazgos CRÍTICOS o ALTOS.
5. Si todo está limpio, indícalo y recuerda la verificación manual en DevTools: pestaña Network, solo debe aparecer
   `POST /api/maintenance/check` y ninguna petición a `api.anthropic.com`.

## Restricciones

- Esta skill solo lee y reporta; no modifica código salvo que el usuario lo pida.
