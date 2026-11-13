# Contexto de Proyecto: KmCheck — Sistema de Mantenimiento Vehicular

## Stack Tecnológico
- Monorrepo con npm workspaces: `shared`, `backend`, `frontend`.
- Frontend: React 19 (Vite), Tailwind CSS v4, lucide-react.
- Backend: Express 5 para desarrollo local y Hono en Cloudflare Workers para producción. Ambos usan `backend/src/core/`.
- Contrato de datos: `shared/src/index.ts` (schemas Zod de request y response, usados por ambos lados).
- Motor de diagnóstico: proveedor intercambiable (`backend/src/providers`).
  - `rules` (por defecto): motor de reglas local en `backend/src/engine`.
  - `claude`: `@anthropic-ai/sdk`, modelo `claude-opus-5-5`, `beta.messages.parse` + `betaZodOutputFormat`,
    fallbacks del lado del servidor. Se activa con `AI_PROVIDER=claude` + `ANTHROPIC_API_KEY`.
    No usar `tool_choice` forzado: devuelve 400 en Opus 5.5.
- Testing: Vitest en todo el repo; Supertest y `app.request` de Hono para la API; React Testing Library + jsdom en el frontend.

## Comandos Principales
- `npm run dev`: Express (puerto 5000) y React (puerto 3000) en paralelo. Vite hace proxy de `/api` a Express.
- `npm run test` / `npm run lint` / `npm run build` / `npm run audit:security`.
- `npm run verify`: todo lo anterior. `npm run cf:check`: valida el bundle del Worker sin desplegar.

## Reglas y Restricciones Estrictas
1. NUNCA importes un SDK de IA ni llames a un proveedor de IA desde `frontend/`. El navegador solo habla con `/api/*` (rutas relativas).
2. NUNCA expongas claves de API ni variables `.env` al cliente (sin prefijo `VITE_` para secretos; en Cloudflare, `wrangler secret put`).
3. NUNCA cambies la API sin actualizar primero los schemas en `shared/src/index.ts`.
4. NUNCA des por terminada una tarea sin que `npm run test` y `npm run lint` pasen al 100%. Usa el subagente `tester`.
5. Los logs del servidor pasan por `backend/src/logger.ts` (redacta secretos). No uses `console.*` directo en el backend.
6. Cualquier proveedor nuevo implementa `DiagnosticProvider`; su salida se valida contra `DiagnosticResponseSchema`.
7. Los tests nunca consumen tokens reales: los proveedores y el cliente de Anthropic se inyectan simulados.
8. La lógica HTTP vive en `backend/src/core/`. Express y el Worker solo la adaptan; los tests de contrato corren contra ambos.
9. Textos visibles al usuario en español con ortografía correcta (tildes y ñ). Las palabras clave de síntomas van sin tildes porque el texto se normaliza antes de comparar.
10. Ejecuta un solo `npm install` a la vez (en Windows, las instalaciones concurrentes corrompen los binarios nativos).

## Estructura de Carpetas
- `/shared/src`: schemas Zod y tipos compartidos.
- `/frontend/src/components`: `VehicleForm`, `DiagnosticCard` (agrupa servicios por km), `UrgencyBadge`.
- `/frontend/src/services`: adaptador de red (`maintenanceApi.ts`, con timeout de cliente).
- `/backend/src/core`: `check.ts` (validación 400, timeout, contrato, 503), `rateLimit.ts` (429), `securityHeaders.ts`.
- `/backend/src/app.ts` + `routes/`, `controllers/`, `middleware/`: adaptador Express.
- `/backend/src/worker.ts`: adaptador Cloudflare Worker (Hono). Configuración en `/wrangler.jsonc`.
- `/backend/src/providers`: `rulesProvider.ts`, `claudeProvider.ts`.
- `/backend/src/engine`: motor de reglas (sin IA).
- `/backend/test`: contrato de la API (Express + Worker), motor y proveedor de Claude simulado.
- `/scripts/security-audit.mjs`: escáner que usan la skill `/security-audit` y CI.
- `/.claude`: subagente `tester`, skill `security-audit` y hook `post-edit`.

## Protocolo de Debugging
Reproducir (test) -> Registrar evidencia (logs sin secretos) -> Aislar (React / core / adaptador / proveedor) -> Hipótesis -> Fix mínimo -> Regresión completa.
