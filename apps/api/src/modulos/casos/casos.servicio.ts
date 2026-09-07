// Servicio de casos SGC (CU-SGC-002..009, 012, 017).
// Reglas: caso unico y trazable; transiciones de estado restringidas;
// SGC no mueve dinero ni mercancia (RN-GOB): solo coordina.
import { randomUUID } from 'crypto';
import { and, desc, eq } from 'drizzle-orm';
import { base } from '../../bd/base';
import { casoMensajes, casos, pagos, reembolsos } from '../../bd/esquema';
import {
  CASO_ABIERTO,
  GARANTIA_IMPROCEDENTE,
  GARANTIA_PROCEDENTE,
  GARANTIA_SOLICITADA,
  PAGO_APROBADO,
  PRIORIDAD_CASO_MEDIA,
  REEMBOLSO_PENDIENTE,
  TIPOS_CASO,
  TRANSICIONES_CASO,
} from '../../dominio/constantes';

export interface DatosCaso {
  tipo: string;
  asunto: string;
  descripcion?: string;
  clienteId?: string;
  pedidoId?: number;
  emprendedorId?: number;
}

export type ResultadoCaso = { ok: boolean; codigoEstado?: number; error?: string; datos?: unknown };

/**
 * Genera la referencia publica del caso (ej. CAS-1A2B3C4D5E6F).
 */
function generarReferenciaCaso(): string {
  return 'CAS-' + randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
}

/**
 * Valida una transicion de estado del caso (CU-SGC-009). Pura y testeable.
 * @returns true si estadoNuevo es una transicion valida desde estadoActual.
 */
export function esTransicionCasoValida(estadoActual: string, estadoNuevo: string): boolean {
  const permitidas = TRANSICIONES_CASO[estadoActual] || [];
  return permitidas.includes(estadoNuevo);
}

/**
 * Crea un caso (CU-SGC-002) con tipo valido y estado abierto.
 */
export async function crearCaso(datos: DatosCaso): Promise<ResultadoCaso> {
  const tipo = String(datos.tipo || '');
  const asunto = String(datos.asunto || '').trim();
  if (!TIPOS_CASO.includes(tipo as (typeof TIPOS_CASO)[number]))
    return { ok: false, codigoEstado: 400, error: 'tipo_invalido' };
  if (!asunto) return { ok: false, codigoEstado: 400, error: 'asunto_requerido' };
  const [creado] = await base
    .insert(casos)
    .values({
      referenciaCaso: generarReferenciaCaso(),
      tipo: tipo,
      estado: CASO_ABIERTO,
      prioridad: PRIORIDAD_CASO_MEDIA,
      clienteId: datos.clienteId || null,
      pedidoId: datos.pedidoId || null,
      emprendedorId: datos.emprendedorId || null,
      asunto: asunto,
      descripcion: String(datos.descripcion || '').trim() || null,
    })
    .returning({
      id: casos.id,
      referenciaCaso: casos.referenciaCaso,
      tipo: casos.tipo,
      estado: casos.estado,
    });
  return { ok: true, datos: creado };
}

/**
 * Lista los casos del cliente autenticado (CU-SGC-004).
 */
export async function listarCasosCliente(clienteId: string) {
  return base.select().from(casos).where(eq(casos.clienteId, clienteId)).orderBy(desc(casos.id));
}

/**
 * Obtiene un caso por referencia (propio del cliente o del agente autorizado).
 */
export async function obtenerCaso(referencia: string, clienteId?: string) {
  const condiciones = clienteId
    ? and(eq(casos.referenciaCaso, referencia), eq(casos.clienteId, clienteId))
    : eq(casos.referenciaCaso, referencia);
  return base.select().from(casos).where(condiciones).limit(1);
}

/**
 * Cambia el estado de un caso validando la transicion (CU-SGC-009).
 */
export async function cambiarEstadoCaso(
  referencia: string,
  estadoNuevo: string,
): Promise<ResultadoCaso> {
  const filas = await base
    .select()
    .from(casos)
    .where(eq(casos.referenciaCaso, referencia))
    .limit(1);
  const caso = filas[0];
  if (!caso) return { ok: false, codigoEstado: 404, error: 'caso_no_encontrado' };
  if (!esTransicionCasoValida(caso.estado, estadoNuevo))
    return { ok: false, codigoEstado: 409, error: 'transicion_invalida' };
  await base
    .update(casos)
    .set({ estado: estadoNuevo, actualizadoEn: new Date() })
    .where(eq(casos.id, caso.id));
  return { ok: true, datos: { referenciaCaso: referencia, estado: estadoNuevo } };
}

/**
 * Agrega un mensaje al caso manteniendo trazabilidad (CU-SGC-005).
 */
