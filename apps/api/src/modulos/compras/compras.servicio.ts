// Servicio de Compras avanzado del ERP (CU-ERP-002..009).
// Flujo: solicitud (PR) -> orden de compra (PO) -> aprobacion -> recepcion -> entrada a inventario -> cuenta por pagar.
import { asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { base } from '../../bd/base';
import {
  bodegas,
  cuentasPorPagar,
  ordenCompraLineas,
  ordenesCompra,
  productos,
  proveedores,
  solicitudesCompra,
} from '../../bd/esquema';
import {
  BASE_PUNTOS_BASICOS,
  CUENTA_PAGADA,
  CUENTA_PENDIENTE,
  ESTADO_ACTIVO,
  MAXIMO_LINEAS_ORDEN,
  TARIFA_IVA_BPS_POR_DEFECTO,
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

// Renglon de la orden de compra (CU-ERP-003): un producto con su cantidad y precio negociado.
export interface LineaOrdenCompra {
  productoId: number;
  cantidad: number;
  precioUnitarioCentavos: number;
}

export interface DatosOrdenCompra {
  solicitudId?: number;
  proveedorId: number;
  bodegaDestinoId: number;
  // Modo de una linea (compatibilidad con el MVP de CU-ERP-003).
  productoId?: number;
  cantidad?: number;
  precioUnitarioCentavos?: number;
  // Modo multi-linea: cada renglon con su producto, cantidad y precio.
  lineas?: LineaOrdenCompra[];
}

// Recepcion por linea (CU-ERP-007): cantidad recibida de un renglon concreto.
export interface RecepcionLinea {
  lineaId: number;
  cantidad: number;
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

/**
 * Lee la tarifa de IVA pactada con un proveedor (CU-ERP-003).
 * Entrada: ejecutor (base o transaccion) y el id del proveedor.
 * Salida: tarifa en puntos basicos; usa el valor por defecto si el proveedor no la define.
 */
async function tarifaIvaProveedor(ejecutor: any, proveedorId: number): Promise<number> {
  const filas = await ejecutor
    .select({ tarifaIvaBps: proveedores.tarifaIvaBps })
    .from(proveedores)
    .where(eq(proveedores.id, proveedorId))
    .limit(1);
  if (!filas[0] || filas[0].tarifaIvaBps === null || filas[0].tarifaIvaBps === undefined)
    return TARIFA_IVA_BPS_POR_DEFECTO;
  return Number(filas[0].tarifaIvaBps);
}

async function bodegaActiva(ejecutor: any, bodegaId: number): Promise<boolean> {
  const filas = await ejecutor.select().from(bodegas).where(eq(bodegas.id, bodegaId)).limit(1);
  return filas[0] ? filas[0].estado === ESTADO_ACTIVO : false;
}

const anio = function () {
  return new Date().getFullYear();
};

/**
 * Valida los renglones de una orden multi-linea (CU-ERP-003).
 * Entrada: lineas crudas del cuerpo HTTP. Salida: codigo de error o null si son validas.
 * Reglas: al menos un renglon, cantidades y precios enteros positivos, sin producto repetido.
 */
export function validarLineasOrden(lineas: LineaOrdenCompra[]): string | null {
  if (!Array.isArray(lineas) || !lineas.length) return 'lineas_obligatorias';
  if (lineas.length > MAXIMO_LINEAS_ORDEN) return 'demasiadas_lineas';
  const vistos = new Set<number>();
  for (const linea of lineas) {
    if (!validarEnteroPositivo(Number(linea.productoId))) return 'producto_invalido';
    if (!validarEnteroPositivo(Number(linea.cantidad))) return 'cantidad_invalida';
    if (!validarEnteroPositivo(Number(linea.precioUnitarioCentavos))) return 'precio_invalido';
    if (vistos.has(Number(linea.productoId))) return 'producto_duplicado_en_lineas';
    vistos.add(Number(linea.productoId));
  }
  return null;
}

/**
 * Calcula los totales de la orden a partir de sus renglones y el IVA del proveedor (CU-ERP-003).
 * Entrada: lineas ya validadas y tarifa en puntos basicos (1900 = 19,00%).
 * Salida: cantidad total de unidades, subtotal, IVA y total en centavos.
 * Regla: el IVA se redondea al centavo mas cercano sobre el subtotal completo de la orden.
 */
export function calcularTotalesOrden(
  lineas: LineaOrdenCompra[],
  tarifaBps: number,
): {
  cantidadTotal: number;
  subtotalCentavos: number;
  impuestoCentavos: number;
  totalCentavos: number;
} {
  let cantidadTotal = 0;
  let subtotalCentavos = 0;
  for (const linea of lineas) {
    cantidadTotal += Number(linea.cantidad);
    subtotalCentavos += Number(linea.cantidad) * Number(linea.precioUnitarioCentavos);
  }
  const impuestoCentavos = Math.round((subtotalCentavos * Number(tarifaBps)) / BASE_PUNTOS_BASICOS);
  return {
    cantidadTotal: cantidadTotal,
    subtotalCentavos: subtotalCentavos,
    impuestoCentavos: impuestoCentavos,
    totalCentavos: subtotalCentavos + impuestoCentavos,
  };
}

/**
 * Normaliza las lineas recibidas del cuerpo HTTP (CU-ERP-003).
 * Acepta el modo multi-linea y, por compatibilidad, el modo de una linea del MVP.
 */
export function normalizarLineasOrden(datos: DatosOrdenCompra): LineaOrdenCompra[] {
  if (Array.isArray(datos.lineas) && datos.lineas.length) {
    return datos.lineas.map(function (linea) {
      return {
        productoId: Number(linea.productoId),
        cantidad: Number(linea.cantidad),
        precioUnitarioCentavos: Number(linea.precioUnitarioCentavos),
      };
    });
  }
  return [
    {
      productoId: Number(datos.productoId),
      cantidad: Number(datos.cantidad),
      precioUnitarioCentavos: Number(datos.precioUnitarioCentavos),
    },
  ];
}

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
 * Crea la orden de compra multi-linea (CU-ERP-003).
 * Entrada: proveedor, bodega destino y los renglones (producto, cantidad, precio negociado).
 * Salida: id y referencia de la orden creada con sus totales.
 * Reglas: proveedor y bodega activos; cada producto debe estar activo; sin producto repetido;
 * el IVA se toma del proveedor (tarifa_iva_bps) y queda congelado en la orden;
 * si viene de una solicitud (CU-ERP-002) se toma su producto y cantidad y se marca convertida.
 */
export async function crearOrdenCompra(
  datos: DatosOrdenCompra,
  actor: ActorSolicitud,
): Promise<ResultadoCompras> {
  let lineas = normalizarLineasOrden(datos);
  if (datos.solicitudId) {
    const filasSolicitud = await base
      .select()
      .from(solicitudesCompra)
      .where(eq(solicitudesCompra.id, Number(datos.solicitudId)))
      .limit(1);
    const solicitud = filasSolicitud[0];
    if (!solicitud || solicitud.estado !== SOLICITUD_PENDIENTE_REVISION)
      return { ok: false, codigoEstado: 409, error: 'solicitud_no_disponible' };
    lineas = [
      {
        productoId: solicitud.productoId,
        cantidad: solicitud.cantidad,
        precioUnitarioCentavos: Number(datos.precioUnitarioCentavos),
      },
    ];
  }
  const errorLineas = validarLineasOrden(lineas);
  if (errorLineas) return { ok: false, codigoEstado: 400, error: errorLineas };
  if (!(await proveedorActivo(base, Number(datos.proveedorId))))
    return { ok: false, codigoEstado: 409, error: 'proveedor_inactivo' };
  if (!(await bodegaActiva(base, Number(datos.bodegaDestinoId))))
    return { ok: false, codigoEstado: 409, error: 'bodega_inactiva' };
  for (const linea of lineas) {
    if (!(await productoActivo(base, linea.productoId)))
      return { ok: false, codigoEstado: 409, error: 'producto_inactivo' };
  }
  const tarifaBps = await tarifaIvaProveedor(base, Number(datos.proveedorId));
  const totales = calcularTotalesOrden(lineas, tarifaBps);

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
        // En el modo multi-linea el producto vive en cada renglon, no en la cabecera.
        productoId: lineas.length === 1 ? lineas[0].productoId : null,
        bodegaDestinoId: Number(datos.bodegaDestinoId),
        cantidadPedida: totales.cantidadTotal,
        precioUnitarioCentavos: lineas.length === 1 ? lineas[0].precioUnitarioCentavos : null,
        tarifaIvaBps: tarifaBps,
        subtotalCentavos: totales.subtotalCentavos,
        impuestoCentavos: totales.impuestoCentavos,
        totalCentavos: totales.totalCentavos,
        estado: ORDEN_PENDIENTE_APROBACION,
        creadoPorRol: actor.rol || null,
      })
      .returning({
        id: ordenesCompra.id,
        referencia: ordenesCompra.referencia,
        estado: ordenesCompra.estado,
      });
    ordenId = orden.id;
    await transaccion.insert(ordenCompraLineas).values(
      lineas.map(function (linea, indice) {
        return {
          ordenId: orden.id,
          numeroLinea: indice + 1,
          productoId: linea.productoId,
          cantidadPedida: linea.cantidad,
          precioUnitarioCentavos: linea.precioUnitarioCentavos,
        };
      }),
    );
    if (datos.solicitudId) {
      await transaccion
        .update(solicitudesCompra)
        .set({ estado: SOLICITUD_CONVERTIDA })
        .where(eq(solicitudesCompra.id, Number(datos.solicitudId)));
    }
  });
  return {
    ok: true,
    datos: {
      id: ordenId,
      referencia: referencia,
      lineas: lineas.length,
      tarifaIvaBps: tarifaBps,
      subtotalCentavos: totales.subtotalCentavos,
      impuestoCentavos: totales.impuestoCentavos,
      totalCentavos: totales.totalCentavos,
    },
  };
}

