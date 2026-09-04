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

    apps/api       API modular Fastify + Drizzle (futuros modulos: core, erp, emprendedor, sgc)
    apps/web       UI web (Vite + React) con design tokens IU_CT
    docs/          Planes, trazabilidad y decisiones (docs-as-code)
    .github/       Workflows CI/CD (GitHub Actions)
    docker-compose.yml  Entorno local: PostgreSQL + API

## Arranque local

1. Iniciar Docker Desktop.
2. cp .env.example .env (ajustar si hace falta).
3. npm install (en la raiz).
4. npm run db:up  ->  docker compose up -d db
5. npm run dev:api  (http://localhost:3001/healthz)
6. npm run dev:web  (http://localhost:5173)

## Politica Git (Backlog v6, cap. 9)
Ver CONTRIBUTING.md (ramas, PR, DoD y convencion de commits con trazabilidad BL/CU).
main protegida; develop rama de integracion; PR revisado por otro integrante; nadie aprueba su propio PR; cambios pequenos, compatibles, reversibles y observables.

## Estado de avance
- F0 (fundacion): COMPLETADA - repo, Docker Compose (db+api), servicios base, design tokens IU_CT, CI.
- F2 (catalogo publico): EN CURSO - esquema Postgres + migraciones Drizzle + API /catalog/products + UI conectada (BL-027/028).
- F1 (contratos): EN CURSO - OpenAPI vivo (/docs, /docs/json) + registro de contratos de eventos en /contracts (BL-015/016/096). Pendiente: RBAC/ABAC base y JSON Schema del resto de eventos.
- F2 (orders, carrito e identidad): EN CURSO - Identidad cliente (register/login + JWT), carrito y checkout autenticados -> Order Service con idempotencia y Outbox OrderCreated (BL-029/030/032/033, CU-EC-007/008/009/013/014, CU-INT-001).
- F1 (RBAC/ABAC + Default Deny): EN CURSO - login interno, consola /admin (clientes, pedidos, auditoria) con roles ADMIN/ZONAL_MANAGER/AUDITOR y registro de auditoria (BL-019, CU-SEC-001..015).
- Pruebas: suite Vitest (5 tests: salud, contrato OpenAPI, totales) ejecutandose en CI.
