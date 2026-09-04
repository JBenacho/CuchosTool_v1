import type { FastifyInstance } from 'fastify';
import { asc, eq, and, sql } from 'drizzle-orm';
import { db } from '../../db/db';
import { products, categories } from '../../db/schema';

// Catalogo publico (CU-EC-001 Consultar catalogo / CU-EC-002 Buscar / CU-EC-004 Ficha).
// Solo productos ACTIVOS. Sin autenticacion (Backlog BL-027).
function formatCop(cents: number): string {
  return '$ ' + (cents / 100).toLocaleString('es-CO', { minimumFractionDigits: 0 });
}

type ProductQuery = { q?: string; limit?: string; offset?: string };

// Schemas JSON para documentar el contrato OpenAPI (BL-015 / CU-INT-010).
const productSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    slug: { type: 'string' },
    name: { type: 'string' },
    description: { type: ['string', 'null'] },
    priceCents: { type: 'integer' },
    currency: { type: 'string' },
    stock: { type: 'integer' },
    imageUrl: { type: ['string', 'null'] },
    category: { type: ['string', 'null'] },
    price: { type: 'string' },
  },
} as const;

export async function catalogRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: ProductQuery }>('/products', {
    schema: {
      tags: ['catalog'],
      summary: 'Listar productos activos del catalogo',
      description: 'Catalogo publico (CU-EC-001). Filtro opcional q= por nombre/descripcion.',
      querystring: {
        type: 'object',
        properties: {
          q: { type: 'string' },
          limit: { type: 'string' },
          offset: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'array', items: productSchema },
            meta: {
              type: 'object',
              properties: { limit: { type: 'integer' }, offset: { type: 'integer' }, count: { type: 'integer' } },
            },
          },
        },
      },
    },
  }, async (req) => {
    const q = (req.query.q || '').trim();
    const limit = Math.min(parseInt(req.query.limit || '50', 10) || 50, 200);
    const offset = parseInt(req.query.offset || '0', 10) || 0;

    const conditions = [eq(products.status, 'ACTIVE')];
    if (q) {
      const like = '%' + q.toLowerCase() + '%';
      conditions.push(sql`(${products.name} ilike ${like} or coalesce(${products.description}, '') ilike ${like})`);
    }

    const rows = await db
      .select({
        id: products.id,
        slug: products.slug,
        name: products.name,
        description: products.description,
        priceCents: products.priceCents,
        currency: products.currency,
        stock: products.stock,
        imageUrl: products.imageUrl,
        category: categories.slug,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(and(...conditions))
      .orderBy(asc(products.id))
      .limit(limit)
      .offset(offset);

    return {
      data: rows.map(function (r) {
        return { ...r, price: formatCop(r.priceCents) };
      }),
      meta: { limit: limit, offset: offset, count: rows.length },
    };
  });

  app.get<{ Params: { id: string } }>('/products/:id', {
    schema: {
      tags: ['catalog'],
      summary: 'Consultar ficha de producto',
      description: 'Ficha de producto activo por id (CU-EC-004).',
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      response: {
        200: { type: 'object', properties: { data: productSchema } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return reply.code(400).send({ error: 'id_invalido' });

    const row = await db
      .select({
        id: products.id,
        slug: products.slug,
        name: products.name,
        description: products.description,
        priceCents: products.priceCents,
        currency: products.currency,
        stock: products.stock,
        imageUrl: products.imageUrl,
        category: categories.slug,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(and(eq(products.id, id), eq(products.status, 'ACTIVE')))
      .limit(1);

    const item = row[0];
    if (!item) return reply.code(404).send({ error: 'producto_no_encontrado' });
    return { data: { ...item, price: formatCop(item.priceCents) } };
  });
}
