import { randomUUID } from 'crypto';
import type { FastifyInstance } from 'fastify';
import { eq, and, inArray, isNull, desc } from 'drizzle-orm';
import { db } from '../../db/db';
import { orders, orderItems, outboxEvents, products } from '../../db/schema';

// Order Service (modulo monolitico, CU-ARCH-001 / CU-EC-008 / BL-030).
// Transaccion ACID + patrocinador Transactional Outbox para OrderCreated (BL-033).
type OrderBody = { items: { productId: number; quantity: number }[] };

function newOrderRef(): string {
  return 'ORD-' + randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
}

export async function ordersRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: OrderBody }>('/orders', {
    schema: {
      tags: ['orders'],
      summary: 'Crear pedido unico desde checkout',
      description: 'Crea el pedido y reserva conceptual de stock; publica OrderCreated via Outbox (CU-EC-008, BL-030/033).',
      body: {
        type: 'object',
        required: ['items'],
        properties: {
          items: {
            type: 'array',
            items: { type: 'object', required: ['productId', 'quantity'], properties: { productId: { type: 'integer' }, quantity: { type: 'integer' } } },
          },
        },
      },
    },
  }, async (req, reply) => {
    const idem = typeof req.headers['idempotency-key'] === 'string' ? req.headers['idempotency-key'] : undefined;
    const customerId = typeof req.headers['x-customer-id'] === 'string' ? req.headers['x-customer-id'] : 'anon';
    const items = (req.body && Array.isArray(req.body.items) ? req.body.items : []).map(function (i) {
      return { productId: Number(i.productId), quantity: Number(i.quantity) };
    });

    if (items.length === 0 || items.some(function (i) { return !(i.productId > 0) || !(i.quantity >= 1); })) {
      return reply.code(400).send({ error: 'items_invalidos' });
    }

    if (idem) {
      const existing = await db.select().from(orders).where(eq(orders.idempotencyKey, idem)).limit(1);
      if (existing[0]) {
        return { data: { orderRef: existing[0].orderRef, status: existing[0].status, totalCents: existing[0].totalCents } };
      }
    }

    const productIds = Array.from(new Set(items.map(function (i) { return i.productId; })));
    const prows = await db.select().from(products).where(and(inArray(products.id, productIds), eq(products.status, 'ACTIVE')));
    const pmap = new Map(prows.map(function (p) { return [p.id, p]; }));

    for (const it of items) {
      const p = pmap.get(it.productId);
      if (!p) return reply.code(422).send({ error: 'producto_no_disponible', productId: it.productId });
      if (it.quantity > p.stock) return reply.code(409).send({ error: 'stock_insuficiente', productId: it.productId, stock: p.stock });
    }

    const subtotal = items.reduce(function (s, it) { return s + (pmap.get(it.productId) ? pmap.get(it.productId)!.priceCents : 0) * it.quantity; }, 0);
    const shipping = 0;
    const total = subtotal + shipping;
    const orderRef = newOrderRef();
    const correlationId = randomUUID();

    const result = await db.transaction(async function (tx) {
      const [created] = await tx
        .insert(orders)
        .values({
          orderRef: orderRef,
          customerId: customerId,
          status: 'PENDING_PAYMENT',
          subtotalCents: subtotal,
          shippingCents: shipping,
          totalCents: total,
          currency: 'COP',
          idempotencyKey: idem || null,
        })
        .returning({ id: orders.id, orderRef: orders.orderRef });

      await tx.insert(orderItems).values(items.map(function (it) {
        return { orderId: created.id, productId: it.productId, quantity: it.quantity, unitPriceCents: pmap.get(it.productId)!.priceCents };
      }));

      await tx.insert(outboxEvents).values({
        aggregateType: 'Order',
        aggregateId: orderRef,
        eventType: 'com.cuchostool.order.created',
        correlationId: correlationId,
        idempotencyKey: idem || null,
        payload: {
          eventId: randomUUID(),
          type: 'com.cuchostool.order.created',
          version: '1.0',
          occurredAt: new Date().toISOString(),
          correlationId: correlationId,
          idempotencyKey: idem || null,
          data: {
            orderId: orderRef,
            customerId: customerId,
            items: items,
            subtotalCents: subtotal,
            shippingCents: shipping,
            totalCents: total,
            currency: 'COP',
          },
        },
      });

      return created;
    });

    return { data: { orderRef: result.orderRef, status: 'PENDING_PAYMENT', totalCents: total, currency: 'COP' } };
  });

  app.get<{ Params: { orderRef: string } }>('/orders/:orderRef', {
    schema: { tags: ['orders'], summary: 'Consultar pedido propio', description: 'Consulta un pedido por orderRef (CU-EC-009).' },
  }, async (req, reply) => {
    const o = await db.select().from(orders).where(eq(orders.orderRef, req.params.orderRef)).limit(1);
    if (!o[0]) return reply.code(404).send({ error: 'pedido_no_encontrado' });
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, o[0].id));
    return { data: { ...o[0], items: items } };
  });

  // Evidencia del Outbox (sin broker en local; el publicador Pub/Sub llega en F3).
  app.get('/outbox/pending', {
    schema: { tags: ['orders'], summary: 'Eventos pendientes de publicacion', description: 'Cola Outbox pendiente (patron Transactional Outbox).' },
  }, async () => {
    const rows = await db.select().from(outboxEvents).where(isNull(outboxEvents.publishedAt)).orderBy(desc(outboxEvents.id));
    return { data: rows };
  });
}
