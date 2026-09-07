// Rutas de casos SGC (CU-SGC-002..009). Cliente crea/consulta lo propio; agentes gestionan.
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { base } from '../../bd/base';
import { reembolsos } from '../../bd/esquema';
import {
  REEMBOLSO_COMPLETADO,
  ROL_ADMIN,
  ROL_AGENTE,
  ROL_RESPONSABLE_GARANTIAS,
  ROL_SUPERVISOR,
} from '../../dominio/constantes';
import { registrarAuditoria } from '../administracion/auditoria';
import {
  agregarMensajeCaso,
  cambiarEstadoCaso,
  crearCaso,
  crearReembolso,
  decidirGarantia,
  listarCasosCliente,
  obtenerCaso,
  solicitarLogistica,
} from './casos.servicio';

type CuerpoCaso = { tipo: string; asunto: string; descripcion?: string; pedidoId?: number };
type CuerpoEstado = { estado: string };
type CuerpoMensaje = { contenido: string };

export async function rutasCasos(aplicacion: FastifyInstance): Promise<void> {
  const autenticar = (aplicacion as any).autenticar;
  const requerirRol = (aplicacion as any).requerirRol as (roles: string[]) => any;

  aplicacion.post<{ Body: CuerpoCaso }>(
    '/casos',
    {
      preHandler: autenticar,
      schema: { tags: ['casos'], summary: 'Crear caso (CU-SGC-002)' },
    },
    async function (solicitud, respuesta) {
      const clienteId = String((solicitud as any).usuario?.sub || '');
      const resultado = await crearCaso({
        tipo: solicitud.body?.tipo || '',
        asunto: solicitud.body?.asunto || '',
        descripcion: solicitud.body?.descripcion,
        pedidoId: Number(solicitud.body?.pedidoId) || undefined,
        clienteId: clienteId,
      });
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      return { data: resultado.datos };
    },
  );

  aplicacion.get(
    '/casos',
    {
      preHandler: autenticar,
      schema: { tags: ['casos'], summary: 'Listar casos propios (CU-SGC-004)' },
    },
    async function (solicitud) {
      return { data: await listarCasosCliente(String((solicitud as any).usuario?.sub || '')) };
    },
  );

  aplicacion.get<{ Params: { referencia: string } }>(
    '/casos/:referencia',
    {
      preHandler: autenticar,
      schema: { tags: ['casos'], summary: 'Consultar caso propio (CU-SGC-004)' },
    },
    async function (solicitud, respuesta) {
      const filas = await obtenerCaso(
        solicitud.params.referencia,
        String((solicitud as any).usuario?.sub || ''),
      );
      if (!filas[0]) return respuesta.code(404).send({ error: 'caso_no_encontrado' });
      return { data: filas[0] };
    },
  );

  aplicacion.patch<{ Params: { referencia: string }; Body: CuerpoEstado }>(
    '/casos/:referencia/estado',
    {
      preHandler: requerirRol([ROL_AGENTE, ROL_SUPERVISOR, ROL_ADMIN]),
      schema: { tags: ['casos'], summary: 'Cambiar estado del caso (CU-SGC-009)' },
    },
    async function (solicitud, respuesta) {
      const resultado = await cambiarEstadoCaso(
        solicitud.params.referencia,
        String(solicitud.body?.estado || ''),
      );
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'casos.cambiar_estado',
        'casos',
        solicitud.params.referencia,
        'ok',
      );
      return { data: resultado.datos };
    },
  );

  aplicacion.post<{ Params: { referencia: string }; Body: CuerpoMensaje }>(
    '/casos/:referencia/mensajes',
    {
      preHandler: autenticar,
      schema: { tags: ['casos'], summary: 'Agregar mensaje al caso (CU-SGC-005)' },
    },
    async function (solicitud, respuesta) {
      const usuario = (solicitud as any).usuario || {};
      const autorTipo = usuario.rol && usuario.rol !== 'CLIENTE' ? 'agente' : 'cliente';
      const resultado = await agregarMensajeCaso(
        solicitud.params.referencia,
        autorTipo,
        usuario.sub ? String(usuario.sub) : null,
        solicitud.body?.contenido || '',
      );
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      return { data: resultado.datos };
    },
  );

  aplicacion.patch<{ Params: { referencia: string }; Body: { decision: string } }>(
    '/casos/:referencia/garantia',
    {
      preHandler: requerirRol([ROL_RESPONSABLE_GARANTIAS, ROL_ADMIN]),
      schema: { tags: ['casos'], summary: 'Decidir garantia (CU-SGC-014)' },
    },
    async function (solicitud, respuesta) {
      const decision = solicitud.body?.decision === 'procedente' ? 'procedente' : 'improcedente';
      const resultado = await decidirGarantia(solicitud.params.referencia, decision);
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'casos.decidir_garantia',
        'casos',
        solicitud.params.referencia,
        'ok',
      );
      return { data: resultado.datos };
    },
  );

  aplicacion.post<{ Params: { referencia: string }; Body: { accion: string } }>(
    '/casos/:referencia/logistica',
    {
      preHandler: requerirRol([ROL_RESPONSABLE_GARANTIAS, ROL_ADMIN]),
      schema: { tags: ['casos'], summary: 'Coordinar logistica del caso (CU-SGC-015)' },
    },
    async function (solicitud, respuesta) {
      const resultado = await solicitarLogistica(
        solicitud.params.referencia,
        String(solicitud.body?.accion || ''),
      );
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'casos.solicitar_logistica',
        'casos',
        solicitud.params.referencia,
        'ok',
      );
      return { data: resultado.datos };
    },
  );

  aplicacion.post<{ Params: { referencia: string } }>(
    '/casos/:referencia/reembolso',
    {
      preHandler: requerirRol([ROL_RESPONSABLE_GARANTIAS, ROL_ADMIN]),
      schema: { tags: ['casos'], summary: 'Solicitar reembolso a pagos (CU-SGC-016)' },
    },
    async function (solicitud, respuesta) {
      const resultado = await crearReembolso(solicitud.params.referencia);
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(solicitud, 'casos.solicitar_reembolso', 'reembolsos', 'nuevo', 'ok');
      return { data: resultado.datos };
    },
  );

  // Payments completa el reembolso; en local se marca completado (F3-GCP lo ejecuta).
  aplicacion.post<{ Params: { referencia: string } }>(
    '/reembolsos/:referencia/completar',
    {
      preHandler: requerirRol([ROL_ADMIN]),
      schema: { tags: ['casos'], summary: 'Completar reembolso (Payments)' },
    },
    async function (solicitud, respuesta) {
      const filas = await base
        .select()
        .from(reembolsos)
        .where(eq(reembolsos.referenciaReembolso, solicitud.params.referencia))
        .limit(1);
      if (!filas[0]) return respuesta.code(404).send({ error: 'reembolso_no_encontrado' });
      await base
        .update(reembolsos)
        .set({ estado: REEMBOLSO_COMPLETADO, actualizadoEn: new Date() })
        .where(eq(reembolsos.id, filas[0].id));
      await registrarAuditoria(
        solicitud,
        'reembolsos.completar',
        'reembolsos',
        solicitud.params.referencia,
        'ok',
      );
      return {
        data: { referenciaReembolso: solicitud.params.referencia, estado: REEMBOLSO_COMPLETADO },
      };
    },
  );
}
