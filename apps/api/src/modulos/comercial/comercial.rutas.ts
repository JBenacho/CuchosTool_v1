// Rutas Comercial B2B (CU-CM-001/004/007) y Metas/Comisiones (CU-CM-005/006), F5.
import type { FastifyInstance } from 'fastify';
import { ROL_ADMIN, ROL_CONTADOR, ROL_VENDEDOR } from '../../dominio/constantes';
import { registrarAuditoria } from '../administracion/auditoria';
import {
  anularOrdenB2b,
  crearClienteEmpresa,
  crearOrdenVentaB2b,
  inactivarClienteEmpresa,
  listarClientesEmpresa,
  listarOrdenesB2b,
  obtenerOrdenB2b,
  pagarOrdenB2b,
} from './comercial.servicio';
import {
  calcularComisiones,
  configurarComision,
  crearMeta,
  cumplimientoMetas,
  listarComisiones,
  listarConfigComisiones,
  listarMetas,
  listarVendedores,
  pagarComision,
} from './metas.servicio';

export async function rutasComercial(aplicacion: FastifyInstance): Promise<void> {
  const requerirRol = (aplicacion as any).requerirRol as (roles: string[]) => any;
  const comercial = [ROL_VENDEDOR, ROL_ADMIN];
  const actorDe = function (solicitud: any) {
    const usuario = solicitud.usuario;
    return {
      id: usuario ? String(usuario.sub || '') : undefined,
      rol: usuario ? usuario.rol : undefined,
    };
  };

  aplicacion.get(
    '/comercial/clientes-empresa',
    {
      preHandler: requerirRol(comercial),
      schema: { tags: ['comercial'], summary: 'Listar clientes ERP (CU-CM-004)' },
    },
    async function () {
      return { data: await listarClientesEmpresa() };
    },
  );
  aplicacion.post(
    '/comercial/clientes-empresa',
    {
      preHandler: requerirRol(comercial),
      schema: { tags: ['comercial'], summary: 'Crear cliente ERP (CU-CM-004)' },
    },
    async function (solicitud: any, respuesta: any) {
      const resultado = await crearClienteEmpresa(solicitud.body || {});
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'comercial.crear_cliente',
        'clientes_empresa',
        'nuevo',
        'ok',
      );
      return respuesta.code(201).send({ data: resultado.datos });
    },
  );
  aplicacion.patch(
    '/comercial/clientes-empresa/:id/inactivar',
    {
      preHandler: requerirRol(comercial),
      schema: { tags: ['comercial'], summary: 'Inactivar cliente ERP (CU-CM-004)' },
    },
    async function (solicitud: any, respuesta: any) {
      const resultado = await inactivarClienteEmpresa(Number(solicitud.params.id));
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      return { data: resultado.datos };
    },
  );

  aplicacion.get(
    '/comercial/ordenes',
    {
      preHandler: requerirRol(comercial),
      schema: { tags: ['comercial'], summary: 'Listar ordenes B2B (CU-CM-007)' },
    },
    async function () {
      return { data: await listarOrdenesB2b() };
    },
  );
  aplicacion.get(
    '/comercial/ordenes/:id',
    {
      preHandler: requerirRol(comercial),
      schema: { tags: ['comercial'], summary: 'Consultar orden B2B (CU-CM-007)' },
    },
    async function (solicitud: any, respuesta: any) {
      const orden = await obtenerOrdenB2b(Number(solicitud.params.id));
      if (!orden) return respuesta.code(404).send({ error: 'orden_no_encontrada' });
      return { data: orden };
    },
  );
  aplicacion.post(
    '/comercial/ordenes',
    {
      preHandler: requerirRol(comercial),
      schema: { tags: ['comercial'], summary: 'Crear orden de venta B2B (CU-CM-007)' },
    },
    async function (solicitud: any, respuesta: any) {
      const resultado = await crearOrdenVentaB2b(solicitud.body || {}, actorDe(solicitud));
      if (!resultado.ok)
        return respuesta
          .code(resultado.codigoEstado || 400)
          .send({ error: resultado.error, ...(resultado.datos || {}) });
      await registrarAuditoria(
        solicitud,
        'comercial.crear_orden_b2b',
        'ordenes_venta_b2b',
        String((resultado.datos as any).folio),
        'ok',
      );
      return respuesta.code(201).send({ data: resultado.datos });
    },
  );
  aplicacion.patch(
    '/comercial/ordenes/:id/pagar',
    {
      preHandler: requerirRol(comercial),
      schema: { tags: ['comercial'], summary: 'Marcar orden B2B pagada (CU-CM-007)' },
    },
    async function (solicitud: any, respuesta: any) {
      const resultado = await pagarOrdenB2b(Number(solicitud.params.id));
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'comercial.pagar_orden_b2b',
        'ordenes_venta_b2b',
        solicitud.params.id,
        'ok',
      );
      return { data: resultado.datos };
    },
  );
  aplicacion.patch(
    '/comercial/ordenes/:id/anular',
    {
      preHandler: requerirRol(comercial),
      schema: { tags: ['comercial'], summary: 'Anular orden B2B y devolver stock (CU-CM-007)' },
    },
    async function (solicitud: any, respuesta: any) {
      const resultado = await anularOrdenB2b(Number(solicitud.params.id), actorDe(solicitud));
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'comercial.anular_orden_b2b',
        'ordenes_venta_b2b',
        solicitud.params.id,
        'ok',
      );
      return { data: resultado.datos };
    },
  );

  // Metas comerciales (CU-CM-005).
  aplicacion.get(
    '/comercial/vendedores',
    {
      preHandler: requerirRol([ROL_ADMIN]),
      schema: { tags: ['comercial'], summary: 'Listar vendedores (CU-CM-001)' },
    },
    async function () {
      return { data: await listarVendedores() };
    },
  );
  aplicacion.get(
    '/comercial/metas',
    {
      preHandler: requerirRol([ROL_ADMIN, ROL_VENDEDOR]),
      schema: { tags: ['comercial'], summary: 'Listar metas comerciales (CU-CM-005)' },
    },
    async function (solicitud: any) {
      return {
        data: await listarMetas(
          solicitud.query && solicitud.query.periodo ? String(solicitud.query.periodo) : undefined,
        ),
      };
    },
  );
  aplicacion.post(
    '/comercial/metas',
    {
      preHandler: requerirRol([ROL_ADMIN]),
      schema: { tags: ['comercial'], summary: 'Crear meta comercial (CU-CM-005)' },
    },
    async function (solicitud: any, respuesta: any) {
      const resultado = await crearMeta(solicitud.body || {});
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'comercial.crear_meta',
        'metas_comerciales',
        'nueva',
        'ok',
      );
      return respuesta.code(201).send({ data: resultado.datos });
    },
  );
  aplicacion.get(
    '/comercial/metas/cumplimiento',
    {
      preHandler: requerirRol([ROL_ADMIN, ROL_VENDEDOR]),
      schema: { tags: ['comercial'], summary: 'Cumplimiento de metas del periodo (CU-CM-005)' },
    },
    async function (solicitud: any) {
      const periodo =
        solicitud.query && solicitud.query.periodo ? String(solicitud.query.periodo) : '';
      return { data: await cumplimientoMetas(periodo) };
    },
  );

  // Comisiones (CU-CM-006).
  aplicacion.get(
    '/comercial/comisiones/config',
    {
      preHandler: requerirRol([ROL_ADMIN, ROL_CONTADOR]),
      schema: { tags: ['comercial'], summary: 'Listar configuracion de comisiones (CU-CM-006)' },
    },
    async function () {
      return { data: await listarConfigComisiones() };
    },
  );
  aplicacion.post(
    '/comercial/comisiones/config',
    {
      preHandler: requerirRol([ROL_ADMIN]),
      schema: { tags: ['comercial'], summary: 'Configurar porcentaje de comision (CU-CM-006)' },
    },
    async function (solicitud: any, respuesta: any) {
      const resultado = await configurarComision(solicitud.body || {});
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'comercial.configurar_comision',
        'comisiones_vendedor',
        'config',
        'ok',
      );
      return { data: resultado.datos };
    },
  );
  aplicacion.post(
    '/comercial/comisiones/calcular',
    {
      preHandler: requerirRol([ROL_ADMIN, ROL_CONTADOR]),
      schema: { tags: ['comercial'], summary: 'Calcular comisiones del periodo (CU-CM-006)' },
    },
    async function (solicitud: any, respuesta: any) {
      const resultado = await calcularComisiones(String((solicitud.body || {}).periodo || ''));
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'comercial.calcular_comisiones',
        'comisiones',
        String((resultado.datos as any).periodo),
        'ok',
      );
      return respuesta.code(201).send({ data: resultado.datos });
    },
  );
  aplicacion.get(
    '/comercial/comisiones',
    {
      preHandler: requerirRol([ROL_ADMIN, ROL_CONTADOR, ROL_VENDEDOR]),
      schema: { tags: ['comercial'], summary: 'Listar comisiones (CU-CM-006)' },
    },
    async function (solicitud: any) {
      return {
        data: await listarComisiones(
          solicitud.query && solicitud.query.periodo ? String(solicitud.query.periodo) : undefined,
        ),
      };
    },
  );
  aplicacion.patch(
    '/comercial/comisiones/:id/pagar',
    {
      preHandler: requerirRol([ROL_ADMIN, ROL_CONTADOR]),
      schema: { tags: ['comercial'], summary: 'Liquidar/pagar comision (CU-CM-006)' },
    },
    async function (solicitud: any, respuesta: any) {
      const resultado = await pagarComision(Number(solicitud.params.id));
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'comercial.pagar_comision',
        'comisiones',
        solicitud.params.id,
        'ok',
      );
      return { data: resultado.datos };
    },
  );
}
