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
import { rutasEmprendedores } from './modulos/emprendedores/emprendedores.rutas';
import { rutasDispersiones } from './modulos/emprendedores/dispersiones.rutas';
import { rutasCasos } from './modulos/casos/casos.rutas';
import { rutasCalidad } from './modulos/calidad/calidad.rutas';
import { rutasErp } from './modulos/erp/erp.rutas';
import { rutasInventario } from './modulos/inventario/inventario.rutas';
import { rutasCompras } from './modulos/compras/compras.rutas';
import { rutasVentas } from './modulos/ventas/ventas.rutas';
import { rutasLogistica } from './modulos/logistica/logistica.rutas';
import { rutasRrhh } from './modulos/rrhh/rrhh.rutas';
import { rutasComercial } from './modulos/comercial/comercial.rutas';
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
        { name: 'emprendedores', description: 'Enrolamiento, productos y aval (CU-EM-001..012)' },
        { name: 'casos', description: 'Soporte, garantias y calidad (CU-SGC-002..017)' },
        {
          name: 'calidad',
          description: 'Patrones, alertas, acciones correctivas y dashboard (CU-SGC-020..023)',
        },
        { name: 'erp', description: 'Modulos ERP (F5): proveedores (CU-ERP-001)' },
        {
          name: 'inventario',
          description:
            'Inventario ERP (F5): movimientos, bodegas, stock y kardex (CU-INV-001..008)',
        },
        {
          name: 'compras',
          description:
            'Compras avanzado (F5): solicitudes, ordenes, recepcion y cuentas por pagar (CU-ERP-002..009)',
        },
        {
          name: 'ventas',
          description:
            'Ventas del ERP (F5): consulta y gestion del ciclo de pedidos del canal (CU-CM-007 base)',
        },
        {
          name: 'logistica',
          description:
            'Logistica ERP (F5): transportistas, vehiculos y despachos con guia y estados (CU-LG-001..006)',
        },
        {
          name: 'rrhh',
          description:
            'RRHH / Nomina ERP (F5): cargos, empleados, ausencias y nomina (CU-RH-001/002/005/007)',
        },
        {
          name: 'comercial',
          description:
            'Comercial B2B (F5): clientes ERP, cupo de credito y ordenes corporativas (CU-CM-001/004/007)',
        },
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
        // @fastify/jwt deja el payload en request.user; lo exponemos como .usuario.
        (solicitud as any).usuario = (solicitud as any).user;
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
  await aplicacion.register(rutasEmprendedores);
  await aplicacion.register(rutasDispersiones);
  await aplicacion.register(rutasCasos);
  await aplicacion.register(rutasCalidad);
  await aplicacion.register(rutasErp);
  await aplicacion.register(rutasInventario);
  await aplicacion.register(rutasCompras);
  await aplicacion.register(rutasVentas);
  await aplicacion.register(rutasLogistica);
  await aplicacion.register(rutasRrhh);
  await aplicacion.register(rutasComercial);

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
