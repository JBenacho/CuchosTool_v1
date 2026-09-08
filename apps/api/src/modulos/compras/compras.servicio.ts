// Servicio de Compras avanzado del ERP (CU-ERP-002..009).
// Flujo: solicitud (PR) -> orden de compra (PO) -> aprobacion -> recepcion -> entrada a inventario -> cuenta por pagar.
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { base } from '../../bd/base';
import {
  bodegas,
  cuentasPorPagar,
  ordenesCompra,
  productos,
  proveedores,
  solicitudesCompra,
} from '../../bd/esquema';
import {
  CUENTA_PAGADA,
  CUENTA_PENDIENTE,
  ESTADO_ACTIVO,
  ORDEN_APROBADA,
  ORDEN_CANCELADA,
  ORDEN_COMPLETADA,
  ORDEN_PENDIENTE_APROBACION,
  ORDEN_RECIBIDA_PARCIAL,
  SOLICITUD_CANCELADA,
  SOLICITUD_CONVERTIDA,
  SOLICITUD_PENDIENTE_REVISION,
  TERMINO_PAGO_DIAS_POR_DEFECTO,
} from '../../dominio/constantes';
import { registrarEntrada } from '../inventario/inventario.servicio';

export type ResultadoCompras = {
  ok: boolean;
  codigoEstado?: number;
  error?: string;
  datos?: unknown;
};

export interface DatosSolicitud {
  productoId: number;
  cantidad: number;
  motivo: string;
}

export interface DatosOrdenCompra {
  solicitudId?: number;
  proveedorId: number;
  bodegaDestinoId: number;
  productoId?: number;
  cantidad?: number;
  precioUnitarioCentavos: number;
}

export interface ActorSolicitud {
  id?: string;
  rol?: string;
}

function like(columna: unknown, patron: string) {
  return sql`${columna} like ${patron}`;
}

async function siguienteReferencia(
  ejecutor: any,
  prefijo: string,
  anio: number,
  desde: any,
): Promise<string> {
  const filas = await ejecutor
    .select({ referencia: desde.referencia })
    .from(desde.tabla)
    .where(like(desde.referencia, prefijo + '-' + anio + '-%'))
    .orderBy(desc(desde.referencia))
    .limit(1);
  const ultimo = filas[0] ? parseInt(String(filas[0].referencia).split('-').pop() || '0', 10) : 0;
  return prefijo + '-' + anio + '-' + String(ultimo + 1).padStart(6, '0');
}

function validarEnteroPositivo(valor: number): boolean {
  return Number.isInteger(valor) && valor > 0;
}

async function productoActivo(ejecutor: any, productoId: number): Promise<boolean> {
  const filas = await ejecutor
    .select()
    .from(productos)
    .where(eq(productos.id, productoId))
    .limit(1);
  return filas[0] ? filas[0].estado === ESTADO_ACTIVO : false;
}

async function proveedorActivo(ejecutor: any, proveedorId: number): Promise<boolean> {
  const filas = await ejecutor
    .select()
    .from(proveedores)
    .where(eq(proveedores.id, proveedorId))
    .limit(1);
  return filas[0] ? filas[0].estado === ESTADO_ACTIVO : false;
}

async function bodegaActiva(ejecutor: any, bodegaId: number): Promise<boolean> {
  const filas = await ejecutor.select().from(bodegas).where(eq(bodegas.id, bodegaId)).limit(1);
  return filas[0] ? filas[0].estado === ESTADO_ACTIVO : false;
}

const anio = function () {
  return new Date().getFullYear();
};

/**
 * Calcula la fecha de vencimiento de una cuenta por pagar (CU-ERP-009):
 * receiptDate + paymentTermsDays del proveedor (plazo por defecto configurable).
 */
export function calcularFechaVencimiento(dias: number, desde: Date = new Date()): Date {
  return new Date(desde.getTime() + dias * 24 * 3600 * 1000);
}

/**
 * Registra una solicitud interna de compra (CU-ERP-002): justificacion obligatoria y cantidad positiva.
 */
export async function crearSolicitudCompra(
  datos: DatosSolicitud,
  actor: ActorSolicitud,
): Promise<ResultadoCompras> {
  const cantidad = Number(datos.cantidad);
  if (!validarEnteroPositivo(cantidad))
    return { ok: false, codigoEstado: 400, error: 'cantidad_invalida' };
  const motivo = String(datos.motivo || '').trim();
  if (!motivo) return { ok: false, codigoEstado: 400, error: 'motivo_obligatorio' };
  const productoOk = await productoActivo(base, Number(datos.productoId));
  if (!productoOk) return { ok: false, codigoEstado: 409, error: 'producto_inactivo' };
  const referencia = await siguienteReferencia(base, 'SC', anio(), {
    referencia: solicitudesCompra.referencia,
    tabla: solicitudesCompra,
  });
  const [solicitud] = await base
    .insert(solicitudesCompra)
    .values({
      referencia: referencia,
      productoId: Number(datos.productoId),
      cantidad: cantidad,
      motivo: motivo,
      solicitanteId: actor.id || null,
      solicitanteRol: actor.rol || null,
      estado: SOLICITUD_PENDIENTE_REVISION,
    })
    .returning({
      id: solicitudesCompra.id,
      referencia: solicitudesCompra.referencia,
      estado: solicitudesCompra.estado,
    });
  return { ok: true, datos: solicitud };
}

