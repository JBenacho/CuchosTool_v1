// Registro de auditoria (CU-SEC-014/015): toda operacion sensible queda trazada
// con actor, rol, recurso, resultado, metadatos e ip.
import { base } from '../../bd/base';
import { auditoriaRegistros } from '../../bd/esquema';

/**
 * Registra una entrada de auditoria.
 * @param solicitud request de Fastify (de ahi se obtienen actor, rol e ip).
 * @param accion accion ejecutada (ej. 'administracion.clientes.listar').
 * @param recurso recurso afectado.
 * @param recursoId identificador del recurso o 'todos'.
 * @param resultado 'ok' | 'error' | detalle del resultado.
 * @param metadatos informacion adicional estructurada (opcional).
 */
export async function registrarAuditoria(
  solicitud: any,
  accion: string,
  recurso: string,
  recursoId: string | null,
  resultado: string,
  metadatos?: Record<string, unknown>
): Promise<void> {
  const usuario = solicitud && solicitud.usuario ? solicitud.usuario : null;
  await base.insert(auditoriaRegistros).values({
    actorId: usuario && usuario.sub ? String(usuario.sub) : null,
    actorRol: usuario && usuario.rol ? String(usuario.rol) : null,
    accion: accion,
    recurso: recurso,
    recursoId: recursoId,
    resultado: resultado,
    metadatos: metadatos || null,
    ip: solicitud && solicitud.ip ? String(solicitud.ip) : null,
  });
}
