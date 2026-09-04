# Arquitectura de CuchosTool (implementacion local)

Documento vivo del codigo (docs-as-code). Linea base normativa: 04_Arquitectura_Oficial_CuchosTool_v6.docx.

## Decisiones clave (ADR)
- ADR-0001: monolitico modular Node.js 24 + TypeScript + Fastify + Drizzle + PostgreSQL (cierra spike BL-014).
- Microservicios solo con justificacion de dominio/escala/seguridad (CU-ARCH-007, BL-093): ADR futura.
- Contract-First: OpenAPI vivo (/docs) + registro de eventos versionados (/contracts).

## C4 - Nivel 1 (Contexto)
| Actor/Sistema | Relacion |
|---|---|
| Cliente E-Commerce | navega catalogo, carrito, checkout, consulta pedidos (CU-EC) |
| Emprendedor | dominio futuro F4 (CU-EM) |
| Equipo ERP (compras/inventario/RRHH/gerencia) | consolas administrativas futuras (CU-ERP) |
| Wompi | pasarela de pagos (F3) |
| Google Cloud | Cloud Run/SQL/PubSub/Storage (baseline ARQ v6; emulado localmente con Docker) |

## C4 - Nivel 2 (Contenedores, entorno local)
| Contenedor/Componente | Tech | Ruta en repo |
|---|---|---|
| apps/web | Vite + React + TS (design system IU_CT) | apps/web |
| apps/api | Fastify + Drizzle (monolito modular) | apps/api |
| PostgreSQL 16 | datos transaccionales | docker-compose.yml |
| (F3) Pub/Sub + Cloud Run | eventos y runtime GCP | infra/ (pendiente Terraform) |

## Modulos del API (monolito modular)
- auth: registro/login cliente + login interno (JWT).
- catalog: catalogo publico y fichas de producto.
- cart: carrito autenticado + checkout.
- orders: Order Service + Transactional Outbox (OrderCreated).
- admin: consola RBAC/ABAC + auditoria.
- contracts: esquemas JSON de eventos y OpenAPI versionado.

## Datos (tablas actuales)
categories, products, customers, carts, cart_items, orders, order_items, outbox_events, users, audit_logs.

## Trazabilidad
SRS v5.0 (RF/RN) -> CU (fichas) -> BL v6.0 (backlog) -> codigo (modulos) -> pruebas/CI.