const seleccionOrden = {
  id: ordenesCompra.id,
  referencia: ordenesCompra.referencia,
  solicitudId: ordenesCompra.solicitudId,
  proveedorId: proveedores.id,
  proveedorNombre: proveedores.nombre,
  proveedorTarifaIvaBps: proveedores.tarifaIvaBps,
  bodegaId: bodegas.id,
  bodegaNombre: bodegas.nombre,
  cantidadPedida: ordenesCompra.cantidadPedida,
  cantidadRecibida: ordenesCompra.cantidadRecibida,
  tarifaIvaBps: ordenesCompra.tarifaIvaBps,
  subtotalCentavos: ordenesCompra.subtotalCentavos,
  impuestoCentavos: ordenesCompra.impuestoCentavos,
  totalCentavos: ordenesCompra.totalCentavos,
  estado: ordenesCompra.estado,
  creadoEn: ordenesCompra.creadoEn,
};

/**
 * Agrega los totales y el saldo pendiente a la cabecera de una orden.
 */
function conTotales(fila: any, lineas: any[] = []) {
  return {
    ...fila,
    lineas: lineas,
    totalLineas: lineas.length,
    saldoPendiente: fila.cantidadPedida - fila.cantidadRecibida,
  };
}

/**
 * Carga los renglones de un conjunto de ordenes y los agrupa por orden (CU-ERP-003/006).
 * Entrada: ids de orden. Salida: mapa ordenId -> lineas con su subtotal y saldo.
 */
