// Rutas del modulo Inventario ERP (F5): movimientos, bodegas, stock y kardex (CU-INV-001..008).
// RBAC: almacenista/contador/admin segun operacion; toda mutacion queda auditada.
import type { FastifyInstance } from 'fastify';
import {
  ROL_ADMIN,
  ROL_ALMACENISTA,
  ROL_COMPRAS,
  ROL_CONTADOR,
  ROL_AUDITOR,
} from '../../dominio/constantes';
import { registrarAuditoria } from '../administracion/auditoria';
import {
  actualizarStockMinimo,
  consultarKardex,
  consultarStock,
  crearBodega,
  inactivarBodega,
  listarBodegas,
  registrarAjuste,
  registrarEntrada,
  registrarSalida,
} from './inventario.servicio';

type CuerpoMovimiento = {
  bodegaId: number;
  productoId: number;
  cantidad: number;
  motivo: string;
  referencia?: string;
};

type CuerpoBodega = { nombre: string; ubicacion?: string };

function rolDe(solicitud: any): { id?: string; rol?: string } {
  const usuario = solicitud.usuario;
  return {
    id: usuario ? String(usuario.sub || '') : undefined,
    rol: usuario ? usuario.rol : undefined,
  };
}

export async function rutasInventario(aplicacion: FastifyInstance): Promise<void> {
  const requerirRol = (aplicacion as any).requerirRol as (roles: string[]) => any;
  const almacen = [ROL_ALMACENISTA, ROL_ADMIN];
  const contable = [ROL_CONTADOR, ROL_ADMIN];
  const consulta = [ROL_ALMACENISTA, ROL_CONTADOR, ROL_COMPRAS, ROL_AUDITOR, ROL_ADMIN];

  // Entrada de inventario (CU-INV-001).
  aplicacion.post<{ Body: CuerpoMovimiento }>(
    '/inventario/movimientos/entrada',
    {
      preHandler: requerirRol(almacen),
      schema: { tags: ['inventario'], summary: 'Registrar entrada de inventario (CU-INV-001)' },
    },
    async function (solicitud, respuesta) {
      const resultado = await registrarEntrada(
        solicitud.body || ({} as CuerpoMovimiento),
        rolDe(solicitud),
      );
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'inventario.entrada',
        'movimientos_inventario',
        String((resultado.datos as any).consecutivo || 'nuevo'),
        'ok',
      );
      return respuesta.code(201).send({ data: resultado.datos });
    },
  );

  // Salida de inventario (CU-INV-002).
  aplicacion.post<{ Body: CuerpoMovimiento }>(
    '/inventario/movimientos/salida',
    {
      preHandler: requerirRol(almacen),
      schema: { tags: ['inventario'], summary: 'Registrar salida de inventario (CU-INV-002)' },
    },
    async function (solicitud, respuesta) {
      const resultado = await registrarSalida(
        solicitud.body || ({} as CuerpoMovimiento),
        rolDe(solicitud),
      );
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'inventario.salida',
        'movimientos_inventario',
        String((resultado.datos as any).consecutivo || 'nuevo'),
        'ok',
      );
      return respuesta.code(201).send({ data: resultado.datos });
    },
  );

  // Ajuste de inventario con cantidad real contada (CU-INV-003).
  aplicacion.post<{ Body: CuerpoMovimiento & { cantidadReal: number } }>(
    '/inventario/movimientos/ajuste',
    {
      preHandler: requerirRol(contable),
      schema: { tags: ['inventario'], summary: 'Registrar ajuste de inventario (CU-INV-003)' },
    },
    async function (solicitud, respuesta) {
      const resultado = await registrarAjuste(solicitud.body || ({} as any), rolDe(solicitud));
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      const datos = resultado.datos as any;
      if (!datos || datos.sinCambio) return { data: resultado.datos };
      await registrarAuditoria(
        solicitud,
        'inventario.ajuste',
        'movimientos_inventario',
        String(datos.consecutivo || 'nuevo'),
        'ok',
      );
      return respuesta.code(201).send({ data: resultado.datos });
    },
  );

  // Bodegas (CU-INV-005).
  aplicacion.get(
    '/inventario/bodegas',
    {
      preHandler: requerirRol(consulta),
      schema: { tags: ['inventario'], summary: 'Listar bodegas (CU-INV-005)' },
    },
    async function () {
      return { data: await listarBodegas() };
    },
  );

  aplicacion.post<{ Body: CuerpoBodega }>(
    '/inventario/bodegas',
    {
      preHandler: requerirRol(contable),
      schema: { tags: ['inventario'], summary: 'Crear bodega (CU-INV-005)' },
    },
    async function (solicitud, respuesta) {
      const resultado = await crearBodega(solicitud.body || ({} as CuerpoBodega));
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(solicitud, 'inventario.crear_bodega', 'bodegas', 'nuevo', 'ok');
      return { data: resultado.datos };
    },
  );

  aplicacion.patch<{ Params: { id: string } }>(
    '/inventario/bodegas/:id/inactivar',
    {
      preHandler: requerirRol(contable),
      schema: { tags: ['inventario'], summary: 'Inactivar bodega (CU-INV-005)' },
    },
    async function (solicitud, respuesta) {
      const resultado = await inactivarBodega(Number(solicitud.params.id));
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'inventario.inactivar_bodega',
        'bodegas',
        solicitud.params.id,
        'ok',
      );
      return { data: resultado.datos };
    },
  );

  // Stock disponible y minimo (CU-INV-007/008).
  aplicacion.get(
    '/inventario/stock',
    {
      preHandler: requerirRol(consulta),
      schema: { tags: ['inventario'], summary: 'Consultar existencias por bodega (CU-INV-008)' },
    },
    async function () {
      return { data: await consultarStock() };
    },
  );

  aplicacion.patch<{ Body: { bodegaId: number; productoId: number; stockMinimo: number } }>(
    '/inventario/stock/minimo',
    {
      preHandler: requerirRol([ROL_COMPRAS, ROL_ALMACENISTA, ROL_ADMIN]),
      schema: { tags: ['inventario'], summary: 'Configurar stock minimo (CU-INV-007)' },
    },
    async function (solicitud, respuesta) {
      const cuerpo = solicitud.body || ({} as any);
      const resultado = await actualizarStockMinimo(
        Number(cuerpo.bodegaId),
        Number(cuerpo.productoId),
        Number(cuerpo.stockMinimo),
      );
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      const datosMinimo = resultado.datos as { id?: number } | undefined;
      await registrarAuditoria(
        solicitud,
        'inventario.stock_minimo',
        'inventario_stock',
        String((datosMinimo && datosMinimo.id) || 'nuevo'),
        'ok',
      );
      return { data: resultado.datos };
    },
  );

  // Kardex (CU-INV-006).
  aplicacion.get<{ Querystring: { productoId?: string; bodegaId?: string; limite?: string } }>(
    '/inventario/kardex',
    {
      preHandler: requerirRol(consulta),
      schema: { tags: ['inventario'], summary: 'Consultar kardex (CU-INV-006)' },
    },
    async function (solicitud) {
      const datos = await consultarKardex({
        productoId: solicitud.query.productoId ? Number(solicitud.query.productoId) : undefined,
        bodegaId: solicitud.query.bodegaId ? Number(solicitud.query.bodegaId) : undefined,
        limite: solicitud.query.limite ? Number(solicitud.query.limite) : undefined,
      });
      return { data: datos };
    },
  );
}
