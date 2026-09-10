// Servicio de reportes gerenciales del ERP (CU-GE).
// Consolida ventas del canal, ventas B2B, facturacion electronica, inventario, cartera y
// comisiones en un resumen ejecutivo, series mensuales, ranking de productos y exportacion CSV.
// Convencion monetaria: todos los montos viajan en centavos de peso colombiano (COP).
import { and, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { base } from '../../bd/base';
import {
  casos,
  comisiones,
  cuentasPorPagar,
  facturas,
  inventarioStock,
  ordenesVentaB2b,
  ordenVentaB2bArticulos,
  pedidoArticulos,
  pedidos,
  productos,
} from '../../bd/esquema';
import {
  CASO_ABIERTO,
  CASO_EN_PROCESO,
  CUENTA_PENDIENTE,
  DIAN_NO_ENVIADA,
  FACTURA_ANULADA,
  FACTURA_EMITIDA,
  LIMITE_RANKING_DEFECTO,
  LIMITE_RANKING_MAXIMO,
  MESES_SERIE_DEFECTO,
  MESES_SERIE_MAXIMO,
  PEDIDO_ENTREGADO,
  PEDIDO_PAGADO,
  SEPARADOR_CSV,
  VENTA_B2B_PAGADA,
} from '../../dominio/constantes';

// Estados de pedido que cuentan como venta efectiva del canal (CU-GE).
const ESTADOS_VENTA_CANAL = [PEDIDO_PAGADO, PEDIDO_ENTREGADO];
// Marca de orden de bytes para que Excel abra el CSV con acentos correctos.
export const BOM_CSV = '\uFEFF';

/**
 * Convierte un valor agregado de la base de datos a numero.
 * Entrada: valor crudo (los bigint y numeric llegan como texto desde PostgreSQL).
 * Salida: numero seguro; 0 si el valor no es convertible.
 */
export function aNumero(valor: unknown): number {
  if (valor === null || valor === undefined) return 0;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

/**
 * Valida el periodo mensual solicitado (formato AAAA-MM).
 * Entrada: periodo crudo. Salida: periodo valido o null si el formato es incorrecto.
 */
export function normalizarPeriodo(valor: unknown): string | null {
  const texto = String(valor || '').trim();
  if (!texto) return new Date().toISOString().slice(0, 7);
  return /^\d{4}-\d{2}$/.test(texto) ? texto : null;
}

/** Rango [inicio, fin) en UTC del periodo mensual (CU-GE). */
export function rangoPeriodo(periodo: string): { inicio: Date; fin: Date } | null {
  if (!/^\d{4}-\d{2}$/.test(periodo)) return null;
  const partes = periodo.split('-').map(Number);
  const anio = partes[0];
  const mes = partes[1];
  if (mes < 1 || mes > 12) return null;
  return { inicio: new Date(Date.UTC(anio, mes - 1, 1)), fin: new Date(Date.UTC(anio, mes, 1)) };
}

/**
 * Normaliza la cantidad de meses de la serie (1..MESES_SERIE_MAXIMO).
 * Entrada: valor crudo de la consulta. Salida: entero dentro del rango permitido.
 */
export function normalizarMeses(valor: unknown): number {
  const meses = Number(valor);
  if (!Number.isInteger(meses) || meses < 1) return MESES_SERIE_DEFECTO;
  return Math.min(meses, MESES_SERIE_MAXIMO);
}

/**
 * Normaliza el tope del ranking de productos (1..LIMITE_RANKING_MAXIMO).
 */
export function normalizarLimite(valor: unknown): number {
  const limite = Number(valor);
  if (!Number.isInteger(limite) || limite < 1) return LIMITE_RANKING_DEFECTO;
  return Math.min(limite, LIMITE_RANKING_MAXIMO);
}

/**
 * Lista los periodos mensuales de la serie, del mas antiguo al mas reciente (CU-GE).
 * Entrada: cantidad de meses y fecha de corte. Salida: arreglo de periodos AAAA-MM.
 */
export function periodosSerie(meses: number, desde: Date = new Date()): string[] {
  const periodos: string[] = [];
  for (let desplazamiento = meses - 1; desplazamiento >= 0; desplazamiento--) {
    const fecha = new Date(
      Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth() - desplazamiento, 1),
    );
    periodos.push(fecha.toISOString().slice(0, 7));
  }
  return periodos;
}

/** Rango [inicio, fin) que cubre la serie completa de meses. */
export function rangoSerie(meses: number, desde: Date = new Date()): { inicio: Date; fin: Date } {
  const periodos = periodosSerie(meses, desde);
  const primero = rangoPeriodo(periodos[0]) as { inicio: Date; fin: Date };
  const ultimo = rangoPeriodo(periodos[periodos.length - 1]) as { inicio: Date; fin: Date };
  return { inicio: primero.inicio, fin: ultimo.fin };
}

/**
 * Formatea un monto en centavos para el CSV exportado.
 * Entrada: centavos. Salida: importe con dos decimales y coma decimal (1234,56), sin miles.
 */
export function formatearMontoCsv(centavos: number): string {
  return (aNumero(centavos) / 100).toFixed(2).replace('.', ',');
}

/** Escapa un campo de CSV cuando contiene el separador, comillas o saltos de linea. */
export function escaparCampoCsv(valor: unknown): string {
  const texto = valor === null || valor === undefined ? '' : String(valor);
  if (
    texto.includes(SEPARADOR_CSV) ||
    texto.includes('"') ||
    texto.includes('\n') ||
    texto.includes('\r')
  )
    return '"' + texto.replace(/"/g, '""') + '"';
  return texto;
}

/**
 * Construye el contenido CSV a partir de encabezados y filas (exportacion gerencial).
 * Entrada: encabezados y filas (valores crudos). Salida: texto CSV con BOM y fin de linea CRLF.
 */
export function construirCsv(encabezados: string[], filas: (string | number)[][]): string {
  const lineas = [encabezados.map(escaparCampoCsv).join(SEPARADOR_CSV)];
  for (const fila of filas) {
    lineas.push(fila.map(escaparCampoCsv).join(SEPARADOR_CSV));
  }
  return BOM_CSV + lineas.join('\r\n') + '\r\n';
}

/**
 * Resumen gerencial consolidado del periodo (CU-GE).
 * Entrada: periodo AAAA-MM. Salida: totales del canal, B2B, facturacion, inventario,
 * casos y comisiones del periodo.
 */
export async function resumenGerencial(periodo: string) {
  const rango = rangoPeriodo(periodo);

  // Canal E-Commerce: totales por estado y monto de ventas efectivas.
  const pedidosFilas = await base
    .select({ estado: pedidos.estado, totalCentavos: pedidos.totalCentavos })
    .from(pedidos);
  const canalPorEstado: Record<string, number> = {};
  let canalEfectivoCentavos = 0;
  for (const fila of pedidosFilas) {
    canalPorEstado[fila.estado] = (canalPorEstado[fila.estado] || 0) + 1;
    if ((ESTADOS_VENTA_CANAL as string[]).includes(fila.estado))
      canalEfectivoCentavos += aNumero(fila.totalCentavos);
  }

  // Ventas B2B: estados y monto pagado del periodo.
  const consultaB2b = base
    .select({
      estado: ordenesVentaB2b.estado,
      totalCentavos: ordenesVentaB2b.totalCentavos,
      creadoEn: ordenesVentaB2b.creadoEn,
    })
    .from(ordenesVentaB2b);
  const b2bFilas = rango
    ? await consultaB2b.where(
        and(gte(ordenesVentaB2b.creadoEn, rango.inicio), lt(ordenesVentaB2b.creadoEn, rango.fin)),
      )
    : await consultaB2b;
  const b2bPorEstado: Record<string, number> = {};
  let b2bPagadoCentavos = 0;
  for (const fila of b2bFilas) {
    b2bPorEstado[fila.estado] = (b2bPorEstado[fila.estado] || 0) + 1;
    if (fila.estado === VENTA_B2B_PAGADA) b2bPagadoCentavos += aNumero(fila.totalCentavos);
  }

  // Facturacion: total facturado (sin anuladas), IVA y facturas electronicas emitidas.
  const facturasFilas = await base
    .select({
      estado: facturas.estado,
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
      facturadoCentavos += aNumero(fila.totalCentavos);
      ivaCentavos += aNumero(fila.impuestoCentavos);
    }
    if (fila.estadoDian !== DIAN_NO_ENVIADA) dianEmitidas++;
  }

  // Inventario: referencias bajo minimo.
  const stockBajoMinimo = await base
    .select({ total: sql<number>`count(*)::int` })
    .from(inventarioStock)
    .where(sql`cantidad < stock_minimo`);

  // Casos abiertos y en proceso.
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
    if (fila.estado === 'pagada') comisionesPagadasCentavos += aNumero(fila.montoCentavos);
    else comisionesCalculadasCentavos += aNumero(fila.montoCentavos);
  }

  return {
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
    inventario: { referenciasBajoMinimo: aNumero(stockBajoMinimo[0] && stockBajoMinimo[0].total) },
    casos: {
      abiertos: aNumero(casosAbiertos[0] && casosAbiertos[0].total),
      enProceso: aNumero(casosEnProceso[0] && casosEnProceso[0].total),
    },
    comisiones: {
      calculadasCentavos: comisionesCalculadasCentavos,
      pagadasCentavos: comisionesPagadasCentavos,
    },
  };
}

/**
 * Serie mensual de ventas y facturacion (CU-GE, reportes avanzados).
 * Entrada: cantidad de meses y fecha de corte. Salida: un punto por mes con canal, B2B y
 * facturacion; los meses sin movimientos aparecen en cero para que la grafica sea continua.
 */
export async function seriesMensuales(meses: number, desde: Date = new Date()) {
  const periodos = periodosSerie(meses, desde);
  const rango = rangoSerie(meses, desde);

  const canalFilas = await base
    .select({
      periodo: sql<string>`to_char(${pedidos.creadoEn}, 'YYYY-MM')`,
      pedidos: sql<number>`count(*)::int`,
      montoCentavos: sql<string>`coalesce(sum(case when ${pedidos.estado} in ('${sql.raw(
        ESTADOS_VENTA_CANAL.join("','"),
      )}') then ${pedidos.totalCentavos} else 0 end), 0)::bigint`,
    })
    .from(pedidos)
    .where(and(gte(pedidos.creadoEn, rango.inicio), lt(pedidos.creadoEn, rango.fin)))
    .groupBy(sql`to_char(${pedidos.creadoEn}, 'YYYY-MM')`);

  const b2bFilas = await base
    .select({
      periodo: sql<string>`to_char(${ordenesVentaB2b.creadoEn}, 'YYYY-MM')`,
      ordenes: sql<number>`count(*)::int`,
      montoCentavos: sql<string>`coalesce(sum(case when ${ordenesVentaB2b.estado} = '${sql.raw(
        VENTA_B2B_PAGADA,
      )}' then ${ordenesVentaB2b.totalCentavos} else 0 end), 0)::bigint`,
    })
    .from(ordenesVentaB2b)
    .where(
      and(gte(ordenesVentaB2b.creadoEn, rango.inicio), lt(ordenesVentaB2b.creadoEn, rango.fin)),
    )
    .groupBy(sql`to_char(${ordenesVentaB2b.creadoEn}, 'YYYY-MM')`);

  const facturaFilas = await base
    .select({
      periodo: sql<string>`to_char(${facturas.creadoEn}, 'YYYY-MM')`,
      facturas: sql<number>`count(*)::int`,
      totalCentavos: sql<string>`coalesce(sum(${facturas.totalCentavos}), 0)::bigint`,
      ivaCentavos: sql<string>`coalesce(sum(${facturas.impuestoCentavos}), 0)::bigint`,
    })
    .from(facturas)
    .where(
      and(
        gte(facturas.creadoEn, rango.inicio),
        lt(facturas.creadoEn, rango.fin),
        sql`${facturas.estado} <> '${sql.raw(FACTURA_ANULADA)}'`,
      ),
    )
    .groupBy(sql`to_char(${facturas.creadoEn}, 'YYYY-MM')`);

  const porPeriodo = new Map<string, any>();
  for (const periodo of periodos) {
    porPeriodo.set(periodo, {
      periodo: periodo,
      pedidos: 0,
      canalCentavos: 0,
      ordenesB2b: 0,
      b2bCentavos: 0,
      facturas: 0,
      facturadoCentavos: 0,
      ivaCentavos: 0,
    });
  }
  for (const fila of canalFilas) {
    const punto = porPeriodo.get(fila.periodo);
    if (!punto) continue;
    punto.pedidos = aNumero(fila.pedidos);
    punto.canalCentavos = aNumero(fila.montoCentavos);
  }
  for (const fila of b2bFilas) {
    const punto = porPeriodo.get(fila.periodo);
    if (!punto) continue;
    punto.ordenesB2b = aNumero(fila.ordenes);
    punto.b2bCentavos = aNumero(fila.montoCentavos);
  }
  for (const fila of facturaFilas) {
    const punto = porPeriodo.get(fila.periodo);
    if (!punto) continue;
    punto.facturas = aNumero(fila.facturas);
    punto.facturadoCentavos = aNumero(fila.totalCentavos);
    punto.ivaCentavos = aNumero(fila.ivaCentavos);
  }
  const serie = periodos.map(function (periodo) {
    const punto = porPeriodo.get(periodo);
    return {
      ...punto,
      totalCentavos: punto.canalCentavos + punto.b2bCentavos + punto.facturadoCentavos,
    };
  });
  const totales = serie.reduce(
    function (acumulado: any, punto: any) {
      acumulado.canalCentavos += punto.canalCentavos;
      acumulado.b2bCentavos += punto.b2bCentavos;
      acumulado.facturadoCentavos += punto.facturadoCentavos;
      acumulado.ivaCentavos += punto.ivaCentavos;
      return acumulado;
    },
    { canalCentavos: 0, b2bCentavos: 0, facturadoCentavos: 0, ivaCentavos: 0 },
  );
  return { meses: meses, serie: serie, totales: totales };
}

/**
 * Ranking de productos por unidades vendidas (CU-GE).
 * Entrada: periodo AAAA-MM y tope. Salida: productos ordenados por unidades con el
 * detalle de unidades y monto por canal de venta (E-Commerce y B2B pagado).
 */
export async function rankingProductos(periodo: string, limite: number) {
  const rango = rangoPeriodo(periodo);
  const consultaCanal = base
    .select({
      productoId: pedidoArticulos.productoId,
      unidades: sql<number>`sum(${pedidoArticulos.cantidad})::int`,
      montoCentavos: sql<string>`sum(${pedidoArticulos.cantidad} * ${pedidoArticulos.precioUnitarioCentavos})::bigint`,
    })
    .from(pedidoArticulos)
    .innerJoin(pedidos, eq(pedidoArticulos.pedidoId, pedidos.id))
    .where(
      and(
        sql`${pedidos.estado} in ('${sql.raw(ESTADOS_VENTA_CANAL.join("','"))}')`,
        rango ? gte(pedidos.creadoEn, rango.inicio) : undefined,
        rango ? lt(pedidos.creadoEn, rango.fin) : undefined,
      ),
    )
    .groupBy(pedidoArticulos.productoId);

  const consultaB2b = base
    .select({
      productoId: ordenVentaB2bArticulos.productoId,
      unidades: sql<number>`sum(${ordenVentaB2bArticulos.cantidad})::int`,
      montoCentavos: sql<string>`sum(${ordenVentaB2bArticulos.subtotalCentavos})::bigint`,
    })
    .from(ordenVentaB2bArticulos)
    .innerJoin(ordenesVentaB2b, eq(ordenVentaB2bArticulos.ordenId, ordenesVentaB2b.id))
    .where(
      and(
        eq(ordenesVentaB2b.estado, VENTA_B2B_PAGADA),
        rango ? gte(ordenesVentaB2b.creadoEn, rango.inicio) : undefined,
        rango ? lt(ordenesVentaB2b.creadoEn, rango.fin) : undefined,
      ),
    )
    .groupBy(ordenVentaB2bArticulos.productoId);

  const canalFilas = await consultaCanal;
  const b2bFilas = await consultaB2b;
  const acumulado = new Map<number, any>();
  function acumular(fila: any, origen: string) {
    const actual = acumulado.get(fila.productoId) || {
      productoId: fila.productoId,
      unidadesCanal: 0,
      montoCanalCentavos: 0,
      unidadesB2b: 0,
      montoB2bCentavos: 0,
    };
    if (origen === 'canal') {
      actual.unidadesCanal += aNumero(fila.unidades);
      actual.montoCanalCentavos += aNumero(fila.montoCentavos);
    } else {
      actual.unidadesB2b += aNumero(fila.unidades);
      actual.montoB2bCentavos += aNumero(fila.montoCentavos);
    }
    acumulado.set(fila.productoId, actual);
  }
  for (const fila of canalFilas) acumular(fila, 'canal');
  for (const fila of b2bFilas) acumular(fila, 'b2b');
  const ids = Array.from(acumulado.keys());
  if (!ids.length) return { periodo: periodo, productos: [] };
  const nombres = await base
    .select({ id: productos.id, nombre: productos.nombre })
    .from(productos)
    .where(inArray(productos.id, ids));
  const nombrePorId = new Map(
    nombres.map(function (fila) {
      return [fila.id, fila.nombre];
    }),
  );
  const lista = Array.from(acumulado.values()).map(function (fila) {
    return {
      productoId: fila.productoId,
      productoNombre: nombrePorId.get(fila.productoId) || 'Producto ' + fila.productoId,
      unidades: fila.unidadesCanal + fila.unidadesB2b,
      montoCentavos: fila.montoCanalCentavos + fila.montoB2bCentavos,
      unidadesCanal: fila.unidadesCanal,
      montoCanalCentavos: fila.montoCanalCentavos,
      unidadesB2b: fila.unidadesB2b,
      montoB2bCentavos: fila.montoB2bCentavos,
    };
  });
  lista.sort(function (a, b) {
    return b.unidades - a.unidades || b.montoCentavos - a.montoCentavos;
  });
  return { periodo: periodo, productos: lista.slice(0, limite) };
}

/**
 * Cartera del ERP (CU-GE): cuentas por pagar pendientes y facturas por cobrar.
 * Salida: montos y conteos, separando lo vencido de lo vigente a la fecha de corte.
 */
export async function cartera(ahora: Date = new Date()) {
  const porPagarFilas = await base
    .select({
      montoCentavos: cuentasPorPagar.montoCentavos,
      venceEn: cuentasPorPagar.venceEn,
    })
    .from(cuentasPorPagar)
    .where(eq(cuentasPorPagar.estado, CUENTA_PENDIENTE));
  let porPagarCentavos = 0;
  let porPagarVencidoCentavos = 0;
  let porPagarVencidas = 0;
  for (const fila of porPagarFilas) {
    const monto = aNumero(fila.montoCentavos);
    porPagarCentavos += monto;
    if (fila.venceEn && new Date(fila.venceEn).getTime() < ahora.getTime()) {
      porPagarVencidoCentavos += monto;
      porPagarVencidas++;
    }
  }
  const porCobrarFilas = await base
    .select({
      montoCentavos: facturas.totalCentavos,
      creadoEn: facturas.creadoEn,
    })
    .from(facturas)
    .where(eq(facturas.estado, FACTURA_EMITIDA));
  let porCobrarCentavos = 0;
  for (const fila of porCobrarFilas) {
    porCobrarCentavos += aNumero(fila.montoCentavos);
  }
  return {
    porPagar: {
      totalCentavos: porPagarCentavos,
      vencidoCentavos: porPagarVencidoCentavos,
      cuentas: porPagarFilas.length,
      vencidas: porPagarVencidas,
    },
    porCobrar: {
      totalCentavos: porCobrarCentavos,
      facturas: porCobrarFilas.length,
    },
    generadoEn: ahora.toISOString(),
  };
}

/**
 * Construye el CSV de la serie mensual (exportacion gerencial).
 */
export function csvSeries(datos: any): string {
  const filas = datos.serie.map(function (punto: any) {
    return [
      punto.periodo,
      punto.pedidos,
      formatearMontoCsv(punto.canalCentavos),
      punto.ordenesB2b,
      formatearMontoCsv(punto.b2bCentavos),
      punto.facturas,
      formatearMontoCsv(punto.facturadoCentavos),
      formatearMontoCsv(punto.ivaCentavos),
      formatearMontoCsv(punto.totalCentavos),
    ];
  });
  return construirCsv(
    [
      'Periodo',
      'Pedidos canal',
      'Venta canal (COP)',
      'Ordenes B2B',
      'Venta B2B (COP)',
      'Facturas',
      'Facturado (COP)',
      'IVA (COP)',
      'Total (COP)',
    ],
    filas,
  );
}

/**
 * Construye el CSV del ranking de productos (exportacion gerencial).
 */
export function csvRanking(datos: any): string {
  const filas = datos.productos.map(function (producto: any) {
    return [
      producto.productoId,
      producto.productoNombre,
      producto.unidades,
      formatearMontoCsv(producto.montoCentavos),
      producto.unidadesCanal,
      formatearMontoCsv(producto.montoCanalCentavos),
      producto.unidadesB2b,
      formatearMontoCsv(producto.montoB2bCentavos),
    ];
  });
  return construirCsv(
    [
      'Producto ID',
      'Producto',
      'Unidades',
      'Monto (COP)',
      'Unidades canal',
      'Monto canal (COP)',
      'Unidades B2B',
      'Monto B2B (COP)',
    ],
    filas,
  );
}

/**
 * Construye el CSV de la cartera (exportacion gerencial).
 */
export function csvCartera(datos: any): string {
  return construirCsv(
    ['Concepto', 'Cuentas', 'Monto (COP)'],
    [
      [
        'Cuentas por pagar pendientes',
        datos.porPagar.cuentas,
        formatearMontoCsv(datos.porPagar.totalCentavos),
      ],
      [
        'Cuentas por pagar vencidas',
        datos.porPagar.vencidas,
        formatearMontoCsv(datos.porPagar.vencidoCentavos),
      ],
      [
        'Facturas por cobrar',
        datos.porCobrar.facturas,
        formatearMontoCsv(datos.porCobrar.totalCentavos),
      ],
    ],
  );
}

/**
 * Construye el CSV del resumen ejecutivo (exportacion gerencial).
 */
export function csvResumen(datos: any): string {
  return construirCsv(
    ['Indicador', 'Valor'],
    [
      ['Periodo', datos.periodo],
      ['Pedidos del canal', datos.canal.totalPedidos],
      ['Venta efectiva del canal (COP)', formatearMontoCsv(datos.canal.montoEfectivoCentavos)],
      ['Ordenes B2B del periodo', datos.b2b.totalOrdenes],
      ['Venta B2B pagada (COP)', formatearMontoCsv(datos.b2b.montoPagadoCentavos)],
      ['Facturas emitidas', datos.facturacion.totalFacturas],
      ['Total facturado (COP)', formatearMontoCsv(datos.facturacion.facturadoCentavos)],
      ['IVA facturado (COP)', formatearMontoCsv(datos.facturacion.ivaCentavos)],
      ['Facturas electronicas DIAN', datos.facturacion.dianEmitidas],
      ['Referencias bajo minimo', datos.inventario.referenciasBajoMinimo],
      ['Casos abiertos', datos.casos.abiertos],
      ['Casos en proceso', datos.casos.enProceso],
      ['Comisiones calculadas (COP)', formatearMontoCsv(datos.comisiones.calculadasCentavos)],
      ['Comisiones pagadas (COP)', formatearMontoCsv(datos.comisiones.pagadasCentavos)],
    ],
  );
}
