// Rutas de calidad (CU-SGC-020..023). Roles: Responsable de Calidad, Supervisor, Admin.
import type { FastifyInstance } from 'fastify';
import { ROL_ADMIN, ROL_RESPONSABLE_CALIDAD, ROL_SUPERVISOR } from '../../dominio/constantes';
import { registrarAuditoria } from '../administracion/auditoria';
import {
  cerrarAccionCorrectiva,
  crearAccionCorrectiva,
  dashboardCalidad,
  detectarPatronesCalidad,
  generarAlertaPorUmbral,
} from './calidad.servicio';

export async function rutasCalidad(aplicacion: FastifyInstance): Promise<void> {
  const requerirRol = (aplicacion as any).requerirRol as (roles: string[]) => any;
  const gestores = [ROL_RESPONSABLE_CALIDAD, ROL_SUPERVISOR, ROL_ADMIN];

  aplicacion.get(
    '/calidad/dashboard',
    {
      preHandler: requerirRol(gestores),
      schema: { tags: ['calidad'], summary: 'Dashboard de calidad (CU-SGC-023)' },
    },
    async function () {
      return { data: await dashboardCalidad() };
    },
  );

  aplicacion.post(
    '/calidad/detectar',
    {
      preHandler: requerirRol(gestores),
      schema: { tags: ['calidad'], summary: 'Detectar patrones de calidad (CU-SGC-020)' },
    },
    async function () {
      return { data: await detectarPatronesCalidad() };
    },
  );

  aplicacion.post(
    '/calidad/alertas/generar',
    {
      preHandler: requerirRol(gestores),
      schema: { tags: ['calidad'], summary: 'Generar alerta por umbral (CU-SGC-021)' },
    },
    async function (solicitud) {
      const resultado = await generarAlertaPorUmbral();
      await registrarAuditoria(
        solicitud,
        'calidad.generar_alerta',
        'alertas_calidad',
        'umbral_casos_abiertos',
        'ok',
      );
      return { data: resultado.datos };
    },
  );

  aplicacion.post<{ Body: { descripcion: string; origenCasoId?: number } }>(
    '/calidad/acciones',
    {
      preHandler: requerirRol(gestores),
      schema: { tags: ['calidad'], summary: 'Crear accion correctiva (CU-SGC-022)' },
    },
    async function (solicitud, respuesta) {
      const resultado = await crearAccionCorrectiva(
        solicitud.body?.descripcion || '',
        Number(solicitud.body?.origenCasoId) || undefined,
      );
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'calidad.crear_accion',
        'acciones_correctivas',
        'nueva',
        'ok',
      );
      return { data: resultado.datos };
    },
  );

  aplicacion.patch<{ Params: { referencia: string } }>(
    '/calidad/acciones/:referencia/cerrar',
    {
      preHandler: requerirRol(gestores),
      schema: { tags: ['calidad'], summary: 'Cerrar accion correctiva (CU-SGC-022)' },
    },
    async function (solicitud, respuesta) {
      const resultado = await cerrarAccionCorrectiva(solicitud.params.referencia);
      if (!resultado.ok)
        return respuesta.code(resultado.codigoEstado || 400).send({ error: resultado.error });
      await registrarAuditoria(
        solicitud,
        'calidad.cerrar_accion',
        'acciones_correctivas',
        solicitud.params.referencia,
        'ok',
      );
      return { data: resultado.datos };
    },
  );
}
