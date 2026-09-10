// Servicio de Facturacion y Contabilidad (CU-FC-001..004, CU-CT-001, F5).
// Reglas: consecutivo fiscal, IVA/retenciones con tarifa en puntos basicos (0..100%),
// inmutabilidad tras emitir (correcciones por nota credito/debito) y asientos cuadrados.
import { createHash } from 'crypto';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { base } from '../../bd/base';
import {
  asientoLineas,
  asientosContables,
  clientesEmpresa,
  cuentasContables,
  facturas,
  impuestos,
  notasFactura,
  ordenesVentaB2b,
} from '../../bd/esquema';
import {
  DIAN_ACEPTADA,
  DIAN_NO_ENVIADA,
  ESTADO_ACTIVO,
  ESTADO_INACTIVO,
  EVENTO_FACTURA_EMITIDA,
  FACTURA_ANULADA,
  FACTURA_EMITIDA,
  FACTURA_PAGADA,
  NATURALEZA_CREDITO,
  NATURALEZA_DEBITO,
  NOTA_CREDITO,
  NOTA_DEBITO,
  TARIFA_BPS_MAXIMA,
  TIPOS_IMPUESTO,
} from '../../dominio/constantes';
import { encolarEvento } from '../eventos/buzon.servicio';

export type ResultadoFinanzas = {
  ok: boolean;
  codigoEstado?: number;
  error?: string;
  datos?: unknown;
};
function limpiar(valor: unknown): string {
  return String(valor || '').trim();
}
function like(columna: unknown, patron: string) {
  return sql`${columna} like ${patron}`;
}

// ---------------------------------- Impuestos (CU-FC-004) ----------------------------------
export async function listarImpuestos() {
  return base.select().from(impuestos).orderBy(asc(impuestos.nombre));
}
export async function crearImpuesto(datos: any): Promise<ResultadoFinanzas> {
  const nombre = limpiar(datos.nombre);
  const tipo = TIPOS_IMPUESTO.includes(datos.tipo) ? datos.tipo : null;
  const tarifaBps = Number(datos.tarifaBps);
  if (!nombre || !tipo) return { ok: false, codigoEstado: 400, error: 'datos_incompletos' };
  if (!Number.isInteger(tarifaBps) || tarifaBps < 0 || tarifaBps > TARIFA_BPS_MAXIMA)
    return { ok: false, codigoEstado: 400, error: 'tarifa_fuera_de_rango' };
  const existente = await base
    .select()
    .from(impuestos)
    .where(eq(impuestos.nombre, nombre))
    .limit(1);
  if (existente[0]) return { ok: false, codigoEstado: 409, error: 'impuesto_ya_existe' };
  const [creado] = await base
    .insert(impuestos)
    .values({ nombre: nombre, tipo: tipo, tarifaBps: tarifaBps, estado: ESTADO_ACTIVO })
    .returning({ id: impuestos.id, nombre: impuestos.nombre, tarifaBps: impuestos.tarifaBps });
  return { ok: true, datos: creado };
}
export async function inactivarImpuesto(id: number): Promise<ResultadoFinanzas> {
  const filas = await base.select().from(impuestos).where(eq(impuestos.id, id)).limit(1);
  if (!filas[0]) return { ok: false, codigoEstado: 404, error: 'impuesto_no_encontrado' };
  await base
    .update(impuestos)
    .set({ estado: ESTADO_INACTIVO, actualizadoEn: new Date() })
    .where(eq(impuestos.id, id));
  return { ok: true, datos: { id: id } };
}

// -------------------------------- Cuentas contables (CU-CT-001) --------------------------------
export async function listarCuentas() {
  return base.select().from(cuentasContables).orderBy(asc(cuentasContables.codigo));
}
export async function crearCuenta(datos: any): Promise<ResultadoFinanzas> {
  const codigo = limpiar(datos.codigo);
  const nombre = limpiar(datos.nombre);
  const naturaleza =
    datos.naturaleza === NATURALEZA_CREDITO ? NATURALEZA_CREDITO : NATURALEZA_DEBITO;
  if (!codigo || !nombre) return { ok: false, codigoEstado: 400, error: 'datos_incompletos' };
  const existente = await base
    .select()
    .from(cuentasContables)
    .where(eq(cuentasContables.codigo, codigo))
    .limit(1);
  if (existente[0]) return { ok: false, codigoEstado: 409, error: 'codigo_ya_existe' };
  const [creada] = await base
    .insert(cuentasContables)
    .values({ codigo: codigo, nombre: nombre, naturaleza: naturaleza, estado: ESTADO_ACTIVO })
    .returning({ id: cuentasContables.id, codigo: cuentasContables.codigo });
  return { ok: true, datos: creada };
}
export async function inactivarCuenta(id: number): Promise<ResultadoFinanzas> {
  const filas = await base
    .select()
    .from(cuentasContables)
    .where(eq(cuentasContables.id, id))
    .limit(1);
  if (!filas[0]) return { ok: false, codigoEstado: 404, error: 'cuenta_no_encontrada' };
  const movimientos = await base
    .select()
    .from(asientoLineas)
    .where(eq(asientoLineas.cuentaId, id))
    .limit(1);
  if (movimientos[0]) return { ok: false, codigoEstado: 409, error: 'cuenta_con_movimientos' };
  await base
    .update(cuentasContables)
    .set({ estado: ESTADO_INACTIVO, actualizadoEn: new Date() })
    .where(eq(cuentasContables.id, id));
  return { ok: true, datos: { id: id } };
}

