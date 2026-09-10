// Reportes gerenciales del ERP (CU-GE base): consolidado de ventas, facturacion, inventario y casos.
import type { FastifyInstance } from 'fastify';
import { and, eq, gte, lt, sql } from 'drizzle-orm';
import { base } from '../../bd/base';
import {
  casos,
  comisiones,
  facturas,
  inventarioStock,
  ordenesVentaB2b,
  pedidos,
} from '../../bd/esquema';
import {
  CASO_ABIERTO,
  CASO_EN_PROCESO,
  FACTURA_ANULADA,
  PEDIDO_ENTREGADO,
  PEDIDO_PAGADO,
  ROL_ADMIN,
  ROL_GERENTE_ZONA,
  VENTA_B2B_PAGADA,
} from '../../dominio/constantes';

function rangoPeriodo(periodo: string): { inicio: Date; fin: Date } | null {
  if (!/^\d{4}-\d{2}$/.test(periodo)) return null;
  const [anio, mes] = periodo.split('-').map(Number);
  return { inicio: new Date(Date.UTC(anio, mes - 1, 1)), fin: new Date(Date.UTC(anio, mes, 1)) };
}

export async function rutasGerencia(aplicacion: FastifyInstance): Promise<void> {
  const requerirRol = (aplicacion as any).requerirRol as (roles: string[]) => any;

  aplicacion.get(
    '/gerencia/resumen',
    {
      preHandler: requerirRol([ROL_ADMIN, ROL_GERENTE_ZONA]),
      schema: { tags: ['gerencia'], summary: 'Resumen gerencial consolidado (CU-GE base)' },
    },
    async function (solicitud: any) {
      const periodo =
        solicitud.query && solicitud.query.periodo
          ? String(solicitud.query.periodo)
          : new Date().toISOString().slice(0, 7);
      const rango = rangoPeriodo(periodo);

      // Canal E-Commerce: totales por estado y monto de ventas efectivas.
      const pedidosFilas = await base
        .select({ estado: pedidos.estado, totalCentavos: pedidos.totalCentavos })
        .from(pedidos);
      const canalPorEstado: Record<string, number> = {};
      let canalEfectivoCentavos = 0;
      for (const fila of pedidosFilas) {
        canalPorEstado[fila.estado] = (canalPorEstado[fila.estado] || 0) + 1;
        if (fila.estado === PEDIDO_PAGADO || fila.estado === PEDIDO_ENTREGADO)
          canalEfectivoCentavos += fila.totalCentavos;
      }

      // Ventas B2B: estados y monto pagado del periodo.
      const b2bConsulta = base
        .select({
          estado: ordenesVentaB2b.estado,
          totalCentavos: ordenesVentaB2b.totalCentavos,
          creadoEn: ordenesVentaB2b.creadoEn,
        })
        .from(ordenesVentaB2b);
      const b2bFilas = rango
        ? await b2bConsulta.where(
            and(
              gte(ordenesVentaB2b.creadoEn, rango.inicio),
              lt(ordenesVentaB2b.creadoEn, rango.fin),
            ),
          )
        : await b2bConsulta;
      const b2bPorEstado: Record<string, number> = {};
      let b2bPagadoCentavos = 0;
      for (const fila of b2bFilas) {
        b2bPorEstado[fila.estado] = (b2bPorEstado[fila.estado] || 0) + 1;
        if (fila.estado === VENTA_B2B_PAGADA) b2bPagadoCentavos += fila.totalCentavos;
      }

      // Facturacion: total facturado (sin anuladas), IVA y facturas electronicas emitidas.
      const facturasFilas = await base
        .select({
          estado: facturas.estado,
          baseCentavos: facturas.baseCentavos,
          impuestoCentavos: facturas.impuestoCentavos,
          totalCentavos: facturas.totalCentavos,
          estadoDian: facturas.estadoDian,
        })
        .from(facturas);
      let facturadoCentavos = 0;
      let ivaCentavos = 0;
      let dianEmitidas = 0;
      for (const fila of facturasFilas) {
        if (fila.estado !== FACTURA_ANULADA) {
          facturadoCentavos += fila.totalCentavos;
          ivaCentavos += fila.impuestoCentavos;
        }
        if (fila.estadoDian !== 'no_enviada') dianEmitidas++;
      }

      // Inventario: referencias bajo minimo.
      const stockBajoMinimo = await base
        .select({ total: sql<number>`count(*)::int` })
        .from(inventarioStock)
        .where(sql`cantidad < stock_minimo`);

      // Casos abiertos en proceso.
      const casosAbiertos = await base
        .select({ total: sql<number>`count(*)::int` })
        .from(casos)
        .where(eq(casos.estado, CASO_ABIERTO));
      const casosEnProceso = await base
        .select({ total: sql<number>`count(*)::int` })
        .from(casos)
        .where(eq(casos.estado, CASO_EN_PROCESO));

      // Comisiones del periodo.
      const comisionesFilas = await base
        .select({ estado: comisiones.estado, montoCentavos: comisiones.montoCentavos })
        .from(comisiones)
        .where(eq(comisiones.periodo, periodo));
      let comisionesCalculadasCentavos = 0;
      let comisionesPagadasCentavos = 0;
      for (const fila of comisionesFilas) {
        if (fila.estado === 'pagada') comisionesPagadasCentavos += fila.montoCentavos;
        else comisionesCalculadasCentavos += fila.montoCentavos;
      }

      return {
        data: {
          periodo: periodo,
          canal: {
            porEstado: canalPorEstado,
            totalPedidos: pedidosFilas.length,
            montoEfectivoCentavos: canalEfectivoCentavos,
          },
          b2b: {
            porEstado: b2bPorEstado,
            totalOrdenes: b2bFilas.length,
            montoPagadoCentavos: b2bPagadoCentavos,
          },
          facturacion: {
            totalFacturas: facturasFilas.length,
            facturadoCentavos: facturadoCentavos,
            ivaCentavos: ivaCentavos,
            dianEmitidas: dianEmitidas,
          },
          inventario: { referenciasBajoMinimo: stockBajoMinimo[0] ? stockBajoMinimo[0].total : 0 },
          casos: {
            abiertos: casosAbiertos[0] ? casosAbiertos[0].total : 0,
            enProceso: casosEnProceso[0] ? casosEnProceso[0].total : 0,
          },
          comisiones: {
            calculadasCentavos: comisionesCalculadasCentavos,
            pagadasCentavos: comisionesPagadasCentavos,
          },
        },
      };
    },
  );
}
