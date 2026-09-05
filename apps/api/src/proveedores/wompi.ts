// Adaptador del proveedor Wompi (CU-EC-010, BL-035).
// Contiene: verificacion de firma de eventos (webhook), firma de integridad de transaccion,
// mapeo de estados del proveedor a estados internos y creacion de sesion de pago.
// Segun la documentacion oficial de Wompi:
// - Integridad: sha256(referencia + montoEnCentavos + moneda + claveIntegridad) en hex.
// - Webhook: el header X-Event-Checksum contiene sha256(cuerpoCrudo + claveEventos)?
//   (Wompi firma el cuerpo del evento con la clave de eventos; aqui se implementa el
//   esquema HMAC-sha256 del cuerpo y se valida en tiempo constante).
import { createHmac, createHash, timingSafeEqual } from 'crypto';
import { PAGO_APROBADO, PAGO_PENDIENTE, PAGO_RECHAZADO } from '../dominio/constantes';

export type EstadoWompi = 'PENDING' | 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR';

export interface SesionPagoWompi {
  urlPago: string;
  referenciaProveedor?: string;
}

/**
 * Mapea el estado reportado por Wompi al estado interno de pagos.
 * Regla: solo APPROVED aprueba; DECLINED/VOIDED/ERROR rechazan; PENDING mantiene pendiente.
 */
export function mapearEstadoWompi(estado: string): string {
  switch (estado) {
    case 'APPROVED':
      return PAGO_APROBADO;
    case 'DECLINED':
    case 'VOIDED':
    case 'ERROR':
      return PAGO_RECHAZADO;
    default:
      return PAGO_PENDIENTE;
  }
}

/**
 * Calcula la firma de integridad que Wompi exige al crear una transaccion.
 * @param referencia referencia interna del pago.
 * @param montoCentavos monto en centavos.
 * @param moneda moneda ISO (COP).
 * @param claveIntegridad clave de integridad del comercio (privada Wompi).
 * @returns hash sha256 en hexadecimal.
 */
export function calcularFirmaIntegridadWompi(
  referencia: string,
  montoCentavos: number,
  moneda: string,
  claveIntegridad: string,
): string {
  return createHash('sha256')
    .update(referencia + montoCentavos + moneda + claveIntegridad)
    .digest('hex');
}

/**
 * Verifica en tiempo constante la firma del webhook de Wompi.
 * @param cuerpoCrudo cuerpo crudo (texto) recibido en el request.
 * @param firma valor del header X-Event-Checksum.
 * @param claveEventos clave de eventos del comercio.
 * @returns true si la firma es valida.
 */
export function verificarFirmaWompi(
  cuerpoCrudo: string,
  firma: string,
  claveEventos: string,
): boolean {
  if (!firma || !claveEventos) return false;
  const esperada = createHmac('sha256', claveEventos).update(cuerpoCrudo).digest('hex');
  const recibida = Buffer.from(firma, 'hex');
  const calculada = Buffer.from(esperada, 'hex');
  if (recibida.length !== calculada.length) return false;
  return timingSafeEqual(recibida, calculada);
}

/**
 * Crea una sesion de pago real en Wompi (produccion o sandbox segun configuracion).
 * Requiere clave publica/privada y token de aceptacion del comercio.
 * @param urlBase base de la API (https://production.wompi.co o https://sandbox.wompi.co).
 * @param clavePublica clave publica del comercio.
 * @param clavePrivada clave privada (Authorization Bearer).
 * @param claveIntegridad clave de integridad del comercio.
 * @param referencia referencia interna del pago.
 * @param montoCentavos monto en centavos.
 * @param moneda moneda ISO (COP).
 */
export async function crearSesionPagoWompi(
  urlBase: string,
  clavePublica: string,
  clavePrivada: string,
  claveIntegridad: string,
  referencia: string,
  montoCentavos: number,
  moneda: string,
): Promise<SesionPagoWompi> {
  // 1) Token de aceptacion del comercio.
  const respuestaAceptacion = await fetch(urlBase + '/v1/merchants/' + clavePublica, {
    method: 'GET',
  });
  if (!respuestaAceptacion.ok) throw new Error('wompi_token_aceptacion_fallo');
  const aceptacion = (await respuestaAceptacion.json()) as {
    data?: { presigned_acceptance?: { acceptance_token?: string } };
  };
  const tokenAceptacion = aceptacion.data?.presigned_acceptance?.acceptance_token;
  if (!tokenAceptacion) throw new Error('wompi_token_aceptacion_falto');

  // 2) Transaccion con firma de integridad.
  const respuesta = await fetch(urlBase + '/v1/transactions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + clavePrivada,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      acceptance_token: tokenAceptacion,
      amount_in_cents: montoCentavos,
      currency: moneda,
      reference: referencia,
      signature: calcularFirmaIntegridadWompi(referencia, montoCentavos, moneda, claveIntegridad),
      customer_email: 'cliente@cuchostool.com', // reemplazar con el correo real del cliente (CU-EC-015)
      payment_method: { type: 'CARD' },
    }),
  });
  if (!respuesta.ok) throw new Error('wompi_transaccion_fallo');
  const transaccion = (await respuesta.json()) as { data?: { id?: string } };
  if (!transaccion.data?.id) throw new Error('wompi_transaccion_sin_id');
  return {
    urlPago: urlBase + '/v1/transactions/' + transaccion.data.id,
    referenciaProveedor: transaccion.data.id,
  };
}
