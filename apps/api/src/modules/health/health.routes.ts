import type { FastifyInstance } from 'fastify';
import { pingDatabase } from '../../db/client';

// Health/Ready (CU-GCP-009 / CU-DEV-006 - smoke y health checks)
export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/healthz', async () => {
    return { status: 'ok', service: 'cuchostool-api', time: new Date().toISOString() };
  });

  app.get('/readyz', async (_req, reply) => {
    const dbOk = await pingDatabase();
    if (!dbOk) {
      return reply.code(503).send({ status: 'not_ready', db: 'unreachable' });
    }
    return { status: 'ready', db: 'ok' };
  });
}
