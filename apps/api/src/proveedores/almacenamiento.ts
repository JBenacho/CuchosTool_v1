// Almacenamiento de archivos de evidencia (CU-SGC-006, F5-GCP).
// Con GCP_BUCKET_EVIDENCIAS sube a Cloud Storage; sin bucket guarda en disco local de desarrollo.
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { config } from '../config';

export interface ResultadoAlmacenamiento {
  url: string;
  proveedor: 'gcs' | 'local';
}

/**
 * Guarda la evidencia y devuelve su URL (gs://... en GCP o ruta local en desarrollo).
 * @param contenidoBase64 archivo codificado en base64 (dato externo validado por tamano).
 */
export async function guardarEvidencia(
  nombreArchivo: string,
  contenidoBase64: string,
  tipoContenido: string,
): Promise<ResultadoAlmacenamiento> {
  const buffer = Buffer.from(contenidoBase64, 'base64');
  const nombreSeguro = String(nombreArchivo || 'evidencia').replace(/[^a-zA-Z0-9._-]/g, '_');
  const clave = new Date().toISOString().slice(0, 10) + '/' + randomUUID() + '-' + nombreSeguro;
  if (config.gcpBucketEvidencias && config.gcpProyectoId) {
    const { Storage } = await import('@google-cloud/storage');
    const almacen = new Storage({ projectId: config.gcpProyectoId });
    const archivo = almacen.bucket(config.gcpBucketEvidencias).file(clave);
    await archivo.save(buffer, {
      contentType: tipoContenido || 'application/octet-stream',
      resumable: false,
    });
    return { url: 'gs://' + config.gcpBucketEvidencias + '/' + clave, proveedor: 'gcs' };
  }
  const carpeta = join(process.cwd(), '.evidencias', clave.substring(0, clave.indexOf('/')));
  await mkdir(carpeta, { recursive: true });
  const ruta = join(carpeta, clave.substring(clave.indexOf('/') + 1));
  await writeFile(ruta, buffer);
  return { url: 'evidencias-local/' + clave, proveedor: 'local' };
}
