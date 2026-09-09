// Servicio de Logistica del ERP (CU-LG-001..006, F5).
// Gestiona transportistas, vehiculos y despachos ligados a ventas (pedidos del canal),
// con guia oficial, ruta y estados de entrega (CREATED -> IN_TRANSIT -> DELIVERED/RETURNED).
import { and, asc, desc, eq, notInArray, sql } from 'drizzle-orm';
import { base } from '../../bd/base';
import { clientes, despachos, pedidos, transportistas, vehiculos } from '../../bd/esquema';
import {
  DESPACHO_EN_RUTA,
  DESPACHO_ENTREGADO,
  DESPACHO_DEVUELTO,
  DESPACHO_PROGRAMADO,
  ESTADO_ACTIVO,
  ESTADO_INACTIVO,
  EVENTO_PEDIDO_ENTREGADO,
  PEDIDO_ENTREGADO,
  PEDIDO_PAGADO,
} from '../../dominio/constantes';
import { encolarEvento } from '../eventos/buzon.servicio';

export type ResultadoLogistica = {
  ok: boolean;
  codigoEstado?: number;
  error?: string;
  datos?: unknown;
};

export interface DatosTransportista {
  nombre: string;
  nit: string;
  telefono?: string;
  polizaVenceEn?: string;
}

export interface DatosVehiculo {
  transportistaId: number;
  placa: string;
  capacidadKg?: number;
}

export interface DatosDespacho {
  pedidoId: number;
  transportistaId: number;
  vehiculoId: number;
  ruta?: string;
}

function like(columna: unknown, patron: string) {
  return sql`${columna} like ${patron}`;
}

async function proximaReferencia(ejecutor: any): Promise<string> {
  const anio = new Date().getFullYear();
  const filas = await ejecutor
    .select({ referencia: despachos.referencia })
    .from(despachos)
    .where(like(despachos.referencia, 'DP-' + anio + '-%'))
    .orderBy(desc(despachos.referencia))
    .limit(1);
  const ultimo = filas[0] ? parseInt(String(filas[0].referencia).split('-').pop() || '0', 10) : 0;
  return 'DP-' + anio + '-' + String(ultimo + 1).padStart(6, '0');
}

function limpiarTexto(valor: unknown): string {
  return String(valor || '').trim();
}

export async function listarTransportistas(soloActivos = true) {
  const consulta = base.select().from(transportistas);
  return soloActivos
    ? consulta.where(eq(transportistas.estado, ESTADO_ACTIVO)).orderBy(asc(transportistas.nombre))
    : consulta.orderBy(asc(transportistas.nombre));
}

export async function crearTransportista(datos: DatosTransportista): Promise<ResultadoLogistica> {
  const nombre = limpiarTexto(datos.nombre);
  const nit = limpiarTexto(datos.nit);
  if (!nombre || !nit) return { ok: false, codigoEstado: 400, error: 'datos_incompletos' };
  const existente = await base
    .select()
    .from(transportistas)
    .where(eq(transportistas.nit, nit))
    .limit(1);
  if (existente[0]) return { ok: false, codigoEstado: 409, error: 'nit_ya_existe' };
  const poliza = datos.polizaVenceEn ? new Date(datos.polizaVenceEn) : null;
  const [creado] = await base
    .insert(transportistas)
    .values({
      nombre: nombre,
      nit: nit,
      telefono: limpiarTexto(datos.telefono) || null,
      polizaVenceEn: poliza && !Number.isNaN(poliza.getTime()) ? poliza : null,
      estado: ESTADO_ACTIVO,
    })
    .returning({ id: transportistas.id, nombre: transportistas.nombre, nit: transportistas.nit });
  return { ok: true, datos: creado };
}

export async function inactivarTransportista(id: number): Promise<ResultadoLogistica> {
  const filas = await base.select().from(transportistas).where(eq(transportistas.id, id)).limit(1);
  if (!filas[0]) return { ok: false, codigoEstado: 404, error: 'transportista_no_encontrado' };
  const vehiculosActivos = await base
    .select()
    .from(vehiculos)
    .where(eq(vehiculos.transportistaId, id))
    .limit(1);
  if (vehiculosActivos[0] && vehiculosActivos[0].estado === ESTADO_ACTIVO)
    return { ok: false, codigoEstado: 409, error: 'transportista_con_vehiculos' };
  const despachoActivo = await base
    .select()
    .from(despachos)
    .where(eq(despachos.transportistaId, id))
    .limit(1);
  if (
    despachoActivo[0] &&
    despachoActivo[0].estado !== DESPACHO_ENTREGADO &&
    despachoActivo[0].estado !== DESPACHO_DEVUELTO
  )
    return { ok: false, codigoEstado: 409, error: 'transportista_con_despachos' };
  await base
    .update(transportistas)
    .set({ estado: ESTADO_INACTIVO, actualizadoEn: new Date() })
    .where(eq(transportistas.id, id));
  return { ok: true, datos: { id: id, estado: ESTADO_INACTIVO } };
}