// ---------------------------------- Asientos (CU-CT-002 base) ----------------------------------
async function proximaReferenciaAsiento(): Promise<string> {
  const anio = new Date().getFullYear();
  const filas = await base
    .select({ referencia: asientosContables.referencia })
    .from(asientosContables)
    .where(like(asientosContables.referencia, 'AS-' + anio + '-%'))
    .orderBy(desc(asientosContables.referencia))
    .limit(1);
  const ultimo = filas[0] ? parseInt(String(filas[0].referencia).split('-').pop() || '0', 10) : 0;
  return 'AS-' + anio + '-' + String(ultimo + 1).padStart(6, '0');
}
export async function listarAsientos() {
  return base
    .select({
      id: asientosContables.id,
      referencia: asientosContables.referencia,
      descripcion: asientosContables.descripcion,
      fecha: asientosContables.fecha,
    })
    .from(asientosContables)
    .orderBy(desc(asientosContables.id));
}
export async function crearAsiento(datos: any): Promise<ResultadoFinanzas> {
  const descripcion = limpiar(datos.descripcion);
  const lineas = Array.isArray(datos.lineas) ? datos.lineas : [];
  if (!descripcion || lineas.length < 2)
    return { ok: false, codigoEstado: 400, error: 'datos_incompletos' };
  let debitos = 0;
  let creditos = 0;
  const normalizadas: { cuentaId: number; debitoCentavos: number; creditoCentavos: number }[] = [];
  for (const linea of lineas) {
    const cuentaId = Number(linea.cuentaId);
    const debito = Math.max(Number(linea.debitoCentavos) || 0, 0);
    const credito = Math.max(Number(linea.creditoCentavos) || 0, 0);
    if (!cuentaId || (debito === 0 && credito === 0))
      return { ok: false, codigoEstado: 400, error: 'linea_invalida' };
    const cuenta = await base
      .select()
      .from(cuentasContables)
      .where(eq(cuentasContables.id, cuentaId))
      .limit(1);
    if (!cuenta[0] || cuenta[0].estado !== ESTADO_ACTIVO)
      return { ok: false, codigoEstado: 409, error: 'cuenta_inactiva' };
    debitos += debito;
    creditos += credito;
    normalizadas.push({ cuentaId: cuentaId, debitoCentavos: debito, creditoCentavos: credito });
  }
  if (debitos !== creditos) return { ok: false, codigoEstado: 400, error: 'asiento_descuadrado' };
  const referencia = await proximaReferenciaAsiento();
  const [asiento] = await base
    .insert(asientosContables)
    .values({
      referencia: referencia,
      descripcion: descripcion,
      fecha: datos.fecha ? new Date(datos.fecha) : new Date(),
    })
    .returning({ id: asientosContables.id, referencia: asientosContables.referencia });
  await base.insert(asientoLineas).values(
    normalizadas.map(function (l) {
      return {
        asientoId: asiento.id,
        cuentaId: l.cuentaId,
        debitoCentavos: l.debitoCentavos,
        creditoCentavos: l.creditoCentavos,
      };
    }),
  );
  return {
    ok: true,
    datos: { id: asiento.id, referencia: asiento.referencia, totalCentavos: debitos },
  };
}

// ---------------------------------- Facturas (CU-FC-001/002/003) ----------------------------------
async function proximoNumeroFactura(): Promise<string> {
  const anio = new Date().getFullYear();
  const filas = await base
    .select({ numero: facturas.numero })
    .from(facturas)
    .where(like(facturas.numero, 'FV-' + anio + '-%'))
    .orderBy(desc(facturas.numero))
    .limit(1);
  const ultimo = filas[0] ? parseInt(String(filas[0].numero).split('-').pop() || '0', 10) : 0;
  return 'FV-' + anio + '-' + String(ultimo + 1).padStart(6, '0');
}

