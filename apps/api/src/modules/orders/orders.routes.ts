import type { FastifyInstance } from 'fastify';
import { eq, isNull, desc } from 'drizzle-orm';
import { db } from '../../db/db';
import { orders, orderItems, outboxEvents } from '../../db/schema';
import { createOrder, type OrderLine } from './order.service';

// Order Service (CU-ARCH-001 / CU-EC-008/009, BL-030/033).
type OrderBody = { items: OrderLine[] };

export async function ordersRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: OrderBody }>('/orders', {
    schema: {
      tags: ['orders'],
      summary: 'Crear pedido unico desde checkout',
      description: 'Transaccion ACID + Outbox OrderCreated. Idempotency-Key opcional (BL-023).',
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
    const lines: OrderLine[] = (req.body && Array.isArray(req.body.items) ? req.body.items : []).map(function (i) {
      return { productId: Number(i.productId), quantity: Number(i.quantity) };
    });
    const res = await createOrder(customerId, idem, lines);
    if (!res.ok) return reply.code(res.status).send({ error: res.error, productId: res.productId, stock: res.stock });
    return { data: { orderRef: res.orderRef, status: 'PENDING_PAYMENT', totalCents: res.totalCents, currency: 'COP' } };
  });

  app.get<{ Params: { orderRef: string } }>('/orders/:orderRef', {
    schema: { tags: ['orders'], summary: 'Consultar pedido propio', description: 'Pedido por orderRef (CU-EC-009).' },
  }, async (req, reply) => {
    const o = await db.select().from(orders).where(eq(orders.orderRef, req.params.orderRef)).limit(1);
    if (!o[0]) return reply.code(404).send({ error: 'pedido_no_encontrado' });
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, o[0].id));
    return { data: { ...o[0], items: items } };
  });

  app.get('/outbox/pending', {
    schema: { tags: ['orders'], summary: 'Eventos pendientes de publicacion', description: 'Cola Outbox pendiente (patron Transactional Outbox).' },
  }, async () => {
    const rows = await db.select().from(outboxEvents).where(isNull(outboxEvents.publishedAt)).orderBy(desc(outboxEvents.id));
    return { data: rows };
  });
}
