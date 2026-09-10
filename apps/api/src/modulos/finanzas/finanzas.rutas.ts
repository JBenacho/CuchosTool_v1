// Rutas de Facturacion (CU-FC-001..004) y Contabilidad (CU-CT-001) del ERP.
import type { FastifyInstance } from 'fastify';
import { ROL_ADMIN, ROL_CONTADOR } from '../../dominio/constantes';
import { registrarAuditoria } from '../administracion/auditoria';
import {
  anularFactura,
  crearAsiento,
  crearCuenta,
  crearImpuesto,
  crearNotaFactura,
  emitirFactura,
  emitirFacturaDian,
  inactivarCuenta,
  inactivarImpuesto,
  listarAsientos,
  listarCuentas,
  listarFacturas,
  listarImpuestos,
  listarNotas,
  obtenerFactura,
  ordenesPorFacturar,
  pagarFactura,
} from './finanzas.servicio';

export async function rutasFinanzas(aplicacion: FastifyInstance): Promise<void> {
  const requerirRol = (aplicacion as any).requerirRol as (roles: string[]) => any;
  const contable = [ROL_CONTADOR, ROL_ADMIN];

  // Impuestos (CU-FC-004).
  aplicacion.get(
    '/facturacion/impuestos',
    {
      preHandler: requerirRol(contable),
      schema: { tags: ['facturacion'], summary: 'Listar impuestos (CU-FC-004)' },
    },
    async function () {
      return { data: await listarImpuestos() };
    },
  );
  aplicacion.post(
    '/facturacion/impuestos',
    {
      preHandler: requerirRol(contable),
      schema: { tags: ['facturacion'], summary: 'Crear impuesto (CU-FC-004)' },
    },
    async function (solicitud: any, respuesta: any) {
      const resultado = await crearImpuesto(solicitud.body || {});
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(solicitud, 'facturacion.crear_impuesto', 'impuestos', 'nuevo', 'ok');
      return respuesta.code(201).send({ data: resultado.datos });
    },
  );
  aplicacion.patch(
    '/facturacion/impuestos/:id/inactivar',
    {
      preHandler: requerirRol(contable),
      schema: { tags: ['facturacion'], summary: 'Inactivar impuesto (CU-FC-004)' },
    },
    async function (solicitud: any, respuesta: any) {
      const resultado = await inactivarImpuesto(Number(solicitud.params.id));
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      return { data: resultado.datos };
    },
  );

  // Facturas (CU-FC-001/003) y notas (CU-FC-002).
  aplicacion.get(
    '/facturacion/ordenes-por-facturar',
    {
      preHandler: requerirRol(contable),
      schema: { tags: ['facturacion'], summary: 'Ordenes B2B por facturar' },
    },
    async function () {
      return { data: await ordenesPorFacturar() };
    },
  );
  aplicacion.get(
    '/facturacion/facturas',
    {
      preHandler: requerirRol(contable),
      schema: { tags: ['facturacion'], summary: 'Listar facturas (CU-FC-001)' },
    },
    async function () {
      return { data: await listarFacturas() };
    },
  );
  aplicacion.get(
    '/facturacion/facturas/:id',
    {
      preHandler: requerirRol(contable),
      schema: { tags: ['facturacion'], summary: 'Consultar factura con notas (CU-FC-001)' },
    },
    async function (solicitud: any, respuesta: any) {
      const factura = await obtenerFactura(Number(solicitud.params.id));
      if (!factura) return respuesta.code(404).send({ error: 'factura_no_encontrada' });
      return { data: factura };
    },
  );
  aplicacion.post(
    '/facturacion/facturas',
    {
      preHandler: requerirRol(contable),
      schema: { tags: ['facturacion'], summary: 'Emitir factura (CU-FC-001)' },
    },
    async function (solicitud: any, respuesta: any) {
      const resultado = await emitirFactura(solicitud.body || {});
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'facturacion.emitir_factura',
        'facturas',
        String((resultado.datos as any).numero),
        'ok',
      );
      return respuesta.code(201).send({ data: resultado.datos });
    },
  );
  aplicacion.patch(
    '/facturacion/facturas/:id/dian',
    {
      preHandler: requerirRol(contable),
      schema: {
        tags: ['facturacion'],
        summary: 'Emitir factura electronica DIAN simulada (CU-FC-001)',
      },
    },
    async function (solicitud: any, respuesta: any) {
      const resultado = await emitirFacturaDian(Number(solicitud.params.id));
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'facturacion.emitir_dian',
        'facturas',
        solicitud.params.id,
        'ok',
      );
      return { data: resultado.datos };
    },
  );
  aplicacion.patch(
    '/facturacion/facturas/:id/pagar',
    {
      preHandler: requerirRol(contable),
      schema: { tags: ['facturacion'], summary: 'Marcar factura pagada (CU-FC-003)' },
    },
    async function (solicitud: any, respuesta: any) {
      const resultado = await pagarFactura(Number(solicitud.params.id));
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      return { data: resultado.datos };
    },
  );
  aplicacion.patch(
    '/facturacion/facturas/:id/anular',
    {
      preHandler: requerirRol(contable),
      schema: { tags: ['facturacion'], summary: 'Anular factura (CU-FC-003)' },
    },
    async function (solicitud: any, respuesta: any) {
      const resultado = await anularFactura(Number(solicitud.params.id));
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      return { data: resultado.datos };
    },
  );
  aplicacion.post(
    '/facturacion/notas',
    {
      preHandler: requerirRol(contable),
      schema: { tags: ['facturacion'], summary: 'Crear nota credito/debito (CU-FC-002)' },
    },
    async function (solicitud: any, respuesta: any) {
      const resultado = await crearNotaFactura(solicitud.body || {});
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      return respuesta.code(201).send({ data: resultado.datos });
    },
  );
  aplicacion.get(
    '/facturacion/facturas/:id/notas',
    {
      preHandler: requerirRol(contable),
      schema: { tags: ['facturacion'], summary: 'Listar notas de una factura (CU-FC-002)' },
    },
    async function (solicitud: any) {
      return { data: await listarNotas(Number(solicitud.params.id)) };
    },
  );

  // Contabilidad: PUC y asientos (CU-CT-001).
  aplicacion.get(
    '/contabilidad/cuentas',
    {
      preHandler: requerirRol(contable),
      schema: { tags: ['contabilidad'], summary: 'Listar cuentas contables (CU-CT-001)' },
    },
    async function () {
      return { data: await listarCuentas() };
    },
  );
  aplicacion.post(
    '/contabilidad/cuentas',
    {
      preHandler: requerirRol(contable),
      schema: { tags: ['contabilidad'], summary: 'Crear cuenta contable (CU-CT-001)' },
    },
    async function (solicitud: any, respuesta: any) {
      const resultado = await crearCuenta(solicitud.body || {});
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'contabilidad.crear_cuenta',
        'cuentas_contables',
        'nueva',
        'ok',
      );
      return respuesta.code(201).send({ data: resultado.datos });
    },
  );
  aplicacion.patch(
    '/contabilidad/cuentas/:id/inactivar',
    {
      preHandler: requerirRol(contable),
      schema: { tags: ['contabilidad'], summary: 'Inactivar cuenta contable (CU-CT-001)' },
    },
    async function (solicitud: any, respuesta: any) {
      const resultado = await inactivarCuenta(Number(solicitud.params.id));
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      return { data: resultado.datos };
    },
  );
  aplicacion.get(
    '/contabilidad/asientos',
    {
      preHandler: requerirRol(contable),
      schema: { tags: ['contabilidad'], summary: 'Listar asientos contables' },
    },
    async function () {
      return { data: await listarAsientos() };
    },
  );
  aplicacion.post(
    '/contabilidad/asientos',
    {
      preHandler: requerirRol(contable),
      schema: { tags: ['contabilidad'], summary: 'Crear asiento contable cuadrado' },
    },
    async function (solicitud: any, respuesta: any) {
      const resultado = await crearAsiento(solicitud.body || {});
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'contabilidad.crear_asiento',
        'asientos_contables',
        String((resultado.datos as any).referencia),
        'ok',
      );
      return respuesta.code(201).send({ data: resultado.datos });
    },
  );
}
