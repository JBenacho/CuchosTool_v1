// Seed de catalogo y usuarios internos de demostracion (idempotente). CU-EC-001..004, CU-SEC-001.
import bcrypt from 'bcryptjs';
import { db } from './db';
import { categories, products, users } from './schema';

async function main(): Promise<void> {
  await db.insert(categories).values([
    { name: 'Artesanias', slug: 'artesanias', position: 1 },
    { name: 'Moda y Accesorios', slug: 'moda', position: 2 },
    { name: 'Gastronomia', slug: 'gastronomia', position: 3 },
  ]).onConflictDoNothing();

  const catRows = await db.select().from(categories);
  const bySlug = new Map(catRows.map(function (c) { return [c.slug, c.id]; }));

  await db.insert(products).values([
    { categoryId: bySlug.get('artesanias') || 1, name: 'Mochila Wayuu', slug: 'mochila-wayuu', description: 'Tejido artesanal del Caribe colombiano.', priceCents: 14500000, stock: 24, imageUrl: null },
    { categoryId: bySlug.get('artesanias') || 1, name: 'Aretes artesanales', slug: 'aretes-artesanales', description: 'Aretes hechos a mano en hilo y metal.', priceCents: 3800000, stock: 60, imageUrl: null },
    { categoryId: bySlug.get('gastronomia') || 3, name: 'Cafe organico 500g', slug: 'cafe-organico-500g', description: 'Cafe de origen, tostion media.', priceCents: 2850000, stock: 120, imageUrl: null },
    { categoryId: bySlug.get('moda') || 2, name: 'Chaqueta en lino', slug: 'chaqueta-en-lino', description: 'Chaqueta ligera de lino color natural.', priceCents: 18900000, stock: 18, imageUrl: null },
  ]).onConflictDoNothing();

  // Usuario interno de desarrollo (credenciales SOLO para entorno local).
  const adminHash = await bcrypt.hash('admin1234', 10);
  await db.insert(users).values([
    { email: 'admin@cuchostool.com', passwordHash: adminHash, role: 'ADMIN', zoneId: null, vendorId: null },
    { email: 'zona@cuchostool.com', passwordHash: adminHash, role: 'ZONAL_MANAGER', zoneId: 'ZON-BOG', vendorId: null },
  ]).onConflictDoNothing();

  console.log('Seed completado.');
  await import('./client').then(function (m) { return m.closePool(); });
}

main().catch(function (e) { console.error(e); process.exit(1); });