async function lineasPorOrden(ids: number[]) {
  const mapa = new Map<number, any[]>();
  if (!ids.length) return mapa;
  const filas = await base
    .select({
      id: ordenCompraLineas.id,
      ordenId: ordenCompraLineas.ordenId,
      numeroLinea: ordenCompraLineas.numeroLinea,
      productoId: productos.id,
      productoNombre: productos.nombre,
      cantidadPedida: ordenCompraLineas.cantidadPedida,
      cantidadRecibida: ordenCompraLineas.cantidadRecibida,
      precioUnitarioCentavos: ordenCompraLineas.precioUnitarioCentavos,
    })
    .from(ordenCompraLineas)
    .innerJoin(productos, eq(ordenCompraLineas.productoId, productos.id))
    .where(inArray(ordenCompraLineas.ordenId, ids))
    .orderBy(asc(ordenCompraLineas.ordenId), asc(ordenCompraLineas.numeroLinea));
  for (const fila of filas) {
    const lista = mapa.get(fila.ordenId) || [];
    lista.push({
      ...fila,
      subtotalCentavos: fila.cantidadPedida * fila.precioUnitarioCentavos,
      saldoPendiente: fila.cantidadPedida - fila.cantidadRecibida,
    });
    mapa.set(fila.ordenId, lista);
  }
  return mapa;
}

