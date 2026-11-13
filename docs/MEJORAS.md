# Plan de Mejoras — KmCheck

Documento generado tras la revisión multi-rol (**BMAD Party Mode**: Arquitectura, Producto, UX, Ingeniería y QA) sobre el estado actual del proyecto.

---

## 1. Estado actual observado

### Fortalezas
- **Contrato único en `shared/src/index.ts`:** Zod valida request, response y errores tanto en frontend como en backend (`MaintenanceRequestSchema`, `DiagnosticResponseSchema`, `ApiErrorSchema`).
- **Doble runtime limpio:** El núcleo HTTP (`backend/src/core/`) es agnóstico y corre tanto en Express 5 (`backend/src/app.ts`) como en Cloudflare Worker (`backend/src/worker.ts`).
- **Seguridad base sólida:** Límite de body de 16 KB, cabeceras de seguridad (`API_SECURITY_HEADERS`), rate limiter por ventana fija (`FixedWindowRateLimiter`), y script de auditoría (`scripts/security-audit.mjs`).
- **Degradación segura:** Si falla Claude o falta `ANTHROPIC_API_KEY`, el sistema mantiene disponibilidad con el motor de reglas local.

### Brechas y oportunidades detectadas
1. **Rate limit detrás de Nginx/Proxy en VPS:** En `backend/src/app.ts` / `backend/src/middleware/rateLimit.ts`, si Express corre detrás de Nginx sin `app.set('trust proxy', 1)`, todas las peticiones llegan con `req.ip === '127.0.0.1'` y un solo usuario podría agotar el `RATE_LIMIT_MAX` para todos.
2. **Historial y exportación para el usuario (`frontend/src/App.tsx`):** `App` mantiene solo el último diagnóstico en memoria (`useState`). Si el usuario recarga la página o quiere comparar dos revisiones o llevar el reporte al taller, pierde la información.
3. **Catálogo OBD-II y contexto de uso:** `backend/src/engine/obdCodes.ts` cubre códigos genéricos frecuentes, pero no distingue claramente códigos desconocidos con orientación útil ni ofrece autocompletado/sugerencias rápidas en el formulario (`VehicleForm.tsx`).
4. **Observabilidad en producción (VPS):** Falta un healthcheck enriquecido o métricas básicas (latencia del proveedor, tasa de fallback de Claude a reglas, errores 4xx/5xx) y rotación/formato estructurado de logs para PM2.
5. **Pruebas End-to-End (E2E) reales:** Existen tests unitarios y de contrato con Vitest, pero no una suite E2E con Playwright contra el build real (`frontend/dist` + Express) ni pruebas de carga sobre el rate limiter.

---

## 2. Roadmap de mejoras implementadas

### P0 — Críticas para producción en VPS

| ID | Mejora | Estado | Archivos clave | Implementación |
|---|---|---|---|---|
| **M-01** | Configurar `trust proxy` en Express cuando corre detrás de Nginx/Cloudflare | ✅ Implementado | `backend/src/app.ts`, `backend/src/config.ts`, `backend/src/server.ts` | Variable `TRUST_PROXY` (`true`/`false`) aplicada en `app.set('trust proxy', 1)` y activada en `deploy.yml`. |
| **M-02** | Endpoint `/api/health` con verificación real de uptime y modo | ✅ Implementado | `backend/src/app.ts`, `backend/src/worker.ts` | Responde `200` con `{ status: 'ok', provider, uptimeSec }` en Express y Worker. |

### P1 — Producto y Experiencia de Usuario (UX)

| ID | Mejora | Estado | Archivos clave | Implementación |
|---|---|---|---|---|
| **M-03** | Historial local de diagnósticos recientes (`localStorage`) | ✅ Implementado | `frontend/src/App.tsx`, `frontend/src/hooks/useDiagnosticHistory.ts` | Guarda los últimos 8 diagnósticos en `kmcheck:history:v1` con opción de reabrir o limpiar. |
| **M-04** | Exportar / imprimir ficha de diagnóstico para el taller | ✅ Implementado | `frontend/src/components/DiagnosticCard.tsx`, `frontend/src/App.tsx` | Botón "Imprimir / PDF" (`window.print()`) y clases `print:hidden` para imprimir solo el reporte. |
| **M-05** | Chips rápidos de códigos OBD-II frecuentes y síntomas típicos | ✅ Implementado | `frontend/src/components/VehicleForm.tsx` | Botones rápidos (`P0300`, `P0420`, `P0171`, `P0128`, `P0442`, `P0562` y síntomas comunes) sin duplicación. |

### P2 — Motor de Diagnóstico y Arquitectura

| ID | Mejora | Estado | Archivos clave | Implementación |
|---|---|---|---|---|
| **M-06** | Base de conocimiento OBD-II ampliada | ✅ Implementado | `backend/src/engine/obdCodes.ts` | Ampliada con `P0115`, `P0118`, `P0130`, `P0135`, `P0325`, `P0340`, `P0401` y `P0440` (manteniendo fallback por familia `SYSTEM_BY_PREFIX`). |
| **M-07** | Cache en memoria (TTL) para respuestas equivalentes de Claude | ✅ Implementado | `backend/src/providers/claudeProvider.ts`, `backend/src/providers/index.ts`, `backend/src/config.ts` | Caché en memoria acotada (200 entradas) con `AI_CACHE_TTL_MS` (default 5 min) y bucket de 500 km. |

### P3 — Calidad, Testing y DevOps

| ID | Mejora | Estado | Archivos clave | Implementación |
|---|---|---|---|---|
| **M-08** | Pruebas E2E HTTP reales sobre Express + RulesProvider | ✅ Implementado | `backend/test/e2e.test.ts` | Levanta servidor Express real en puerto efímero y valida `/api/health`, `/api/maintenance/check` y aislamiento de rate limit por `X-Forwarded-For`. |
| **M-09** | Hardening del workflow de despliegue en VPS | ✅ Implementado | `.github/workflows/deploy.yml`, `deploy/nginx-kmcheck.conf` | Healthcheck post-deploy contra `http://127.0.0.1:${APP_PORT}/api/health` con reintentos y falla explícita si no responde. |

---

## 3. Próximo paso sugerido
Implementar **M-01** (`trust proxy`) y **M-09** (healthcheck post-deploy) antes de abrir el VPS al público, y luego avanzar con **M-03 / M-04** (historial + imprimir PDF) para multiplicar el valor percibido por el usuario final.

