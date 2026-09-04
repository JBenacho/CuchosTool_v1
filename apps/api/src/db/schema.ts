import { pgTable, serial, text, integer, bigint, timestamp, index } from 'drizzle-orm/pg-core';

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
