# KmCheck — Diagnóstico y mantenimiento vehicular

Aplicación web que recibe los datos de un vehículo (marca, modelo, año, kilometraje, síntomas y códigos OBD-II)
y devuelve un diagnóstico estructurado con alertas por urgencia (🔴 urgente, 🟡 pronto, 🟢 OK) y servicios recomendados.

- **Frontend:** React 19 + Vite + Tailwind CSS v4.
- **Backend:** Express 5 (desarrollo local) y Cloudflare Worker con Hono (producción). Los dos comparten el mismo núcleo.
- **Motor de diagnóstico:** reglas locales (sin IA, por defecto) o Claude (`claude-opus-5-5`) con salida estructurada.
- **Contrato de datos:** schemas Zod en `shared/`, usados por el frontend y el backend.

## Requisitos

- Node.js 20.19 o superior.
- npm 10 o superior.

## Instalación

```powershell
npm install
Copy-Item backend\.env.example backend\.env   # Linux/macOS: cp backend/.env.example backend/.env
```

> **Importante (Windows):** ejecuta **un solo** `npm install` a la vez y cierra `npm run dev` antes de instalar.
> Dos instalaciones simultáneas pueden dejar sin sus binarios nativos a `esbuild`, `lightningcss` o `rolldown`
> (errores *"Cannot find native binding"* o *"Cannot find module ...win32-x64-msvc.node"*).
> Solución: borra `node_modules` y `package-lock.json` y vuelve a ejecutar `npm install`, una sola vez.

## Uso diario

| Comando | Qué hace |
|---|---|
| `npm run dev` | Express en http://localhost:5000 + React en **http://localhost:3000** (Vite hace proxy de `/api`) |
| `npm run test` | Tests de shared, backend y frontend (Vitest) |
| `npm run lint` | ESLint + typecheck de los tres paquetes |
| `npm run build` | Build de producción del frontend (`frontend/dist`) |
| `npm run audit:security` | Comprueba que el frontend no acceda a la IA ni exponga secretos |
| `npm run verify` | Todo lo anterior: lint, tests, build y auditoría |

## Activar Claude (opcional)

Por defecto se usa el motor de reglas, que no necesita API key. Para usar Claude:

```ini
# backend/.env
AI_PROVIDER=claude
ANTHROPIC_API_KEY=sk-ant-...
# AI_MODEL=claude-opus-5-5   (por defecto)
```

Claude recibe el pre-diagnóstico del motor de reglas como contexto y responde con un JSON validado contra el schema.
Si falta la key, el servidor avisa en el log y sigue funcionando con el motor de reglas.

## API

`POST /api/maintenance/check`

```json
{ "make": "Chevrolet", "model": "Spark", "year": 2018, "mileageKm": 60000, "obdCodes": ["P0300"], "symptoms": "tironea" }
```

| Código | Cuándo |
|---|---|
| 200 | Diagnóstico generado (cumple `DiagnosticResponseSchema`) |
| 400 | Datos inválidos: no se llama al motor ni se consumen tokens |
| 413 | Cuerpo de más de 16 KB |
| 429 | Más de `RATE_LIMIT_MAX` solicitudes por minuto desde la misma IP |
| 503 | El motor o la IA fallaron o excedieron `AI_TIMEOUT_MS`. Mensaje genérico; el detalle va al log, sin secretos |

`GET /api/health` → `{ "status": "ok", "provider": "rules-engine" | "claude" }`

## Despliegue en Cloudflare

Un solo Worker sirve el build de React como *static assets* y atiende `/api/*`: mismo dominio y sin CORS.

```powershell
npx wrangler login                              # una vez
npx wrangler secret put ANTHROPIC_API_KEY       # solo si usarás Claude (y cambia AI_PROVIDER en wrangler.jsonc)
npm run cf:check                                # valida el bundle sin desplegar
npm run cf:dev                                  # prueba local con el runtime de Cloudflare (http://localhost:8787)
npm run deploy                                  # verify + wrangler deploy
```

