// Rutas de pagos (CU-EC-010, BL-035).
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { base } from '../../bd/base';
import { pagos } from '../../bd/esquema';
import { iniciarPago, registrarNotificacionPago } from './pagos.servicio';

type CuerpoIniciarPago = { referenciaPedido: string };

export async function rutasPagos(aplicacion: FastifyInstance): Promise<void> {
  const autenticar = (aplicacion as any).autenticar;

  aplicacion.post<{ Body: CuerpoIniciarPago }>(
    '/pagos/iniciar',
    {
      preHandler: autenticar,
      schema: {
        tags: ['pagos'],
        summary: 'Iniciar pago Wompi del pedido',
        body: {
          type: 'object',
          required: ['referenciaPedido'],
          properties: { referenciaPedido: { type: 'string' } },
        },
      },
    },
    async function (solicitud, respuesta) {
      const clienteId = String((solicitud as any).usuario?.sub || 'anonimo');
      const resultado = await iniciarPago(
        clienteId,
        String(solicitud.body?.referenciaPedido || ''),
      );
      if (resultado.codigoEstado)
        return respuesta.code(resultado.codigoEstado).send({ error: resultado.error });
      return { data: resultado };
    },
  );

  aplicacion.get<{ Params: { referenciaPago: string } }>(
    '/pagos/:referenciaPago',
    {
      preHandler: autenticar,
      schema: {
        tags: ['pagos'],
        summary: 'Consultar estado del pago',
        description: 'Estado del pago propio del cliente.',
      },
    },
    async function (solicitud, respuesta) {
      const clienteId = String((solicitud as any).usuario?.sub || 'anonimo');
      const filas = await base
        .select()
        .from(pagos)
        .where(eq(pagos.referenciaPago, solicitud.params.referenciaPago))
        .limit(1);
      const pago = filas[0];
      if (!pago || pago.clienteId !== clienteId)
        return respuesta.code(404).send({ error: 'pago_no_encontrado' });
      return {
        data: {
          referenciaPago: pago.referenciaPago,
          estado: pago.estado,
          montoCentavos: pago.montoCentavos,
          idTransaccionProveedor: pago.idTransaccionProveedor,
        },
      };
    },
  );

  // SOLO DESARROLLO: simula la notificacion del proveedor Wompi.
  // Al integrar Wompi real este endpoint se elimina y se usa el webhook firmado (RNF-SEC).
  aplicacion.post<{ Params: { referenciaPago: string } }>(
    '/pagos/simular/:referenciaPago',
    {
      schema: { tags: ['pagos'], summary: '(DEV) Simular notificacion de pago del proveedor' },
    },
    async function (solicitud, respuesta) {
      const resultado = await registrarNotificacionPago(
        solicitud.params.referenciaPago,
        'SIM-' + randomUUID(),
      );
      if (resultado.codigoEstado)
        return respuesta.code(resultado.codigoEstado).send({ error: resultado.error });
      return { data: resultado };
    },
  );
}
