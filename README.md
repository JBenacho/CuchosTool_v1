# CuchosTool.com - CuchosTool_v1

Plataforma web empresarial: E-Commerce + ERP + Core + dominios modulares (Emprendedor, SGC) sobre Google Cloud (Cloud Run, Cloud SQL PostgreSQL, Pub/Sub, API Gateway, Cloud Storage, Secret Manager) con DevOps/DevSecOps/IaC.

## Documentacion de referencia (linea base)

La documentacion del proyecto vive en la carpeta 'Documentos Consulta' (fuera del codigo migrable):

- SRS IEEE 830 v5.0, Arquitectura v6.0, Backlog maestro v6.0, Reglas de negocio v1.0 y Catalogo de casos de uso v5.0 (docx).
- Fichas de CU (HTML/PNG) en 'Casos de Uso CuchosTool'.
- Guia visual UI: IU_CT.png (design system: modo oscuro azul-noche, acentos verde #0B9F68 y naranja #D16014, tipografia Inter/Space Grotesk).

## Documentacion tecnica

- Documentos Consulta/docs/architecture.md (C4 + decisiones, mapeado al codigo).
- Documentos Consulta/docs/adr/ (decisiones registradas, ADR-0001 stack).
- scripts/setup.ps1 (bootstrap reproducible desde cero).

## Stack de desarrollo local (spike BL-014 cerrado)

Node.js 24 + TypeScript + Fastify + Drizzle ORM + PostgreSQL (Docker) + Vite/React (web).

## Estructura

    apps/api           API modular Fastify + Drizzle (modulos: autenticacion, catalogo, carrito, pedidos, administracion)
    apps/web-ecommerce Sitio publico E-Commerce (Vite + React)
    apps/web-erp       Sitio administrativo ERP (dominio independiente)
    paquetes/tokens-diseno  Design system IU_CT compartido (tokens CSS)
    contracts/        Contratos OpenAPI y esquemas de eventos versionados
    infra/            Terraform GCP (Pub/Sub + Cloud Scheduler)
    scripts/          Validacion de contratos y bootstrap
    .github/          Workflows CI/CD (GitHub Actions)
    Documentos Consulta/  Documentacion y archivos de consulta (fuera de la raiz migrable)
    docker-compose.yml  Entorno local: PostgreSQL + API

## Arranque local

1. Iniciar Docker Desktop.
2. cp .env.example .env (ajustar si hace falta).
3. npm install (en la raiz).
4. npm run db:up -> docker compose up -d db
5. npm run dev:api (http://localhost:3001/salud/estado)
6. npm run dev:web-ecommerce (http://localhost:5173)
7. npm run dev:web-erp (http://localhost:5174)

## Politica Git (Backlog v6, cap. 9)

Ver CONTRIBUTING.md (ramas, PR, DoD y convencion de commits con trazabilidad BL/CU).
main protegida; develop rama de integracion; PR revisado por otro integrante; nadie aprueba su propio PR; cambios pequenos, compatibles, reversibles y observables.

## Estado de avance

- F0 (fundacion): COMPLETADA - repo, Docker Compose (db+api), servicios base, design tokens IU_CT, CI.
- F1: COMPLETADA - contratos OpenAPI (/docs) + eventos versionados (/contracts) + RBAC/ABAC Default Deny + auditoria (BL-015/016/019/096, CU-SEC-001..015).
- F2: COMPLETADA - catalogo, identidad JWT, carrito, checkout, Order Service con idempotencia y buzon PedidoCreado (BL-027..034, CU-EC-001..017, CU-INT-001).
- Refactor de calidad: COMPLETADO - nomenclatura 100% en espanol (codigo, tablas, rutas, contratos), capas separadas, constantes de negocio, pruebas (BL-002/013).
- Sitios web: E-Commerce (apps/web-ecommerce) operativo; ERP (apps/web-erp) shell listo para F5.
- F3 (pagos y eventos): EN CURSO - Pagos Wompi (iniciar/simular/consultar), confirmacion idempotente, pedido -> pagado, publicador del buzon con topicos y DLQ operable (BL-035/036/091/101, CU-EC-010, CU-INT-002).
- F4 (Emprendedor + SGC + checkout UI): EN CURSO - Enrolamiento/activacion de emprendedores, productos con aval, casos SGC con transiciones y mensajes, y UI de checkout en el E-Commerce (BL-039..068 base, CU-EM-001..012, CU-SGC-002..009, CU-EC-007/008).
- Pruebas: suite Vitest (13 tests) ejecutandose en CI.
