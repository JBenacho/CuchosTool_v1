// Rutas del carrito (CU-EC-007) y pago desde carrito (CU-EC-008). Requieren sesion de cliente.
import type { FastifyInstance } from 'fastify';
import { MONEDA_COP, PEDIDO_PENDIENTE_PAGO } from '../../dominio/constantes';
import { crearPedido } from '../pedidos/pedidos.servicio';
import {
  actualizarCantidad,
  agregarArticulo,
  articulosDelCarrito,
  quitarArticulo,
  vaciarCarrito,
  vistaCarrito,
} from './carrito.servicio';

// Devuelve el id del cliente autenticado desde el payload del JWT (establecido por el decorador autenticar).
function clienteAutenticado(solicitud: any): string {
  const usuario = solicitud && solicitud.usuario ? solicitud.usuario : null;
  return usuario && usuario.sub ? String(usuario.sub) : 'anonimo';
}

type CuerpoArticulo = { productoId: number; cantidad: number };

export async function rutasCarrito(aplicacion: FastifyInstance): Promise<void> {
  const autenticar = (aplicacion as any).autenticar;

  aplicacion.get(
    '/carrito',
    {
      preHandler: autenticar,
      schema: {
        tags: ['carrito'],
        summary: 'Consultar carrito',
        description: 'Contenido y total del carrito del cliente autenticado (CU-EC-007).',
      },
    },
    async function (solicitud) {
      return { data: await vistaCarrito(clienteAutenticado(solicitud)) };
    },
  );

  aplicacion.post<{ Body: CuerpoArticulo }>(
    '/carrito/articulos',
    {
      preHandler: autenticar,
      schema: {
        tags: ['carrito'],
        summary: 'Agregar producto al carrito',
        body: {
          type: 'object',
          required: ['productoId', 'cantidad'],
          properties: { productoId: { type: 'integer' }, cantidad: { type: 'integer' } },
        },
      },
    },
    async function (solicitud, respuesta) {
      const resultado = await agregarArticulo(
        clienteAutenticado(solicitud),
        Number(solicitud.body?.productoId),
        Number(solicitud.body?.cantidad),
      );
      if (!resultado.ok)
        return respuesta
          .code(resultado.codigoEstado || 400)
          .send({ error: resultado.error, stock: resultado.stock });
      return { data: resultado.vista };
    },
  );

  aplicacion.patch<{ Params: { productoId: string }; Body: { cantidad: number } }>(
    '/carrito/articulos/:productoId',
    {
      preHandler: autenticar,
      schema: {
        tags: ['carrito'],
        summary: 'Actualizar cantidad',
        body: {
          type: 'object',
          required: ['cantidad'],
          properties: { cantidad: { type: 'integer' } },
        },
      },
    },
    async function (solicitud, respuesta) {
      const resultado = await actualizarCantidad(
        clienteAutenticado(solicitud),
        Number(solicitud.params.productoId),
        Number(solicitud.body?.cantidad),
      );
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      return { data: resultado.vista };
    },
  );

  aplicacion.delete<{ Params: { productoId: string } }>(
    '/carrito/articulos/:productoId',
    {
      preHandler: autenticar,
      schema: { tags: ['carrito'], summary: 'Quitar producto del carrito' },
    },
    async function (solicitud, respuesta) {
      const resultado = await quitarArticulo(
        clienteAutenticado(solicitud),
        Number(solicitud.params.productoId),
      );
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      return { data: resultado.vista };
    },
  );

  aplicacion.post(
    '/carrito/pagar',
    {
      preHandler: autenticar,
      schema: {
        tags: ['carrito'],
        summary: 'Crear pedido desde el carrito',
        description: 'Vacia el carrito y crea el pedido (CU-EC-008).',
      },
    },
    async function (solicitud, respuesta) {
      const clienteId = clienteAutenticado(solicitud);
      const claveIdempotencia =
        typeof solicitud.headers['idempotency-key'] === 'string'
          ? solicitud.headers['idempotency-key']
          : undefined;
      const articulos = await articulosDelCarrito(clienteId);
      if (articulos.length === 0) return respuesta.code(400).send({ error: 'carrito_vacio' });
      const resultado = await crearPedido(clienteId, claveIdempotencia, articulos);
      if (!resultado.creado)
        return respuesta.code(resultado.codigoEstado).send({
          error: resultado.error,
          productoId: resultado.productoId,
          stock: resultado.stock,
        });
      await vaciarCarrito(clienteId);
      return {
        data: {
          referenciaPedido: resultado.referenciaPedido,
          estado: PEDIDO_PENDIENTE_PAGO,
          totalCentavos: resultado.totalCentavos,
          moneda: MONEDA_COP,
        },
      };
    },
  );
}
