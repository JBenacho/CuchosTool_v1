// Punto de entrada de la API (se separa de la construccion para facilitar pruebas).
import { construirAplicacion } from './app';
import { config } from './config';
import { arrancarPublicador } from './modulos/eventos/buzon.servicio';

async function principal(): Promise<void> {
  const aplicacion = await construirAplicacion({ logger: true });
  const direccion = await aplicacion.listen({ host: config.anfitrion, port: config.puerto });
  aplicacion.log.info('CuchosTool API escuchando en ' + direccion);
  // Publicador periodico del buzon (en GCP lo sustituye Cloud Scheduler + Pub/Sub real).
  arrancarPublicador(config.intervaloPublicadorMs);
}

principal().catch(function (error) {
  // Fallo predecible: se registra el error con contexto y se termina con codigo distinto de cero.
  console.error('Error iniciando la API:', error);
  process.exit(1);
});
