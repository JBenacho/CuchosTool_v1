// Rutas del Order Service (CU-EC-008/009). El buzon de eventos vive en el modulo eventos.
import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { base } from '../../bd/base';
import { pedidoArticulos, pedidos } from '../../bd/esquema';
import { crearPedido, type ArticuloPedido } from './pedidos.servicio';
import { MONEDA_COP, PEDIDO_PENDIENTE_PAGO } from '../../dominio/constantes';

type CuerpoPedido = { articulos: ArticuloPedido[] };

export async function rutasPedidos(aplicacion: FastifyInstance): Promise<void> {
  const autenticar = (aplicacion as any).autenticar;

  aplicacion.post<{ Body: CuerpoPedido }>(
    '/pedidos',
    {
      preHandler: autenticar,
      schema: {
        tags: ['pedidos'],
        summary: 'Crear pedido unico desde checkout',
        description: 'Transaccion ACID + buzon OrderCreated. Idempotency-Key opcional (BL-023).',
        body: {
          type: 'object',
          required: ['articulos'],
          properties: {
            articulos: {
              type: 'array',
              items: {
                type: 'object',
                required: ['productoId', 'cantidad'],
                properties: { productoId: { type: 'integer' }, cantidad: { type: 'integer' } },
              },
            },
          },
        },
      },
    },
    async function (solicitud, respuesta) {
      const claveIdempotencia =
        typeof solicitud.headers['idempotency-key'] === 'string'
          ? solicitud.headers['idempotency-key']
          : undefined;
      const clienteId = String((solicitud as any).usuario?.sub || 'anonimo');
      const articulos: ArticuloPedido[] = (
        solicitud.body && Array.isArray(solicitud.body.articulos) ? solicitud.body.articulos : []
      ).map(function (a) {
        return { productoId: Number(a.productoId), cantidad: Number(a.cantidad) };
      });
      const resultado = await crearPedido(clienteId, claveIdempotencia, articulos);
      if (!resultado.creado)
        return respuesta.code(resultado.codigoEstado).send({
          error: resultado.error,
          productoId: resultado.productoId,
          stock: resultado.stock,
        });
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

  aplicacion.get<{ Params: { referencia: string } }>(
    '/pedidos/:referencia',
    {
      preHandler: autenticar,
      schema: {
        tags: ['pedidos'],
        summary: 'Consultar pedido propio',
        description: 'Pedido por referencia del cliente autenticado (CU-EC-009).',
      },
    },
    async function (solicitud, respuesta) {
      const clienteId = String((solicitud as any).usuario?.sub || 'anonimo');
      const filas = await base
        .select()
        .from(pedidos)
        .where(
          and(
            eq(pedidos.referenciaPedido, solicitud.params.referencia),
            eq(pedidos.clienteId, clienteId),
          ),
        )
        .limit(1);
      const pedido = filas[0];
      if (!pedido) return respuesta.code(404).send({ error: 'pedido_no_encontrado' });
      const articulos = await base
        .select()
        .from(pedidoArticulos)
        .where(eq(pedidoArticulos.pedidoId, pedido.id));
      return { data: { ...pedido, articulos: articulos } };
    },
  );
}
