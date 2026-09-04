import { randomUUID } from 'crypto';
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../../db/db';
import { orders, orderItems, outboxEvents, products } from '../../db/schema';

export type OrderLine = { productId: number; quantity: number };
export type CreateOrderResult =
  | { ok: true; orderRef: string; totalCents: number }
  | { ok: false; status: number; error: string; productId?: number; stock?: number };

function newOrderRef(): string {
  return 'ORD-' + randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
}

export async function createOrder(customerId: string, idem: string | undefined, lines: OrderLine[]): Promise<CreateOrderResult> {
  if (lines.length === 0) return { ok: false, status: 400, error: 'items_invalidos' };
  if (idem) {
    const existing = await db.select().from(orders).where(eq(orders.idempotencyKey, idem)).limit(1);
    if (existing[0]) return { ok: true, orderRef: existing[0].orderRef, totalCents: existing[0].totalCents };
  }

  const productIds = Array.from(new Set(lines.map(function (l) { return l.productId; })));
  const prows = await db.select().from(products).where(and(inArray(products.id, productIds), eq(products.status, 'ACTIVE')));
  const pmap = new Map(prows.map(function (p) { return [p.id, p]; }));

  for (const l of lines) {
    const p = pmap.get(l.productId);
    if (!p) return { ok: false, status: 422, error: 'producto_no_disponible', productId: l.productId };
    if (!(l.quantity >= 1)) return { ok: false, status: 400, error: 'cantidad_invalida', productId: l.productId };
    if (l.quantity > p.stock) return { ok: false, status: 409, error: 'stock_insuficiente', productId: l.productId, stock: p.stock };
  }

  const subtotal = lines.reduce(function (s, l) { return s + (pmap.get(l.productId) ? pmap.get(l.productId)!.priceCents : 0) * l.quantity; }, 0);
  const shipping = 0;
  const total = subtotal + shipping;
  const orderRef = newOrderRef();
  const correlationId = randomUUID();

  await db.transaction(async function (tx) {
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
      .returning({ id: orders.id });

    await tx.insert(orderItems).values(lines.map(function (l) {
      return { orderId: created.id, productId: l.productId, quantity: l.quantity, unitPriceCents: pmap.get(l.productId)!.priceCents };
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
          items: lines,
          subtotalCents: subtotal,
          shippingCents: shipping,
          totalCents: total,
          currency: 'COP',
        },
      },
    });
  });

  return { ok: true, orderRef: orderRef, totalCents: total };
}
