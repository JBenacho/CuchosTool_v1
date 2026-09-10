// Servicio de Metas y Comisiones comerciales (CU-CM-005/006, F5).
// Metas: monto > 0 y unica por vendedor y periodo; cumplimiento calculado con ventas B2B.
// Comisiones: porcentaje 0..100% (bps), base = ventas B2B pagadas del periodo, inmutables al pagar.
import { and, asc, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { base } from '../../bd/base';
import {
  comisiones,
  comisionesVendedor,
  metasComerciales,
  ordenesVentaB2b,
  usuarios,
} from '../../bd/esquema';
import {
  COMISION_CALCULADA,
  COMISION_PAGADA,
  ROL_VENDEDOR,
  TARIFA_BPS_MAXIMA,
  VENTA_B2B_PAGADA,
} from '../../dominio/constantes';

export type ResultadoMetas = {
  ok: boolean;
  codigoEstado?: number;
  error?: string;
  datos?: unknown;
};
function limpiar(valor: unknown): string {
  return String(valor || '').trim();
}
function rangoPeriodo(periodo: string): { inicio: Date; fin: Date } | null {
  if (!/^\d{4}-\d{2}$/.test(periodo)) return null;
  const [anio, mes] = periodo.split('-').map(Number);
  return { inicio: new Date(Date.UTC(anio, mes - 1, 1)), fin: new Date(Date.UTC(anio, mes, 1)) };
}

export async function listarVendedores() {
  return base
    .select({ id: usuarios.id, correo: usuarios.correo, rol: usuarios.rol })
    .from(usuarios)
    .where(eq(usuarios.rol, ROL_VENDEDOR))
    .orderBy(asc(usuarios.correo));
}

export async function listarMetas(periodo?: string) {
  const consulta = base.select().from(metasComerciales);
  return periodo
    ? consulta
        .where(eq(metasComerciales.periodo, periodo))
        .orderBy(asc(metasComerciales.vendedorId))
    : consulta.orderBy(desc(metasComerciales.periodo), asc(metasComerciales.vendedorId));
}

export async function crearMeta(datos: any): Promise<ResultadoMetas> {
  const vendedorId = limpiar(datos.vendedorId);
  const periodo = limpiar(datos.periodo);
  const montoMetaCentavos = Number(datos.montoMetaCentavos);
  if (!vendedorId || !rangoPeriodo(periodo))
    return { ok: false, codigoEstado: 400, error: 'datos_incompletos' };
  if (!Number.isInteger(montoMetaCentavos) || montoMetaCentavos <= 0)
    return { ok: false, codigoEstado: 400, error: 'monto_invalido' };
  const existente = await base
    .select()
    .from(metasComerciales)
    .where(and(eq(metasComerciales.vendedorId, vendedorId), eq(metasComerciales.periodo, periodo)))
    .limit(1);
  if (existente[0]) return { ok: false, codigoEstado: 409, error: 'meta_ya_existe' };
  const [creada] = await base
    .insert(metasComerciales)
    .values({
      vendedorId: vendedorId,
      zonaId: limpiar(datos.zonaId) || null,
      periodo: periodo,
      montoMetaCentavos: montoMetaCentavos,
    })
    .returning({ id: metasComerciales.id, periodo: metasComerciales.periodo });
  return { ok: true, datos: creada };
}

/** Cumplimiento: ventas B2B pagadas del vendedor en el periodo frente a la meta (RN-CM-03). */
export async function cumplimientoMetas(periodo: string) {
  const rango = rangoPeriodo(periodo);
  if (!rango) return [];
  const metas = await base
    .select()
    .from(metasComerciales)
    .where(eq(metasComerciales.periodo, periodo));
  const resultado: any[] = [];
  for (const meta of metas) {
    const ventas = await base
      .select({ totalCentavos: ordenesVentaB2b.totalCentavos })
      .from(ordenesVentaB2b)
      .where(
        and(
          eq(ordenesVentaB2b.vendedorId, meta.vendedorId),
          eq(ordenesVentaB2b.estado, VENTA_B2B_PAGADA),
          gte(ordenesVentaB2b.creadoEn, rango.inicio),
          lt(ordenesVentaB2b.creadoEn, rango.fin),
        ),
      );
    const avance = ventas.reduce(function (s, v) {
      return s + v.totalCentavos;
    }, 0);
    resultado.push({
      vendedorId: meta.vendedorId,
      periodo: meta.periodo,
      montoMetaCentavos: meta.montoMetaCentavos,
      avanceCentavos: avance,
      cumplimientoPct:
        meta.montoMetaCentavos > 0
          ? Math.round((avance * 10000) / meta.montoMetaCentavos) / 100
          : 0,
    });
  }
  return resultado;
}

export async function configurarComision(datos: any): Promise<ResultadoMetas> {
  const vendedorId = limpiar(datos.vendedorId);
  const porcentajeBps = Number(datos.porcentajeBps);
  if (!vendedorId) return { ok: false, codigoEstado: 400, error: 'datos_incompletos' };
  if (!Number.isInteger(porcentajeBps) || porcentajeBps < 0 || porcentajeBps > TARIFA_BPS_MAXIMA)
    return { ok: false, codigoEstado: 400, error: 'porcentaje_fuera_de_rango' };
  const existente = await base
    .select()
    .from(comisionesVendedor)
    .where(eq(comisionesVendedor.vendedorId, vendedorId))
    .limit(1);
  if (existente[0]) {
    await base
      .update(comisionesVendedor)
      .set({ porcentajeBps: porcentajeBps, actualizadoEn: new Date() })
      .where(eq(comisionesVendedor.id, existente[0].id));
    return { ok: true, datos: { vendedorId: vendedorId, porcentajeBps: porcentajeBps } };
  }
  const [creada] = await base
    .insert(comisionesVendedor)
    .values({ vendedorId: vendedorId, porcentajeBps: porcentajeBps })
    .returning({ id: comisionesVendedor.id });
  return {
    ok: true,
    datos: { id: creada.id, vendedorId: vendedorId, porcentajeBps: porcentajeBps },
  };
}

export async function listarConfigComisiones() {
  return base.select().from(comisionesVendedor).orderBy(asc(comisionesVendedor.vendedorId));
}

/** Calcula comisiones del periodo sobre ventas B2B pagadas (RN-CM-02); no recalcula pagadas. */
export async function calcularComisiones(periodo: string): Promise<ResultadoMetas> {
  const rango = rangoPeriodo(periodo);
  if (!rango) return { ok: false, codigoEstado: 400, error: 'periodo_invalido' };
  const configs = await base.select().from(comisionesVendedor);
  let calculadas = 0;
  for (const config of configs) {
    const ventas = await base
      .select({ totalCentavos: ordenesVentaB2b.totalCentavos })
      .from(ordenesVentaB2b)
      .where(
        and(
          eq(ordenesVentaB2b.vendedorId, config.vendedorId),
          eq(ordenesVentaB2b.estado, VENTA_B2B_PAGADA),
          gte(ordenesVentaB2b.creadoEn, rango.inicio),
          lt(ordenesVentaB2b.creadoEn, rango.fin),
        ),
      );
    const baseCentavos = ventas.reduce(function (s, v) {
      return s + v.totalCentavos;
    }, 0);
    if (baseCentavos <= 0) continue;
    const existente = await base
      .select()
      .from(comisiones)
      .where(and(eq(comisiones.vendedorId, config.vendedorId), eq(comisiones.periodo, periodo)))
      .limit(1);
    if (existente[0]) continue;
    const monto = Math.round((baseCentavos * config.porcentajeBps) / TARIFA_BPS_MAXIMA);
    await base
      .insert(comisiones)
      .values({
        vendedorId: config.vendedorId,
        periodo: periodo,
        baseCentavos: baseCentavos,
        porcentajeBps: config.porcentajeBps,
        montoCentavos: monto,
        estado: COMISION_CALCULADA,
      });
    calculadas++;
  }
  return { ok: true, datos: { periodo: periodo, calculadas: calculadas } };
}

export async function listarComisiones(periodo?: string) {
  const consulta = base.select().from(comisiones);
  return periodo
    ? consulta.where(eq(comisiones.periodo, periodo)).orderBy(asc(comisiones.vendedorId))
    : consulta.orderBy(desc(comisiones.periodo), asc(comisiones.vendedorId));
}

export async function pagarComision(id: number): Promise<ResultadoMetas> {
  const filas = await base.select().from(comisiones).where(eq(comisiones.id, id)).limit(1);
  if (!filas[0]) return { ok: false, codigoEstado: 404, error: 'comision_no_encontrada' };
  if (filas[0].estado !== COMISION_CALCULADA)
    return { ok: false, codigoEstado: 409, error: 'comision_no_pagable' };
  await base
    .update(comisiones)
    .set({ estado: COMISION_PAGADA, pagadaEn: new Date() })
    .where(eq(comisiones.id, id));
  return { ok: true, datos: { id: id, estado: COMISION_PAGADA } };
}
