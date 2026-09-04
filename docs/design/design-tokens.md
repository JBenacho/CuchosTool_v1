# Design System CuchosTool - derivado de IU_CT.png

## Fuente primaria

- IU_CT.png (raiz del repositorio). Analisis de pixeles realizado por NICOLA:
  - Dimensiones 1318x794.
  - Fondo principal azul-noche oscuro (esquinas ~#020618..#0E1629..#192033).
  - Acentos: verde/teal #0B9F68 y naranja/cobre #D16014; blanco #FCFCFC.
  - Paneles elevados azul-pizarra (#203040..#304060).

## Decisiones aprobadas por el equipo

- Tema: UI principal oscura azul-noche con acentos verde #0B9F68 y naranja #D16014.
- Tipografia: Inter (UI) + Space Grotesk (titulos), cargadas desde Google Fonts.
- Patrones: dashboard con tarjetas KPI/graficas, storefront publico (catalogo/fichas/carrito), paneles y bandejas operativas con tablas densas, sidebar/header oscuro con contenido claro, y modo oscuro global.

## Tokens implementados

Ver apps/web/src/styles/tokens.css (CSS custom properties):

- Fondo: --ct-bg-0..4 y escala navy --ct-navy-500..900.
- Texto: --ct-text(-strong/-muted/-faint).
- Acentos: --ct-accent (verde), --ct-warm (naranja), danger/info/gold.
- Tipografia: --ct-font-sans (Inter) y --ct-font-display (Space Grotesk).
- Escala: spacing base 4px, radios, sombras, altura header 64px, sidebar 248px.

## Trazabilidad

- CU-GE-001..009 (dashboard gerencial), CU-EC-001..017 (storefront),
- CU-SGC-023/026 y bandejas operativas, CU-SEC-* (consola de acceso/auditoria).
  Estado: v0.1 - F0.
