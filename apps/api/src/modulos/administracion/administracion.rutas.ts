// Consola administrativa (RBAC/ABAC + Default Deny, BL-019, CU-SEC-001..015).
// Cada ruta declara explicitamente los roles permitidos; cualquier otro rol recibe 403.
import type { FastifyInstance } from 'fastify';
import { desc } from 'drizzle-orm';
import { base } from '../../bd/base';
import { auditoriaRegistros, clientes, pedidos } from '../../bd/esquema';
import { ROL_ADMIN, ROL_AUDITOR, ROL_GERENTE_ZONA } from '../../dominio/constantes';
import { registrarAuditoria } from './auditoria';

export async function rutasAdministracion(aplicacion: FastifyInstance): Promise<void> {
  const requerirRol = (aplicacion as any).requerirRol as (roles: string[]) => any;

  aplicacion.get(
    '/administracion/clientes',
    {
      preHandler: requerirRol([ROL_ADMIN]),
      schema: { tags: ['administracion'], summary: 'Listar clientes (ADMIN)' },
    },
    async function (solicitud) {
      await registrarAuditoria(
        solicitud,
        'administracion.clientes.listar',
        'clientes',
        'todos',
        'ok',
      );
      const filas = await base
        .select({
          id: clientes.id,
          correo: clientes.correo,
          nombre: clientes.nombre,
          estado: clientes.estado,
        })
        .from(clientes);
      return { data: filas };
    },
  );

  aplicacion.get(
    '/administracion/pedidos',
    {
      preHandler: requerirRol([ROL_ADMIN, ROL_GERENTE_ZONA]),
      schema: { tags: ['administracion'], summary: 'Listar pedidos (ADMIN / GERENTE_ZONA)' },
    },
    async function (solicitud) {
      await registrarAuditoria(
        solicitud,
        'administracion.pedidos.listar',
        'pedidos',
        'todos',
        'ok',
      );
      const filas = await base
        .select({
          id: pedidos.id,
          referenciaPedido: pedidos.referenciaPedido,
          clienteId: pedidos.clienteId,
          estado: pedidos.estado,
          totalCentavos: pedidos.totalCentavos,
          creadoEn: pedidos.creadoEn,
        })
        .from(pedidos)
        .orderBy(desc(pedidos.id));
      return { data: filas };
    },
  );

  aplicacion.get(
    '/administracion/auditoria',
    {
      preHandler: requerirRol([ROL_ADMIN, ROL_AUDITOR]),
      schema: {
        tags: ['administracion'],
        summary: 'Consultar auditoria de operaciones (ADMIN / AUDITOR)',
      },
    },
    async function (solicitud) {
      await registrarAuditoria(
        solicitud,
        'administracion.auditoria.listar',
        'auditoria_registros',
        'todos',
        'ok',
      );
      const filas = await base
        .select()
        .from(auditoriaRegistros)
        .orderBy(desc(auditoriaRegistros.id))
        .limit(200);
      return { data: filas };
    },
  );
}
