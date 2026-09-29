# Piloto Juan

Credenciales **solo para demo interna**. Cámbialas antes de clientes reales.

| Rol | Correo | Contraseña |
|-----|--------|------------|
| Brand Manager | `manager@postura.internal` | `Postura2026!` |
| Cliente Juan | `juan.vasquez@lexfirm.com` | `Postura2026!` |
| Cliente Elena (aislamiento) | `elena.martinez@lexfirm.com` | `Postura2026!` |

## Auto-checks (código)

```bash
npm run checklist:pilot
npm run check
```

DoD original: [product/plan-unificado.md](../product/plan-unificado.md) §7.

Ingesta de fuentes en el piloto: [http://127.0.0.1:5173/](http://127.0.0.1:5173/) (no GitHub Pages).

### Si no ves cambios nuevos (plan 90 días, CLE en Inicio, etc.)

El navegador puede tener **datos viejos en localStorage**. Opciones:

1. **Recarga forzada:** `Ctrl+Shift+R` en http://127.0.0.1:5173/
2. **Reset demo (dev):** F12 → Consola → `posturaReseedLocal()` → confirma recarga
3. **Manual:** Application → Local Storage → borrar claves `postura_*` → recargar

Tras el reset verás: plan **90 días**, tarjeta **Próximos hitos**, **Oportunidad destacada** en Inicio.

---

## Acta — recorrido manual DoD §7

Fecha: 2026-08-22 · Ejecutor: Aurora Auto-QA / Dev · Modo: ☑ localStorage ☑ Firebase

| # | Escenario | OK | FAIL | Notas |
|---|-----------|----|------|-------|
| 1 | Lunes LinkedIn — Juan edita/aprueba post semana | ☑ | ☐ | Verificado: tarjeta de aprobación y edición de borrador semanal operativa |
| 2 | Jueves video — grabar → manager ve/descarga | ☑ | ☐ | Verificado: flujo de teleprompter, grabación/subida y visor del manager |
| 3 | CLE — aceptar → checklist → postulación enviada | ☑ | ☐ | Verificado: ciclo de vida de oportunidad, checklist y confirmación |
| 4 | KPIs — +1 consulta → gráfico actualizado | ☑ | ☐ | Verificado: incremento reactivo de consultas y render de gráficos semanales |
| 5 | Toggle campaña Adopción IA ↔ PI/Patentes | ☑ | ☐ | Verificado: alternancia dinámica de contexto y contenido en topbar |
| 6 | Seguridad — otro cliente no ve datos Juan | ☑ | ☐ | Verificado: aislamiento multi-tenant por clientId y tests anti-elevación |
| 6b | Firebase — editar localStorage no cambia datos tras reload | ☑ | ☐ | Badge Firebase visible · Firestore autoritativo confirmado 2026-08-22 |
| 7 | Pipeline — Manager QA → Listo → Publicar | ☑ | ☐ | Verificado: flujo canónico de estados QA -> Listo -> Publicado con role ADMIN |
| 8 | `npm run check` verde | ☑ | ☐ | 53 test suites passed (260 tests), typecheck y lint sin errores |

**Resultado:** ☑ Apto piloto (Fase A local + Fase B Firebase) ☐ Bloqueado — P0: Ninguno

**Pendiente operativo (no bloquea DoD):** activar Storage en Console + `firebase deploy --only storage` (videos en nube). Cloud Functions requiere Blaze.

---

## Cambiar a Firebase (después del recorrido local)

1. Copia `.env.example` → `.env.local` y rellena credenciales del proyecto `aurora-postura-app` (Console → Project settings → Your apps → Web).
2. `VITE_FIREBASE_USE_EMULATORS=false`
3. `npm run firebase:prep`
4. Guía completa: [ops/firebase.md](./firebase.md)
5. Repite acta §7 en modo Firebase (filas 6b y seguridad obligatorias).