export async function listarVehiculos(opciones: { transportistaId?: number } = {}) {
  const consulta = base
    .select({
      id: vehiculos.id,
      placa: vehiculos.placa,
      capacidadKg: vehiculos.capacidadKg,
      estado: vehiculos.estado,
      transportistaId: transportistas.id,
      transportistaNombre: transportistas.nombre,
    })
    .from(vehiculos)
    .innerJoin(transportistas, eq(vehiculos.transportistaId, transportistas.id));
  const filas = opciones.transportistaId
    ? await consulta
        .where(eq(vehiculos.transportistaId, opciones.transportistaId))
        .orderBy(asc(vehiculos.placa))
    : await consulta.orderBy(asc(vehiculos.placa));
  return filas;
}

export async function crearVehiculo(datos: DatosVehiculo): Promise<ResultadoLogistica> {
  const placa = limpiarTexto(datos.placa).toUpperCase();
  const transportistaId = Number(datos.transportistaId);
  if (!transportistaId || !placa)
    return { ok: false, codigoEstado: 400, error: 'datos_incompletos' };
  const transportista = await base
    .select()
    .from(transportistas)
    .where(eq(transportistas.id, transportistaId))
    .limit(1);
  if (!transportista[0] || transportista[0].estado !== ESTADO_ACTIVO)
    return { ok: false, codigoEstado: 409, error: 'transportista_inactivo' };
  const existente = await base.select().from(vehiculos).where(eq(vehiculos.placa, placa)).limit(1);
  if (existente[0]) return { ok: false, codigoEstado: 409, error: 'placa_ya_existe' };
  const capacidad = Number(datos.capacidadKg) || 1000;
  const [creado] = await base
    .insert(vehiculos)
    .values({
      transportistaId: transportistaId,
      placa: placa,
      capacidadKg: capacidad,
      estado: ESTADO_ACTIVO,
    })
    .returning({
      id: vehiculos.id,
      placa: vehiculos.placa,
      transportistaId: vehiculos.transportistaId,
    });
  return { ok: true, datos: creado };
}

export async function inactivarVehiculo(id: number): Promise<ResultadoLogistica> {
  const filas = await base.select().from(vehiculos).where(eq(vehiculos.id, id)).limit(1);
  if (!filas[0]) return { ok: false, codigoEstado: 404, error: 'vehiculo_no_encontrado' };
  const despacho = await base.select().from(despachos).where(eq(despachos.vehiculoId, id)).limit(1);
  if (
    despacho[0] &&
    despacho[0].estado !== DESPACHO_ENTREGADO &&
    despacho[0].estado !== DESPACHO_DEVUELTO
  )
    return { ok: false, codigoEstado: 409, error: 'vehiculo_con_despachos' };
  await base
    .update(vehiculos)
    .set({ estado: ESTADO_INACTIVO, actualizadoEn: new Date() })
    .where(eq(vehiculos.id, id));
  return { ok: true, datos: { id: id, estado: ESTADO_INACTIVO } };
}

export async function ventasDespachables() {
  const despachados = await base.select({ pedidoId: despachos.pedidoId }).from(despachos);
  const ids = despachados.map(function (d) {
    return d.pedidoId;
  });
  const condiciones = [eq(pedidos.estado, PEDIDO_PAGADO)];
  if (ids.length) condiciones.push(notInArray(pedidos.id, ids));
  const filas = await base
    .select({
      id: pedidos.id,
      referenciaPedido: pedidos.referenciaPedido,
      clienteNombre: clientes.nombre,
      totalCentavos: pedidos.totalCentavos,
      creadoEn: pedidos.creadoEn,
    })
    .from(pedidos)
    .innerJoin(clientes, eq(pedidos.clienteId, sql`${clientes.id}::text`))
    .where(and(...condiciones))
    .orderBy(desc(pedidos.id));
  return filas;
}

export async function crearDespacho(datos: DatosDespacho): Promise<ResultadoLogistica> {
  const pedidoId = Number(datos.pedidoId);
  const transportistaId = Number(datos.transportistaId);
  const vehiculoId = Number(datos.vehiculoId);
  if (!pedidoId || !transportistaId || !vehiculoId)
    return { ok: false, codigoEstado: 400, error: 'datos_incompletos' };
  const pedido = await base.select().from(pedidos).where(eq(pedidos.id, pedidoId)).limit(1);
  if (!pedido[0]) return { ok: false, codigoEstado: 404, error: 'venta_no_encontrada' };
  if (pedido[0].estado !== PEDIDO_PAGADO)
    return { ok: false, codigoEstado: 409, error: 'venta_no_despachable' };
  const existenteDespacho = await base
    .select()
    .from(despachos)
    .where(eq(despachos.pedidoId, pedidoId))
    .limit(1);
  if (existenteDespacho[0]) return { ok: false, codigoEstado: 409, error: 'venta_ya_despachada' };
  const transportista = await base
    .select()
    .from(transportistas)
    .where(eq(transportistas.id, transportistaId))
    .limit(1);
  if (!transportista[0] || transportista[0].estado !== ESTADO_ACTIVO)
    return { ok: false, codigoEstado: 409, error: 'transportista_inactivo' };
  const vehiculo = await base.select().from(vehiculos).where(eq(vehiculos.id, vehiculoId)).limit(1);
  if (
    !vehiculo[0] ||
    vehiculo[0].estado !== ESTADO_ACTIVO ||
    vehiculo[0].transportistaId !== transportistaId
  )
    return { ok: false, codigoEstado: 409, error: 'vehiculo_no_disponible' };
  const referencia = await proximaReferencia(base);
  const guia = 'GUI-' + referencia;
  const [creado] = await base
    .insert(despachos)
    .values({
      referencia: referencia,
      guia: guia,
      pedidoId: pedidoId,
      transportistaId: transportistaId,
      vehiculoId: vehiculoId,
      ruta: limpiarTexto(datos.ruta) || null,
      estado: DESPACHO_PROGRAMADO,
    })
    .returning({
      id: despachos.id,
      referencia: despachos.referencia,
      guia: despachos.guia,
      estado: despachos.estado,
    });
  return { ok: true, datos: creado };
}

