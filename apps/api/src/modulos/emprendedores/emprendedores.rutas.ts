// Rutas de emprendedores (CU-EM-001..004, 007/010..012). RBAC: roles explicitos.
import type { FastifyInstance } from 'fastify';
import { ROL_ADMIN, ROL_EMPRENDEDOR, ROL_GERENTE_ZONA } from '../../dominio/constantes';
import { registrarAuditoria } from '../administracion/auditoria';
import {
  activarEmprendedor,
  avalarProducto,
  cambiarEstadoOferta,
  configurarLogisticaEmprendedor,
  configurarMediosEmprendedor,
  crearOferta,
  crearProductoEmprendedor,
  enrolarEmprendedor,
  listarEmprendedores,
  listarOfertasEmprendedor,
  listarProductosEmprendedor,
  marcarDocumentosCompletos,
  obtenerEmprendedor,
  reportesEmprendedor,
  suspenderEmprendedor,
  validarMultimediaProducto,
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

// Validacion de alcance por zona (ABAC, EM-020): un Gerente de Zona no puede
// actuar sobre emprendedores fuera de su zona. Devuelve true si tiene permiso.
async function esDeZonaDelUsuario(
  usuario: any,
  emprendedorZonaId: string | null,
): Promise<boolean> {
  if (usuario.rol === ROL_ADMIN) return true;
  if (usuario.rol !== ROL_GERENTE_ZONA) return false;
  return usuario.zonaId ? String(usuario.zonaId) === String(emprendedorZonaId || '') : false;
}

async function validarAlcance(
  solicitud: any,
  respuesta: any,
  emprendedorId: number,
): Promise<{ ok: boolean; zonaId?: string } | undefined> {
  const filas = await obtenerEmprendedor(emprendedorId);
  if (!filas[0]) {
    respuesta.code(404).send({ error: 'emprendedor_no_encontrado' });
    return { ok: false };
  }
  const usuario = (solicitud as any).usuario || {};
  if (!(await esDeZonaDelUsuario(usuario, filas[0].zonaId))) {
    respuesta.code(403).send({ error: 'prohibido' });
    return { ok: false };
  }
  return { ok: true };
}

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
    async function (solicitud) {
      // ABAC (EM-020): el Gerente de Zona solo ve emprendedores de su zona.
      const usuario = (solicitud as any).usuario || {};
      const zonaId =
        usuario.rol === ROL_GERENTE_ZONA && usuario.zonaId ? String(usuario.zonaId) : undefined;
      return { data: await listarEmprendedores(zonaId) };
    },
  );

  aplicacion.patch<{ Params: { id: string } }>(
    '/emprendedores/:id/activar',
    {
      preHandler: requerirRol([ROL_GERENTE_ZONA, ROL_ADMIN]),
      schema: { tags: ['emprendedores'], summary: 'Validar y activar emprendedor (CU-EM-004)' },
    },
    async function (solicitud, respuesta) {
      const alcance = await validarAlcance(solicitud, respuesta, Number(solicitud.params.id));
      if (!alcance || !alcance.ok) return;
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

  aplicacion.patch<{
    Params: { id: string };
    Body: { medioEnvio?: string; medioPagoElectronico?: string };
  }>(
    '/emprendedores/:id/medios',
    {
      preHandler: autenticar,
      schema: {
        tags: ['emprendedores'],
        summary: 'Configurar medios de envio y pago (CU-EM-005/006)',
      },
    },
    async function (solicitud, respuesta) {
      const usuario = (solicitud as any).usuario || {};
      const esPropietario = Number(usuario.emprendedorId) === Number(solicitud.params.id);
      const esGestor = usuario.rol === ROL_GERENTE_ZONA || usuario.rol === ROL_ADMIN;
      if (!esPropietario && !esGestor) return respuesta.code(403).send({ error: 'prohibido' });
      const resultado = await configurarMediosEmprendedor(
        Number(solicitud.params.id),
        solicitud.body || {},
      );
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      return { data: resultado.datos };
    },
  );

  aplicacion.post<{
    Body: { nombre: string; descuentoBps: number; iniciaEn: string; finalizaEn: string };
  }>(
    '/emprendedores/ofertas',
    {
      preHandler: autenticar,
      schema: { tags: ['emprendedores'], summary: 'Crear oferta (CU-EM-013)' },
    },
    async function (solicitud, respuesta) {
      const emprendedorId = Number((solicitud as any).usuario?.emprendedorId || 0);
      if (!(emprendedorId > 0))
        return respuesta.code(403).send({ error: 'sin_emprendedor_vinculado' });
      const resultado = await crearOferta(emprendedorId, solicitud.body || ({} as any));
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      return { data: resultado.datos };
    },
  );

  aplicacion.get(
    '/emprendedores/ofertas',
    {
      preHandler: autenticar,
      schema: { tags: ['emprendedores'], summary: 'Listar ofertas propias (CU-EM-013)' },
    },
    async function (solicitud, respuesta) {
      const emprendedorId = Number((solicitud as any).usuario?.emprendedorId || 0);
      if (!(emprendedorId > 0))
        return respuesta.code(403).send({ error: 'sin_emprendedor_vinculado' });
      return { data: await listarOfertasEmprendedor(emprendedorId) };
    },
  );

  aplicacion.patch<{ Params: { id: string }; Body: { estado: string } }>(
    '/emprendedores/ofertas/:id/estado',
    {
      preHandler: autenticar,
      schema: { tags: ['emprendedores'], summary: 'Activar o inactivar oferta (CU-EM-013)' },
    },
    async function (solicitud, respuesta) {
      const emprendedorId = Number((solicitud as any).usuario?.emprendedorId || 0);
      if (!(emprendedorId > 0))
        return respuesta.code(403).send({ error: 'sin_emprendedor_vinculado' });
      const resultado = await cambiarEstadoOferta(
        Number(solicitud.params.id),
        emprendedorId,
        String(solicitud.body?.estado || ''),
      );
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      return { data: resultado.datos };
    },
  );

  aplicacion.get(
    '/emprendedores/reportes',
    {
      preHandler: autenticar,
      schema: { tags: ['emprendedores'], summary: 'Reportes de ventas propias (CU-EM-014)' },
    },
    async function (solicitud, respuesta) {
      const emprendedorId = Number((solicitud as any).usuario?.emprendedorId || 0);
      if (!(emprendedorId > 0))
        return respuesta.code(403).send({ error: 'sin_emprendedor_vinculado' });
      return { data: await reportesEmprendedor(emprendedorId) };
    },
  );

  aplicacion.patch<{ Params: { id: string } }>(
    '/emprendedores/:id/suspender',
    {
      preHandler: requerirRol([ROL_GERENTE_ZONA, ROL_ADMIN]),
      schema: { tags: ['emprendedores'], summary: 'Suspender emprendedor (CU-EM-002)' },
    },
    async function (solicitud, respuesta) {
      const alcance = await validarAlcance(solicitud, respuesta, Number(solicitud.params.id));
      if (!alcance || !alcance.ok) return;
      const resultado = await suspenderEmprendedor(Number(solicitud.params.id));
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'emprendedores.suspender',
        'emprendedores',
        solicitud.params.id,
        'ok',
      );
      return { data: resultado.datos };
    },
  );

  aplicacion.patch<{ Params: { id: string }; Body: { proveedorLogistico: string } }>(
    '/emprendedores/:id/logistica',
    {
      preHandler: autenticar,
      schema: { tags: ['emprendedores'], summary: 'Configurar servicio logistico (CU-EM-019)' },
    },
    async function (solicitud, respuesta) {
      const usuario = (solicitud as any).usuario || {};
      const esPropietario = Number(usuario.emprendedorId) === Number(solicitud.params.id);
      const esGestor = usuario.rol === ROL_GERENTE_ZONA || usuario.rol === ROL_ADMIN;
      if (!esPropietario && !esGestor) return respuesta.code(403).send({ error: 'prohibido' });
      const resultado = await configurarLogisticaEmprendedor(
        Number(solicitud.params.id),
        String(solicitud.body?.proveedorLogistico || ''),
      );
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      return { data: resultado.datos };
    },
  );

  aplicacion.patch<{ Params: { id: string } }>(
    '/emprendedores/:id/documentos',
    {
      preHandler: requerirRol([ROL_GERENTE_ZONA, ROL_ADMIN]),
      schema: {
        tags: ['emprendedores'],
        summary: 'Marcar paquete documental completo (CU-EM-003)',
      },
    },
    async function (solicitud, respuesta) {
      const alcance = await validarAlcance(solicitud, respuesta, Number(solicitud.params.id));
      if (!alcance || !alcance.ok) return;
      const resultado = await marcarDocumentosCompletos(Number(solicitud.params.id));
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'emprendedores.documentos_completos',
        'emprendedores',
        solicitud.params.id,
        'ok',
      );
      return { data: resultado.datos };
    },
  );

  aplicacion.post<{ Params: { id: string } }>(
    '/emprendedores/productos/:id/multimedia-validar',
    {
      preHandler: requerirRol([ROL_GERENTE_ZONA, ROL_ADMIN]),
      schema: {
        tags: ['emprendedores'],
        summary: 'Validar requisitos multimedia del producto (CU-EM-009)',
      },
    },
    async function (solicitud, respuesta) {
      const resultado = await validarMultimediaProducto(Number(solicitud.params.id));
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'emprendedores.validar_multimedia',
        'productos',
        solicitud.params.id,
        'ok',
      );
      return { data: resultado.datos };
    },
  );
}
