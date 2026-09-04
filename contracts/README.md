# Contratos de integracion (Contract-First)

Registro de contratos versionados de CuchosTool. Baseline: SRS v5.0 / ARQ v6.0 / BL v6.0.

## Convenciones (CU-INT-010..014)

- Envelope comun versionado: eventId, type, version, occurredAt, correlationId, idempotencyKey, data.
- Consumidores idempotentes; reintentos y DLQ (BL-025 / BL-091).
- Compatibilidad hacia atras: solo cambios aditivos (BL-026).
- Idempotency-Key obligatorio en operaciones criticas (BL-023).
- Todos los nombres de campos estan en espanol (regla de nomenclatura del proyecto).

## Eventos (Pub/Sub)

| CU         | Evento                | type                                  | Archivo                                   |
| ---------- | --------------------- | ------------------------------------- | ----------------------------------------- |
| CU-INT-001 | PedidoCreado          | com.cuchostool.pedido.creado          | events/pedido-creado.schema.json          |
| CU-INT-002 | PedidoPagado          | com.cuchostool.pedido.pagado          | events/pedido-pagado.schema.json          |
| CU-INT-003 | InventarioActualizado | com.cuchostool.inventario.actualizado | events/inventario-actualizado.schema.json |

Pendientes por formalizar (F3): pedido-despachado, envio-creado, pedido-entregado, empleado-creado, compra-recibida, factura-generada.

## API (OpenAPI 3)

- Especificacion viva: GET /docs (Swagger UI) y GET /docs/json en el servicio api.
- Instantanea versionada: openapi.generated.json (se regenera en CI/PR para detectar breaking changes).
- Integridad de contratos: npm run validate:contracts (job 'contracts' en CI).
