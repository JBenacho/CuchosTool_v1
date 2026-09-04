import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { healthRoutes } from './modules/health/health.routes';
import { catalogRoutes } from './modules/catalog/catalog.routes';
import { config } from './config';

// Contrato OpenAPI (BL-015 / CU-INT-010): documentado y expuesto en /docs y /docs/json.
const apiInfo = {
  title: 'CuchosTool API',
  description: 'Plataforma CuchosTool.com - API Contract-First. Baseline SRS v5.0 / ARQ v6.0 / BL v6.0.',
  version: '0.1.0',
} as const;

export async function buildApp(opts?: { logger?: boolean }): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts && opts.logger ? { level: config.logLevel } : false,
  });

  await app.register(cors, { origin: true });

  await app.register(swagger, {
    openapi: {
      info: apiInfo,
      tags: [
        { name: 'health', description: 'Salud y disponibilidad' },
        { name: 'catalog', description: 'Catalogo publico (CU-EC-001..006)' },
      ],
    },
  });

  await app.register(swaggerUi, { routePrefix: '/docs' });

  // Registro de modulos.
  await app.register(healthRoutes);
  await app.register(catalogRoutes, { prefix: '/catalog' });

  app.get('/', async () => ({
    name: 'CuchosTool API',
    version: '0.1.0',
    baseline: 'SRS v5.0 / ARQ v6.0 / BL v6.0',
    status: 'f2-catalogo',
    docs: '/docs',
  }));

  return app;
}
