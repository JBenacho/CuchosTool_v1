# INFORME DE REVISIÓN DOCUMENTAL — CASOS DE USO y BACKLOG

**Proyecto:** CuchosTool.com | **Revisado por:** NICOLA | **Alcance:** Backlog v6, 182 fichas de CU, SRS v5, Arquitectura v6, Reglas de Negocio v1, catálogo CU v5 y matriz XLSX.

## 1. INVENTARIO

- Catálogo Maestro CU v5 (01/09/2026): 186 registros = 182 CU activos + 4 históricos (CU-UI-001..004).
- 182 fichas HTML en 9 dominios: EC 17 | ERP/INV 19 | RH/CM 14 | LG/FC/CT 16 | GE/SEC/DEV 34 | ARCH/INT/OBS/DATA 25 | GCP 11 | EM 20 | SGC 26.
- SRS v5 (01/09): referencias internas a Arquitectura v5.0 (el artefacto vigente es v6.0).
- Arquitectura v6: baseline Cloud; TBD-01..12 presentes; catálogos CMP/PIP/CTR-API presentes.
- Backlog v6 (02/09): BL-001..BL-105 con anomalías de numeración.
- Reglas de Negocio v1: ~180 códigos RN; <code>BR-xx</code>: 0 apariciones.
- Matriz XLSX: hojas Prompt / CasoUso (186 filas) / comparativas v2->v5; contiene archivos temporales <code>~$</code>.
- Positivo: inventario CU 100% alineado (182 fichas = 182 activos del catálogo = dominios EM-001..020 y SGC-001..026 del backlog); sin inflación funcional (CU-EM-021 descartado); 11 bloques presentes en 181/182 fichas; backlog con épicas, fases F0-F6, DoR/DoD, política Git y dueños de proceso claros.

## 2. HALLAZGOS

### H1 (ALTA) — Trazabilidad de fichas no trazable (placeholder de generación)

Las líneas <code>Trazabilidad:</code> no se corresponden con SRS v5 + BL v6 + Reglas v1:

- EM (20) y SGC (26): patrón idéntico <code>EM-0x/SGC-0x, RNF-001, BL-001, BR-02</code>; no referencian RF-EMP/RF-SGC ni BL v6 (CU-EM-001 debe trazar a BL-039, no BL-001=gobierno).
- DEV (10): <code>DEV-0x, RNF-003, BL-010, BR-02</code> (BL-010 = backup/PITR).
- ARCH/INT/OBS/DATA/GCP (47): <code>ARQ/INT/OBS/DATA/GCP-0x + BL-0xx</code> desalineados (GCP-004->BL-011, GCP-008->BL-014, GCP-011->BL-030).
- ERP/RH/CM/CT/FC/LG: códigos legacy <code>US-113..121</code>, <code>BR-02/03/07/11</code>, <code>BL-CM-01..07</code>, <code>BL-CT-01</code>, <code>BL-RH-00</code>, <code>RNF-CM-001</code>, <code>RF-CO-004/005</code> (SRS define solo RF-CO-001..003), <code>RF-INV-_</code> vs <code>RF-IN-_</code>, <code>RF-FIN-001</code>/<code>RF-LOG-001</code> no definidos.
- SEC: <code>RS-001..005</code> (catálogo v2) + <code>RN-SEC-014/015</code> inexistentes (Reglas v1 llega a RN-SEC-012).
- Conteos: 23 fichas con US-_, 120 con BR-_, 29 con BL-XX-NN, 59 con RNF-001, 137 con BL numérico de v5.

### H2 (ALTA) — Baselines/versiones inconsistentes

- 116 fichas: <code>Baseline: SRS v5.0 / ARQ v6.0 / BL v5.0</code>; 92 con <code>Estado ... (Baseline v6.0)</code>; otras variantes (Baseline v5.0), (Baseline v5.0 / ARQ v6.0). Mínimo 4 convenciones distintas.
- SRS v5 referencia ARQ v5.0; el archivo vigente es ARQ v6.0. Catálogo v5 (01/09) precede a BL/ARQ v6 (02/09).
- 100% de fichas en estado Aprobado aun con TBD/pendientes -> estado inflado.

### H3 (ALTA) — Fichas rotas o duplicadas

