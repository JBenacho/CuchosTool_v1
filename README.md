# CuchosTool.com - CuchosTool_v1

Plataforma web empresarial: E-Commerce + ERP + Core + dominios modulares (Emprendedor, SGC) sobre Google Cloud (Cloud Run, Cloud SQL PostgreSQL, Pub/Sub, API Gateway, Cloud Storage, Secret Manager) con DevOps/DevSecOps/IaC.

## Documentacion de referencia (linea base)

- SRS IEEE 830 v5.0: 03_SRS_CuchosTool_IEEE830_DevOps_GoogleCloud_v5.docx
- Arquitectura v6.0: 04_Arquitectura_Oficial_CuchosTool_v6.docx
- Backlog maestro v6.0: 05_Backlog_CuchosTool_v6.docx
- Reglas de negocio v1.0: 06_CuchosTool_Catalogo_Reglas_Negocio_v1.docx
- Catalogo de casos de uso v5.0: 02_Catalogo_Maestro_Casos_Uso_CuchosTool_v5.docx
- Fichas de CU (HTML/PNG): Carpeta 'Casos de Uso CuchosTool'
- Guia visual UI: IU_CT.png (design system: modo oscuro azul-noche, acentos verde #0B9F68 y naranja #D16014, tipografia Inter/Space Grotesk)

## Documentacion tecnica

- docs/architecture.md (C4 + decisiones, mapeado al codigo).
- docs/adr/ (decisiones registradas, ADR-0001 stack).
- scripts/setup.ps1 (bootstrap reproducible desde cero).

## Stack de desarrollo local (spike BL-014 cerrado)

Node.js 24 + TypeScript + Fastify + Drizzle ORM + PostgreSQL (Docker) + Vite/React (web).

## Estructura

    apps/api           API modular Fastify + Drizzle (modulos: autenticacion, catalogo, carrito, pedidos, administracion)
    apps/web-ecommerce Sitio publico E-Commerce (Vite + React)
    apps/web-erp       Sitio administrativo ERP (dominio independiente)
    paquetes/tokens-diseno  Design system IU_CT compartido (tokens CSS)
    contracts/        Contratos OpenAPI y esquemas de eventos versionados
    docs/             Planes, trazabilidad y decisiones (docs-as-code)
    .github/       Workflows CI/CD (GitHub Actions)
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
- Pruebas: suite Vitest (7 tests: salud, contrato OpenAPI, totales, topicos) ejecutandose en CI.