/**
 * Lista solicitudes de compra con el producto asociado.
 */
export async function listarSolicitudesCompra() {
  return base
    .select({
      id: solicitudesCompra.id,
      referencia: solicitudesCompra.referencia,
      productoId: productos.id,
      productoNombre: productos.nombre,
      cantidad: solicitudesCompra.cantidad,
      motivo: solicitudesCompra.motivo,
      estado: solicitudesCompra.estado,
      creadoEn: solicitudesCompra.creadoEn,
    })
    .from(solicitudesCompra)
    .innerJoin(productos, eq(solicitudesCompra.productoId, productos.id))
    .orderBy(desc(solicitudesCompra.id));
}

/**
 * Cancela una solicitud en revision (CU-ERP-002).
 */
export async function cancelarSolicitudCompra(id: number): Promise<ResultadoCompras> {
  const existente = await base
    .select()
    .from(solicitudesCompra)
    .where(eq(solicitudesCompra.id, id))
    .limit(1);
  if (!existente[0]) return { ok: false, codigoEstado: 404, error: 'solicitud_no_encontrada' };
  if (existente[0].estado !== SOLICITUD_PENDIENTE_REVISION)
    return { ok: false, codigoEstado: 409, error: 'solicitud_no_cancelable' };
  await base
    .update(solicitudesCompra)
    .set({ estado: SOLICITUD_CANCELADA })
    .where(eq(solicitudesCompra.id, id));
  return { ok: true, datos: { id: id, estado: SOLICITUD_CANCELADA } };
}

/**
 * Crea la orden de compra (CU-ERP-003): proveedor y bodega activos, precio negociado en centavos.
 * Si viene de una solicitud, toma su producto y cantidad y la marca como convertida.
 */
export async function crearOrdenCompra(
  datos: DatosOrdenCompra,
  actor: ActorSolicitud,
): Promise<ResultadoCompras> {
  let productoId = Number(datos.productoId);
  let cantidad = Number(datos.cantidad);
  if (datos.solicitudId) {
    const filasSolicitud = await base
      .select()
      .from(solicitudesCompra)
      .where(eq(solicitudesCompra.id, Number(datos.solicitudId)))
      .limit(1);
    const solicitud = filasSolicitud[0];
    if (!solicitud || solicitud.estado !== SOLICITUD_PENDIENTE_REVISION)
      return { ok: false, codigoEstado: 409, error: 'solicitud_no_disponible' };
    productoId = solicitud.productoId;
    cantidad = solicitud.cantidad;
  }
  if (!validarEnteroPositivo(cantidad) || !validarEnteroPositivo(productoId))
    return { ok: false, codigoEstado: 400, error: 'cantidad_invalida' };
  const precio = Number(datos.precioUnitarioCentavos);
  if (!validarEnteroPositivo(precio))
    return { ok: false, codigoEstado: 400, error: 'precio_invalido' };
  if (!(await proveedorActivo(base, Number(datos.proveedorId))))
    return { ok: false, codigoEstado: 409, error: 'proveedor_inactivo' };
  if (!(await bodegaActiva(base, Number(datos.bodegaDestinoId))))
    return { ok: false, codigoEstado: 409, error: 'bodega_inactiva' };
  if (!(await productoActivo(base, productoId)))
    return { ok: false, codigoEstado: 409, error: 'producto_inactivo' };

  const referencia = await siguienteReferencia(base, 'OC', anio(), {
    referencia: ordenesCompra.referencia,
    tabla: ordenesCompra,
  });
  let ordenId: number | undefined;
  await base.transaction(async function (transaccion) {
    const [orden] = await transaccion
      .insert(ordenesCompra)
      .values({
        referencia: referencia,
        solicitudId: datos.solicitudId ? Number(datos.solicitudId) : null,
        proveedorId: Number(datos.proveedorId),
        productoId: productoId,
        bodegaDestinoId: Number(datos.bodegaDestinoId),
        cantidadPedida: cantidad,
        precioUnitarioCentavos: precio,
        estado: ORDEN_PENDIENTE_APROBACION,
        creadoPorRol: actor.rol || null,
      })
      .returning({
        id: ordenesCompra.id,
        referencia: ordenesCompra.referencia,
        estado: ordenesCompra.estado,
      });
    ordenId = orden.id;
    if (datos.solicitudId) {
      await transaccion
        .update(solicitudesCompra)
        .set({ estado: SOLICITUD_CONVERTIDA })
        .where(eq(solicitudesCompra.id, Number(datos.solicitudId)));
    }
  });
  return { ok: true, datos: { id: ordenId, referencia: referencia } };
}

