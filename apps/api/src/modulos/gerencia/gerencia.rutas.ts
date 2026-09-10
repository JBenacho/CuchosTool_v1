// Rutas de reportes gerenciales del ERP (CU-GE): resumen ejecutivo, series mensuales,
// ranking de productos, cartera y exportacion CSV. RBAC: ADMIN y GERENTE_ZONA.
import type { FastifyInstance } from 'fastify';
import { REPORTES_GERENCIALES, ROL_ADMIN, ROL_GERENTE_ZONA } from '../../dominio/constantes';
import {
  cartera,
  csvCartera,
  csvRanking,
  csvResumen,
  csvSeries,
  normalizarLimite,
  normalizarMeses,
  normalizarPeriodo,
  rankingProductos,
  resumenGerencial,
  seriesMensuales,
} from './gerencia.servicio';

// Nombre del archivo CSV por tipo de reporte exportado.
const ARCHIVOS_CSV: Record<string, string> = {
  resumen: 'resumen-gerencial',
  series: 'series-mensuales',
  ranking: 'ranking-productos',
  cartera: 'cartera',
};

/** Arma el periodo solicitado o responde 400 cuando el formato no es AAAA-MM. */
function periodoDe(solicitud: any): { periodo?: string; error?: string } {
  const periodo = normalizarPeriodo(solicitud.query && solicitud.query.periodo);
  if (!periodo) return { error: 'periodo_invalido' };
  return { periodo: periodo };
}

export async function rutasGerencia(aplicacion: FastifyInstance): Promise<void> {
  const requerirRol = (aplicacion as any).requerirRol as (roles: string[]) => any;
  const gerencia = [ROL_ADMIN, ROL_GERENTE_ZONA];

  aplicacion.get(
    '/gerencia/resumen',
    {
      preHandler: requerirRol(gerencia),
      schema: { tags: ['gerencia'], summary: 'Resumen gerencial consolidado (CU-GE)' },
    },
    async function (solicitud: any, respuesta: any) {
      const pedido = periodoDe(solicitud);
      if (pedido.error) return respuesta.code(400).send({ error: pedido.error });
      return { data: await resumenGerencial(pedido.periodo as string) };
    },
  );

  aplicacion.get(
    '/gerencia/series',
    {
      preHandler: requerirRol(gerencia),
      schema: { tags: ['gerencia'], summary: 'Serie mensual de ventas y facturacion (CU-GE)' },
    },
    async function (solicitud: any) {
      const meses = normalizarMeses(solicitud.query && solicitud.query.meses);
      return { data: await seriesMensuales(meses) };
    },
  );

  aplicacion.get(
    '/gerencia/ranking-productos',
    {
      preHandler: requerirRol(gerencia),
      schema: { tags: ['gerencia'], summary: 'Ranking de productos vendidos (CU-GE)' },
    },
    async function (solicitud: any, respuesta: any) {
      const pedido = periodoDe(solicitud);
      if (pedido.error) return respuesta.code(400).send({ error: pedido.error });
      const limite = normalizarLimite(solicitud.query && solicitud.query.limite);
      return { data: await rankingProductos(pedido.periodo as string, limite) };
    },
  );

  aplicacion.get(
    '/gerencia/cartera',
    {
      preHandler: requerirRol(gerencia),
      schema: { tags: ['gerencia'], summary: 'Cartera por pagar y por cobrar (CU-GE)' },
    },
    async function () {
      return { data: await cartera() };
    },
  );

  // Exportacion CSV de los reportes gerenciales (descarga directa desde el navegador).
  aplicacion.get(
    '/gerencia/exportar',
    {
      preHandler: requerirRol(gerencia),
      schema: {
        tags: ['gerencia'],
        summary: 'Exportar reporte gerencial en CSV (resumen, series, ranking o cartera)',
      },
    },
    async function (solicitud: any, respuesta: any) {
      const reporte = String((solicitud.query && solicitud.query.reporte) || 'resumen');
      if (!(REPORTES_GERENCIALES as unknown as string[]).includes(reporte))
        return respuesta.code(400).send({ error: 'reporte_invalido' });
      const pedido = periodoDe(solicitud);
      if (pedido.error) return respuesta.code(400).send({ error: pedido.error });
      const periodo = pedido.periodo as string;
      const meses = normalizarMeses(solicitud.query && solicitud.query.meses);
      const limite = normalizarLimite(solicitud.query && solicitud.query.limite);

      let contenido = '';
      if (reporte === 'resumen') contenido = csvResumen(await resumenGerencial(periodo));
      if (reporte === 'series') contenido = csvSeries(await seriesMensuales(meses));
      if (reporte === 'ranking') contenido = csvRanking(await rankingProductos(periodo, limite));
      if (reporte === 'cartera') contenido = csvCartera(await cartera());

      const archivo = ARCHIVOS_CSV[reporte] + '-' + periodo + '.csv';
      return respuesta
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', 'attachment; filename="' + archivo + '"')
        .send(contenido);
    },
  );
}
