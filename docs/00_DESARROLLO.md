# Plan de Desarrollo - CuchosTool (F0+)

Implementacion local (VS Code + GitHub + Docker) por fases del Backlog v6.0.
Trazabilidad de cada tarea con su ID de backlog (BL-xxx).

## Fase F0 - Fundacion (en curso)
| Backlog | Tarea | Estado |
|---|---|---|
| BL-002 | Repositorio git, ramas main/develop, proteccion | En curso |
| BL-003 | Entornos locales reproducibles (Docker Compose) | En curso |
| BL-004 | Build reproducible y artefacto versionado (Dockerfile) | En curso |
| BL-005 | CI con lint/typecheck/build (GitHub Actions) | En curso |
| BL-013 | Politica de PR y revision cruzada | Documentada (README) |
| BL-014 | Cierre spike runtime contractual (Node+TS+Fastify+Drizzle) | Decidido |
| RN-GOB-011 / ARQ v6 | Design tokens IU_CT y patrones UI | Documentado (docs/design) |

## Fase F1 - Modelo, seguridad y contratos (en curso)
| Backlog | Tarea | Estado |
|---|---|---|
| BL-015 | Contratos OpenAPI criticos | Hecho: OpenAPI vivo en /docs y /docs/json; instantanea contracts/openapi.generated.json |
| BL-016 | Esquemas JSON de eventos criticos | Parcial: OrderCreated, OrderPaid, InventoryUpdated (contracts/events) |
| BL-096 | Catalogo de APIs/eventos versionado | Hecho: contracts/README.md (registro) |
| BL-019 | RBAC + ABAC + Default Deny | Pendiente |

## Fase F2 - Catalogo publico (en curso)
| Backlog | Tarea | Estado |
|---|---|---|
| BL-027 | Conservar catalogo publico y busqueda sin autenticacion | Hecho (GET /catalog/products, q=) |
| BL-028 | Ficha de producto y disponibilidad desde Inventory | Parcial (GET /catalog/products/:id; stock como entero) |
| CU-EC-001..006 | Esquema categories/products + migraciones Drizzle + seed | Hecho |
| BL-030 / CU-EC-008 | POST /orders (transaccion ACID, idempotencia, validacion stock) | Hecho |
| BL-033 / CU-INT-001 | Outbox OrderCreated (evento transaccional versionado) | Hecho |
| CU-EC-009 | GET /orders/:orderRef (pedido propio) | Hecho |
| BL-029 / CU-EC-007 | Carrito: GET/POST/PATCH/DELETE + checkout que vacia carrito | Hecho (cliente por X-Customer-Id provisional) |

## Proximas fases
- F1: modelo/seguridad/contratos (RBAC/ABAC base, OpenAPI, eventos) - BL-015..026.
- F2: ciclo critico E-Commerce (catalogo, carrito, checkout, Order) - BL-027..034.
- F3: integraciones (Wompi, logistica, eventos, release) - BL-035..038 y 076..078.
- F4: Emprendedor y SGC - BL-039..068.

## Como verificar un incremento (DoD Backlog v6)
1. npm run typecheck y npm run build sin errores.
2. docker compose up -d --build levanta db + api; /healthz y /readyz OK.
3. PR revisado por otro integrante (nadie aprueba su propio PR).
4. Commit pequeno con referencia a CU/BL en el mensaje.
5. Sin secretos en git (usar .env local).