- CU-INT-009 (PurchaseReceived): HTML solo con CSS/<title>, sin cuerpo (0 bloques).
- CU-SGC-026 (bandeja operativa): el archivo contiene la ficha duplicada de CU-SGC-025 (falta la real).
- CU-EC-002 (Buscar productos): <title>/cabecera dice CU-EC-001 (metadatos erróneos).

### H4 (ALTA) — Residuos de generación [cite: N]

- 40 fichas / 877 tokens: E-Commerce 15 fichas (232), ERP 7 (112), GE+SEC 18 (533). Texto visible que se exporta al PNG.

### H5 (ALTA) — Backlog v6: numeración y referencias

- Runbooks aparece como BL-0105 (sección 6, F5, dependencias DR): debe ser BL-085 (no existe BL-085).
- BL-022 traza <code>BL-08</code> (debe ser BL-008).
- Anexo C (spikes) sin mapeo explícito a TBD-02/04/05/06/07/09/10/11/12 usados como trazabilidad.
- BL-079: rango CU-GCP-009..011 para DR no es el idóneo (foco en GCP-005/GCP-010): validar.
- Menor: capítulo numerado 09. en tabla de contenidos.

### H6 (MEDIA) — Contradicción p99 validada vs TBD

- ~102 fichas (dom 05-09) con CA <code>Latencia p99 validada (BL-001)</code> / <code>verificada (BL-011 / BL-080)</code>, pero BL-080 mantiene RTO/RPO TBD y EM/SGC usan <code>p99 <= TBD ms</code>. BL citados no corresponden al ítem.
- Plantillas heterogéneas por lote: E-Commerce no usa ese criterio; bloque 11 se titula INTEGRACIONES / MATRIZ DE INTEGRACIONES / Matriz de Integraciones.

### H7 (MEDIA) — Restos de plantilla

- <code>(User Role)</code> en actores de SEC-002, SEC-008, EM-001, SGC-001.
- Matriz XLSX: SEC-012/013 con objetivo copiado de EM-020 (EmprendedorId en vez de zona/vendedor).
- Inglés en diagramas (ZONAL MGR, Notifier Welcome, HTTP REST).
- Temporales <code>~$</code> en carpeta de CU.

### H8 (BAJA) — Gobernanza de versiones/códigos

- Colisión numérica v5 (SRS/Catálogo/BL anterior) vs v6 (ARQ/BL actual); sin tabla maestra de versiones.
- No existe índice oficial de códigos vigentes (RF/RN/RI/CMP/PIP/CTR/BL); cada lote usa su dialecto (RS/US/BR/BL-XX-NN/RF-INV/RN-EM...).

## 3. RECOMENDACIONES

R1. Tabla maestra de códigos oficiales + matriz única CU->BL v6 (137 fichas con BL de v5).
R2. Regenerar/corregir Trazabilidad de las 182 fichas contra SRS v5 + BL v6 + Reglas v1; gate DoR de traza válida.
R3. Regenerar CU-INT-009 y CU-SGC-026; corregir metadatos de CU-EC-002.
R4. Limpieza global de [cite: N] (877) y (User Role); reexportar PNG.
R5. Homogeneizar baseline/estado a convención oficial v6.0 en las 182 fichas; SRS -> ARQ v6.
R6. Backlog: BL-0105->BL-085; BL-08->BL-008; Anexo C <-> TBD-ids; validar BL-079.
R7. Resolver latencia (RN-OPS/SLA + spike BL-080); quitar CA plantilla (BL-0xx).
R8. Plantilla canónica de 11 bloques (nombre oficial del bloque 11, diagramas en español) y regeneración por lotes.
R9. Docs-as-code para requisitos (Git/PR/revisión) + gates CI: 0 placeholders, 0 [cite], trazas válidas, PNG íntegro.
R10. Limpiar ~$ y corregir SEC-012/013; publicar SRS/Catálogo/ARQ/Reglas en versión alineada.

## 4. RIESGOS

- Sin R1/R2, la trazabilidad Requisito->CU->RN->Deploy es inauditable (compromete F1 y gates DoR).
- Fichas rotas (INT-009, SGC-026) y criterios duplicados impiden ejecutar BL-087 (cobertura 80%/90%).
- Residuos visibles pasarían a la documentación base si no se limpian antes de diseño/pruebas.

## 5. FUENTES

Backlog v6 (íntegro) · Catálogo v5 · SRS v5 · ARQ v6 · Reglas v1 · Matriz XLSX · 182 fichas HTML (métricas en _NICOLA_work/metrics2.json).
