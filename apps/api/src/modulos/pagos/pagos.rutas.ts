// Rutas de pagos (CU-EC-010, BL-035).
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { base } from '../../bd/base';
import { pagos } from '../../bd/esquema';
import { iniciarPago, registrarNotificacionPago } from './pagos.servicio';
import { verificarFirmaWompi, type EstadoWompi } from '../../proveedores/wompi';
import { config } from '../../config';

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

  // Webhook real de Wompi (F3-GCP): verifica la firma X-Event-Checksum antes de actuar.
  // rawBody: se requiere el cuerpo crudo para validar el HMAC (no el JSON parseado).
  aplicacion.post(
    '/pagos/notificacion-wompi',
    {
      config: { rawBody: true },
      schema: {
        tags: ['pagos'],
        summary: 'Webhook firmado de Wompi',
        description: 'Notificacion de transacciones verificada con X-Event-Checksum (F3-GCP).',
      },
    },
    async function (solicitud, respuesta) {
      if (!config.wompiClaveEventos)
        return respuesta.code(503).send({ error: 'proveedor_no_configurado' });
      const cuerpoCrudo = String((solicitud as any).rawBody || '');
      const firma =
        typeof solicitud.headers['x-event-checksum'] === 'string'
          ? solicitud.headers['x-event-checksum']
          : '';
      if (!verificarFirmaWompi(cuerpoCrudo, firma, config.wompiClaveEventos))
        return respuesta.code(401).send({ error: 'firma_invalida' });
      const evento = JSON.parse(cuerpoCrudo) as {
        event?: string;
        data?: { transaction?: { id?: string; reference?: string; status?: string } };
      };
      if (evento.event !== 'transaction.updated')
        return { data: { recibido: true, ignorado: true } };
      const transaccion = evento.data && evento.data.transaction ? evento.data.transaction : null;
      if (!transaccion || !transaccion.reference)
        return respuesta.code(400).send({ error: 'evento_sin_referencia' });
      const resultado = await registrarNotificacionPago(
        transaccion.reference,
        transaccion.id || 'wompi-desconocido',
        (transaccion.status || 'PENDING') as EstadoWompi,
      );
      if (resultado.codigoEstado)
        return respuesta.code(resultado.codigoEstado).send({ error: resultado.error });
      return { data: { recibido: true, ...resultado } };
    },
  );
}
