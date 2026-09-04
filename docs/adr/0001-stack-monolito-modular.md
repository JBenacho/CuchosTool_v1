# ADR-0001: Stack de desarrollo y monolitico modular

- Estado: Aceptado (cierra spike BL-014).
- Fecha: 2026-09-04.
- Decisores: Nicola (PM/arquitecto).

## Contexto

El Backlog v6.0 dejo el runtime contractual como propuesta a validar (TBD-02). Se necesita un stack reproducible en el entorno local (VS Code + GitHub + Docker) que sea compatible con la baseline de Google Cloud (Cloud Run, Cloud SQL PostgreSQL) y permita un ciclo rapido de E-Commerce + Core.

## Decision

- Monolito modular en Node.js 24 + TypeScript.
- Framework HTTP: Fastify (rendimiento + esquemas JSON + OpenAPI nativo via @fastify/swagger).
- ORM: Drizzle (type-safe, migraciones versionadas, compatible PostgreSQL).
- Base de datos: PostgreSQL 16 (Cloud SQL parity local).
- Frontend: Vite + React + TS con design system IU_CT (tokens CSS).
- Auth: JWT (@fastify/jwt) + bcryptjs; RBAC/ABAC con Default Deny.

## Consecuencias

- Positivas: un solo artefacto desplegable en Cloud Run; trazabilidad simple; migraciones reproducibles.
- Riesgos/limitaciones: acoplamiento de modulos a vigilar; la separacion en microservicios se evaluara con ADR posterior solo con justificacion (CU-ARCH-007 / BL-093).