const seleccionOrden = {
  id: ordenesCompra.id,
  referencia: ordenesCompra.referencia,
  solicitudId: ordenesCompra.solicitudId,
  proveedorId: proveedores.id,
  proveedorNombre: proveedores.nombre,
  productoId: productos.id,
  productoNombre: productos.nombre,
  bodegaId: bodegas.id,
  bodegaNombre: bodegas.nombre,
  cantidadPedida: ordenesCompra.cantidadPedida,
  cantidadRecibida: ordenesCompra.cantidadRecibida,
  precioUnitarioCentavos: ordenesCompra.precioUnitarioCentavos,
  estado: ordenesCompra.estado,
  creadoEn: ordenesCompra.creadoEn,
};

function conTotales(fila: any) {
  const totalCentavos = fila.cantidadPedida * fila.precioUnitarioCentavos;
  return {
    ...fila,
    totalCentavos: totalCentavos,
    saldoPendiente: fila.cantidadPedida - fila.cantidadRecibida,
  };
}

/**
 * Construye la consulta de ordenes con sus relaciones (fresca por llamada, evita builders compartidos).
 */
function consultaOrdenes() {
  return base
    .select(seleccionOrden)
    .from(ordenesCompra)
    .innerJoin(proveedores, eq(ordenesCompra.proveedorId, proveedores.id))
    .innerJoin(productos, eq(ordenesCompra.productoId, productos.id))
    .innerJoin(bodegas, eq(ordenesCompra.bodegaDestinoId, bodegas.id));
}

/**
 * Lista ordenes de compra (CU-ERP-006).
 */
export async function listarOrdenesCompra() {
  const filas = await consultaOrdenes().orderBy(desc(ordenesCompra.id));
  return filas.map(conTotales);
}

/**
 * Consulta una orden de compra por id (CU-ERP-006).
 */
export async function obtenerOrdenCompra(id: number) {
  const filas = await consultaOrdenes().where(eq(ordenesCompra.id, id)).limit(1);
  return filas[0] ? conTotales(filas[0]) : null;
}

/**
 * Aprueba la orden (CU-ERP-004): solo desde pendiente_aprobacion; rol contador/gerencia.
 */
export async function aprobarOrdenCompra(id: number): Promise<ResultadoCompras> {
  const filas = await base.select().from(ordenesCompra).where(eq(ordenesCompra.id, id)).limit(1);
  if (!filas[0]) return { ok: false, codigoEstado: 404, error: 'orden_no_encontrada' };
  if (filas[0].estado !== ORDEN_PENDIENTE_APROBACION)
    return { ok: false, codigoEstado: 409, error: 'orden_no_aprobable' };
  await base
    .update(ordenesCompra)
    .set({ estado: ORDEN_APROBADA, actualizadoEn: new Date() })
    .where(eq(ordenesCompra.id, id));
  return { ok: true, datos: { id: id, estado: ORDEN_APROBADA } };
}

/**
 * Cancela la orden mientras no tenga mercancia recibida.
 */
export async function cancelarOrdenCompra(id: number): Promise<ResultadoCompras> {
  const filas = await base.select().from(ordenesCompra).where(eq(ordenesCompra.id, id)).limit(1);
  if (!filas[0]) return { ok: false, codigoEstado: 404, error: 'orden_no_encontrada' };
  const orden = filas[0];
  if (
    orden.cantidadRecibida > 0 ||
    (orden.estado !== ORDEN_PENDIENTE_APROBACION && orden.estado !== ORDEN_APROBADA)
  )
    return { ok: false, codigoEstado: 409, error: 'orden_no_cancelable' };
  await base
    .update(ordenesCompra)
    .set({ estado: ORDEN_CANCELADA, actualizadoEn: new Date() })
    .where(eq(ordenesCompra.id, id));
  return { ok: true, datos: { id: id, estado: ORDEN_CANCELADA } };
}

/**
 * Registra la recepcion de mercancia (CU-ERP-007) e ingresa al inventario (CU-ERP-008).
 * Reglas: la orden debe estar aprobada; la cantidad recibida no puede exceder el saldo pendiente;
 * al completar la recepcion se causa la cuenta por pagar (CU-ERP-009).
 */
