// Rutas de Logistica del ERP (CU-LG-001..006): transportistas, vehiculos, rutas y despachos.
// CU-LG-005: la gestion de rutas queda restringida a logistica y administracion (RN-LG-04).
import type { FastifyInstance } from 'fastify';
import { ROL_ADMIN, ROL_ALMACENISTA, ROL_LOGISTICA } from '../../dominio/constantes';
import { registrarAuditoria } from '../administracion/auditoria';
import {
  actualizarRuta,
  asignarDespachosARuta,
  cancelarRuta,
  completarRuta,
  crearDespacho,
  crearRuta,
  crearTransportista,
  crearVehiculo,
  despacharDespacho,
  despachosConsolidables,
  devolverDespacho,
  entregarDespacho,
  inactivarTransportista,
  inactivarVehiculo,
  iniciarRuta,
  listarDespachos,
  listarRutas,
  listarTransportistas,
  listarVehiculos,
  obtenerRuta,
  ventasDespachables,
} from './logistica.servicio';

/** Actor autenticado de la solicitud (id y rol) para auditoria. */
function actorDe(solicitud: any): { id?: string; rol?: string } {
  const usuario = solicitud.usuario;
  return {
    id: usuario ? String(usuario.sub || '') : undefined,
    rol: usuario ? usuario.rol : undefined,
  };
}

