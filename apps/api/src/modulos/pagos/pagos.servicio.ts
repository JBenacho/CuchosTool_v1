// Servicio de pagos (CU-EC-010, BL-035). Payments conserva el dinero (RN-GOB-005).
// Wompi es el proveedor definido; en local la notificacion del proveedor se SIMULA
// (endpoint /pagos/simular/:referenciaPago) hasta integrar el webhook firmado real (F3-GCP).
import { randomUUID } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { base } from '../../bd/base';
import { pagos, pedidos } from '../../bd/esquema';
import {
  EVENTO_PEDIDO_PAGADO,
  MONEDA_COP,
  PAGO_APROBADO,
  PAGO_PENDIENTE,
  PEDIDO_PAGADO,
  PEDIDO_PENDIENTE_PAGO,
  PROVEEDOR_PAGOS,
} from '../../dominio/constantes';
import { encolarEvento } from '../eventos/buzon.servicio';

export interface ResultadoIniciarPago {
  creado: boolean;
  referenciaPago?: string;
  estado?: string;
  urlPagoSimulada?: string;
  montoCentavos?: number;
  codigoEstado?: number;
  error?: string;
}

/**
 * Genera la referencia publica del pago (ej. PAY-1A2B3C4D5E6F).
 */
function generarReferenciaPago(): string {
  return 'PAY-' + randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
}

/**
 * Inicia la intencion de pago Wompi para un pedido del cliente autenticado.
 * Reglas: solo pedidos propios en estado pendiente_pago; idempotente por pedido
 * (si ya existe un pago pendiente se devuelve el existente, sin duplicar).
 * @param clienteId identificador del cliente (sub del JWT).
 * @param referenciaPedido referencia publica del pedido.
 */
export async function iniciarPago(
  clienteId: string,
  referenciaPedido: string,
): Promise<ResultadoIniciarPago> {
  const filasPedido = await base
    .select()
    .from(pedidos)
    .where(and(eq(pedidos.referenciaPedido, referenciaPedido), eq(pedidos.clienteId, clienteId)))
    .limit(1);
  const pedido = filasPedido[0];
  if (!pedido) return { creado: false, codigoEstado: 404, error: 'pedido_no_encontrado' };
  if (pedido.estado !== PEDIDO_PENDIENTE_PAGO)
    return { creado: false, codigoEstado: 409, error: 'pedido_no_pagable' };

  const existentes = await base
    .select()
    .from(pagos)
    .where(and(eq(pagos.pedidoId, pedido.id), eq(pagos.estado, PAGO_PENDIENTE)))
    .limit(1);
  if (existentes[0]) {
    return {
      creado: false,
      referenciaPago: existentes[0].referenciaPago,
      estado: existentes[0].estado,
      urlPagoSimulada: '/pagos/simular/' + existentes[0].referenciaPago,
      montoCentavos: existentes[0].montoCentavos,
    };
  }

  const referenciaPago = generarReferenciaPago();
  const [pago] = await base
    .insert(pagos)
    .values({
      referenciaPago: referenciaPago,
      pedidoId: pedido.id,
      clienteId: clienteId,
      montoCentavos: pedido.totalCentavos,
      moneda: MONEDA_COP,
      proveedor: PROVEEDOR_PAGOS,
      estado: PAGO_PENDIENTE,
    })
    .returning({
      referenciaPago: pagos.referenciaPago,
      estado: pagos.estado,
      montoCentavos: pagos.montoCentavos,
    });
  return {
    creado: true,
    referenciaPago: pago.referenciaPago,
    estado: pago.estado,
    urlPagoSimulada: '/pagos/simular/' + pago.referenciaPago,
    montoCentavos: pago.montoCentavos,
  };
}

/**
 * Registra la notificacion de pago del proveedor y confirma el pedido.
 * Reglas: idempotente (una segunda notificacion no tiene doble efecto, BL-101);
 * transaccion unica: pago aprobado + pedido pagado + evento PedidoPagado en el buzon.
 */
export async function registrarNotificacionPago(
  referenciaPago: string,
  idTransaccionProveedor: string,
): Promise<{
  ok: boolean;
  yaProcesado?: boolean;
  referenciaPago?: string;
  estado?: string;
  codigoEstado?: number;
  error?: string;
}> {
  const filas = await base
    .select()
    .from(pagos)
    .where(eq(pagos.referenciaPago, referenciaPago))
    .limit(1);
  const pago = filas[0];
  if (!pago) return { ok: false, codigoEstado: 404, error: 'pago_no_encontrado' };
  if (pago.estado === PAGO_APROBADO)
    return {
      ok: true,
      yaProcesado: true,
      referenciaPago: pago.referenciaPago,
      estado: pago.estado,
    };
  if (pago.estado !== PAGO_PENDIENTE)
    return { ok: false, codigoEstado: 409, error: 'pago_no_pendiente' };

  const filasPedido = await base
    .select()
    .from(pedidos)
    .where(eq(pedidos.id, pago.pedidoId))
    .limit(1);
  const referenciaPedido = filasPedido[0] ? filasPedido[0].referenciaPedido : String(pago.pedidoId);

  await base.transaction(async function (transaccion) {
    await transaccion
      .update(pagos)
      .set({
        estado: PAGO_APROBADO,
        idTransaccionProveedor: idTransaccionProveedor,
        actualizadoEn: new Date(),
      })
      .where(eq(pagos.id, pago.id));
    await transaccion
      .update(pedidos)
      .set({ estado: PEDIDO_PAGADO, actualizadoEn: new Date() })
      .where(eq(pedidos.id, pago.pedidoId));
    await encolarEvento(transaccion, {
      tipoAgregado: 'Pedido',
      idAgregado: referenciaPedido,
      tipoEvento: EVENTO_PEDIDO_PAGADO,
      claveIdempotencia: referenciaPago,
      datos: {
        pedidoId: referenciaPedido,
        pagoId: referenciaPago,
        montoCentavos: pago.montoCentavos,
        moneda: pago.moneda,
        pagadoEn: new Date().toISOString(),
      },
    });
  });
  return { ok: true, yaProcesado: false, referenciaPago: referenciaPago, estado: PAGO_APROBADO };
}
