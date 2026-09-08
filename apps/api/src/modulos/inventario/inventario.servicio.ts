// Servicio de inventario del ERP (CU-INV-001..008, DOM-04).
// Reglas: cada movimiento es ACID (stock + kardex + evento en el buzon);
// la existencia por bodega vive en inventario_stock (fuente unica, CU-INV-010)
// y productos.stock refleja el total disponible para el canal E-Commerce.
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { base } from '../../bd/base';
import { bodegas, inventarioStock, movimientosInventario, productos } from '../../bd/esquema';
import {
  ESTADO_ACTIVO,
  ESTADO_INACTIVO,
  EVENTO_INVENTARIO_STOCK_ACTUALIZADO,
  MOVIMIENTO_AJUSTE,
  MOVIMIENTO_ENTRADA,
  MOVIMIENTO_SALIDA,
} from '../../dominio/constantes';
import { encolarEvento } from '../eventos/buzon.servicio';

export type ResultadoInventario = {
  ok: boolean;
  codigoEstado?: number;
  error?: string;
  datos?: unknown;
};

export interface DatosMovimiento {
  bodegaId: number;
  productoId: number;
  cantidad: number;
  motivo: string;
  referencia?: string;
}

export interface DatosBodega {
  nombre: string;
  ubicacion?: string;
}

/**
 * Consecutivo oficial del kardex (CU-INV-006): INV-AAAA-000001 por anio.
 */
export function generarConsecutivoMovimiento(
  secuencia: number,
  anio = new Date().getFullYear(),
): string {
  return 'INV-' + String(anio) + '-' + String(secuencia).padStart(6, '0');
}

/**
 * Valida la estructura basica de un movimiento (puro, sin BD).
 * Reglas (CU-INV-001/002/003): cantidad > 0 y motivo obligatorio.
 */
export function validarMovimiento(datos: Partial<DatosMovimiento>): { error?: string } {
  if (!Number.isInteger(datos.bodegaId) || Number(datos.bodegaId) <= 0)
    return { error: 'bodega_invalida' };
  if (!Number.isInteger(datos.productoId) || Number(datos.productoId) <= 0)
    return { error: 'producto_invalido' };
  const cantidad = Number(datos.cantidad);
  if (!Number.isInteger(cantidad) || cantidad <= 0) return { error: 'cantidad_invalida' };
  if (!String(datos.motivo || '').trim()) return { error: 'motivo_obligatorio' };
  return {};
}

/**
 * Valida el nombre de una bodega (puro). Regla: nombre obligatorio (CU-INV-005).
 */
export function normalizarDatosBodega(datos: Partial<DatosBodega>): {
  error?: string;
  datos?: DatosBodega;
} {
  const nombre = String(datos.nombre || '').trim();
  if (!nombre) return { error: 'nombre_obligatorio' };
  return {
    datos: {
      nombre: nombre,
      ubicacion: String(datos.ubicacion || '').trim() || undefined,
    },
  };
}

function like(columna: unknown, patron: string) {
  return sql`${columna} like ${patron}`;
}

/**
 * Recupera el consecutivo disponible del anio (maximo secuencial + 1) dentro del ejecutor.
 */
async function proximoConsecutivo(ejecutor: any, anio: number): Promise<string> {
  const prefijo = 'INV-' + anio + '-%';
  const filas = await ejecutor
    .select({ consecutivo: movimientosInventario.consecutivo })
    .from(movimientosInventario)
    .where(like(movimientosInventario.consecutivo, prefijo))
    .orderBy(desc(movimientosInventario.consecutivo))
    .limit(1);
  const ultimo = filas[0] ? parseInt(String(filas[0].consecutivo).split('-').pop() || '0', 10) : 0;
  return generarConsecutivoMovimiento(ultimo + 1, anio);
}

/**
 * Recalcula el stock total del producto (suma por bodegas) hacia la tabla productos,
 * que es la fuente de disponibilidad del canal E-Commerce (CU-INV-008/010).
 */
async function sincronizarStockProducto(ejecutor: any, productoId: number): Promise<void> {
  await ejecutor.execute(
    sql`UPDATE productos SET stock = (SELECT COALESCE(SUM(cantidad), 0) FROM inventario_stock WHERE producto_id = ${productoId}), actualizado_en = now() WHERE id = ${productoId}`,
  );
}