export async function agregarMensajeCaso(
  referencia: string,
  autorTipo: string,
  autorId: string | null,
  contenido: string,
): Promise<ResultadoCaso> {
  const texto = String(contenido || '').trim();
  if (!texto) return { ok: false, codigoEstado: 400, error: 'contenido_requerido' };
  const filas = await base
    .select()
    .from(casos)
    .where(eq(casos.referenciaCaso, referencia))
    .limit(1);
  const caso = filas[0];
  if (!caso) return { ok: false, codigoEstado: 404, error: 'caso_no_encontrado' };
  const [creado] = await base
    .insert(casoMensajes)
    .values({ casoId: caso.id, autorTipo: autorTipo, autorId: autorId, contenido: texto })
    .returning({
      id: casoMensajes.id,
      autorTipo: casoMensajes.autorTipo,
      contenido: casoMensajes.contenido,
    });
  return { ok: true, datos: creado };
}

/**
 * Decide una garantia con evidencia (CU-SGC-014). Solo casos en estado garantia solicitada.
 * @param decision 'procedente' o 'improcedente'.
 */
export async function decidirGarantia(
  referenciaCaso: string,
  decision: 'procedente' | 'improcedente',
): Promise<ResultadoCaso> {
  const filas = await base
    .select()
    .from(casos)
    .where(eq(casos.referenciaCaso, referenciaCaso))
    .limit(1);
  const caso = filas[0];
  if (!caso) return { ok: false, codigoEstado: 404, error: 'caso_no_encontrado' };
  if (caso.garantiaEstado !== GARANTIA_SOLICITADA)
    return { ok: false, codigoEstado: 409, error: 'garantia_ya_decidida' };
  const estadoNuevo = decision === 'procedente' ? GARANTIA_PROCEDENTE : GARANTIA_IMPROCEDENTE;
  await base
    .update(casos)
    .set({ garantiaEstado: estadoNuevo, garantiaDecididaEn: new Date(), actualizadoEn: new Date() })
    .where(eq(casos.id, caso.id));
  return { ok: true, datos: { referenciaCaso: referenciaCaso, garantiaEstado: estadoNuevo } };
}

/**
 * Registra la coordinacion logistica del caso (CU-SGC-015): SGC coordina, Logistica mueve.
 */
export async function solicitarLogistica(
  referenciaCaso: string,
  accion: string,
): Promise<ResultadoCaso> {
  const accionesValidas = ['devolucion', 'cambio', 'recogida', 'reemplazo'] as const;
  if (!accionesValidas.includes(accion as (typeof accionesValidas)[number]))
    return { ok: false, codigoEstado: 400, error: 'accion_invalida' };
  const filas = await base
    .select()
    .from(casos)
    .where(eq(casos.referenciaCaso, referenciaCaso))
    .limit(1);
  const caso = filas[0];
  if (!caso) return { ok: false, codigoEstado: 404, error: 'caso_no_encontrado' };
  if (caso.garantiaEstado !== GARANTIA_PROCEDENTE)
    return { ok: false, codigoEstado: 409, error: 'garantia_no_procedente' };
  await base
    .update(casos)
    .set({ logisticaAccion: accion, actualizadoEn: new Date() })
    .where(eq(casos.id, caso.id));
  return { ok: true, datos: { referenciaCaso: referenciaCaso, logisticaAccion: accion } };
}

/**
 * Crea un reembolso coordinado (CU-SGC-016). Requiere garantia procedente y un pago aprobado.
 * Payments ejecuta el dinero posteriormente (BL-062).
 */
export async function crearReembolso(referenciaCaso: string): Promise<ResultadoCaso> {
  const filas = await base
    .select()
    .from(casos)
    .where(eq(casos.referenciaCaso, referenciaCaso))
    .limit(1);
  const caso = filas[0];
  if (!caso) return { ok: false, codigoEstado: 404, error: 'caso_no_encontrado' };
  if (caso.garantiaEstado !== GARANTIA_PROCEDENTE)
    return { ok: false, codigoEstado: 409, error: 'garantia_no_procedente' };
  if (!caso.pedidoId) return { ok: false, codigoEstado: 409, error: 'caso_sin_pedido' };
  const filasPago = await base
    .select()
    .from(pagos)
    .where(eq(pagos.pedidoId, caso.pedidoId))
    .limit(1);
  const pago = filasPago[0];
  if (!pago || pago.estado !== PAGO_APROBADO)
    return { ok: false, codigoEstado: 409, error: 'pago_no_aprobado' };
  const existente = await base
    .select()
    .from(reembolsos)
    .where(eq(reembolsos.casoId, caso.id))
    .limit(1);
  if (existente[0]) return { ok: false, codigoEstado: 409, error: 'reembolso_ya_creado' };
  const [creado] = await base
    .insert(reembolsos)
    .values({
      referenciaReembolso: 'RMB-' + randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase(),
      pagoId: pago.id,
      casoId: caso.id,
      montoCentavos: pago.montoCentavos,
      estado: REEMBOLSO_PENDIENTE,
    })
    .returning({
      id: reembolsos.id,
      referenciaReembolso: reembolsos.referenciaReembolso,
      estado: reembolsos.estado,
      montoCentavos: reembolsos.montoCentavos,
    });
  return { ok: true, datos: creado };
}
