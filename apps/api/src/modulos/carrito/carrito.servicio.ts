// Servicio de carrito (capa de negocio, CU-EC-007).
// Reglas: un carrito por cliente; los precios se resuelven vivos contra el catalogo
// en el momento de consultar o pagar (nunca se confia en precios enviados por el cliente).
import { and, eq } from 'drizzle-orm';
import { base } from '../../bd/base';
import { carritoArticulos, carritos, productos } from '../../bd/esquema';
import { ESTADO_ACTIVO } from '../../dominio/constantes';

export interface VistaArticuloCarrito {
  productoId: number;
  cantidad: number;
  nombre: string;
  precioCentavos: number;
  moneda: string;
  stock: number;
}

export interface VistaCarrito {
  articulos: VistaArticuloCarrito[];
  totalCentavos: number;
}

/**
 * Obtiene el id del carrito del cliente; si no existe, lo crea.
 * @param clienteId identificador del cliente autenticado.
 * @returns id interno del carrito.
 */
async function obtenerOCrearCarrito(clienteId: string): Promise<number> {
  const existentes = await base.select().from(carritos).where(eq(carritos.clienteId, clienteId)).limit(1);
  if (existentes[0]) return existentes[0].id;
  const [creado] = await base.insert(carritos).values({ clienteId: clienteId }).returning({ id: carritos.id });
  return creado.id;
}

/**
 * Construye la vista del carrito: articulos con datos vivos del producto y total.
 * @param clienteId cliente autenticado.
 */
export async function vistaCarrito(clienteId: string): Promise<VistaCarrito> {
  const existentes = await base.select().from(carritos).where(eq(carritos.clienteId, clienteId)).limit(1);
  if (!existentes[0]) return { articulos: [], totalCentavos: 0 };
  const filas = await base
    .select({
      productoId: carritoArticulos.productoId,
      cantidad: carritoArticulos.cantidad,
      nombre: productos.nombre,
      precioCentavos: productos.precioCentavos,
      moneda: productos.moneda,
      stock: productos.stock,
    })
    .from(carritoArticulos)
    .innerJoin(productos, eq(carritoArticulos.productoId, productos.id))
    .where(eq(carritoArticulos.carritoId, existentes[0].id));
  const totalCentavos = filas.reduce(function (acumulado, fila) { return acumulado + (fila.precioCentavos || 0) * fila.cantidad; }, 0);
  return { articulos: filas, totalCentavos: totalCentavos };
}

/**
 * Agrega cantidad de un producto al carrito (o incrementa si ya existe).
 * Reglas: producto activo y cantidad no mayor al stock (RN-INV / CU-EC-007).
 * @returns vista actualizada del carrito, o error de negocio con codigo HTTP.
 */
export async function agregarArticulo(
  clienteId: string,
  productoId: number,
  cantidad: number
): Promise<{ ok: boolean; vista?: VistaCarrito; codigoEstado?: number; error?: string; stock?: number }> {
  if (!(productoId > 0) || !(cantidad >= 1)) return { ok: false, codigoEstado: 400, error: 'articulos_invalidos' };
  const filasProducto = await base.select().from(productos).where(and(eq(productos.id, productoId), eq(productos.estado, ESTADO_ACTIVO))).limit(1);
  const producto = filasProducto[0];
  if (!producto) return { ok: false, codigoEstado: 422, error: 'producto_no_disponible' };
  if (cantidad > producto.stock) return { ok: false, codigoEstado: 409, error: 'stock_insuficiente', stock: producto.stock };

  const carritoId = await obtenerOCrearCarrito(clienteId);
  const existentes = await base.select().from(carritoArticulos).where(and(eq(carritoArticulos.carritoId, carritoId), eq(carritoArticulos.productoId, productoId))).limit(1);
  if (existentes[0]) {
    await base.update(carritoArticulos).set({ cantidad: existentes[0].cantidad + cantidad }).where(eq(carritoArticulos.id, existentes[0].id));
  } else {
    await base.insert(carritoArticulos).values({ carritoId: carritoId, productoId: productoId, cantidad: cantidad });
  }
  return { ok: true, vista: await vistaCarrito(clienteId) };
}

/**
 * Actualiza la cantidad de un articulo (cantidad 0 o negativa lo elimina).
 */
export async function actualizarCantidad(clienteId: string, productoId: number, cantidad: number): Promise<{ ok: boolean; vista?: VistaCarrito; codigoEstado?: number; error?: string }> {
  const existentes = await base.select().from(carritos).where(eq(carritos.clienteId, clienteId)).limit(1);
  if (!existentes[0]) return { ok: false, codigoEstado: 404, error: 'carrito_vacio' };
  if (cantidad <= 0) {
    await base.delete(carritoArticulos).where(and(eq(carritoArticulos.carritoId, existentes[0].id), eq(carritoArticulos.productoId, productoId)));
  } else {
    await base.update(carritoArticulos).set({ cantidad: cantidad }).where(and(eq(carritoArticulos.carritoId, existentes[0].id), eq(carritoArticulos.productoId, productoId)));
  }
  return { ok: true, vista: await vistaCarrito(clienteId) };
}

/**
 * Elimina un articulo del carrito.
 */
export async function quitarArticulo(clienteId: string, productoId: number): Promise<{ ok: boolean; vista?: VistaCarrito; codigoEstado?: number; error?: string }> {
  const existentes = await base.select().from(carritos).where(eq(carritos.clienteId, clienteId)).limit(1);
  if (!existentes[0]) return { ok: false, codigoEstado: 404, error: 'carrito_vacio' };
  await base.delete(carritoArticulos).where(and(eq(carritoArticulos.carritoId, existentes[0].id), eq(carritoArticulos.productoId, productoId)));
  return { ok: true, vista: await vistaCarrito(clienteId) };
}

/**
 * Devuelve los articulos actuales del carrito como lineas de pedido.
 */
export async function articulosDelCarrito(clienteId: string): Promise<{ productoId: number; cantidad: number }[]> {
  const existentes = await base.select().from(carritos).where(eq(carritos.clienteId, clienteId)).limit(1);
  if (!existentes[0]) return [];
  const filas = await base.select().from(carritoArticulos).where(eq(carritoArticulos.carritoId, existentes[0].id));
  return filas.map(function (fila) { return { productoId: fila.productoId, cantidad: fila.cantidad }; });
}

/**
 * Vacia el carrito (se ejecuta despues de crear el pedido con exito).
 */
export async function vaciarCarrito(clienteId: string): Promise<void> {
  const existentes = await base.select().from(carritos).where(eq(carritos.clienteId, clienteId)).limit(1);
  if (existentes[0]) await base.delete(carritoArticulos).where(eq(carritoArticulos.carritoId, existentes[0].id));
}