/** Ordenes B2B confirmadas/pagadas aun sin factura (para facturar desde el ERP). */
export async function ordenesPorFacturar() {
  const facturadas = await base.select({ ordenB2bId: facturas.ordenB2bId }).from(facturas);
  const ids = facturadas
    .map(function (f) {
      return f.ordenB2bId;
    })
    .filter(function (v) {
      return v !== null;
    });
  const filas = await base
    .select({
      id: ordenesVentaB2b.id,
      folio: ordenesVentaB2b.folio,
      clienteEmpresaId: clientesEmpresa.id,
      clienteRazonSocial: clientesEmpresa.razonSocial,
      totalCentavos: ordenesVentaB2b.totalCentavos,
      estado: ordenesVentaB2b.estado,
    })
    .from(ordenesVentaB2b)
    .innerJoin(clientesEmpresa, eq(ordenesVentaB2b.clienteEmpresaId, clientesEmpresa.id));
  return filas.filter(function (f) {
    return ids.indexOf(f.id) === -1;
  });
}

export async function emitirFactura(datos: any): Promise<ResultadoFinanzas> {
  let clienteEmpresaId = Number(datos.clienteEmpresaId);
  let baseCentavos = Number(datos.baseCentavos) || 0;
  const ordenB2bId = datos.ordenB2bId ? Number(datos.ordenB2bId) : null;
  const impuestoId = datos.impuestoId ? Number(datos.impuestoId) : null;
  if (ordenB2bId) {
    const orden = await base
      .select()
      .from(ordenesVentaB2b)
      .where(eq(ordenesVentaB2b.id, ordenB2bId))
      .limit(1);
    if (!orden[0]) return { ok: false, codigoEstado: 404, error: 'orden_no_encontrada' };
    const yaFacturada = await base
      .select()
      .from(facturas)
      .where(eq(facturas.ordenB2bId, ordenB2bId))
      .limit(1);
    if (yaFacturada[0]) return { ok: false, codigoEstado: 409, error: 'orden_ya_facturada' };
    clienteEmpresaId = orden[0].clienteEmpresaId;
    baseCentavos = orden[0].totalCentavos;
  }
  if (!clienteEmpresaId || baseCentavos <= 0)
    return { ok: false, codigoEstado: 400, error: 'datos_incompletos' };
  const cliente = await base
    .select()
    .from(clientesEmpresa)
    .where(eq(clientesEmpresa.id, clienteEmpresaId))
    .limit(1);
  if (!cliente[0]) return { ok: false, codigoEstado: 404, error: 'cliente_no_encontrado' };
  let impuestoCentavos = 0;
  if (impuestoId) {
    const impuesto = await base
      .select()
      .from(impuestos)
      .where(eq(impuestos.id, impuestoId))
      .limit(1);
    if (!impuesto[0] || impuesto[0].estado !== ESTADO_ACTIVO)
      return { ok: false, codigoEstado: 409, error: 'impuesto_inactivo' };
    // Redondeo a dos decimales estrictos en COP (RN-FC-02).
    impuestoCentavos = Math.round((baseCentavos * impuesto[0].tarifaBps) / TARIFA_BPS_MAXIMA);
  }
  const total = baseCentavos + impuestoCentavos;
  const numero = await proximoNumeroFactura();
  const [factura] = await base
    .insert(facturas)
    .values({
      numero: numero,
      clienteEmpresaId: clienteEmpresaId,
      ordenB2bId: ordenB2bId,
      impuestoId: impuestoId,
      baseCentavos: baseCentavos,
      impuestoCentavos: impuestoCentavos,
      totalCentavos: total,
      estado: FACTURA_EMITIDA,
    })
    .returning({
      id: facturas.id,
      numero: facturas.numero,
      totalCentavos: facturas.totalCentavos,
      estado: facturas.estado,
    });
  await encolarEvento(base, {
    tipoAgregado: 'Factura',
    idAgregado: numero,
    tipoEvento: EVENTO_FACTURA_EMITIDA,
    claveIdempotencia: numero,
    datos: { numero: numero, clienteId: clienteEmpresaId, totalCentavos: total },
  });
  return { ok: true, datos: factura };
}

export async function listarFacturas() {
  return base
    .select({
      id: facturas.id,
      numero: facturas.numero,
      clienteRazonSocial: clientesEmpresa.razonSocial,
      baseCentavos: facturas.baseCentavos,
      impuestoCentavos: facturas.impuestoCentavos,
      totalCentavos: facturas.totalCentavos,
      estado: facturas.estado,
      estadoDian: facturas.estadoDian,
      cufe: facturas.cufe,
      creadoEn: facturas.creadoEn,
    })
    .from(facturas)
    .innerJoin(clientesEmpresa, eq(facturas.clienteEmpresaId, clientesEmpresa.id))
    .orderBy(desc(facturas.id));
}

/**
 * Emite la factura electronica DIAN (simulada): genera el CUFE (hash fiscal) y marca
 * el estado de envio. Inmutable: una factura ya emitida a la DIAN no se re-emite (RN-FC-03).
 */
