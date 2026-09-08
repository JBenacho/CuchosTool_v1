// Rutas del modulo Ventas del ERP (CU-CM-007 base): consulta y gestion del ciclo de pedidos del canal.
import type { FastifyInstance } from 'fastify';
import { ROL_ADMIN, ROL_VENDEDOR } from '../../dominio/constantes';
import { registrarAuditoria } from '../administracion/auditoria';
import {
  cancelarVenta,
  entregarVenta,
  listarVentas,
  obtenerVenta,
  resumenVentas,
} from './ventas.servicio';

export async function rutasVentas(aplicacion: FastifyInstance): Promise<void> {
  const requerirRol = (aplicacion as any).requerirRol as (roles: string[]) => any;
  const comercial = [ROL_VENDEDOR, ROL_ADMIN];

  aplicacion.get<{ Querystring: { estado?: string; limite?: string } }>(
    '/ventas',
    {
      preHandler: requerirRol(comercial),
      schema: { tags: ['ventas'], summary: 'Listar ventas del canal (CU-CM-007 base)' },
    },
    async function (solicitud) {
      return {
        data: await listarVentas({
          estado: solicitud.query.estado || undefined,
          limite: solicitud.query.limite ? Number(solicitud.query.limite) : undefined,
        }),
      };
    },
  );

  aplicacion.get(
    '/ventas/resumen',
    {
      preHandler: requerirRol(comercial),
      schema: { tags: ['ventas'], summary: 'Resumen de ventas del ERP' },
    },
    async function () {
      return { data: await resumenVentas() };
    },
  );

  aplicacion.get<{ Params: { referencia: string } }>(
    '/ventas/:referencia',
    {
      preHandler: requerirRol(comercial),
      schema: { tags: ['ventas'], summary: 'Consultar detalle de una venta' },
    },
    async function (solicitud, respuesta) {
      const venta = await obtenerVenta(solicitud.params.referencia);
      if (!venta) return respuesta.code(404).send({ error: 'venta_no_encontrada' });
      return { data: venta };
    },
  );

  aplicacion.patch<{ Params: { referencia: string } }>(
    '/ventas/:referencia/entregar',
    {
      preHandler: requerirRol(comercial),
      schema: { tags: ['ventas'], summary: 'Marcar venta como entregada' },
    },
    async function (solicitud, respuesta) {
      const resultado = await entregarVenta(solicitud.params.referencia);
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'ventas.entregar',
        'pedidos',
        solicitud.params.referencia,
        'ok',
      );
      return { data: resultado.datos };
    },
  );

  aplicacion.patch<{ Params: { referencia: string } }>(
    '/ventas/:referencia/cancelar',
    {
      preHandler: requerirRol(comercial),
      schema: { tags: ['ventas'], summary: 'Cancelar venta pendiente de pago' },
    },
    async function (solicitud, respuesta) {
      const resultado = await cancelarVenta(solicitud.params.referencia);
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'ventas.cancelar',
        'pedidos',
        solicitud.params.referencia,
        'ok',
      );
      return { data: resultado.datos };
    },
  );
}
