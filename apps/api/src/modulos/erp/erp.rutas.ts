// Rutas ERP (F5): proveedores (CU-ERP-001). Roles: COMPRAS / ADMIN.
import type { FastifyInstance } from 'fastify';
import { ROL_ADMIN, ROL_COMPRAS } from '../../dominio/constantes';
import { registrarAuditoria } from '../administracion/auditoria';
import {
  actualizarProveedor,
  crearProveedor,
  inactivarProveedor,
  listarProveedores,
} from './proveedores.servicio';

type CuerpoProveedor = {
  nit: string;
  nombre: string;
  contacto?: string;
  telefono?: string;
  correo?: string;
  direccion?: string;
  sitioWeb?: string;
};

type CambiosProveedor = {
  contacto?: string;
  telefono?: string;
  correo?: string;
  direccion?: string;
  sitioWeb?: string;
};

export async function rutasErp(aplicacion: FastifyInstance): Promise<void> {
  const requerirRol = (aplicacion as any).requerirRol as (roles: string[]) => any;
  const gestores = [ROL_COMPRAS, ROL_ADMIN];

  aplicacion.get(
    '/erp/proveedores',
    {
      preHandler: requerirRol(gestores),
      schema: { tags: ['erp'], summary: 'Listar proveedores (CU-ERP-001)' },
    },
    async function () {
      return { data: await listarProveedores() };
    },
  );

  aplicacion.post<{ Body: CuerpoProveedor }>(
    '/erp/proveedores',
    {
      preHandler: requerirRol(gestores),
      schema: { tags: ['erp'], summary: 'Crear proveedor (CU-ERP-001)' },
    },
    async function (solicitud, respuesta) {
      const resultado = await crearProveedor(solicitud.body || {});
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(solicitud, 'erp.crear_proveedor', 'proveedores', 'nuevo', 'ok');
      return { data: resultado.datos };
    },
  );

  aplicacion.patch<{ Params: { id: string }; Body: CambiosProveedor }>(
    '/erp/proveedores/:id',
    {
      preHandler: requerirRol(gestores),
      schema: { tags: ['erp'], summary: 'Actualizar proveedor (CU-ERP-001)' },
    },
    async function (solicitud, respuesta) {
      const resultado = await actualizarProveedor(
        Number(solicitud.params.id),
        solicitud.body || {},
      );
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      return { data: resultado.datos };
    },
  );

  aplicacion.patch<{ Params: { id: string } }>(
    '/erp/proveedores/:id/inactivar',
    {
      preHandler: requerirRol(gestores),
      schema: { tags: ['erp'], summary: 'Inactivar proveedor (CU-ERP-001)' },
    },
    async function (solicitud, respuesta) {
      const resultado = await inactivarProveedor(Number(solicitud.params.id));
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'erp.inactivar_proveedor',
        'proveedores',
        solicitud.params.id,
        'ok',
      );
      return { data: resultado.datos };
    },
  );
}