/**
 * Valida que la bodega y el producto existan y esten activos (dentro del ejecutor).
 */
async function validarBodegaProducto(
  ejecutor: any,
  bodegaId: number,
  productoId: number,
): Promise<string | null> {
  const bodegasFilas = await ejecutor
    .select()
    .from(bodegas)
    .where(eq(bodegas.id, bodegaId))
    .limit(1);
  const bodega = bodegasFilas[0];
  if (!bodega || bodega.estado !== ESTADO_ACTIVO) return 'bodega_inactiva';
  const productosFilas = await ejecutor
    .select()
    .from(productos)
    .where(eq(productos.id, productoId))
    .limit(1);
  const producto = productosFilas[0];
  if (!producto || producto.estado !== ESTADO_ACTIVO) return 'producto_inactivo';
  return null;
}

/**
 * Lee (o crea si no existe) la fila de existencia de un producto en una bodega.
 */
async function obtenerOcrearStock(
  ejecutor: any,
  bodegaId: number,
  productoId: number,
): Promise<{ id: number; cantidad: number }> {
  const filas = await ejecutor
    .select()
    .from(inventarioStock)
    .where(and(eq(inventarioStock.bodegaId, bodegaId), eq(inventarioStock.productoId, productoId)))
    .limit(1);
  if (filas[0]) return { id: filas[0].id, cantidad: filas[0].cantidad };
  const [nueva] = await ejecutor
    .insert(inventarioStock)
    .values({ bodegaId: bodegaId, productoId: productoId, cantidad: 0 })
    .returning({ id: inventarioStock.id, cantidad: inventarioStock.cantidad });
  return { id: nueva.id, cantidad: nueva.cantidad };
}

/**
 * Ejecuta un movimiento transaccional (entrada/salida/ajuste) sobre stock y kardex.
 * @param delta variacion firmada de existencia en la bodega (CU-INV-001..003).
 */
async function aplicarMovimiento(
  bodegaId: number,
  productoId: number,
  tipo: string,
  delta: number,
  motivo: string,
  referencia: string | undefined,
  actor: { id?: string; rol?: string },
): Promise<ResultadoInventario> {
  const anio = new Date().getFullYear();
  let resultado: ResultadoInventario = { ok: false, codigoEstado: 500, error: 'error_interno' };
  await base.transaction(async function (transaccion) {
    const errorValido = await validarBodegaProducto(transaccion, bodegaId, productoId);
    if (errorValido) {
      resultado = { ok: false, codigoEstado: 409, error: errorValido };
      return;
    }
    const stock = await obtenerOcrearStock(transaccion, bodegaId, productoId);
    const stockResultante = stock.cantidad + delta;
    // Regla CU-INV-002/003: la existencia fisica nunca queda negativa.
    if (stockResultante < 0) {
      resultado = { ok: false, codigoEstado: 422, error: 'stock_insuficiente' };
      return;
    }
    const consecutivo = await proximoConsecutivo(transaccion, anio);
    const [movimiento] = await transaccion
      .insert(movimientosInventario)
      .values({
        consecutivo: consecutivo,
        bodegaId: bodegaId,
        productoId: productoId,
        tipo: tipo,
        cantidad: delta,
        stockResultante: stockResultante,
        motivo: String(motivo).trim(),
        referencia: referencia ? String(referencia).trim() || null : null,
        actorId: actor.id || null,
        actorRol: actor.rol || null,
      })
      .returning({
        id: movimientosInventario.id,
        consecutivo: movimientosInventario.consecutivo,
        tipo: movimientosInventario.tipo,
        cantidad: movimientosInventario.cantidad,
        stockResultante: movimientosInventario.stockResultante,
      });
    await transaccion
      .update(inventarioStock)
      .set({ cantidad: stockResultante, actualizadoEn: new Date() })
      .where(eq(inventarioStock.id, stock.id));
    await sincronizarStockProducto(transaccion, productoId);
    await encolarEvento(transaccion, {
      tipoAgregado: 'Inventario',
      idAgregado: String(productoId),
      tipoEvento: EVENTO_INVENTARIO_STOCK_ACTUALIZADO,
      claveIdempotencia: consecutivo,
      datos: {
        consecutivo: consecutivo,
        bodegaId: bodegaId,
        productoId: productoId,
        tipo: tipo,
        stockResultante: stockResultante,
      },
    });
    resultado = { ok: true, datos: movimiento };
  });
  return resultado;
}

