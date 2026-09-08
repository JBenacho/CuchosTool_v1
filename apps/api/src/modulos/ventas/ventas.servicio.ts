// Servicio de Ventas del ERP (modulo Ventas/Pedidos del canal E-Commerce, CU-CM-007 base).
// Consulta el ciclo de pedidos como ventas y gestiona su estado (entregar/cancelar).
// Nota: la ficha CU-CM-007 (ordenes B2B con descuento ACID de inventario) se ampliara
// en un siguiente incremento con erp_sales_orders; aqui el canal unico es el E-Commerce.
import { and, desc, eq, inArray } from 'drizzle-orm';
import { base } from '../../bd/base';
import { clientes, pagos, pedidoArticulos, pedidos, productos } from '../../bd/esquema';
import {
  EVENTO_PEDIDO_ENTREGADO,
  PEDIDO_CANCELADO,
  PEDIDO_ENTREGADO,
  PEDIDO_PAGADO,
  PEDIDO_PENDIENTE_PAGO,
} from '../../dominio/constantes';
import { encolarEvento } from '../eventos/buzon.servicio';

export type ResultadoVenta = {
  ok: boolean;
  codigoEstado?: number;
  error?: string;
  datos?: unknown;
};

/**
 * Lista las ventas (pedidos del canal) con filtros opcionales por estado.
 * El cliente se resuelve por su id (pedido.clienteId guarda el id numerico como texto).
 */
export async function listarVentas(opciones: { estado?: string; limite?: number } = {}) {
  const limite = Math.min(opciones.limite || 100, 300);
  const consulta = base
    .select({
      id: pedidos.id,
      referenciaPedido: pedidos.referenciaPedido,
      clienteId: pedidos.clienteId,
      totalCentavos: pedidos.totalCentavos,
      moneda: pedidos.moneda,
      estado: pedidos.estado,
      creadoEn: pedidos.creadoEn,
    })
    .from(pedidos);
  const filas = opciones.estado
    ? await consulta
        .where(eq(pedidos.estado, opciones.estado))
        .orderBy(desc(pedidos.creadoEn))
        .limit(limite)
    : await consulta.orderBy(desc(pedidos.creadoEn)).limit(limite);
  const idsClientes = filas
    .map(function (fila) {
      return Number(fila.clienteId);
    })
    .filter(function (id) {
      return Number.isInteger(id);
    });
  const mapaClientes = new Map<number, { correo: string; nombre: string }>();
  if (idsClientes.length) {
    const filasClientes = await base
      .select({ id: clientes.id, correo: clientes.correo, nombre: clientes.nombre })
      .from(clientes)
      .where(inArray(clientes.id, idsClientes));
    for (const cliente of filasClientes) {
      mapaClientes.set(cliente.id, { correo: cliente.correo, nombre: cliente.nombre });
    }
  }
  return filas.map(function (fila) {
    const cliente = mapaClientes.get(Number(fila.clienteId));
    return {
      ...fila,
      clienteCorreo: cliente ? cliente.correo : null,
      clienteNombre: cliente ? cliente.nombre : null,
    };
  });
}

/**
 * Resumen de ventas para el ERP: totales por estado y monto de ventas efectivas.
 */
export async function resumenVentas() {
  const filas = await base
    .select({ estado: pedidos.estado, totalCentavos: pedidos.totalCentavos })
    .from(pedidos);
  const conteo: Record<string, number> = {};
  let efectivas = 0;
  let montoEfectivoCentavos = 0;
  let montoPendienteCentavos = 0;
  for (const fila of filas) {
    conteo[fila.estado] = (conteo[fila.estado] || 0) + 1;
    if (fila.estado === PEDIDO_PAGADO || fila.estado === PEDIDO_ENTREGADO) {
      efectivas++;
      montoEfectivoCentavos += fila.totalCentavos;
    }
    if (fila.estado === PEDIDO_PENDIENTE_PAGO) montoPendienteCentavos += fila.totalCentavos;
  }
  return {
    total: filas.length,
    porEstado: conteo,
    ventasEfectivas: efectivas,
    montoEfectivoCentavos: montoEfectivoCentavos,
    montoPendienteCentavos: montoPendienteCentavos,
  };
}