export async function rutasLogistica(aplicacion: FastifyInstance): Promise<void> {
  const requerirRol = (aplicacion as any).requerirRol as (roles: string[]) => any;
  const gestion = [ROL_LOGISTICA, ROL_ADMIN];
  const operacion = [ROL_LOGISTICA, ROL_ALMACENISTA, ROL_ADMIN];

  // Transportistas (CU-LG-001).
  aplicacion.get(
    '/logistica/transportistas',
    {
      preHandler: requerirRol(operacion),
      schema: { tags: ['logistica'], summary: 'Listar transportistas (CU-LG-001)' },
    },
    async function () {
      return { data: await listarTransportistas() };
    },
  );
  aplicacion.post(
    '/logistica/transportistas',
    {
      preHandler: requerirRol(gestion),
      schema: { tags: ['logistica'], summary: 'Crear transportista (CU-LG-001)' },
    },
    async function (solicitud: any, respuesta: any) {
      const resultado = await crearTransportista(solicitud.body || {});
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'logistica.crear_transportista',
        'transportistas',
        'nuevo',
        'ok',
      );
      return respuesta.code(201).send({ data: resultado.datos });
    },
  );
  aplicacion.patch(
    '/logistica/transportistas/:id/inactivar',
    {
      preHandler: requerirRol(gestion),
      schema: { tags: ['logistica'], summary: 'Inactivar transportista (CU-LG-001)' },
    },
    async function (solicitud: any, respuesta: any) {
      const resultado = await inactivarTransportista(Number(solicitud.params.id));
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'logistica.inactivar_transportista',
        'transportistas',
        solicitud.params.id,
        'ok',
      );
      return { data: resultado.datos };
    },
  );

  // Vehiculos (CU-LG-002).
  aplicacion.get(
    '/logistica/vehiculos',
    {
      preHandler: requerirRol(operacion),
      schema: { tags: ['logistica'], summary: 'Listar vehiculos (CU-LG-002)' },
    },
    async function (solicitud: any) {
      return {
        data: await listarVehiculos({
          transportistaId:
            solicitud.query && solicitud.query.transportistaId
              ? Number(solicitud.query.transportistaId)
              : undefined,
        }),
      };
    },
  );
  aplicacion.post(
    '/logistica/vehiculos',
    {
      preHandler: requerirRol(gestion),
      schema: { tags: ['logistica'], summary: 'Crear vehiculo (CU-LG-002)' },
    },
    async function (solicitud: any, respuesta: any) {
      const resultado = await crearVehiculo(solicitud.body || {});
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(solicitud, 'logistica.crear_vehiculo', 'vehiculos', 'nuevo', 'ok');
      return respuesta.code(201).send({ data: resultado.datos });
    },
  );
  aplicacion.patch(
    '/logistica/vehiculos/:id/inactivar',
    {
      preHandler: requerirRol(gestion),
      schema: { tags: ['logistica'], summary: 'Inactivar vehiculo (CU-LG-002)' },
    },
    async function (solicitud: any, respuesta: any) {
      const resultado = await inactivarVehiculo(Number(solicitud.params.id));
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'logistica.inactivar_vehiculo',
        'vehiculos',
        solicitud.params.id,
        'ok',
      );
      return { data: resultado.datos };
    },
  );

  // Rutas de distribucion (CU-LG-005): codigo unico, paradas secuenciadas y consolidacion.
  aplicacion.get(
    '/logistica/rutas',
    {
      preHandler: requerirRol(gestion),
      schema: { tags: ['logistica'], summary: 'Listar rutas de distribucion (CU-LG-005)' },
    },
    async function () {
      return { data: await listarRutas() };
    },
  );
  aplicacion.get<{ Params: { id: string } }>(
    '/logistica/rutas/:id',
    {
      preHandler: requerirRol(gestion),
      schema: { tags: ['logistica'], summary: 'Consultar ruta con sus paradas (CU-LG-005)' },
    },
    async function (solicitud, respuesta) {
      const ruta = await obtenerRuta(Number(solicitud.params.id));
      if (!ruta) return respuesta.code(404).send({ error: 'ruta_no_encontrada' });
      return { data: ruta };
    },
  );
  aplicacion.post(
    '/logistica/rutas',
    {
      preHandler: requerirRol(gestion),
      schema: { tags: ['logistica'], summary: 'Planificar ruta de distribucion (CU-LG-005)' },
    },
    async function (solicitud: any, respuesta: any) {
      const resultado = await crearRuta(solicitud.body || {}, actorDe(solicitud));
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'logistica.crear_ruta',
        'rutas',
        String((resultado.datos as any).codigo),
        'ok',
      );
      return respuesta.code(201).send({ data: resultado.datos });
    },
  );
  aplicacion.patch(
    '/logistica/rutas/:id',
    {
      preHandler: requerirRol(gestion),
      schema: { tags: ['logistica'], summary: 'Modificar ruta planificada (CU-LG-005)' },
    },
    async function (solicitud: any, respuesta: any) {
      const resultado = await actualizarRuta(Number(solicitud.params.id), solicitud.body || {});
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'logistica.actualizar_ruta',
        'rutas',
        solicitud.params.id,
        'ok',
      );
      return { data: resultado.datos };
    },
  );
  aplicacion.post(
    '/logistica/rutas/:id/despachos',
    {
      preHandler: requerirRol(gestion),
      schema: {
        tags: ['logistica'],
        summary: 'Consolidar despachos programados en la ruta (CU-LG-005)',
      },
    },
    async function (solicitud: any, respuesta: any) {
      const cuerpo = solicitud.body || {};
      const resultado = await asignarDespachosARuta(
        Number(solicitud.params.id),
        Array.isArray(cuerpo.despachoIds) ? cuerpo.despachoIds.map(Number) : [],
      );
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'logistica.consolidar_despachos',
        'rutas',
        solicitud.params.id,
        'ok',
      );
      return { data: resultado.datos };
    },
  );
  aplicacion.patch(
    '/logistica/rutas/:id/iniciar',
    {
      preHandler: requerirRol(gestion),
      schema: { tags: ['logistica'], summary: 'Iniciar ejecucion de la ruta (CU-LG-005)' },
    },
    async function (solicitud: any, respuesta: any) {
      const resultado = await iniciarRuta(Number(solicitud.params.id));
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'logistica.iniciar_ruta',
        'rutas',
        solicitud.params.id,
        'ok',
      );
      return { data: resultado.datos };
    },
  );
  aplicacion.patch(
    '/logistica/rutas/:id/completar',
    {
      preHandler: requerirRol(gestion),
      schema: { tags: ['logistica'], summary: 'Completar ruta en ejecucion (CU-LG-005)' },
    },
    async function (solicitud: any, respuesta: any) {
      const resultado = await completarRuta(Number(solicitud.params.id));
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'logistica.completar_ruta',
        'rutas',
        solicitud.params.id,
        'ok',
      );
      return { data: resultado.datos };
    },
  );
  aplicacion.patch(
    '/logistica/rutas/:id/cancelar',
    {
      preHandler: requerirRol(gestion),
      schema: { tags: ['logistica'], summary: 'Cancelar ruta planificada (CU-LG-005)' },
    },
    async function (solicitud: any, respuesta: any) {
      const resultado = await cancelarRuta(Number(solicitud.params.id));
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'logistica.cancelar_ruta',
        'rutas',
        solicitud.params.id,
        'ok',
      );
      return { data: resultado.datos };
    },
  );
  aplicacion.get(
    '/logistica/despachos-consolidables',
    {
      preHandler: requerirRol(gestion),
      schema: {
        tags: ['logistica'],
        summary: 'Despachos programados disponibles para consolidar (CU-LG-005)',
      },
    },
    async function () {
      return { data: await despachosConsolidables() };
    },
  );

  // Despachos (CU-LG-003/004/005/006).
  aplicacion.get(
    '/logistica/ventas-despachables',
    {
      preHandler: requerirRol(operacion),
      schema: { tags: ['logistica'], summary: 'Ventas pagadas disponibles para despacho' },
    },
    async function () {
      return { data: await ventasDespachables() };
    },
  );
  aplicacion.get(
    '/logistica/despachos',
    {
      preHandler: requerirRol(operacion),
      schema: { tags: ['logistica'], summary: 'Listar despachos (CU-LG-003)' },
    },
    async function () {
      return { data: await listarDespachos() };
    },
  );
  aplicacion.post(
    '/logistica/despachos',
    {
      preHandler: requerirRol(operacion),
      schema: { tags: ['logistica'], summary: 'Crear despacho programado (CU-LG-003)' },
    },
    async function (solicitud: any, respuesta: any) {
      const resultado = await crearDespacho(solicitud.body || {});
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'logistica.crear_despacho',
        'despachos',
        String((resultado.datos as any).referencia),
        'ok',
      );
      return respuesta.code(201).send({ data: resultado.datos });
    },
  );
  aplicacion.patch(
    '/logistica/despachos/:id/despachar',
    {
      preHandler: requerirRol(operacion),
      schema: { tags: ['logistica'], summary: 'Poner despacho en ruta (CU-LG-006)' },
    },
    async function (solicitud: any, respuesta: any) {
      const resultado = await despacharDespacho(Number(solicitud.params.id));
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'logistica.despachar',
        'despachos',
        solicitud.params.id,
        'ok',
      );
      return { data: resultado.datos };
    },
  );
  aplicacion.patch(
    '/logistica/despachos/:id/entregar',
    {
      preHandler: requerirRol(operacion),
      schema: {
        tags: ['logistica'],
        summary: 'Marcar despacho entregado y venta entregada (CU-LG-006)',
      },
    },
    async function (solicitud: any, respuesta: any) {
      const resultado = await entregarDespacho(Number(solicitud.params.id));
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'logistica.entregar',
        'despachos',
        solicitud.params.id,
        'ok',
      );
      return { data: resultado.datos };
    },
  );
  aplicacion.patch(
    '/logistica/despachos/:id/devolver',
    {
      preHandler: requerirRol(operacion),
      schema: { tags: ['logistica'], summary: 'Registrar devolucion del despacho (CU-LG-006)' },
    },
    async function (solicitud: any, respuesta: any) {
      const resultado = await devolverDespacho(Number(solicitud.params.id));
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'logistica.devolver',
        'despachos',
        solicitud.params.id,
        'ok',
      );
      return { data: resultado.datos };
    },
  );
}
