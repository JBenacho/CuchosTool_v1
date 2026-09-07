// Servicio de calidad (CU-SGC-020..023).
// Reglas: las alertas se generan solo si el umbral configurado se supera; las acciones
// correctivas quedan trazables y cerrables con evidencia (BL-064..066).
import { randomUUID } from 'crypto';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { base } from '../../bd/base';
import { accionesCorrectivas, alertasCalidad, casos } from '../../bd/esquema';
import { config } from '../../config';
import {
  ACCION_ABIERTA,
  ACCION_CERRADA,
  ALERTA_ACTIVA,
  CASO_ABIERTO,
  CASO_EN_PROCESO,
} from '../../dominio/constantes';

export type ResultadoCalidad = {
  ok: boolean;
  codigoEstado?: number;
  error?: string;
  datos?: unknown;
};

/**
 * Decide si debe generarse una alerta de calidad (pura y testeable).
 * @param casosAbiertos cantidad de casos abiertos/en proceso.
 * @param umbral umbral configurado.
 */
export function debeGenerarAlerta(casosAbiertos: number, umbral: number): boolean {
  return casosAbiertos >= umbral && umbral > 0;
}

/**
 * Detecta patrones de calidad agrupando casos abiertos por tipo (CU-SGC-020).
 */
export async function detectarPatronesCalidad() {
  return base
    .select({ tipo: casos.tipo, cantidad: sql`count(*)`.mapWith(Number) })
    .from(casos)
    .where(inArray(casos.estado, [CASO_ABIERTO, CASO_EN_PROCESO]))
    .groupBy(casos.tipo);
}

/**
 * Genera una alerta por umbral de casos abiertos (CU-SGC-021). Idempotente:
 * no crea una segunda alerta activa del mismo tipo.
 */
export async function generarAlertaPorUmbral(): Promise<ResultadoCalidad> {
  const filas = await base
    .select({ cantidad: sql`count(*)`.mapWith(Number) })
    .from(casos)
    .where(inArray(casos.estado, [CASO_ABIERTO, CASO_EN_PROCESO]));
  const casosAbiertos = Number(filas[0] ? filas[0].cantidad : 0);
  if (!debeGenerarAlerta(casosAbiertos, config.umbralCasosAbiertosAlerta))
    return {
      ok: true,
      datos: {
        generada: false,
        casosAbiertos: casosAbiertos,
        umbral: config.umbralCasosAbiertosAlerta,
      },
    };
  const existente = await base
    .select()
    .from(alertasCalidad)
    .where(
      and(
        eq(alertasCalidad.tipo, 'umbral_casos_abiertos'),
        eq(alertasCalidad.estado, ALERTA_ACTIVA),
      ),
    )
    .limit(1);
  if (existente[0]) return { ok: true, datos: { generada: false, existente: true } };
  const [creada] = await base
    .insert(alertasCalidad)
    .values({
      tipo: 'umbral_casos_abiertos',
      mensaje: 'Casos abiertos superan el umbral',
      valores: { casosAbiertos: casosAbiertos, umbral: config.umbralCasosAbiertosAlerta },
      estado: ALERTA_ACTIVA,
    })
    .returning({ id: alertasCalidad.id, tipo: alertasCalidad.tipo, estado: alertasCalidad.estado });
  return { ok: true, datos: { generada: true, alerta: creada } };
}

/**
 * Crea una accion correctiva derivada de un hallazgo (CU-SGC-022).
 */
export async function crearAccionCorrectiva(
  descripcion: string,
  origenCasoId?: number,
): Promise<ResultadoCalidad> {
  const texto = String(descripcion || '').trim();
  if (!texto) return { ok: false, codigoEstado: 400, error: 'descripcion_requerida' };
  const [creada] = await base
    .insert(accionesCorrectivas)
    .values({
      referenciaAccion: 'ACC-' + randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase(),
      descripcion: texto,
      origenCasoId: origenCasoId || null,
      estado: ACCION_ABIERTA,
    })
    .returning({
      id: accionesCorrectivas.id,
      referenciaAccion: accionesCorrectivas.referenciaAccion,
      estado: accionesCorrectivas.estado,
    });
  return { ok: true, datos: creada };
}

/**
 * Cierra una accion correctiva (CU-SGC-022).
 */
export async function cerrarAccionCorrectiva(referencia: string): Promise<ResultadoCalidad> {
  const filas = await base
    .select()
    .from(accionesCorrectivas)
    .where(eq(accionesCorrectivas.referenciaAccion, referencia))
    .limit(1);
  if (!filas[0]) return { ok: false, codigoEstado: 404, error: 'accion_no_encontrada' };
  if (filas[0].estado !== ACCION_ABIERTA)
    return { ok: false, codigoEstado: 409, error: 'accion_no_abierta' };
  await base
    .update(accionesCorrectivas)
    .set({ estado: ACCION_CERRADA, cerradaEn: new Date() })
    .where(eq(accionesCorrectivas.id, filas[0].id));
  return { ok: true, datos: { referenciaAccion: referencia, estado: ACCION_CERRADA } };
}

/**
 * Dashboard de calidad (CU-SGC-023): casos por estado, por tipo y promedio de calificacion.
 */
export async function dashboardCalidad() {
  const porEstado = await base
    .select({ estado: casos.estado, cantidad: sql`count(*)`.mapWith(Number) })
    .from(casos)
    .groupBy(casos.estado);
  const porTipo = await base
    .select({ tipo: casos.tipo, cantidad: sql`count(*)`.mapWith(Number) })
    .from(casos)
    .groupBy(casos.tipo);
  const promedio = await base
    .select({ promedio: sql`avg(${casos.calificacion})`.mapWith(Number) })
    .from(casos);
  return {
    porEstado: porEstado,
    porTipo: porTipo,
    promedioCalificacion: Number(promedio[0] && promedio[0].promedio ? promedio[0].promedio : 0),
  };
}