/**
 * Consulta el detalle de una venta: cliente, lineas (con producto) y pago asociado.
 */
export async function obtenerVenta(referencia: string) {
  const pedido = await base
    .select()
    .from(pedidos)
    .where(eq(pedidos.referenciaPedido, referencia))
    .limit(1);
  if (!pedido[0]) return null;
  const clienteId = Number(pedido[0].clienteId);
  const cliente = Number.isInteger(clienteId)
    ? await base.select().from(clientes).where(eq(clientes.id, clienteId)).limit(1)
    : [];
  const lineas = await base
    .select({
      productoId: pedidoArticulos.productoId,
      productoNombre: productos.nombre,
      cantidad: pedidoArticulos.cantidad,
      precioUnitarioCentavos: pedidoArticulos.precioUnitarioCentavos,
    })
    .from(pedidoArticulos)
    .innerJoin(productos, eq(pedidoArticulos.productoId, productos.id))
    .where(eq(pedidoArticulos.pedidoId, pedido[0].id));
  const pagoFilas = await base
    .select()
    .from(pagos)
    .where(eq(pagos.pedidoId, pedido[0].id))
    .orderBy(desc(pagos.id))
    .limit(1);
  return {
    ...pedido[0],
    cliente: cliente[0] || null,
    lineas: lineas,
    pago: pagoFilas[0] || null,
  };
}

/**
 * Marca una venta como entregada (venta efectiva) cuando ya esta pagada.
 * Emite el evento com.cuchostool.pedido.entregado en el buzon transaccional.
 */
export async function entregarVenta(referencia: string): Promise<ResultadoVenta> {
  const filas = await base
    .select()
    .from(pedidos)
    .where(eq(pedidos.referenciaPedido, referencia))
    .limit(1);
  const pedido = filas[0];
  if (!pedido) return { ok: false, codigoEstado: 404, error: 'venta_no_encontrada' };
  if (pedido.estado !== PEDIDO_PAGADO)
    return { ok: false, codigoEstado: 409, error: 'venta_no_entregable' };
  await base.transaction(async function (transaccion) {
    await transaccion
      .update(pedidos)
      .set({ estado: PEDIDO_ENTREGADO, actualizadoEn: new Date() })
      .where(eq(pedidos.id, pedido.id));
    await encolarEvento(transaccion, {
      tipoAgregado: 'Pedido',
      idAgregado: referencia,
      tipoEvento: EVENTO_PEDIDO_ENTREGADO,
      claveIdempotencia: referencia,
      datos: { referenciaPedido: referencia, entregadoEn: new Date().toISOString() },
    });
  });
  return { ok: true, datos: { referenciaPedido: referencia, estado: PEDIDO_ENTREGADO } };
}

/**
 * Cancela una venta que aun no fue pagada (sin movimiento de dinero).
 */
export async function cancelarVenta(referencia: string): Promise<ResultadoVenta> {
  const filas = await base
    .select()
    .from(pedidos)
    .where(eq(pedidos.referenciaPedido, referencia))
    .limit(1);
  const pedido = filas[0];
  if (!pedido) return { ok: false, codigoEstado: 404, error: 'venta_no_encontrada' };
  if (pedido.estado !== PEDIDO_PENDIENTE_PAGO)
    return { ok: false, codigoEstado: 409, error: 'venta_no_cancelable' };
  await base
    .update(pedidos)
    .set({ estado: PEDIDO_CANCELADO, actualizadoEn: new Date() })
    .where(eq(pedidos.id, pedido.id));
  return { ok: true, datos: { referenciaPedido: referencia, estado: PEDIDO_CANCELADO } };
}