/**
 * Registra una entrada de inventario (CU-INV-001): incrementa la existencia.
 */
export async function registrarEntrada(
  datos: DatosMovimiento,
  actor: { id?: string; rol?: string },
): Promise<ResultadoInventario> {
  const valido = validarMovimiento(datos);
  if (valido.error) return { ok: false, codigoEstado: 400, error: valido.error };
  return aplicarMovimiento(
    datos.bodegaId,
    datos.productoId,
    MOVIMIENTO_ENTRADA,
    datos.cantidad,
    datos.motivo,
    datos.referencia,
    actor,
  );
}

/**
 * Registra una salida de inventario (CU-INV-002): decrementa la existencia.
 */
export async function registrarSalida(
  datos: DatosMovimiento,
  actor: { id?: string; rol?: string },
): Promise<ResultadoInventario> {
  const valido = validarMovimiento(datos);
  if (valido.error) return { ok: false, codigoEstado: 400, error: valido.error };
  return aplicarMovimiento(
    datos.bodegaId,
    datos.productoId,
    MOVIMIENTO_SALIDA,
    -datos.cantidad,
    datos.motivo,
    datos.referencia,
    actor,
  );
}

/**
 * Registra un ajuste de inventario (CU-INV-003) con la cantidad real contada:
 * diferencial = cantidadReal - stockActual; motivo (justificacion) obligatorio.
 */
export async function registrarAjuste(
  datos: DatosMovimiento & { cantidadReal: number },
  actor: { id?: string; rol?: string },
): Promise<ResultadoInventario> {
  const valido = validarMovimiento(datos);
  if (valido.error) return { ok: false, codigoEstado: 400, error: valido.error };
  if (!Number.isInteger(datos.cantidadReal) || datos.cantidadReal < 0)
    return { ok: false, codigoEstado: 400, error: 'cantidad_real_invalida' };
  const bodega = await base.select().from(bodegas).where(eq(bodegas.id, datos.bodegaId)).limit(1);
  const producto = await base
    .select()
    .from(productos)
    .where(eq(productos.id, datos.productoId))
    .limit(1);
  if (!bodega[0] || bodega[0].estado !== ESTADO_ACTIVO)
    return { ok: false, codigoEstado: 409, error: 'bodega_inactiva' };
  if (!producto[0] || producto[0].estado !== ESTADO_ACTIVO)
    return { ok: false, codigoEstado: 409, error: 'producto_inactivo' };
  const filaStock = await obtenerOcrearStock(base, datos.bodegaId, datos.productoId);
  const delta = datos.cantidadReal - filaStock.cantidad;
  if (delta === 0) return { ok: true, datos: { sinCambio: true } };
  return aplicarMovimiento(
    datos.bodegaId,
    datos.productoId,
    MOVIMIENTO_AJUSTE,
    delta,
    datos.motivo,
    datos.referencia,
    actor,
  );
}

// ---------------------------------------------------------------------------
// Bodegas (CU-INV-005) y consultas de stock/kardex (CU-INV-006/007/008).
// ---------------------------------------------------------------------------

/**
 * Lista las bodegas (activas por defecto).
 */
export async function listarBodegas(soloActivas = true) {
  const consulta = base.select().from(bodegas);
  return soloActivas
    ? consulta.where(eq(bodegas.estado, ESTADO_ACTIVO)).orderBy(asc(bodegas.nombre))
    : consulta.orderBy(asc(bodegas.nombre));
}

/**
 * Crea una bodega (CU-INV-005).
 */
export async function crearBodega(datos: DatosBodega): Promise<ResultadoInventario> {
  const normalizado = normalizarDatosBodega(datos);
  if (normalizado.error) return { ok: false, codigoEstado: 400, error: normalizado.error };
  const nombre = (normalizado.datos as DatosBodega).nombre;
  const ubicacion = (normalizado.datos as DatosBodega).ubicacion;
  const existente = await base.select().from(bodegas).where(eq(bodegas.nombre, nombre)).limit(1);
  if (existente[0]) return { ok: false, codigoEstado: 409, error: 'bodega_ya_existe' };
  const [creada] = await base
    .insert(bodegas)
    .values({ nombre: nombre, ubicacion: ubicacion || null })
    .returning({ id: bodegas.id, nombre: bodegas.nombre, ubicacion: bodegas.ubicacion });
  return { ok: true, datos: creada };
}

