# Contratos de integracion (Contract-First)

Registro de contratos versionados de CuchosTool. Baseline: SRS v5.0 / ARQ v6.0 / BL v6.0.

## Convenciones (CU-INT-010..014)
- Envelope comun versionado: eventId, type, version, occurredAt, correlationId, idempotencyKey, data.
- Consumidores idempotentes; reintentos y DLQ (BL-025 / BL-091).
- Compatibilidad hacia atras: additive changes solo (BL-026).
- Idempotency-Key obligatorio en operaciones criticas (BL-023).

## Eventos (Pub/Sub)
| CU | Evento | type | Archivo |
|---|---|---|---|
| CU-INT-001 | OrderCreated | com.cuchostool.order.created | events/order-created.schema.json |
| CU-INT-002 | OrderPaid | com.cuchostool.order.paid | events/order-paid.schema.json |
| CU-INT-003 | InventoryUpdated | com.cuchostool.inventory.updated | events/inventory-updated.schema.json |

Pendientes por formalizar (F3): OrderDispatched, ShipmentCreated, OrderDelivered, EmployeeCreated, PurchaseReceived, InvoiceGenerated.

## API (OpenAPI 3)
- Especificacion viva: GET /docs (Swagger UI) y GET /docs/json en el servicio api.
- Instantanea versionada: openapi.generated.json (se regenera en CI/PR para detectar breaking changes).
