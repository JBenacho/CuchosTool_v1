// Servicio de casos SGC (CU-SGC-002..009, 012, 017).
// Reglas: caso unico y trazable; transiciones de estado restringidas;
// SGC no mueve dinero ni mercancia (RN-GOB): solo coordina.
import { randomUUID } from 'crypto';
import { and, desc, eq } from 'drizzle-orm';
import { base } from '../../bd/base';
import { casoMensajes, casos } from '../../bd/esquema';
import {
  CASO_ABIERTO,
  PRIORIDAD_CASO_MEDIA,
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
