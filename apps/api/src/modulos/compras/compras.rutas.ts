// Rutas de Compras avanzado del ERP (CU-ERP-002..009): solicitudes, ordenes, recepcion y cuentas por pagar.
import type { FastifyInstance } from 'fastify';
import { ROL_ADMIN, ROL_ALMACENISTA, ROL_COMPRAS, ROL_CONTADOR } from '../../dominio/constantes';
import { registrarAuditoria } from '../administracion/auditoria';
import {
  aprobarOrdenCompra,
  cancelarOrdenCompra,
  cancelarSolicitudCompra,
  crearOrdenCompra,
  crearSolicitudCompra,
  listarCuentasPorPagar,
  listarOrdenesCompra,
  listarSolicitudesCompra,
  obtenerOrdenCompra,
  pagarCuentaPorPagar,
  registrarRecepcionOrden,
} from './compras.servicio';

type CuerpoSolicitud = { productoId: number; cantidad: number; motivo: string };
type CuerpoOrden = {
  solicitudId?: number;
  proveedorId: number;
  bodegaDestinoId: number;
  // Modo de una linea (compatibilidad) o multi-linea con renglones (CU-ERP-003).
  productoId?: number;
  cantidad?: number;
  precioUnitarioCentavos?: number;
  lineas?: { productoId: number; cantidad: number; precioUnitarioCentavos: number }[];
};
type CuerpoRecepcion = {
  /** Recepcion por renglon (CU-ERP-007); obligatoria si la orden tiene varias lineas. */
  lineas?: { lineaId: number; cantidad: number }[];
  /** Cantidad suelta: solo valida en ordenes de un unico renglon. */
  cantidadRecibida?: number;
};

function actorDe(solicitud: any): { id?: string; rol?: string } {
  const usuario = solicitud.usuario;
  return {
    id: usuario ? String(usuario.sub || '') : undefined,
    rol: usuario ? usuario.rol : undefined,
  };
}

