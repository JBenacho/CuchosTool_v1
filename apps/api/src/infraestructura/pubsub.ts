// Publicador GCP Pub/Sub (F3-GCP).
// Sustituye la evidencia local (tabla eventos_publicados) cuando GCP_PROYECTO_ID esta configurado.
// Credenciales: Application Default Credentials (gcloud auth application-default login)
// o variable GOOGLE_APPLICATION_CREDENTIALS con la ruta del JSON de la cuenta de servicio.
import { PubSub } from '@google-cloud/pubsub';
import { config } from '../config';

let cliente: PubSub | null = null;

/**
 * Devuelve el cliente Pub/Sub (perezoso, una unica instancia por proceso).
 * @throws si GCP no esta configurado.
 */
function obtenerCliente(): PubSub {
  if (!config.gcpProyectoId) throw new Error('gcp_no_configurado');
  if (!cliente) cliente = new PubSub({ projectId: config.gcpProyectoId });
  return cliente;
}

/**
 * Indica si el publicador GCP esta activo segun la configuracion.
 */
export function publicadorGcpActivo(): boolean {
  return Boolean(config.gcpProyectoId);
}

/**
 * Publica un mensaje JSON en un topico Pub/Sub.
 * @param topico nombre del topico.
 * @param eventId identificador del evento (atributo para deduplicacion de consumidores).
 * @param carga objeto del evento (se serializa a JSON).
 * @returns id del mensaje publicado.
 */
export async function publicarEnPubSub(
  topico: string,
  eventId: string,
  carga: Record<string, unknown>,
): Promise<string> {
  const clientePubSub = obtenerCliente();
  const datos = Buffer.from(JSON.stringify(carga), 'utf8');
  const idMensaje = await clientePubSub.topic(topico).publishMessage({
    data: datos,
    attributes: { eventId: eventId, tipoEvento: String(carga.type || '') },
  });
  return idMensaje;
}
