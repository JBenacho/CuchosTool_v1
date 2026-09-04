import { pgTable, serial, text, integer, bigint, timestamp, index, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';

// Catalogo publico (CU-EC-001..006): producto + categoria.
// Precios en centavos COP (bigint) para evitar errores de redondeo.
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  position: integer('position').notNull().default(0),
});

export const products = pgTable(
  'products',
  {
    id: serial('id').primaryKey(),
    categoryId: integer('category_id').references(() => categories.id),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    description: text('description'),
    priceCents: bigint('price_cents', { mode: 'number' }).notNull(),
    currency: text('currency').notNull().default('COP'),
    status: text('status').notNull().default('ACTIVE'),
    stock: integer('stock').notNull().default(0),
    imageUrl: text('image_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('products_category_idx').on(table.categoryId),
    index('products_status_idx').on(table.status),
  ]
);

// Pedido empresarial unico (CU-ARCH-001 / CU-EC-008 / BL-030).
// Order Service es dueno unico del ciclo del pedido (RN-GOB-003).
export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  orderRef: text('order_ref').notNull().unique(),
  customerId: text('customer_id').notNull(),
  status: text('status').notNull().default('PENDING_PAYMENT'),
  subtotalCents: bigint('subtotal_cents', { mode: 'number' }).notNull(),
  shippingCents: bigint('shipping_cents', { mode: 'number' }).notNull().default(0),
  totalCents: bigint('total_cents', { mode: 'number' }).notNull(),
  currency: text('currency').notNull().default('COP'),
  idempotencyKey: text('idempotency_key').unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id),
  productId: integer('product_id').notNull(),
  quantity: integer('quantity').notNull(),
  unitPriceCents: bigint('unit_price_cents', { mode: 'number' }).notNull(),
});

// Patron Transactional Outbox (CU-INT-001 / BL-033): eventos transaccionales.
export const outboxEvents = pgTable('outbox_events', {
  id: serial('id').primaryKey(),
  aggregateType: text('aggregate_type').notNull(),
  aggregateId: text('aggregate_id').notNull(),
  eventType: text('event_type').notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  correlationId: text('correlation_id'),
  idempotencyKey: text('idempotency_key'),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
});

// Carrito de compra (CU-EC-007). En local el cliente se identifica por X-Customer-Id
// hasta cerrar identidad (CU-EC-013/014). Precios se resuelven vivos al checkout.
export const carts = pgTable('carts', {
  id: serial('id').primaryKey(),
  customerId: text('customer_id').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const cartItems = pgTable(
  'cart_items',
  {
    id: serial('id').primaryKey(),
    cartId: integer('cart_id').notNull().references(() => carts.id),
    productId: integer('product_id').notNull(),
    quantity: integer('quantity').notNull(),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('cart_items_cart_product_idx').on(table.cartId, table.productId)]
);
