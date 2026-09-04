// Rutas operativas del buzon de eventos (CU-INT-001/002, BL-091).
import type { FastifyInstance } from 'fastify';
import { desc, isNull } from 'drizzle-orm';
import { base } from '../../bd/base';
import { eventosBuzon, eventosFallidos, eventosPublicados } from '../../bd/esquema';
import { procesarBuzonPendiente } from './buzon.servicio';

export async function rutasEventos(aplicacion: FastifyInstance): Promise<void> {
  aplicacion.get(
    '/buzon/pendientes',
    {
      schema: {
        tags: ['eventos'],
        summary: 'Eventos pendientes de publicacion',
        description: 'Cola del buzon transaccional pendiente.',
      },
    },
    async function () {
      const filas = await base
        .select()
        .from(eventosBuzon)
        .where(isNull(eventosBuzon.publicadoEn))
        .orderBy(desc(eventosBuzon.id));
      return { data: filas };
    },
  );

  aplicacion.post(
    '/buzon/procesar',
    {
      schema: {
        tags: ['eventos'],
        summary: 'Procesar buzon pendiente',
        description: 'Ejecuta una tanda del publicador (dev).',
      },
    },
    async function () {
      return { data: await procesarBuzonPendiente() };
    },
  );

  aplicacion.get(
    '/buzon/publicados',
    {
      schema: {
        tags: ['eventos'],
        summary: 'Eventos publicados',
        description: 'Evidencia local de publicacion (topico + carga).',
      },
    },
    async function () {
      const filas = await base
        .select()
        .from(eventosPublicados)
        .orderBy(desc(eventosPublicados.id))
        .limit(200);
      return { data: filas };
    },
  );

  aplicacion.get(
    '/buzon/fallidos',
    {
      schema: {
        tags: ['eventos'],
        summary: 'Eventos fallidos (DLQ)',
        description: 'Cola de fallos con motivo para reproceso (BL-091).',
      },
    },
    async function () {
      const filas = await base
        .select()
        .from(eventosFallidos)
        .orderBy(desc(eventosFallidos.id))
        .limit(200);
      return { data: filas };
    },
  );
}