La configuración está en `wrangler.jsonc`. **Nunca** pongas la API key en `vars`: usa `wrangler secret put`.

## Despliegue con Docker (local o VPS)

El proyecto incluye `docker-compose.yml` con dos servicios:
- **`backend`**: Node 22 + Express (`deploy/Dockerfile.backend`), escuchando en el puerto interno `5050` (expuesto en `127.0.0.1:5050` para healthchecks).
- **`web`**: build multi-stage de React servido por Nginx (`deploy/Dockerfile.web` + `deploy/nginx-docker.conf`) en el puerto `80`, con proxy de `/api/` hacia `backend:5050`.

### Ejecución manual con Docker

```bash
cp backend/.env.example backend/.env   # ajusta PORT=5050, TRUST_PROXY=true y AI_PROVIDER si usas Claude
docker compose up -d --build
```

La aplicación queda disponible en `http://localhost` (puerto `80`, personalizable con `WEB_PORT=8080 docker compose up -d --build`).

### Despliegue automático en VPS (GitHub Actions)

El workflow `.github/workflows/deploy.yml` sincroniza el código por `rsync` y levanta los contenedores con `docker compose up -d --build --remove-orphans`.

**Requisitos en el VPS:** únicamente **Docker** y **Docker Compose** (`docker compose version`) instalados, más `curl` para el healthcheck post-deploy. No hace falta instalar Node.js ni PM2 en el servidor.

**Secrets en GitHub (`Settings > Secrets and variables > Actions > Secrets`):**
- `VPS_HOST`: IP o dominio del VPS.
- `VPS_USER`: usuario SSH (ej. `root`).
- `VPS_SSH_KEY`: llave privada SSH completa (sin passphrase), cuya llave pública debe estar en `~/.ssh/authorized_keys` del VPS.
- `VPS_PORT`: *(opcional)* puerto SSH (por defecto `22`).
- `ANTHROPIC_API_KEY`: *(opcional)* solo si usas `AI_PROVIDER=claude`.

**Variables en GitHub (`Settings > Secrets and variables > Actions > Variables`):**
- `VPS_DEPLOY_PATH`: *(opcional)* ruta destino en el VPS (por defecto `/var/www/kmcheck`).
- `WEB_PORT`: *(opcional)* puerto público de Nginx (por defecto `80`).
- `APP_PORT`: *(opcional)* puerto local en `127.0.0.1` para el healthcheck del backend (por defecto `5050`).
- `CORS_ORIGIN`: *(opcional)* origen permitido (por defecto `http://<VPS_HOST>`).
- `AI_PROVIDER` / `AI_MODEL`: *(opcional)* por defecto `rules`.

## Estructura

```
shared/      Contrato Zod (request/response) compartido
backend/
  src/core/        Núcleo HTTP agnóstico: validación, timeout, 503, rate limit, cabeceras
  src/engine/      Motor de reglas: plan de mantenimiento, base OBD-II, síntomas
  src/providers/   Proveedores: rules | claude
  src/app.ts       Adaptador Express (local)
  src/worker.ts    Adaptador Cloudflare Worker (producción)
  test/            Tests de contrato (se corren contra Express y contra el Worker), motor y Claude simulado
frontend/    React: VehicleForm, DiagnosticCard, servicio de red
scripts/     security-audit.mjs
.claude/     Subagente tester, skill /security-audit y hook post-edit para Claude Code
```

## Desarrollo con Claude Code

- `CLAUDE.md`: reglas del proyecto que el agente debe seguir.
- Subagente **`tester`**: corre la verificación completa sin modificar código.
- Skill **`/security-audit`**: auditoría antes de un commit o despliegue.
- Hook **post-edit**: tras cada edición de Claude, corre ESLint sobre el archivo editado y el typecheck de su paquete.
  La suite completa la corre el subagente `tester`, porque correrla en cada edición sería demasiado lento.
