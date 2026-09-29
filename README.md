# POSTURA

**Positioning Intelligence** — sistema de operación para Brand Managers y clientes: radar de señales, curación, briefings, contenido y portal.

Producto piloto (Juan / LexFirm). Código en TypeScript (Vite), persistencia local + Firebase Auth/Firestore, Cloud Functions para ingesta en producción.

## Arranque

```bash
npm install
cp .env.example .env.local   # opcional: Firebase, Tavily, YouTube
npm run dev
```

Abre [http://127.0.0.1:5173/](http://127.0.0.1:5173/).

Cuentas de piloto: ver [docs/ops/pilot.md](docs/ops/pilot.md).

## Calidad

```bash
npm run check    # typecheck + lint + tests
npm run build
```

CI: `.github/workflows/ci.yml`  
GitHub Pages: `.github/workflows/pages.yml` (ingesta RSS **no** corre en Pages; usar `npm run dev` o Functions).

## Estructura

| Ruta | Rol |
|------|-----|
| `src/` | Aplicación (UI, dominio, servicios) |
| `server/` | Proxy Vite: RSS, Tavily, YouTube, IA (solo `npm run dev`) |
| `functions/` | Cloud Functions (auth + secretos; requiere plan Blaze para deploy) |
| `tests/` | Vitest |
| `scripts/` | Provision Firebase, checklists de piloto |
| `docs/` | Operación, producto y especificaciones |

Detalle: [docs/README.md](docs/README.md) · [docs/architecture.md](docs/architecture.md)

## Despliegue

| Destino | Uso |
|---------|-----|
| Local Vite | Desarrollo y radar (proxy `/api/*`) |
| [GitHub Pages](https://madarchy.github.io/aurora/) | Demo estática; **sin** proxy de fuentes |
| Firebase Hosting | Sitio de producto (`npm run firebase:deploy:hosting`) |

Firebase Auth, reglas e ingesta cloud: [docs/ops/firebase.md](docs/ops/firebase.md).

## Licencia

Repositorio privado de producto. Todos los derechos reservados salvo acuerdo contrario.
