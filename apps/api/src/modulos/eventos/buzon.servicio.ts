// Servicio del buzon transaccional y publicador de eventos (CU-INT-001/002, BL-033/091/101).
// En local el 'Pub/Sub' se evidencia en la tabla eventos_publicados; en GCP este modulo
// se reemplaza por Cloud Scheduler + Pub/Sub real sin cambiar los contratos.
import { randomUUID } from 'crypto';
import { asc, eq, isNull } from 'drizzle-orm';
import { base } from '../../bd/base';
import { eventosBuzon, eventosFallidos, eventosPublicados } from '../../bd/esquema';
import { TOPICO_GENERAL, TOPICO_PEDIDOS } from '../../dominio/constantes';

export interface DatosEvento {
  tipoAgregado: string;
  idAgregado: string;
  tipoEvento: string;
  correlacionId?: string;
  claveIdempotencia?: string;
  datos: Record<string, unknown>;
}

/**
 * Construye la carga (envelope versionado) del evento segun el contrato en /contracts.
 * Campos: eventId, type, version, occurredAt, correlationId, idempotencyKey, data.
 */
export function construirCargaEvento(
  tipoEvento: string,
  correlacionId: string,
  claveIdempotencia: string | undefined,
  datos: Record<string, unknown>,
): Record<string, unknown> {
  return {
    eventId: randomUUID(),
    type: tipoEvento,
    version: '1.0',
    occurredAt: new Date().toISOString(),
    correlationId: correlacionId,
    idempotencyKey: claveIdempotencia || null,
    data: datos,
  };
}

/**
 * Inserta un evento en el buzon dentro de la transaccion/ejecutor dado (Outbox).
 * @param ejecutor base de datos o transaccion activa (sin perdida de eventos).
 */
export async function encolarEvento(ejecutor: any, evento: DatosEvento): Promise<void> {
  const correlacionId = evento.correlacionId || randomUUID();
  await ejecutor.insert(eventosBuzon).values({
    tipoAgregado: evento.tipoAgregado,
    idAgregado: evento.idAgregado,
    tipoEvento: evento.tipoEvento,
    correlacionId: correlacionId,
    claveIdempotencia: evento.claveIdempotencia || null,
    carga: construirCargaEvento(
      evento.tipoEvento,
      correlacionId,
      evento.claveIdempotencia,
      evento.datos,
    ),
  });
}

/**
 * Mapea un tipo de evento de dominio a su topico Pub/Sub (BL-101/102).
 * Regla: los topicos se derivan del prefijo del tipo; nuevos dominios agregan su caso.
 */
export function topicoDeEvento(tipoEvento: string): string {
  if (tipoEvento.startsWith('com.cuchostool.pedido.')) return TOPICO_PEDIDOS;
  return TOPICO_GENERAL;
}

/**
 * Procesa una tanda de eventos pendientes del buzon.
 * Publica cada evento en eventos_publicados y marca su publicacion; si el evento ya
 * existe (duplicado) o falla, se envia a la DLQ operable (eventos_fallidos).
 * @param limite cantidad maxima de eventos por tanda.
 * @returns cantidad de publicados y fallidos.
 */
export async function procesarBuzonPendiente(
  limite = 50,
): Promise<{ publicados: number; fallidos: number }> {
  const pendientes = await base
    .select()
    .from(eventosBuzon)
    .where(isNull(eventosBuzon.publicadoEn))
    .orderBy(asc(eventosBuzon.id))
    .limit(limite);
  let publicados = 0;
  let fallidos = 0;
  for (const evento of pendientes) {
    const topico = topicoDeEvento(evento.tipoEvento);
    const eventId = String((evento.carga as any).eventId || evento.id);
    try {
      await base.insert(eventosPublicados).values({
        topico: topico,
        eventId: eventId,
        tipoEvento: evento.tipoEvento,
        carga: evento.carga,
      });
      await base
        .update(eventosBuzon)
        .set({ publicadoEn: new Date() })
        .where(eq(eventosBuzon.id, evento.id));
      publicados++;
    } catch (error: any) {
      // 23505: clave unica violada (evento ya publicado) -> DLQ con motivo claro.
      const motivo = error && error.code === '23505' ? 'evento_duplicado' : 'error_publicacion';
      await base.insert(eventosFallidos).values({
        topico: topico,
        eventId: eventId,
        tipoEvento: evento.tipoEvento,
        carga: evento.carga,
        motivo: motivo,
        reintentos: 0,
      });
      fallidos++;
    }
  }
  return { publicados: publicados, fallidos: fallidos };
}

/**
 * Arranca el publicador periodico del buzon (desarrollo local).
 * @param intervaloMs intervalo en milisegundos; 0 lo desactiva.
 * @returns el timer activo o null si esta desactivado.
 */
export function arrancarPublicador(intervaloMs: number): NodeJS.Timeout | null {
  if (intervaloMs <= 0) return null;
  return setInterval(function () {
    procesarBuzonPendiente().catch(function (error) {
      console.error('Error del publicador del buzon:', error);
    });
  }, intervaloMs);
}
