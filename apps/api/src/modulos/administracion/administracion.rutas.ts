// Consola administrativa (RBAC/ABAC + Default Deny, BL-019, CU-SEC-001..015).
// Cada ruta declara explicitamente los roles permitidos; cualquier otro rol recibe 403.
import type { FastifyInstance } from 'fastify';
import { asc, desc, eq } from 'drizzle-orm';
import { base } from '../../bd/base';
import { auditoriaRegistros, clientes, pedidos, usuarios } from '../../bd/esquema';
import {
  ESTADO_ACTIVO,
  ESTADO_INACTIVO,
  ROL_ADMIN,
  ROL_AUDITOR,
  ROL_GERENTE_ZONA,
  ROLES_ERP_GESTIONABLES,
} from '../../dominio/constantes';
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

  // Usuarios internos y perfiles (RBAC, CU-SEC-001..007). Solo administracion.
  aplicacion.get(
    '/administracion/usuarios',
    {
      preHandler: requerirRol([ROL_ADMIN]),
      schema: { tags: ['administracion'], summary: 'Listar usuarios internos y perfiles (ADMIN)' },
    },
    async function (solicitud) {
      await registrarAuditoria(
        solicitud,
        'administracion.usuarios.listar',
        'usuarios',
        'todos',
        'ok',
      );
      const filas = await base
        .select({
          id: usuarios.id,
          correo: usuarios.correo,
          rol: usuarios.rol,
          zonaId: usuarios.zonaId,
          emprendedorId: usuarios.emprendedorId,
          estado: usuarios.estado,
          creadoEn: usuarios.creadoEn,
        })
        .from(usuarios)
        .orderBy(asc(usuarios.correo));
      return { data: filas };
    },
  );

  // Gestion de perfiles: activar/inactivar usuario (solo ADMIN; nunca a si mismo).
  aplicacion.patch<{ Params: { id: string }; Body: { estado: string } }>(
    '/administracion/usuarios/:id/estado',
    {
      preHandler: requerirRol([ROL_ADMIN]),
      schema: { tags: ['administracion'], summary: 'Activar/inactivar usuario interno (ADMIN)' },
    },
    async function (solicitud, respuesta) {
      const id = Number(solicitud.params.id);
      const estado = String((solicitud.body || {}).estado || '');
      if (estado !== ESTADO_ACTIVO && estado !== ESTADO_INACTIVO)
        return respuesta.code(400).send({ error: 'estado_invalido' });
      const filas = await base.select().from(usuarios).where(eq(usuarios.id, id)).limit(1);
      if (!filas[0]) return respuesta.code(404).send({ error: 'usuario_no_encontrado' });
      const actor = (solicitud as any).usuario as { sub?: string } | undefined;
      if (actor && String(actor.sub) === String(id))
        return respuesta.code(409).send({ error: 'no_puede_modificarse_a_si_mismo' });
      await base
        .update(usuarios)
        .set({ estado: estado, actualizadoEn: new Date() })
        .where(eq(usuarios.id, id));
      await registrarAuditoria(
        solicitud,
        'administracion.usuarios.estado',
        'usuarios',
        String(id),
        'ok',
      );
      return { data: { id: id, estado: estado } };
    },
  );

  // Gestion de perfiles: cambiar rol (y zona si el rol es Gerente de Zona).
  aplicacion.patch<{ Params: { id: string }; Body: { rol?: string; zonaId?: string } }>(
    '/administracion/usuarios/:id/perfil',
    {
      preHandler: requerirRol([ROL_ADMIN]),
      schema: {
        tags: ['administracion'],
        summary: 'Cambiar rol/perfil de usuario interno (ADMIN)',
      },
    },
    async function (solicitud, respuesta) {
      const id = Number(solicitud.params.id);
      const rolNuevo = String((solicitud.body || {}).rol || '');
      const zonaId =
        (solicitud.body || {}).zonaId !== undefined
          ? String((solicitud.body as any).zonaId).trim()
          : undefined;
      if (!ROLES_ERP_GESTIONABLES.includes(rolNuevo as any))
        return respuesta.code(400).send({ error: 'rol_no_gestionable' });
      const filas = await base.select().from(usuarios).where(eq(usuarios.id, id)).limit(1);
      if (!filas[0]) return respuesta.code(404).send({ error: 'usuario_no_encontrado' });
      const actor = (solicitud as any).usuario as { sub?: string } | undefined;
      if (actor && String(actor.sub) === String(id))
        return respuesta.code(409).send({ error: 'no_puede_modificarse_a_si_mismo' });
      // La zona solo aplica al Gerente de Zona; para otros roles se limpia.
      const zonaFinal = rolNuevo === ROL_GERENTE_ZONA ? zonaId || null : null;
      await base
        .update(usuarios)
        .set({ rol: rolNuevo, zonaId: zonaFinal, actualizadoEn: new Date() })
        .where(eq(usuarios.id, id));
      await registrarAuditoria(
        solicitud,
        'administracion.usuarios.perfil',
        'usuarios',
        String(id),
        'ok',
      );
      return { data: { id: id, rol: rolNuevo, zonaId: zonaFinal } };
    },
  );
}
