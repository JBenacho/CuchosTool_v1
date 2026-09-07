// Rutas de casos SGC (CU-SGC-002..009). Cliente crea/consulta lo propio; agentes gestionan.
import type { FastifyInstance } from 'fastify';
import { ROL_ADMIN, ROL_AGENTE, ROL_SUPERVISOR } from '../../dominio/constantes';
import { registrarAuditoria } from '../administracion/auditoria';
import {
  agregarMensajeCaso,
  cambiarEstadoCaso,
  crearCaso,
  listarCasosCliente,
  obtenerCaso,
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
}