/**
 * Construye la consulta de ordenes con sus relaciones (fresca por llamada, evita builders compartidos).
 * El producto no se une aqui: vive en cada renglon de la orden (CU-ERP-003).
 */
function consultaOrdenes() {
  return base
    .select(seleccionOrden)
    .from(ordenesCompra)
    .innerJoin(proveedores, eq(ordenesCompra.proveedorId, proveedores.id))
    .innerJoin(bodegas, eq(ordenesCompra.bodegaDestinoId, bodegas.id));
}

/**
 * Lista ordenes de compra (CU-ERP-006).
 */
export async function listarOrdenesCompra() {
  const filas = await consultaOrdenes().orderBy(desc(ordenesCompra.id));
  const lineas = await lineasPorOrden(
    filas.map(function (fila) {
      return fila.id;
    }),
  );
  return filas.map(function (fila) {
    return conTotales(fila, lineas.get(fila.id) || []);
  });
}

/**
 * Consulta una orden de compra por id con sus renglones (CU-ERP-006).
 */
export async function obtenerOrdenCompra(id: number) {
  const filas = await consultaOrdenes().where(eq(ordenesCompra.id, id)).limit(1);
  if (!filas[0]) return null;
  const lineas = await lineasPorOrden([id]);
  return conTotales(filas[0], lineas.get(id) || []);
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
 * Convierte el cuerpo de la recepcion en renglones a recibir (CU-ERP-007).
 * Entrada: recepciones por linea o la cantidad suelta del modo de una linea.
 * Salida: renglones a recibir o el codigo de error correspondiente.
 * Regla: el modo de cantidad suelta solo aplica a ordenes de un unico renglon.
 */
function normalizarRecepciones(
  lineas: { id: number; cantidadPedida: number; cantidadRecibida: number }[],
  recepciones: RecepcionLinea[] | number,
): { error?: string; codigoEstado?: number; items?: { linea: any; cantidad: number }[] } {
  if (typeof recepciones === 'number') {
    if (lineas.length !== 1) return { error: 'recepcion_por_linea_requerida', codigoEstado: 400 };
    return { items: [{ linea: lineas[0], cantidad: recepciones }] };
  }
  if (!Array.isArray(recepciones) || !recepciones.length)
    return { error: 'recepcion_sin_lineas', codigoEstado: 400 };
  const items: { linea: any; cantidad: number }[] = [];
  const vistas = new Set<number>();
  for (const recepcion of recepciones) {
    const linea = lineas.filter(function (fila) {
      return fila.id === Number(recepcion.lineaId);
    })[0];
    if (!linea) return { error: 'linea_no_encontrada', codigoEstado: 404 };
    if (vistas.has(linea.id)) return { error: 'linea_duplicada', codigoEstado: 400 };
    vistas.add(linea.id);
    const cantidad = Number(recepcion.cantidad);
    if (!validarEnteroPositivo(cantidad)) return { error: 'cantidad_invalida', codigoEstado: 400 };
    if (cantidad > linea.cantidadPedida - linea.cantidadRecibida)
      return { error: 'cantidad_excede_saldo', codigoEstado: 422 };
    items.push({ linea: linea, cantidad: cantidad });
  }
  return { items: items };
}

/**
 * Registra la recepcion de mercancia por linea (CU-ERP-007) e ingresa al inventario (CU-ERP-008).
 * Entrada: id de la orden, renglones recibidos (lineaId + cantidad) y el actor autenticado.
 * Salida: cantidades acumuladas, estado de la orden, movimientos de inventario y cuenta por pagar.
 * Reglas: la orden debe estar aprobada o parcialmente recibida; ninguna linea puede exceder su saldo;
 * la orden se completa cuando todas las lineas llegan a su cantidad pedida y entonces se causa
 * la cuenta por pagar por el total con IVA (CU-ERP-009).
 */
export async function registrarRecepcionOrden(
  id: number,
  recepciones: RecepcionLinea[] | number,
  actor: ActorSolicitud,
): Promise<ResultadoCompras> {
  const filas = await base.select().from(ordenesCompra).where(eq(ordenesCompra.id, id)).limit(1);
  const orden = filas[0];
  if (!orden) return { ok: false, codigoEstado: 404, error: 'orden_no_encontrada' };
  if (orden.estado !== ORDEN_APROBADA && orden.estado !== ORDEN_RECIBIDA_PARCIAL)
    return { ok: false, codigoEstado: 409, error: 'orden_no_recibible' };
  const lineas = await base
    .select()
    .from(ordenCompraLineas)
    .where(eq(ordenCompraLineas.ordenId, id))
    .orderBy(asc(ordenCompraLineas.numeroLinea));
  if (!lineas.length) return { ok: false, codigoEstado: 409, error: 'orden_sin_lineas' };
  const normalizado = normalizarRecepciones(lineas, recepciones);
  if (normalizado.error)
    return {
      ok: false,
      codigoEstado: normalizado.codigoEstado || 400,
      error: normalizado.error,
    };

  const movimientos: unknown[] = [];
  const recibidoPorLinea = new Map<number, number>();
  for (const item of normalizado.items || []) {
    const entrada = await registrarEntrada(
      {
        bodegaId: orden.bodegaDestinoId,
        productoId: item.linea.productoId,
        cantidad: item.cantidad,
        motivo: 'Recepcion ' + orden.referencia + ' linea ' + item.linea.numeroLinea,
        referencia: orden.referencia,
      },
      actor,
    );
    if (!entrada.ok) return entrada as ResultadoCompras;
    movimientos.push(entrada.datos);
    recibidoPorLinea.set(item.linea.id, item.cantidad);
  }

  let nuevaRecibida = 0;
  let completa = true;
  await base.transaction(async function (transaccion) {
    for (const linea of lineas) {
      const cantidad = recibidoPorLinea.get(linea.id) || 0;
      const acumulada = linea.cantidadRecibida + cantidad;
      nuevaRecibida += acumulada;
      if (acumulada !== linea.cantidadPedida) completa = false;
      if (cantidad > 0) {
        await transaccion
          .update(ordenCompraLineas)
          .set({ cantidadRecibida: acumulada })
          .where(eq(ordenCompraLineas.id, linea.id));
      }
    }
    await transaccion
      .update(ordenesCompra)
      .set({
        cantidadRecibida: nuevaRecibida,
        estado: completa ? ORDEN_COMPLETADA : ORDEN_RECIBIDA_PARCIAL,
        actualizadoEn: new Date(),
      })
      .where(eq(ordenesCompra.id, id));
  });

  let cuenta: unknown = null;
  if (completa) {
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
          // El importe a pagar es el total de la orden con el IVA del proveedor (CU-ERP-009).
          montoCentavos: orden.totalCentavos,
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
      estado: completa ? ORDEN_COMPLETADA : ORDEN_RECIBIDA_PARCIAL,
      movimientosInventario: movimientos,
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