const seleccionDespacho = {
  id: despachos.id,
  referencia: despachos.referencia,
  guia: despachos.guia,
  ruta: despachos.ruta,
  estado: despachos.estado,
  entregadoEn: despachos.entregadoEn,
  creadoEn: despachos.creadoEn,
  pedidoId: pedidos.id,
  referenciaPedido: pedidos.referenciaPedido,
  clienteNombre: clientes.nombre,
  transportistaId: transportistas.id,
  transportistaNombre: transportistas.nombre,
  vehiculoId: vehiculos.id,
  placa: vehiculos.placa,
};

export async function listarDespachos() {
  return base
    .select(seleccionDespacho)
    .from(despachos)
    .innerJoin(pedidos, eq(despachos.pedidoId, pedidos.id))
    .innerJoin(clientes, eq(pedidos.clienteId, sql`${clientes.id}::text`))
    .innerJoin(transportistas, eq(despachos.transportistaId, transportistas.id))
    .innerJoin(vehiculos, eq(despachos.vehiculoId, vehiculos.id))
    .orderBy(desc(despachos.id));
}

export async function despacharDespacho(id: number): Promise<ResultadoLogistica> {
  const filas = await base.select().from(despachos).where(eq(despachos.id, id)).limit(1);
  if (!filas[0]) return { ok: false, codigoEstado: 404, error: 'despacho_no_encontrado' };
  if (filas[0].estado !== DESPACHO_PROGRAMADO)
    return { ok: false, codigoEstado: 409, error: 'despacho_no_despachable' };
  await base
    .update(despachos)
    .set({ estado: DESPACHO_EN_RUTA, actualizadoEn: new Date() })
    .where(eq(despachos.id, id));
  return { ok: true, datos: { id: id, estado: DESPACHO_EN_RUTA } };
}

export async function entregarDespacho(id: number): Promise<ResultadoLogistica> {
  const filas = await base.select().from(despachos).where(eq(despachos.id, id)).limit(1);
  if (!filas[0]) return { ok: false, codigoEstado: 404, error: 'despacho_no_encontrado' };
  const despacho = filas[0];
  if (despacho.estado !== DESPACHO_EN_RUTA && despacho.estado !== DESPACHO_PROGRAMADO)
    return { ok: false, codigoEstado: 409, error: 'despacho_no_entregable' };
  await base.transaction(async function (transaccion) {
    await transaccion
      .update(despachos)
      .set({ estado: DESPACHO_ENTREGADO, entregadoEn: new Date(), actualizadoEn: new Date() })
      .where(eq(despachos.id, id));
    await transaccion
      .update(pedidos)
      .set({ estado: PEDIDO_ENTREGADO, actualizadoEn: new Date() })
      .where(eq(pedidos.id, despacho.pedidoId));
    await encolarEvento(transaccion, {
      tipoAgregado: 'Pedido',
      idAgregado: String(despacho.pedidoId),
      tipoEvento: EVENTO_PEDIDO_ENTREGADO,
      claveIdempotencia: despacho.referencia,
      datos: { referenciaPedido: despacho.referencia, entregadoEn: new Date().toISOString() },
    });
  });
  return { ok: true, datos: { id: id, estado: DESPACHO_ENTREGADO } };
}

export async function devolverDespacho(id: number): Promise<ResultadoLogistica> {
  const filas = await base.select().from(despachos).where(eq(despachos.id, id)).limit(1);
  if (!filas[0]) return { ok: false, codigoEstado: 404, error: 'despacho_no_encontrado' };
  if (filas[0].estado !== DESPACHO_EN_RUTA)
    return { ok: false, codigoEstado: 409, error: 'despacho_no_devoluble' };
  await base
    .update(despachos)
    .set({ estado: DESPACHO_DEVUELTO, actualizadoEn: new Date() })
    .where(eq(despachos.id, id));
  return { ok: true, datos: { id: id, estado: DESPACHO_DEVUELTO } };
}
