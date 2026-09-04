// Semilla de datos de desarrollo (idempotente).
// Solo valores de demostracion; las credenciales aqui son EXCLUSIVAS del entorno local
// y nunca deben usarse en produccion (CU-SEC-011 / RNF-MAN).
import bcrypt from 'bcryptjs';
import { base } from './base';
import { categorias, productos, usuarios } from './esquema';
import { ROL_ADMIN, ROL_GERENTE_ZONA, RONDAS_BCRYPT } from '../dominio/constantes';

async function principal(): Promise<void> {
  // Categorias del catalogo (CU-EC-001..003).
  await base
    .insert(categorias)
    .values([
      { nombre: 'Artesanias', slug: 'artesanias', posicion: 1 },
      { nombre: 'Moda y Accesorios', slug: 'moda', posicion: 2 },
      { nombre: 'Gastronomia', slug: 'gastronomia', posicion: 3 },
    ])
    .onConflictDoNothing();

  const filasCategorias = await base.select().from(categorias);
  const idPorSlug = new Map(
    filasCategorias.map(function (c) {
      return [c.slug, c.id];
    }),
  );

  // Productos de demostracion con precios en centavos (CU-EC-001..005).
  await base
    .insert(productos)
    .values([
      {
        categoriaId: idPorSlug.get('artesanias') || 1,
        nombre: 'Mochila Wayuu',
        slug: 'mochila-wayuu',
        descripcion: 'Tejido artesanal del Caribe colombiano.',
        precioCentavos: 14500000,
        stock: 24,
        urlImagen: null,
      },
      {
        categoriaId: idPorSlug.get('artesanias') || 1,
        nombre: 'Aretes artesanales',
        slug: 'aretes-artesanales',
        descripcion: 'Aretes hechos a mano en hilo y metal.',
        precioCentavos: 3800000,
        stock: 60,
        urlImagen: null,
      },
      {
        categoriaId: idPorSlug.get('gastronomia') || 3,
        nombre: 'Cafe organico 500g',
        slug: 'cafe-organico-500g',
        descripcion: 'Cafe de origen, tostion media.',
        precioCentavos: 2850000,
        stock: 120,
        urlImagen: null,
      },
      {
        categoriaId: idPorSlug.get('moda') || 2,
        nombre: 'Chaqueta en lino',
        slug: 'chaqueta-en-lino',
        descripcion: 'Chaqueta ligera de lino color natural.',
        precioCentavos: 18900000,
        stock: 18,
        urlImagen: null,
      },
    ])
    .onConflictDoNothing();

  // Usuarios internos de desarrollo para probar RBAC/ABAC (CU-SEC-001/009).
  const hashContrasena = await bcrypt.hash('admin1234', RONDAS_BCRYPT);
  await base
    .insert(usuarios)
    .values([
      {
        correo: 'admin@cuchostool.com',
        hashContrasena: hashContrasena,
        rol: ROL_ADMIN,
        zonaId: null,
        vendedorId: null,
      },
      {
        correo: 'zona@cuchostool.com',
        hashContrasena: hashContrasena,
        rol: ROL_GERENTE_ZONA,
        zonaId: 'ZON-BOG',
        vendedorId: null,
      },
    ])
    .onConflictDoNothing();

  console.log('Semilla completada.');
  await import('./cliente').then(function (modulo) {
    return modulo.cerrarPool();
  });
}

principal().catch(function (error) {
  console.error(error);
  process.exit(1);
});
