// Rutas de emprendedores (CU-EM-001..004, 007/010..012). RBAC: roles explicitos.
import type { FastifyInstance } from 'fastify';
import { ROL_ADMIN, ROL_EMPRENDEDOR, ROL_GERENTE_ZONA } from '../../dominio/constantes';
import { registrarAuditoria } from '../administracion/auditoria';
import {
  activarEmprendedor,
  avalarProducto,
  crearProductoEmprendedor,
  enrolarEmprendedor,
  listarEmprendedores,
  listarProductosEmprendedor,
} from './emprendedores.servicio';

type CuerpoEnrolamiento = {
  documentoIdentidad: string;
  nombre: string;
  correo: string;
  telefono?: string;
  zonaId?: string;
};
type CuerpoProducto = {
  nombre: string;
  slug: string;
  descripcion?: string;
  precioCentavos: number;
  stock: number;
};
type CuerpoAval = { decision: 'aprobar' | 'rechazar' };

export async function rutasEmprendedores(aplicacion: FastifyInstance): Promise<void> {
  const requerirRol = (aplicacion as any).requerirRol as (roles: string[]) => any;
  const autenticar = (aplicacion as any).autenticar;

  aplicacion.post<{ Body: CuerpoEnrolamiento }>(
    '/emprendedores',
    {
      preHandler: requerirRol([ROL_GERENTE_ZONA, ROL_ADMIN]),
      schema: { tags: ['emprendedores'], summary: 'Enrolar emprendedor (CU-EM-001)' },
    },
    async function (solicitud, respuesta) {
      const resultado = await enrolarEmprendedor(
        String((solicitud as any).usuario?.sub || 'sistema'),
        solicitud.body || {},
      );
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(solicitud, 'emprendedores.enrolar', 'emprendedores', 'nuevo', 'ok');
      return { data: resultado.datos };
    },
  );

  aplicacion.get(
    '/emprendedores',
    {
      preHandler: requerirRol([ROL_GERENTE_ZONA, ROL_ADMIN]),
      schema: { tags: ['emprendedores'], summary: 'Listar emprendedores (CU-EM-002)' },
    },
    async function () {
      return { data: await listarEmprendedores() };
    },
  );

  aplicacion.patch<{ Params: { id: string } }>(
    '/emprendedores/:id/activar',
    {
      preHandler: requerirRol([ROL_GERENTE_ZONA, ROL_ADMIN]),
      schema: { tags: ['emprendedores'], summary: 'Validar y activar emprendedor (CU-EM-004)' },
    },
    async function (solicitud, respuesta) {
      const resultado = await activarEmprendedor(Number(solicitud.params.id));
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'emprendedores.activar',
        'emprendedores',
        solicitud.params.id,
        'ok',
      );
      return { data: resultado.datos };
    },
  );

  aplicacion.post<{ Body: CuerpoProducto }>(
    '/emprendedores/productos',
    {
      preHandler: autenticar,
      schema: { tags: ['emprendedores'], summary: 'Crear producto del emprendedor (CU-EM-007)' },
    },
    async function (solicitud, respuesta) {
      const usuario = (solicitud as any).usuario || {};
      const rol = usuario.rol;
      if (rol !== ROL_EMPRENDEDOR && rol !== ROL_GERENTE_ZONA && rol !== ROL_ADMIN)
        return respuesta.code(403).send({ error: 'prohibido' });
      const emprendedorId = Number(usuario.emprendedorId || 0);
      if (!(emprendedorId > 0))
        return respuesta.code(403).send({ error: 'sin_emprendedor_vinculado' });
      const resultado = await crearProductoEmprendedor(emprendedorId, solicitud.body || {});
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      return { data: resultado.datos };
    },
  );

  aplicacion.get(
    '/emprendedores/productos',
    {
      preHandler: autenticar,
      schema: { tags: ['emprendedores'], summary: 'Listar productos propios (CU-EM-008)' },
    },
    async function (solicitud, respuesta) {
      const emprendedorId = Number((solicitud as any).usuario?.emprendedorId || 0);
      if (!(emprendedorId > 0))
        return respuesta.code(403).send({ error: 'sin_emprendedor_vinculado' });
      return { data: await listarProductosEmprendedor(emprendedorId) };
    },
  );

  aplicacion.post<{ Params: { id: string }; Body: CuerpoAval }>(
    '/emprendedores/productos/:id/aval',
    {
      preHandler: requerirRol([ROL_GERENTE_ZONA, ROL_ADMIN]),
      schema: { tags: ['emprendedores'], summary: 'Avalar o rechazar producto (CU-EM-011)' },
    },
    async function (solicitud, respuesta) {
      const resultado = await avalarProducto(
        Number(solicitud.params.id),
        solicitud.body?.decision || 'rechazar',
      );
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'emprendedores.avalar_producto',
        'productos',
        solicitud.params.id,
        'ok',
      );
      return { data: resultado.datos };
    },
  );
}
