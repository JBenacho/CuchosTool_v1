// Servicio de dispersiones al emprendedor (CU-EM-015..018, BL-049/050/051).
// Reglas: solo pedidos entregados y pagados habilitan dispersion; el emprendedor coordina
// y Payments ejecuta el dinero (RN-GOB-005); la comision sale de config (TBD de negocio, BL-051).
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { base } from '../../bd/base';
import { dispersiones, pedidos } from '../../bd/esquema';
import { config } from '../../config';
import {
  DISPERSION_COMPLETADA,
  DISPERSION_PENDIENTE,
  PEDIDO_ENTREGADO,
  PEDIDO_PAGADO,
} from '../../dominio/constantes';

export type ResultadoDispersion = {
  ok: boolean;
  codigoEstado?: number;
  error?: string;
  datos?: unknown;
};

/**
 * Genera la referencia publica de la dispersion (ej. DSP-1A2B3C4D5E6F).
 */
function generarReferenciaDispersion(): string {
  return 'DSP-' + randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
}

/**
 * Calcula la comision del emprendedor en puntos basicos (pura y testeable).
 * @param montoCentavos monto base del pedido.
 * @param tasaBps tasa en puntos basicos (10000 = 100%). 0 = sin comision.
 */
export function calcularComision(montoCentavos: number, tasaBps: number): number {
  if (tasaBps <= 0) return 0;
  return Math.floor((montoCentavos * tasaBps) / 10000);
}

/**
 * Confirma la entrega fisica del pedido (CU-EM-015). Habilita la dispersion.
 */
export async function confirmarEntregaPedido(
  referenciaPedido: string,
): Promise<ResultadoDispersion> {
  const filas = await base
    .select()
    .from(pedidos)
    .where(eq(pedidos.referenciaPedido, referenciaPedido))
    .limit(1);
  const pedido = filas[0];
  if (!pedido) return { ok: false, codigoEstado: 404, error: 'pedido_no_encontrado' };
  if (pedido.estado !== PEDIDO_PAGADO)
    return { ok: false, codigoEstado: 409, error: 'pedido_no_pagado' };
  await base
    .update(pedidos)
    .set({ estado: PEDIDO_ENTREGADO, actualizadoEn: new Date() })
    .where(eq(pedidos.id, pedido.id));
  return { ok: true, datos: { referenciaPedido: referenciaPedido, estado: PEDIDO_ENTREGADO } };
}

/**
 * Autoriza y registra la dispersion del pedido al emprendedor (CU-EM-016).
 * La comision se calcula con la tasa configurada (0 mientras el negocio no la defina).
 */
export async function autorizarDispersion(
  referenciaPedido: string,
  emprendedorId: number,
): Promise<ResultadoDispersion> {
  const filas = await base
    .select()
    .from(pedidos)
    .where(eq(pedidos.referenciaPedido, referenciaPedido))
    .limit(1);
  const pedido = filas[0];
  if (!pedido) return { ok: false, codigoEstado: 404, error: 'pedido_no_encontrado' };
  if (pedido.estado !== PEDIDO_ENTREGADO)
    return { ok: false, codigoEstado: 409, error: 'pedido_no_entregado' };
  const existente = await base
    .select()
    .from(dispersiones)
    .where(eq(dispersiones.pedidoId, pedido.id))
    .limit(1);
  if (existente[0]) return { ok: false, codigoEstado: 409, error: 'dispersion_ya_registrada' };
  const comisionCentavos = calcularComision(pedido.totalCentavos, config.tasaComisionBps);
  const [creada] = await base
    .insert(dispersiones)
    .values({
      referenciaDispersion: generarReferenciaDispersion(),
      pedidoId: pedido.id,
      emprendedorId: emprendedorId,
      montoCentavos: pedido.totalCentavos,
      comisionCentavos: comisionCentavos,
      estado: DISPERSION_PENDIENTE,
    })
    .returning({
      id: dispersiones.id,
      referenciaDispersion: dispersiones.referenciaDispersion,
      estado: dispersiones.estado,
      montoCentavos: dispersiones.montoCentavos,
      comisionCentavos: dispersiones.comisionCentavos,
    });
  return { ok: true, datos: creada };
}

/**
 * Ejecuta (simuladamente) la dispersion autorizada (CU-EM-017). Payments la completa en F3-GCP.
 */
export async function ejecutarDispersion(
  referenciaDispersion: string,
): Promise<ResultadoDispersion> {
  const filas = await base
    .select()
    .from(dispersiones)
    .where(eq(dispersiones.referenciaDispersion, referenciaDispersion))
    .limit(1);
  const dispersion = filas[0];
  if (!dispersion) return { ok: false, codigoEstado: 404, error: 'dispersion_no_encontrada' };
  if (dispersion.estado !== DISPERSION_PENDIENTE)
    return { ok: false, codigoEstado: 409, error: 'dispersion_no_pendiente' };
  await base
    .update(dispersiones)
    .set({ estado: DISPERSION_COMPLETADA, ejecutadoEn: new Date(), actualizadoEn: new Date() })
    .where(eq(dispersiones.id, dispersion.id));
  return {
    ok: true,
    datos: { referenciaDispersion: referenciaDispersion, estado: DISPERSION_COMPLETADA },
  };
}