export async function rutasCompras(aplicacion: FastifyInstance): Promise<void> {
  const requerirRol = (aplicacion as any).requerirRol as (roles: string[]) => any;
  const compras = [ROL_COMPRAS, ROL_ADMIN];
  const contable = [ROL_CONTADOR, ROL_ADMIN];
  const almacen = [ROL_ALMACENISTA, ROL_ADMIN];
  const consulta = [ROL_COMPRAS, ROL_CONTADOR, ROL_ALMACENISTA, ROL_ADMIN];

  // Solicitudes de compra (CU-ERP-002).
  aplicacion.post<{ Body: CuerpoSolicitud }>(
    '/compras/solicitudes',
    {
      preHandler: requerirRol(compras),
      schema: { tags: ['compras'], summary: 'Registrar solicitud de compra (CU-ERP-002)' },
    },
    async function (solicitud, respuesta) {
      const resultado = await crearSolicitudCompra(
        solicitud.body || ({} as CuerpoSolicitud),
        actorDe(solicitud),
      );
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'compras.crear_solicitud',
        'solicitudes_compra',
        String((resultado.datos as any).referencia),
        'ok',
      );
      return respuesta.code(201).send({ data: resultado.datos });
    },
  );

  aplicacion.get(
    '/compras/solicitudes',
    {
      preHandler: requerirRol(compras),
      schema: { tags: ['compras'], summary: 'Listar solicitudes de compra (CU-ERP-002)' },
    },
    async function () {
      return { data: await listarSolicitudesCompra() };
    },
  );

  aplicacion.patch<{ Params: { id: string } }>(
    '/compras/solicitudes/:id/cancelar',
    {
      preHandler: requerirRol(compras),
      schema: { tags: ['compras'], summary: 'Cancelar solicitud de compra (CU-ERP-002)' },
    },
    async function (solicitud, respuesta) {
      const resultado = await cancelarSolicitudCompra(Number(solicitud.params.id));
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'compras.cancelar_solicitud',
        'solicitudes_compra',
        solicitud.params.id,
        'ok',
      );
      return { data: resultado.datos };
    },
  );

  // Ordenes de compra (CU-ERP-003/004/005/006).
  aplicacion.post<{ Body: CuerpoOrden }>(
    '/compras/ordenes',
    {
      preHandler: requerirRol(compras),
      schema: { tags: ['compras'], summary: 'Crear orden de compra (CU-ERP-003)' },
    },
    async function (solicitud, respuesta) {
      const resultado = await crearOrdenCompra(
        solicitud.body || ({} as CuerpoOrden),
        actorDe(solicitud),
      );
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'compras.crear_orden',
        'ordenes_compra',
        String((resultado.datos as any).referencia),
        'ok',
      );
      return respuesta.code(201).send({ data: resultado.datos });
    },
  );

  aplicacion.get(
    '/compras/ordenes',
    {
      preHandler: requerirRol(consulta),
      schema: { tags: ['compras'], summary: 'Listar ordenes de compra (CU-ERP-006)' },
    },
    async function () {
      return { data: await listarOrdenesCompra() };
    },
  );

  aplicacion.get<{ Params: { id: string } }>(
    '/compras/ordenes/:id',
    {
      preHandler: requerirRol(consulta),
      schema: { tags: ['compras'], summary: 'Consultar orden de compra (CU-ERP-006)' },
    },
    async function (solicitud, respuesta) {
      const orden = await obtenerOrdenCompra(Number(solicitud.params.id));
      if (!orden) return respuesta.code(404).send({ error: 'orden_no_encontrada' });
      return { data: orden };
    },
  );

  aplicacion.patch<{ Params: { id: string } }>(
    '/compras/ordenes/:id/aprobar',
    {
      preHandler: requerirRol(contable),
      schema: { tags: ['compras'], summary: 'Aprobar orden de compra (CU-ERP-004)' },
    },
    async function (solicitud, respuesta) {
      const resultado = await aprobarOrdenCompra(Number(solicitud.params.id));
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'compras.aprobar_orden',
        'ordenes_compra',
        solicitud.params.id,
        'ok',
      );
      return { data: resultado.datos };
    },
  );

  aplicacion.patch<{ Params: { id: string } }>(
    '/compras/ordenes/:id/cancelar',
    {
      preHandler: requerirRol(compras),
      schema: { tags: ['compras'], summary: 'Cancelar orden de compra (CU-ERP-005)' },
    },
    async function (solicitud, respuesta) {
      const resultado = await cancelarOrdenCompra(Number(solicitud.params.id));
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'compras.cancelar_orden',
        'ordenes_compra',
        solicitud.params.id,
        'ok',
      );
      return { data: resultado.datos };
    },
  );

  // Recepcion e ingreso a inventario (CU-ERP-007/008).
  aplicacion.post<{ Params: { id: string }; Body: CuerpoRecepcion }>(
    '/compras/ordenes/:id/recepcion',
    {
      preHandler: requerirRol(almacen),
      schema: {
        tags: ['compras'],
        summary: 'Registrar recepcion por linea e ingreso a inventario (CU-ERP-007/008)',
      },
    },
    async function (solicitud, respuesta) {
      const cuerpo = solicitud.body || {};
      // La recepcion puede venir por renglon (multi-linea) o como cantidad suelta (una linea).
      const recepciones = Array.isArray(cuerpo.lineas)
        ? cuerpo.lineas
        : Number(cuerpo.cantidadRecibida);
      const resultado = await registrarRecepcionOrden(
        Number(solicitud.params.id),
        recepciones as any,
        actorDe(solicitud),
      );
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'compras.recepcion_orden',
        'ordenes_compra',
        solicitud.params.id,
        'ok',
      );
      return respuesta.code(201).send({ data: resultado.datos });
    },
  );

  // Cuentas por pagar de compras (CU-ERP-009).
  aplicacion.get(
    '/compras/cuentas-pagar',
    {
      preHandler: requerirRol(contable),
      schema: { tags: ['compras'], summary: 'Listar cuentas por pagar (CU-ERP-009)' },
    },
    async function () {
      return { data: await listarCuentasPorPagar() };
    },
  );

  aplicacion.patch<{ Params: { id: string }; Body: { referenciaPago: string } }>(
    '/compras/cuentas-pagar/:id/pagar',
    {
      preHandler: requerirRol(contable),
      schema: { tags: ['compras'], summary: 'Registrar pago de cuenta por pagar (CU-ERP-009)' },
    },
    async function (solicitud, respuesta) {
      const resultado = await pagarCuentaPorPagar(
        Number(solicitud.params.id),
        String((solicitud.body || {}).referenciaPago || ''),
      );
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'compras.pagar_cuenta',
        'cuentas_por_pagar',
        solicitud.params.id,
        'ok',
      );
      return { data: resultado.datos };
    },
  );
}