export async function emitirFacturaDian(id: number): Promise<ResultadoFinanzas> {
  const filas = await base.select().from(facturas).where(eq(facturas.id, id)).limit(1);
  if (!filas[0]) return { ok: false, codigoEstado: 404, error: 'factura_no_encontrada' };
  const factura = filas[0];
  if (factura.estado === FACTURA_ANULADA)
    return { ok: false, codigoEstado: 409, error: 'factura_anulada' };
  if (factura.estadoDian !== DIAN_NO_ENVIADA)
    return { ok: false, codigoEstado: 409, error: 'factura_ya_enviada_dian' };
  const cliente = await base
    .select({ nit: clientesEmpresa.nit })
    .from(clientesEmpresa)
    .where(eq(clientesEmpresa.id, factura.clienteEmpresaId))
    .limit(1);
  const sello = [
    factura.numero,
    cliente[0] ? cliente[0].nit : '',
    String(factura.totalCentavos),
    factura.creadoEn.toISOString(),
  ].join('|');
  const cufe = createHash('sha256').update(sello).digest('hex');
  await base
    .update(facturas)
    .set({ cufe: cufe, estadoDian: DIAN_ACEPTADA, dianEmitidaEn: new Date() })
    .where(eq(facturas.id, id));
  return { ok: true, datos: { id: id, cufe: cufe, estadoDian: DIAN_ACEPTADA } };
}
export async function obtenerFactura(id: number) {
  const fila = await base.select().from(facturas).where(eq(facturas.id, id)).limit(1);
  if (!fila[0]) return null;
  const notas = await base
    .select()
    .from(notasFactura)
    .where(eq(notasFactura.facturaId, id))
    .orderBy(desc(notasFactura.id));
  return { ...fila[0], notas: notas };
}
export async function pagarFactura(id: number): Promise<ResultadoFinanzas> {
  const filas = await base.select().from(facturas).where(eq(facturas.id, id)).limit(1);
  if (!filas[0]) return { ok: false, codigoEstado: 404, error: 'factura_no_encontrada' };
  if (filas[0].estado !== FACTURA_EMITIDA)
    return { ok: false, codigoEstado: 409, error: 'factura_no_pagable' };
  await base.update(facturas).set({ estado: FACTURA_PAGADA }).where(eq(facturas.id, id));
  return { ok: true, datos: { id: id, estado: FACTURA_PAGADA } };
}
export async function anularFactura(id: number): Promise<ResultadoFinanzas> {
  const filas = await base.select().from(facturas).where(eq(facturas.id, id)).limit(1);
  if (!filas[0]) return { ok: false, codigoEstado: 404, error: 'factura_no_encontrada' };
  if (filas[0].estado !== FACTURA_EMITIDA)
    return { ok: false, codigoEstado: 409, error: 'factura_no_anulable' };
  await base
    .update(facturas)
    .set({ estado: FACTURA_ANULADA, anuladoEn: new Date() })
    .where(eq(facturas.id, id));
  return { ok: true, datos: { id: id, estado: FACTURA_ANULADA } };
}

export async function crearNotaFactura(datos: any): Promise<ResultadoFinanzas> {
  const facturaId = Number(datos.facturaId);
  const tipo =
    datos.tipo === NOTA_DEBITO ? NOTA_DEBITO : datos.tipo === NOTA_CREDITO ? NOTA_CREDITO : null;
  const montoCentavos = Number(datos.montoCentavos);
  const motivo = limpiar(datos.motivo);
  if (!facturaId || !tipo || !motivo || !Number.isInteger(montoCentavos) || montoCentavos <= 0)
    return { ok: false, codigoEstado: 400, error: 'datos_incompletos' };
  const factura = await base.select().from(facturas).where(eq(facturas.id, facturaId)).limit(1);
  if (!factura[0]) return { ok: false, codigoEstado: 404, error: 'factura_no_encontrada' };
  if (factura[0].estado === FACTURA_ANULADA)
    return { ok: false, codigoEstado: 409, error: 'factura_anulada' };
  if (tipo === NOTA_CREDITO && montoCentavos > factura[0].totalCentavos)
    return { ok: false, codigoEstado: 422, error: 'monto_excede_factura' };
  const [nota] = await base
    .insert(notasFactura)
    .values({ facturaId: facturaId, tipo: tipo, montoCentavos: montoCentavos, motivo: motivo })
    .returning({
      id: notasFactura.id,
      tipo: notasFactura.tipo,
      montoCentavos: notasFactura.montoCentavos,
    });
  return { ok: true, datos: nota };
}
export async function listarNotas(facturaId: number) {
  return base
    .select()
    .from(notasFactura)
    .where(eq(notasFactura.facturaId, facturaId))
    .orderBy(desc(notasFactura.id));
}