export async function registrarRecepcionOrden(
  id: number,
  cantidadRecibida: number,
  actor: ActorSolicitud,
): Promise<ResultadoCompras> {
  const filas = await base.select().from(ordenesCompra).where(eq(ordenesCompra.id, id)).limit(1);
  const orden = filas[0];
  if (!orden) return { ok: false, codigoEstado: 404, error: 'orden_no_encontrada' };
  if (orden.estado !== ORDEN_APROBADA && orden.estado !== ORDEN_RECIBIDA_PARCIAL)
    return { ok: false, codigoEstado: 409, error: 'orden_no_recibible' };
  const cantidad = Number(cantidadRecibida);
  const saldo = orden.cantidadPedida - orden.cantidadRecibida;
  if (!validarEnteroPositivo(cantidad) || cantidad > saldo)
    return { ok: false, codigoEstado: 422, error: 'cantidad_excede_saldo' };
  const entrada = await registrarEntrada(
    {
      bodegaId: orden.bodegaDestinoId,
      productoId: orden.productoId,
      cantidad: cantidad,
      motivo: 'Recepcion ' + orden.referencia,
      referencia: orden.referencia,
    },
    actor,
  );
  if (!entrada.ok) return entrada as ResultadoCompras;

  const nuevaRecibida = orden.cantidadRecibida + cantidad;
  const completa = nuevaRecibida === orden.cantidadPedida;
  const estadoNuevo = completa ? ORDEN_COMPLETADA : ORDEN_RECIBIDA_PARCIAL;
  await base
    .update(ordenesCompra)
    .set({ cantidadRecibida: nuevaRecibida, estado: estadoNuevo, actualizadoEn: new Date() })
    .where(eq(ordenesCompra.id, id));

  let cuenta: unknown = null;
  if (completa) {
    const monto = nuevaRecibida * orden.precioUnitarioCentavos;
    const vence = calcularFechaVencimiento(TERMINO_PAGO_DIAS_POR_DEFECTO);
    const existente = await base
      .select()
      .from(cuentasPorPagar)
      .where(eq(cuentasPorPagar.ordenId, id))
      .limit(1);
    if (!existente[0]) {
      const [creada] = await base
        .insert(cuentasPorPagar)
        .values({
          ordenId: id,
          proveedorId: orden.proveedorId,
          montoCentavos: monto,
          venceEn: vence,
          estado: CUENTA_PENDIENTE,
        })
        .returning({ id: cuentasPorPagar.id, montoCentavos: cuentasPorPagar.montoCentavos });
      cuenta = creada;
    }
  }
  return {
    ok: true,
    datos: {
      ordenId: id,
      cantidadRecibida: nuevaRecibida,
      estado: estadoNuevo,
      movimientoInventario: entrada.datos,
      cuentaPorPagar: cuenta,
    },
  };
}

/**
 * Lista cuentas por pagar de compras (CU-ERP-009).
 */
export async function listarCuentasPorPagar() {
  return base
    .select({
      id: cuentasPorPagar.id,
      ordenReferencia: ordenesCompra.referencia,
      proveedorNombre: proveedores.nombre,
      montoCentavos: cuentasPorPagar.montoCentavos,
      venceEn: cuentasPorPagar.venceEn,
      estado: cuentasPorPagar.estado,
      referenciaPago: cuentasPorPagar.referenciaPago,
      pagadaEn: cuentasPorPagar.pagadaEn,
    })
    .from(cuentasPorPagar)
    .innerJoin(ordenesCompra, eq(cuentasPorPagar.ordenId, ordenesCompra.id))
    .innerJoin(proveedores, eq(cuentasPorPagar.proveedorId, proveedores.id))
    .orderBy(desc(cuentasPorPagar.id));
}

/**
 * Marca pagada una cuenta por pagar (CU-ERP-009).
 */
export async function pagarCuentaPorPagar(
  id: number,
  referenciaPago: string,
): Promise<ResultadoCompras> {
  const referencia = String(referenciaPago || '').trim();
  if (!referencia) return { ok: false, codigoEstado: 400, error: 'referencia_pago_obligatoria' };
  const filas = await base
    .select()
    .from(cuentasPorPagar)
    .where(eq(cuentasPorPagar.id, id))
    .limit(1);
  if (!filas[0]) return { ok: false, codigoEstado: 404, error: 'cuenta_no_encontrada' };
  if (filas[0].estado !== CUENTA_PENDIENTE)
    return { ok: false, codigoEstado: 409, error: 'cuenta_no_pendiente' };
  await base
    .update(cuentasPorPagar)
    .set({ estado: CUENTA_PAGADA, referenciaPago: referencia, pagadaEn: new Date() })
    .where(eq(cuentasPorPagar.id, id));
  return { ok: true, datos: { id: id, estado: CUENTA_PAGADA } };
}
