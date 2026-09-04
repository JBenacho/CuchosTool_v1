// Aplicacion Fastify de CuchosTool: registro de plugins, decoradores de seguridad y modulos.
// Convenciones: nombres en espanol; cada modulo vive en src/modulos/<dominio>/.
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import jwt from '@fastify/jwt';
import { rutasSalud } from './modulos/salud/salud.rutas';
import { rutasCatalogo } from './modulos/catalogo/catalogo.rutas';
import { rutasAutenticacion } from './modulos/autenticacion/autenticacion.rutas';
import { rutasCarrito } from './modulos/carrito/carrito.rutas';
import { rutasPedidos } from './modulos/pedidos/pedidos.rutas';
import { rutasAdministracion } from './modulos/administracion/administracion.rutas';
import { rutasPagos } from './modulos/pagos/pagos.rutas';
import { rutasEventos } from './modulos/eventos/eventos.rutas';
import { config } from './config';

// Informacion del contrato OpenAPI (BL-015 / CU-INT-010).
const informacionApi = {
  title: 'CuchosTool API',
  description:
    'Plataforma CuchosTool.com - API Contract-First. Baseline SRS v5.0 / ARQ v6.0 / BL v6.0.',
  version: '0.2.0',
} as const;

/**
 * Construye la aplicacion Fastify con todos los plugins y rutas registrados.
 * Se separa del arranque para poder probarla con app.inject (sin abrir puerto).
 */
export async function construirAplicacion(opciones?: {
  logger?: boolean;
}): Promise<FastifyInstance> {
  const aplicacion = Fastify({
    logger: opciones && opciones.logger ? { level: config.nivelLog } : false,
  });

  await aplicacion.register(cors, { origin: true });

  await aplicacion.register(swagger, {
    openapi: {
      info: informacionApi,
      tags: [
        { name: 'salud', description: 'Salud y disponibilidad' },
        { name: 'catalogo', description: 'Catalogo publico (CU-EC-001..006)' },
        {
          name: 'autenticacion',
          description: 'Identidad de cliente e interna (CU-EC-013/014, CU-SEC-009)',
        },
        { name: 'carrito', description: 'Carrito de compra (CU-EC-007)' },
        { name: 'pedidos', description: 'Pedidos (CU-EC-008/009)' },
        { name: 'pagos', description: 'Pagos Wompi (CU-EC-010, BL-035/101)' },
        { name: 'eventos', description: 'Buzon y publicador de eventos (CU-INT-001/002, BL-091)' },
        {
          name: 'administracion',
          description: 'Consola administrativa RBAC/ABAC (CU-SEC-001..015)',
        },
      ],
    },
  });
  await aplicacion.register(swaggerUi, { routePrefix: '/docs' });

  await aplicacion.register(jwt, { secret: config.secretoJwt });

  // Decorador de autorizacion por rol (RBAC, Default Deny).
  // Regla: si el JWT no tiene un rol permitido, se responde 403; sin token, 401.
  aplicacion.decorate('requerirRol', function (rolesPermitidos: string[]) {
    return async function (
      solicitud: import('fastify').FastifyRequest,
      respuesta: import('fastify').FastifyReply,
    ) {
      try {
        await solicitud.jwtVerify();
      } catch {
        return respuesta.code(401).send({ error: 'no_autorizado' });
      }
      const usuario = (solicitud as any).usuario;
      const rol = usuario && usuario.rol;
      if (!rolesPermitidos.includes(rol)) return respuesta.code(403).send({ error: 'prohibido' });
    };
  });

  // Decorador de autenticacion: exige JWT valido y deja el payload en solicitud.usuario.
  aplicacion.decorate(
    'autenticar',
    async function (
      solicitud: import('fastify').FastifyRequest,
      respuesta: import('fastify').FastifyReply,
    ) {
      try {
        await solicitud.jwtVerify();
        // @fastify/jwt guarda el payload en request.user; lo exponemos como .usuario para el resto del codigo.
        (solicitud as any).usuario = (solicitud as any).user;
      } catch {
        return respuesta.code(401).send({ error: 'no_autorizado' });
      }
    },
  );

  // Registro de modulos por dominio.
  await aplicacion.register(rutasSalud);
  await aplicacion.register(rutasAutenticacion);
  await aplicacion.register(rutasAdministracion);
  await aplicacion.register(rutasCatalogo);
  await aplicacion.register(rutasCarrito);
  await aplicacion.register(rutasPedidos);
  await aplicacion.register(rutasPagos);
  await aplicacion.register(rutasEventos);

  aplicacion.get('/', async function () {
    return {
      nombre: 'CuchosTool API',
      version: '0.2.0',
      baseline: 'SRS v5.0 / ARQ v6.0 / BL v6.0',
      estado: 'f2-completo',
      docs: '/docs',
    };
  });

  return aplicacion;
}
