import type { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { db } from '../../db/db';
import { carts, cartItems, products } from '../../db/schema';
import { createOrder } from '../orders/order.service';

// Carrito (CU-EC-007) - requiere sesion de cliente (JWT, CU-EC-014).
function customerOf(req: any): string {
  const u = (req && req.user) ? req.user : null;
  return u && u.sub ? String(u.sub) : 'anon';
}

async function getOrCreateCart(customerId: string): Promise<number> {
  const existing = await db.select().from(carts).where(eq(carts.customerId, customerId)).limit(1);
  if (existing[0]) return existing[0].id;
  const [created] = await db.insert(carts).values({ customerId: customerId }).returning({ id: carts.id });
  return created.id;
}

async function cartView(customerId: string) {
  const existing = await db.select().from(carts).where(eq(carts.customerId, customerId)).limit(1);
  if (!existing[0]) return { data: { items: [], totalCents: 0 } };
  const rows = await db
    .select({
      productId: cartItems.productId,
      quantity: cartItems.quantity,
      name: products.name,
      priceCents: products.priceCents,
      currency: products.currency,
      stock: products.stock,
    })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .where(eq(cartItems.cartId, existing[0].id));
  const totalCents = rows.reduce(function (s, r) { return s + (r.priceCents || 0) * r.quantity; }, 0);
  return { data: { items: rows, totalCents: totalCents } };
}

type AddItemBody = { productId: number; quantity: number };

export async function cartRoutes(app: FastifyInstance): Promise<void> {
  const auth = (app as any).authenticate;

  app.get('/cart', {
    preHandler: auth,
    schema: { tags: ['cart'], summary: 'Consultar carrito', description: 'Contenido y total del carrito del cliente autenticado (CU-EC-007).' },
  }, async (req) => {
    return cartView(customerOf(req));
  });

  app.post<{ Body: AddItemBody }>('/cart/items', {
    preHandler: auth,
    schema: {
      tags: ['cart'],
      summary: 'Agregar producto al carrito',
      body: { type: 'object', required: ['productId', 'quantity'], properties: { productId: { type: 'integer' }, quantity: { type: 'integer' } } },
    },
  }, async (req, reply) => {
    const customerId = customerOf(req);
    const productId = Number(req.body?.productId);
    const quantity = Number(req.body?.quantity);
    if (!(productId > 0) || !(quantity >= 1)) return reply.code(400).send({ error: 'items_invalidos' });
    const prod = await db.select().from(products).where(and(eq(products.id, productId), eq(products.status, 'ACTIVE'))).limit(1);
    if (!prod[0]) return reply.code(422).send({ error: 'producto_no_disponible' });
    if (quantity > prod[0].stock) return reply.code(409).send({ error: 'stock_insuficiente', stock: prod[0].stock });
    const cartId = await getOrCreateCart(customerId);
    const existingItem = await db.select().from(cartItems).where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId))).limit(1);
    if (existingItem[0]) {
      await db.update(cartItems).set({ quantity: existingItem[0].quantity + quantity }).where(eq(cartItems.id, existingItem[0].id));
    } else {
      await db.insert(cartItems).values({ cartId: cartId, productId: productId, quantity: quantity });
    }
    return cartView(customerId);
  });

  app.patch<{ Params: { productId: string }; Body: { quantity: number } }>('/cart/items/:productId', {
    preHandler: auth,
    schema: { tags: ['cart'], summary: 'Actualizar cantidad', body: { type: 'object', required: ['quantity'], properties: { quantity: { type: 'integer' } } } },
  }, async (req, reply) => {
    const customerId = customerOf(req);
    const productId = Number(req.params.productId);
    const quantity = Number(req.body?.quantity);
    const existing = await db.select().from(carts).where(eq(carts.customerId, customerId)).limit(1);
    if (!existing[0]) return reply.code(404).send({ error: 'carrito_vacio' });
    if (quantity <= 0) {
      await db.delete(cartItems).where(and(eq(cartItems.cartId, existing[0].id), eq(cartItems.productId, productId)));
    } else {
      await db.update(cartItems).set({ quantity: quantity }).where(and(eq(cartItems.cartId, existing[0].id), eq(cartItems.productId, productId)));
    }
    return cartView(customerId);
  });

  app.delete<{ Params: { productId: string } }>('/cart/items/:productId', {
    preHandler: auth,
    schema: { tags: ['cart'], summary: 'Quitar producto del carrito' },
  }, async (req, reply) => {
    const customerId = customerOf(req);
    const productId = Number(req.params.productId);
    const existing = await db.select().from(carts).where(eq(carts.customerId, customerId)).limit(1);
    if (!existing[0]) return reply.code(404).send({ error: 'carrito_vacio' });
    await db.delete(cartItems).where(and(eq(cartItems.cartId, existing[0].id), eq(cartItems.productId, productId)));
    return cartView(customerId);
  });

  app.post('/cart/checkout', {
    preHandler: auth,
    schema: { tags: ['cart'], summary: 'Crear pedido desde el carrito', description: 'Vacia el carrito y crea el pedido (CU-EC-008).' },
  }, async (req, reply) => {
    const customerId = customerOf(req);
    const idem = typeof req.headers['idempotency-key'] === 'string' ? req.headers['idempotency-key'] : undefined;
    const existing = await db.select().from(carts).where(eq(carts.customerId, customerId)).limit(1);
    if (!existing[0]) return reply.code(400).send({ error: 'carrito_vacio' });
    const rows = await db.select().from(cartItems).where(eq(cartItems.cartId, existing[0].id));
    const lines = rows.map(function (r) { return { productId: r.productId, quantity: r.quantity }; });
    const res = await createOrder(customerId, idem, lines);
    if (!res.ok) return reply.code(res.status).send({ error: res.error, productId: res.productId, stock: res.stock });
    await db.delete(cartItems).where(eq(cartItems.cartId, existing[0].id));
    return { data: { orderRef: res.orderRef, status: 'PENDING_PAYMENT', totalCents: res.totalCents, currency: 'COP' } };
  });
}
