// Rutas de RRHH / Nomina (CU-RH-001/002/005/007, F5).
import type { FastifyInstance } from 'fastify';
import { ROL_ADMIN, ROL_RRHH } from '../../dominio/constantes';
import { registrarAuditoria } from '../administracion/auditoria';
import {
  crearCargo,
  crearEmpleado,
  generarNomina,
  inactivarCargo,
  inactivarEmpleado,
  justificarAusencia,
  listarAusencias,
  listarCargos,
  listarEmpleados,
  listarNominas,
  pagarNomina,
  registrarAusencia,
} from './rrhh.servicio';

export async function rutasRrhh(aplicacion: FastifyInstance): Promise<void> {
  const requerirRol = (aplicacion as any).requerirRol as (roles: string[]) => any;
  const rrhh = [ROL_RRHH, ROL_ADMIN];

  aplicacion.get(
    '/rrhh/cargos',
    {
      preHandler: requerirRol(rrhh),
      schema: { tags: ['rrhh'], summary: 'Listar cargos (CU-RH-002)' },
    },
    async function () {
      return { data: await listarCargos() };
    },
  );
  aplicacion.post(
    '/rrhh/cargos',
    {
      preHandler: requerirRol(rrhh),
      schema: { tags: ['rrhh'], summary: 'Crear cargo (CU-RH-002)' },
    },
    async function (solicitud: any, respuesta: any) {
      const resultado = await crearCargo(solicitud.body || {});
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(solicitud, 'rrhh.crear_cargo', 'cargos', 'nuevo', 'ok');
      return respuesta.code(201).send({ data: resultado.datos });
    },
  );
  aplicacion.patch(
    '/rrhh/cargos/:id/inactivar',
    {
      preHandler: requerirRol(rrhh),
      schema: { tags: ['rrhh'], summary: 'Inactivar cargo (CU-RH-002)' },
    },
    async function (solicitud: any, respuesta: any) {
      const resultado = await inactivarCargo(Number(solicitud.params.id));
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      return { data: resultado.datos };
    },
  );

  aplicacion.get(
    '/rrhh/empleados',
    {
      preHandler: requerirRol(rrhh),
      schema: { tags: ['rrhh'], summary: 'Listar empleados (CU-RH-001)' },
    },
    async function () {
      return { data: await listarEmpleados() };
    },
  );
  aplicacion.post(
    '/rrhh/empleados',
    {
      preHandler: requerirRol(rrhh),
      schema: { tags: ['rrhh'], summary: 'Crear empleado (CU-RH-001)' },
    },
    async function (solicitud: any, respuesta: any) {
      const resultado = await crearEmpleado(solicitud.body || {});
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(solicitud, 'rrhh.crear_empleado', 'empleados', 'nuevo', 'ok');
      return respuesta.code(201).send({ data: resultado.datos });
    },
  );
  aplicacion.patch(
    '/rrhh/empleados/:id/inactivar',
    {
      preHandler: requerirRol(rrhh),
      schema: { tags: ['rrhh'], summary: 'Inactivar empleado (CU-RH-001)' },
    },
    async function (solicitud: any, respuesta: any) {
      const resultado = await inactivarEmpleado(Number(solicitud.params.id));
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      return { data: resultado.datos };
    },
  );

  aplicacion.post(
    '/rrhh/ausencias',
    {
      preHandler: requerirRol(rrhh),
      schema: { tags: ['rrhh'], summary: 'Registrar ausencia (CU-RH-005)' },
    },
    async function (solicitud: any, respuesta: any) {
      const resultado = await registrarAusencia(solicitud.body || {});
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(solicitud, 'rrhh.registrar_ausencia', 'ausencias', 'nuevo', 'ok');
      return respuesta.code(201).send({ data: resultado.datos });
    },
  );
  aplicacion.get(
    '/rrhh/ausencias',
    {
      preHandler: requerirRol(rrhh),
      schema: { tags: ['rrhh'], summary: 'Listar ausencias (CU-RH-005)' },
    },
    async function () {
      return { data: await listarAusencias() };
    },
  );
  aplicacion.patch(
    '/rrhh/ausencias/:id/justificar',
    {
      preHandler: requerirRol(rrhh),
      schema: { tags: ['rrhh'], summary: 'Justificar ausencia (CU-RH-005)' },
    },
    async function (solicitud: any, respuesta: any) {
      const resultado = await justificarAusencia(Number(solicitud.params.id));
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      return { data: resultado.datos };
    },
  );

  aplicacion.post(
    '/rrhh/nominas/generar',
    {
      preHandler: requerirRol(rrhh),
      schema: { tags: ['rrhh'], summary: 'Generar nomina del periodo (CU-RH-007)' },
    },
    async function (solicitud: any, respuesta: any) {
      const periodo = String((solicitud.body || {}).periodo || '');
      const resultado = await generarNomina(periodo);
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(solicitud, 'rrhh.generar_nomina', 'nominas', periodo, 'ok');
      return respuesta.code(201).send({ data: resultado.datos });
    },
  );
  aplicacion.get(
    '/rrhh/nominas',
    {
      preHandler: requerirRol(rrhh),
      schema: { tags: ['rrhh'], summary: 'Listar nominas (CU-RH-007)' },
    },
    async function (solicitud: any) {
      return {
        data: await listarNominas(
          solicitud.query && solicitud.query.periodo ? String(solicitud.query.periodo) : undefined,
        ),
      };
    },
  );
  aplicacion.patch(
    '/rrhh/nominas/:id/pagar',
    {
      preHandler: requerirRol(rrhh),
      schema: { tags: ['rrhh'], summary: 'Marcar nomina pagada (CU-RH-007)' },
    },
    async function (solicitud: any, respuesta: any) {
      const resultado = await pagarNomina(Number(solicitud.params.id));
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'rrhh.pagar_nomina',
        'nominas',
        solicitud.params.id,
        'ok',
      );
      return { data: resultado.datos };
    },
  );
}
