# Guia de contribucion - CuchosTool

Este repositorio implementa la politica Git del Backlog v6.0 (capitulo 9) y el DoD de la seccion 4.

## Ramas

- main: protegida. Solo integra via PR aprobado.
- develop: rama de integracion (cambios de feature convergen aqui).
- feature/<BL-o-CU>-<resumen>: por cada tarea (ej. feature/BL-030-checkout).

## Flujo de trabajo

1. Crear feature branch desde develop.
2. Commits pequenos, compatibles, reversibles y observables.
3. Mensaje de commit con trazabilidad: 'F2: ... (BL-xxx, CU-xxx-NNN)'.
4. PR hacia develop. Otro integrante revisa; nadie aprueba su propio PR.
5. CI (typecheck, tests, build, contratos, docker) en verde.
6. Nicola autoriza la integracion y el merge.

## Definition of Done (resumen)

- Requisito/CU/RN identificado y accion (CREAR/ACTUALIZAR/INTEGRAR/CONSERVAR) justificada.
- Pruebas ejecutadas y gates CI exitosos.
- Contratos OpenAPI/eventos versionados y validados (npm run validate:contracts).
- Sin secretos en git ni datos sensibles en logs.
- Migraciones versionadas y reversibles cuando aplique.
- Artefacto versionado y trazabilidad completa (BL/CU en commit).

## Convenciones de codigo (obligatorias)

- Nomenclatura 100% en espanol: variables, funciones, archivos, tablas, campos y rutas (camelCase en TS/JS, snake_case en BD).
- Capas separadas: *.servicio.ts (reglas de negocio) y *.rutas.ts (transporte HTTP); la BD solo via src/bd.
- Valores de negocio solo en src/dominio/constantes.ts (nada hardcodeado).
- Comentarios de proposito/entradas/salidas/reglas en funciones y procesos relevantes.

## Comandos utiles

- npm run lint (ESLint)
- npm run format / npm run format:check (Prettier)
- npm run typecheck (typecheck de api y web)
- npm test -w @cuchostool/api (suite de pruebas)
- npm run validate:contracts (integridad de contratos de eventos)
- npm run db:up (docker compose up -d db)
- npm run dev:api / npm run dev:web-ecommerce / npm run dev:web-erp
