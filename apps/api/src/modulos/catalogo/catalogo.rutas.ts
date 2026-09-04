// Rutas del catalogo publico (CU-EC-001..006). Sin autenticacion (BL-027).
import type { FastifyInstance } from 'fastify';
import {
  formatearPrecioPesos,
  listarProductosActivos,
  obtenerProductoActivo,
  type ProductoResumen,
} from './catalogo.servicio';

// Esquema JSON del producto para el contrato OpenAPI (BL-015).
const esquemaProducto = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    slug: { type: 'string' },
    nombre: { type: 'string' },
    descripcion: { type: ['string', 'null'] },
    precioCentavos: { type: 'integer' },
    moneda: { type: 'string' },
    stock: { type: 'integer' },
    urlImagen: { type: ['string', 'null'] },
    categoria: { type: ['string', 'null'] },
    precio: { type: 'string' },
  },
} as const;

type ConsultaProductos = { q?: string; limit?: string; offset?: string };

export async function rutasCatalogo(aplicacion: FastifyInstance): Promise<void> {
  aplicacion.get<{ Querystring: ConsultaProductos }>(
    '/catalogo/productos',
    {
      schema: {
        tags: ['catalogo'],
        summary: 'Listar productos activos del catalogo',
        description: 'Catalogo publico (CU-EC-001). Filtro opcional q= por nombre/descripcion.',
        querystring: {
          type: 'object',
          properties: {
            q: { type: 'string' },
            limit: { type: 'string' },
            offset: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array', items: esquemaProducto },
              meta: {
                type: 'object',
                properties: {
                  limite: { type: 'integer' },
                  desplazamiento: { type: 'integer' },
                  cantidad: { type: 'integer' },
                },
              },
            },
          },
        },
      },
    },
    async function (solicitud) {
      const resultado = await listarProductosActivos(
        solicitud.query.q || '',
        solicitud.query.limit,
        solicitud.query.offset,
      );
      const productosFormateados = resultado.filas.map(function (p: ProductoResumen) {
        return { ...p, precio: formatearPrecioPesos(p.precioCentavos) };
      });
      return {
        data: productosFormateados,
        meta: {
          limite: resultado.limite,
          desplazamiento: resultado.desplazamiento,
          cantidad: productosFormateados.length,
        },
      };
    },
  );

  aplicacion.get<{ Params: { id: string } }>(
    '/catalogo/productos/:id',
    {
      schema: {
        tags: ['catalogo'],
        summary: 'Consultar ficha de producto',
        description: 'Ficha de producto activo por id (CU-EC-004).',
        params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
        response: {
          200: { type: 'object', properties: { data: esquemaProducto } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async function (solicitud, respuesta) {
      const id = parseInt(solicitud.params.id, 10);
      if (Number.isNaN(id)) return respuesta.code(400).send({ error: 'id_invalido' });
      const producto = await obtenerProductoActivo(id);
      if (!producto) return respuesta.code(404).send({ error: 'producto_no_encontrado' });
      return { data: { ...producto, precio: formatearPrecioPesos(producto.precioCentavos) } };
    },
  );
}
