import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { healthRoutes } from './modules/health/health.routes';
import { config } from './config';

export async function buildApp(opts?: { logger?: boolean }): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts && opts.logger ? { level: config.logLevel } : false,
  });

  await app.register(cors, { origin: true });

  // Registro de modulos. F0: salud. F1/F2: core, ecommerce, etc.
  await app.register(healthRoutes);

  app.get('/', async () => ({
    name: 'CuchosTool API',
    version: '0.1.0',
    baseline: 'SRS v5.0 / ARQ v6.0 / BL v6.0',
    status: 'f0-fundacion',
  }));

  return app;
}
