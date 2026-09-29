# Retomar — Firebase producción (aurora-postura-app)

> Guardado el 20 ago 2026. La app ya está en modo **Firebase real** (no emulador).
> Proyecto: `aurora-postura-app` · `.env.local` con `VITE_FIREBASE_USE_EMULATORS=false`

---

## Al abrir el proyecto

```powershell
cd C:\Users\user\Desktop\AURORA
npm install
npm run firebase:prep    # opcional — valida .env.local antes de dev
npm run dev
```

Abrir: **http://127.0.0.1:5173/** (o el puerto que indique Vite)

Debes ver en la barra superior: **`Firebase · aurora-postura-app`**

---

## Checklist si es la primera vez en esta máquina

### 1. Firebase Console (una vez)
- [Auth](https://console.firebase.google.com/project/aurora-postura-app/authentication/providers) → **Email/Password** activado
- Auth → Settings → **Authorized domains** → `127.0.0.1` y `localhost`

### 2. Activar Storage (una vez — requerido para videos)
https://console.firebase.google.com/project/aurora-postura-app/storage → **Get Started**

Luego:
```powershell
firebase deploy --only storage
```

### 3. Reglas Firestore ✅ (ya desplegadas)
```powershell
firebase deploy --only firestore:rules
```

### 4. Service account + usuarios (SEC-009-012)

1. Firebase Console → ⚙ **Project settings** → **Service accounts** → **Generate new private key**
2. Guardar **fuera del clone**, p. ej. `%USERPROFILE%\.firebase-credentials\firebase-sa.json`  
   **No** uses `AURORA/secrets/`, ZIP/RAR del repo, ni artifacts de release.
3. PowerShell:
```powershell
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.firebase-credentials" | Out-Null
# (mueve el JSON descargado a esa carpeta — nunca bajo AURORA/)
$env:GOOGLE_APPLICATION_CREDENTIALS="$env:USERPROFILE\.firebase-credentials\firebase-sa.json"
npm run firebase:prep
npm run firebase:provision
```

`firebase:prep` **falla** si:

- existe un SA bajo el clone (`secrets/firebase-sa.json`, `.firebase-service-account.json`), o
- `GOOGLE_APPLICATION_CREDENTIALS` apunta a un path **dentro** del repositorio.

**Phase 4.1:** credential operativa en `%USERPROFILE%\.firebase-credentials\`; copia in-repo eliminada.

Tras provisionar/cambiar claims: **cerrar sesión y volver a entrar** (o forzar refresh del ID token). Los tokens antiguos pueden seguir con claims viejos.

| Email | Rol | Contraseña demo |
|-------|-----|-----------------|
| `manager@postura.internal` | ADMIN (`organizationId` explícito del seed) | `Postura2026!` |
| `juan.vasquez@lexfirm.com` | CLIENT + `clientId` | `Postura2026!` |
| `elena.martinez@lexfirm.com` | CLIENT + `clientId` | `Postura2026!` |

Claims (**fail-closed**, sin tenant por defecto):

| Role | `organizationId` | `clientId` |
|------|------------------|------------|
| ADMIN | **required** | always `null` |
| CLIENT | **required** | **required** |
| invalid / missing | provision / `setPosturaClaims` **rejects** | — |


### 4. Probar
1. Login **manager** → si Firestore vacío, bootstrap automático del seed Juan
2. Login **Juan** (otra ventana/incógnito) → solo sus datos
3. Editar `localStorage` en DevTools → **no** debe cambiar lo que ves tras recargar

---

## Comportamiento actual (código)

- **Firestore = fuente de verdad** (no localStorage cuando Firebase activo)
- **Login solo Firebase** (sin fallback local)
- **Videos** → Firebase Storage si hay config; si no, IndexedDB
- **Primer ADMIN** en Firestore vacío → sube seed demo automáticamente

---

## Comandos útiles

| Comando | Para qué |
|---------|----------|
| `npm run firebase:prep` | Validar .env.local + SA **externa** al clone |
| `npm run secret:scan` | Escaneo sanitizado (gitleaks si hay; inventory local) |
| `npm run dev` | Desarrollo local contra Firebase nube |
| `npm run check` | Tests + lint + types |
| `npm run firebase:provision` | Crear/actualizar usuarios + claims |
| `npm run firebase:deploy:rules` | Reglas Firestore + Storage |
| `npm run firebase:deploy:hosting` | Build + deploy web |
| `npm run firebase:deploy:functions` | RSS/Tavily proxy + ingesta programada |
| `npm run emulators` | Solo si quieres volver a emulador local |

---

## Si algo falla

| Error | Solución |
|-------|----------|
| Sin permisos POSTURA (custom claims) | `npm run firebase:provision` + **re-login** |
| Credenciales inválidas / sin organizationId | Claims fail-closed — reprovision con org explícita; re-login |
| Permiso denegado Firestore | `npm run firebase:deploy:rules` |
| `Failed to resolve firebase/...` | `npm install` |
| Badge no aparece | Revisar `.env.local` y reiniciar `npm run dev` |

---

## Credenciales demo (local / provision)

- Manager: `manager@postura.internal` / `Postura2026!`
- Cliente Juan: `juan.vasquez@lexfirm.com` / `Postura2026!`
- Cliente Elena: `elena.martinez@lexfirm.com` / `Postura2026!`

---

## Ingesta programada (Cloud Functions)

> **Bloqueo actual:** Cloud Functions + Secret Manager requieren plan **Blaze**.
> Hasta actualizar: https://console.firebase.google.com/project/aurora-postura-app/usage/details
> Mientras tanto el radar usa el proxy local de Vite (`npm run dev`) con keys en `.env.local`.
> Los índices Firestore ya están desplegados.

### Secretos (obligatorio, una vez — tras Blaze)

Ejecuta **tú** estos comandos en PowerShell (el agente no puede subir API keys solo):

```powershell
cd C:\Users\user\Desktop\AURORA

# Pega la key cuando Firebase lo pida (o usa --data-file=ruta_a_archivo_con_la_key)
firebase functions:secrets:set TAVILY_API_KEY
firebase functions:secrets:set YOUTUBE_API_KEY
```

Si ya tienes las keys en `.env.local`:

```powershell
# Tavily (solo si está definida)
($m = Select-String -Path .env.local -Pattern '^TAVILY_API_KEY=(.+)$'); if ($m) { $m.Matches[0].Groups[1].Value | firebase functions:secrets:set TAVILY_API_KEY }

# YouTube
($m = Select-String -Path .env.local -Pattern '^YOUTUBE_API_KEY=(.+)$'); if ($m) { $m.Matches[0].Groups[1].Value | firebase functions:secrets:set YOUTUBE_API_KEY }
```

### Build + deploy

```powershell
cd C:\Users\user\Desktop\AURORA\functions
npm install
cd ..
npm run firebase:deploy:functions
firebase deploy --only firestore:indexes
```

### Frontend producción

En el build de hosting, define:

```text
VITE_POSTURA_FUNCTIONS_BASE=https://us-central1-aurora-postura-app.cloudfunctions.net
```

### Funciones desplegadas

| Función | Rol |
|---------|-----|
| `rssProxy` | Proxy RSS con SSRF — **Bearer + ADMIN** |
| `tavilySearch` | Descubrimiento web — **Bearer + ADMIN** |
| `youtubeApi` | YouTube Data API — **Bearer + ADMIN** |
| `aiComplete` | IA cloud (stub) — **Bearer + ADMIN** |
| `ingestSourcesScheduled` | Ingesta cada 15 min |
| `ingestSourcesManual` | Disparo ADMIN (callable) |

**Auth en proxies:** el frontend envía `Authorization: Bearer <Firebase ID token>` cuando `VITE_POSTURA_FUNCTIONS_BASE` está definido. Solo cuentas con custom claims `role=ADMIN`. CORS limitado a localhost + `*.web.app` / `*.firebaseapp.com`. Orígenes extra: env `POSTURA_ALLOWED_ORIGINS` (comma-separated) en la función.

Los clientes reciben señales nuevas vía listeners Firestore al tener sesión abierta.

---

## Custom claims, token refresh y gates Spec (SPEC-009)

### Required claims

- **ADMIN:** `role=ADMIN`, `organizationId` (string no vacío), `clientId=null`
- **CLIENT:** `role=CLIENT`, `organizationId`, `clientId` (ambos required)
- Missing org / missing CLIENT `clientId` / invalid role → **fail closed** (no `org_aurora_01` default)

Provision: `npm run firebase:provision`  
Callable: `setPosturaClaims` (ADMIN caller only) — same validation.

### After changing claims

Existing ID tokens may still carry **old** claims until:

1. User **signs out and signs in again**, or
2. Client forces ID token refresh (`getIdToken(true)` / equivalent)

Do this for all demo users (manager, Juan, Elena) after reprovision (**T-009-17** in migration window — not Phase 4 execution).

### CODE_COMPLETE vs DEPLOYED

| Gate | Meaning |
|------|---------|
| **CODE_COMPLETE** | Repo rules + callers + tests green **after** final envelope switch (**T-009-14e**) |
| **DEPLOYED** | Production `firebase deploy` of already-finalized rules (+ Storage if Console allows) after backfill verify |
| **DONE** | Acceptance Required PASS + DEPLOYED (or documented PARTIAL) |

Phase 4 does **not** deploy rules or reprovision production beyond local prep scripts.

### Migration order (see `specs/009-security-hardening/migration.md`)

```text
code (Phases 1–4) → T-009-14e final envelope rules → tests → CODE_COMPLETE
→ backup → dry-run → envelope backfill → claims reprovision → token refresh/re-login
→ rules deploy → post-deploy verification
```

Rollback: redeploy previous rules from known git tag; re-login users; restore Firestore export only as last resort.

### Secret scanning

```powershell
npm run secret:scan
```

Optionally install [gitleaks](https://github.com/gitleaks/gitleaks) on PATH for deeper history scans.  
If a **valid** SA private key was committed, pushed, or shipped in an archive → **ROTATION REQUIRED** before Spec DONE (do not rotate automatically without authorization).

---

## Plan general

Oleadas **0–7** + radar (triage, clusters, feedback, gate por canal) en código.
Siguiente hito operativo: **secretos + deploy functions** (arriba) y recorrido piloto Juan.