/**
 * Inactiva una bodega (CU-INV-005).
 */
export async function inactivarBodega(id: number): Promise<ResultadoInventario> {
  const existente = await base.select().from(bodegas).where(eq(bodegas.id, id)).limit(1);
  if (!existente[0]) return { ok: false, codigoEstado: 404, error: 'bodega_no_encontrada' };
  await base
    .update(bodegas)
    .set({ estado: ESTADO_INACTIVO, actualizadoEn: new Date() })
    .where(eq(bodegas.id, id));
  return { ok: true, datos: { id: id, estado: ESTADO_INACTIVO } };
}

/**
 * Consulta existencias por bodega y producto (CU-INV-008), marcando stock bajo minimo (CU-INV-007).
 */
export async function consultarStock() {
  const filas = await base
    .select({
      bodegaId: inventarioStock.bodegaId,
      bodegaNombre: bodegas.nombre,
      productoId: inventarioStock.productoId,
      productoNombre: productos.nombre,
      cantidad: inventarioStock.cantidad,
      stockMinimo: inventarioStock.stockMinimo,
    })
    .from(inventarioStock)
    .innerJoin(bodegas, eq(inventarioStock.bodegaId, bodegas.id))
    .innerJoin(productos, eq(inventarioStock.productoId, productos.id))
    .where(eq(bodegas.estado, ESTADO_ACTIVO))
    .orderBy(asc(bodegas.nombre), asc(productos.nombre));
  return filas.map(function (fila) {
    return { ...fila, bajoMinimo: fila.cantidad < fila.stockMinimo };
  });
}

/**
 * Configura el stock minimo de un producto en una bodega (CU-INV-007).
 */
export async function actualizarStockMinimo(
  bodegaId: number,
  productoId: number,
  stockMinimo: number,
): Promise<ResultadoInventario> {
  if (!Number.isInteger(stockMinimo) || stockMinimo < 0)
    return { ok: false, codigoEstado: 400, error: 'stock_minimo_invalido' };
  const stock = await obtenerOcrearStock(base, bodegaId, productoId);
  await base
    .update(inventarioStock)
    .set({ stockMinimo: stockMinimo, actualizadoEn: new Date() })
    .where(eq(inventarioStock.id, stock.id));
  return { ok: true, datos: { id: stock.id, stockMinimo: stockMinimo } };
}

/**
 * Consulta el kardex transaccional (CU-INV-006): movimientos recientes con saldo resultante.
 */
export async function consultarKardex(
  opciones: { productoId?: number; bodegaId?: number; limite?: number } = {},
) {
  const limite = Math.min(opciones.limite || 60, 200);
  const condiciones = [];
  if (opciones.productoId)
    condiciones.push(eq(movimientosInventario.productoId, opciones.productoId));
  if (opciones.bodegaId) condiciones.push(eq(movimientosInventario.bodegaId, opciones.bodegaId));
  const baseConsulta = base
    .select({
      id: movimientosInventario.id,
      consecutivo: movimientosInventario.consecutivo,
      tipo: movimientosInventario.tipo,
      cantidad: movimientosInventario.cantidad,
      stockResultante: movimientosInventario.stockResultante,
      motivo: movimientosInventario.motivo,
      referencia: movimientosInventario.referencia,
      actorRol: movimientosInventario.actorRol,
      creadoEn: movimientosInventario.creadoEn,
      bodegaNombre: bodegas.nombre,
      productoId: productos.id,
      productoNombre: productos.nombre,
    })
    .from(movimientosInventario)
    .innerJoin(bodegas, eq(movimientosInventario.bodegaId, bodegas.id))
    .innerJoin(productos, eq(movimientosInventario.productoId, productos.id));
  const filas = condiciones.length
    ? await baseConsulta
        .where(and(...condiciones))
        .orderBy(desc(movimientosInventario.creadoEn), desc(movimientosInventario.id))
        .limit(limite)
    : await baseConsulta
        .orderBy(desc(movimientosInventario.creadoEn), desc(movimientosInventario.id))
        .limit(limite);
  return filas;
}
