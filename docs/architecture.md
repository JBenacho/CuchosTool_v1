# Arquitectura de CuchosTool (implementacion local)

Documento vivo del codigo (docs-as-code). Linea base normativa: 04_Arquitectura_Oficial_CuchosTool_v6.docx.

## Decisiones clave (ADR)
- ADR-0001: monolitico modular Node.js 24 + TypeScript + Fastify + Drizzle + PostgreSQL (cierra spike BL-014).
- Microservicios solo con justificacion de dominio/escala/seguridad (CU-ARCH-007, BL-093): ADR futura.
- Contract-First: OpenAPI vivo (/docs) + registro de eventos versionados (/contracts).
- Nomenclatura: todo el codigo, tablas, campos y rutas en espanol (regla obligatoria del proyecto).
- Canales: E-Commerce y ERP son sitios web independientes en dominios separados (apps/web-ecommerce y apps/web-erp), compartiendo el design system IU_CT.

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
| apps/web-ecommerce | Vite + React + TS (design system IU_CT) | apps/web (renombra a web-ecommerce) |
| apps/web-erp | Vite + React + TS (pendiente, fase F5) | apps/web-erp |
| apps/api | Fastify + Drizzle (monolito modular) | apps/api |
| PostgreSQL 16 | datos transaccionales | docker-compose.yml |
| (F3) Pub/Sub + Cloud Run | eventos y runtime GCP | infra/ (pendiente Terraform) |

## Modulos del API (monolito modular, rutas en espanol)
- autenticacion (/autenticacion/*): registro/login cliente + login interno (JWT).
- catalogo (/catalogo/*): catalogo publico y fichas de producto.
- carrito (/carrito/*): carrito autenticado + pago.
- pedidos (/pedidos/*, /buzon/*): Order Service + buzon transaccional (PedidoCreado).
- administracion (/administracion/*): consola RBAC/ABAC + auditoria.
- salud (/salud/*): health checks.

## Datos (tablas actuales)
categorias, productos, clientes, carritos, carrito_articulos, pedidos, pedido_articulos, eventos_buzon, usuarios, auditoria_registros.

## Trazabilidad
SRS v5.0 (RF/RN) -> CU (fichas) -> BL v6.0 (backlog) -> codigo (modulos) -> pruebas/CI.
