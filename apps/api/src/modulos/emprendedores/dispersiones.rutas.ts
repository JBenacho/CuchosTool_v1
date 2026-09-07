// Rutas de dispersiones (CU-EM-015..018). Roles: Gerente de Zona coordina; Admin ejecuta.
import type { FastifyInstance } from 'fastify';
import { ROL_ADMIN, ROL_GERENTE_ZONA } from '../../dominio/constantes';
import { registrarAuditoria } from '../administracion/auditoria';
import {
  autorizarDispersion,
  confirmarEntregaPedido,
  ejecutarDispersion,
} from './dispersiones.servicio';

type CuerpoAutorizar = { referenciaPedido: string; emprendedorId: number };

export async function rutasDispersiones(aplicacion: FastifyInstance): Promise<void> {
  const requerirRol = (aplicacion as any).requerirRol as (roles: string[]) => any;

  aplicacion.post<{ Body: { referenciaPedido: string } }>(
    '/dispersiones/entregas',
    {
      preHandler: requerirRol([ROL_GERENTE_ZONA, ROL_ADMIN]),
      schema: { tags: ['emprendedores'], summary: 'Confirmar entrega fisica (CU-EM-015)' },
    },
    async function (solicitud, respuesta) {
      const resultado = await confirmarEntregaPedido(
        String(solicitud.body?.referenciaPedido || ''),
      );
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'dispersiones.confirmar_entrega',
        'pedidos',
        solicitud.body?.referenciaPedido || '',
        'ok',
      );
      return { data: resultado.datos };
    },
  );

  aplicacion.post<{ Body: CuerpoAutorizar }>(
    '/dispersiones',
    {
      preHandler: requerirRol([ROL_GERENTE_ZONA, ROL_ADMIN]),
      schema: { tags: ['emprendedores'], summary: 'Autorizar dispersion (CU-EM-016)' },
    },
    async function (solicitud, respuesta) {
      const resultado = await autorizarDispersion(
        String(solicitud.body?.referenciaPedido || ''),
        Number(solicitud.body?.emprendedorId),
      );
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'dispersiones.autorizar',
        'pedidos',
        solicitud.body?.referenciaPedido || '',
        'ok',
      );
      return { data: resultado.datos };
    },
  );

  aplicacion.post<{ Params: { referencia: string } }>(
    '/dispersiones/:referencia/ejecutar',
    {
      preHandler: requerirRol([ROL_ADMIN]),
      schema: { tags: ['emprendedores'], summary: 'Ejecutar dispersion (CU-EM-017)' },
    },
    async function (solicitud, respuesta) {
      const resultado = await ejecutarDispersion(solicitud.params.referencia);
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'dispersiones.ejecutar',
        'dispersiones',
        solicitud.params.referencia,
        'ok',
      );
      return { data: resultado.datos };
    },
  );
}
