// Servicio de Logistica del ERP (CU-LG-001..006, F5).
// Gestiona transportistas, vehiculos, rutas de distribucion y despachos ligados a ventas
// (pedidos del canal), con guia oficial, ruta y estados de entrega
// (CREATED -> IN_TRANSIT -> DELIVERED/RETURNED).
import { and, asc, desc, eq, inArray, notInArray, sql } from 'drizzle-orm';
import { base } from '../../bd/base';
import {
  clientes,
  despachos,
  pedidos,
  rutaParadas,
  rutas,
  transportistas,
  vehiculos,
} from '../../bd/esquema';
import {
  DESPACHO_EN_RUTA,
  DESPACHO_ENTREGADO,
  DESPACHO_DEVUELTO,
  DESPACHO_PROGRAMADO,
  ESTADO_ACTIVO,
  ESTADO_INACTIVO,
  EVENTO_PEDIDO_ENTREGADO,
  MAXIMO_PARADAS_RUTA,
  PEDIDO_ENTREGADO,
  PEDIDO_PAGADO,
  PREFIJO_RUTA,
  RUTA_CANCELADA,
  RUTA_COMPLETADA,
  RUTA_EN_PROGRESO,
  RUTA_PLANIFICADA,
  RUTAS_ACTIVAS,
  RUTAS_NO_MODIFICABLES,
  VEHICULO_ASIGNADO,
  VEHICULO_DISPONIBLE,
} from '../../dominio/constantes';
import { encolarEvento } from '../eventos/buzon.servicio';

export type ResultadoLogistica = {
  ok: boolean;
  codigoEstado?: number;
  error?: string;
  datos?: unknown;
};

/** Actor autenticado que ejecuta una operacion de logistica (para auditoria). */
export interface ActorRuta {
  id?: string;
  rol?: string;
}

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

/** Parada del trayecto (CU-LG-005): posicion, destino y despacho a entregar (opcional). */
export interface ParadaRuta {
  destino: string;
  despachoId?: number;
}

export interface DatosRuta {
  /** Codigo unico de la ruta (RN-LG-01); si no se envia, se genera RTE-AAAA-######. */
  codigo?: string;
  nombre: string;
  vehiculoId: number;
  paradas: ParadaRuta[];
}

function like(columna: unknown, patron: string) {
  return sql`${columna} like ${patron}`;
}

/**
 * Genera la siguiente referencia consecutiva de una tabla (CU-LG-003/005).
 * Entrada: prefijo oficial (DP, RTE), tabla y columna de referencia.
 * Salida: referencia con formato PREFIJO-AAAA-######.
 */
async function siguienteReferencia(prefijo: string, tabla: any, columna: any): Promise<string> {
  const anio = new Date().getFullYear();
  const patron = prefijo + '-' + anio + '-%';
  const filas = await base
    .select({ referencia: columna })
    .from(tabla)
    .where(like(columna, patron))
    .orderBy(desc(columna))
    .limit(1);
  const ultimo = filas[0] ? parseInt(String(filas[0].referencia).split('-').pop() || '0', 10) : 0;
  return prefijo + '-' + anio + '-' + String(ultimo + 1).padStart(6, '0');
}

async function proximaReferencia(): Promise<string> {
  return siguienteReferencia('DP', despachos, despachos.referencia);
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

/**
 * Marca los vehiculos tomados por una ruta activa (CU-LG-005).
 * Entrada: filas de vehiculos. Salida: las mismas filas con su estadoOperativo derivado.
 * Regla: un vehiculo con ruta planificada o en progreso esta asignado; si no, disponible.
 */
async function conEstadoOperativo(filas: any[]) {
  if (!filas.length) return filas;
  const ocupados = await base
    .select({ vehiculoId: rutas.vehiculoId })
    .from(rutas)
    .where(inArray(rutas.estado, RUTAS_ACTIVAS as unknown as string[]));
  const tomados = new Set(
    ocupados.map(function (fila) {
      return fila.vehiculoId;
    }),
  );
  return filas.map(function (fila) {
    return {
      ...fila,
      estadoOperativo: tomados.has(fila.id) ? VEHICULO_ASIGNADO : VEHICULO_DISPONIBLE,
    };
  });
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
  return conEstadoOperativo(filas);
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
  const referencia = await proximaReferencia();
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
  rutaId: despachos.rutaId,
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
// ---------------------------------------------------------------------------
// Rutas de distribucion (CU-LG-005)
// ---------------------------------------------------------------------------

/**
 * Valida y normaliza el codigo de una ruta (RN-LG-01).
 * Entrada: codigo crudo del cuerpo HTTP. Salida: codigo en mayusculas o null si es valido
 * generarlo automaticamente; error cuando el formato no cumple el patron alfanumerico.
 */
export function normalizarCodigoRuta(codigo: unknown): { error?: string; codigo?: string | null } {
  const texto = String(codigo || '')
    .trim()
    .toUpperCase();
  if (!texto) return { codigo: null };
  if (!/^[A-Z0-9][A-Z0-9-]{3,19}$/.test(texto)) return { error: 'codigo_ruta_invalido' };
  return { codigo: texto };
}

/**
 * Valida la secuencia de paradas de una ruta (RN-LG-02).
 * Entrada: paradas crudas del cuerpo HTTP. Salida: paradas numeradas o codigo de error.
 * Reglas: al menos una parada, tope configurado, destino obligatorio y sin destinos repetidos.
 */
export function normalizarParadas(paradas: ParadaRuta[]): {
  error?: string;
  datos?: { secuencia: number; destino: string; despachoId: number | null }[];
} {
  if (!Array.isArray(paradas) || !paradas.length) return { error: 'paradas_obligatorias' };
  if (paradas.length > MAXIMO_PARADAS_RUTA) return { error: 'demasiadas_paradas' };
  const destinos = new Set<string>();
  const datos: { secuencia: number; destino: string; despachoId: number | null }[] = [];
  for (const parada of paradas) {
    const destino = limpiarTexto(parada ? parada.destino : '');
    if (!destino) return { error: 'destino_obligatorio' };
    const clave = destino.toLowerCase();
    if (destinos.has(clave)) return { error: 'destino_duplicado' };
    destinos.add(clave);
    const despachoId = parada && parada.despachoId ? Number(parada.despachoId) : null;
    datos.push({
      secuencia: datos.length + 1,
      destino: destino,
      despachoId: despachoId && !Number.isNaN(despachoId) ? despachoId : null,
    });
  }
  return { datos: datos };
}

/** Indica si una ruta ya no admite cambios (RN-LG-03). */
export function rutaModificable(estado: string): boolean {
  return !(RUTAS_NO_MODIFICABLES as unknown as string[]).includes(estado);
}

/**
 * Verifica que el vehiculo exista, este activo, pertenezca al transportista y no tenga
 * otra ruta vigente (CU-LG-005). Entrada: vehiculo y transportista declarados.
 */
async function validarVehiculoDeRuta(
  vehiculoId: number,
  rutaIdExcluida?: number,
): Promise<{ error?: string; codigoEstado?: number; transportistaId?: number }> {
  const filas = await base.select().from(vehiculos).where(eq(vehiculos.id, vehiculoId)).limit(1);
  const vehiculo = filas[0];
  if (!vehiculo) return { error: 'vehiculo_no_encontrado', codigoEstado: 404 };
  if (vehiculo.estado !== ESTADO_ACTIVO)
    return { error: 'vehiculo_no_disponible', codigoEstado: 409 };
  const activas = await base
    .select({ id: rutas.id, codigo: rutas.codigo })
    .from(rutas)
    .where(
      and(
        eq(rutas.vehiculoId, vehiculoId),
        inArray(rutas.estado, RUTAS_ACTIVAS as unknown as string[]),
      ),
    );
  const otra = activas.filter(function (ruta) {
    return ruta.id !== rutaIdExcluida;
  })[0];
  if (otra) return { error: 'vehiculo_en_ruta', codigoEstado: 409 };
  return { transportistaId: vehiculo.transportistaId };
}

/**
 * Carga las paradas agrupadas por ruta (CU-LG-005).
 * Entrada: ids de ruta. Salida: mapa rutaId -> paradas ordenadas por secuencia.
 */
async function paradasPorRuta(ids: number[]) {
  const mapa = new Map<number, any[]>();
  if (!ids.length) return mapa;
  const filas = await base
    .select({
      id: rutaParadas.id,
      rutaId: rutaParadas.rutaId,
      secuencia: rutaParadas.secuencia,
      destino: rutaParadas.destino,
      despachoId: rutaParadas.despachoId,
      guia: despachos.guia,
    })
    .from(rutaParadas)
    .leftJoin(despachos, eq(rutaParadas.despachoId, despachos.id))
    .where(inArray(rutaParadas.rutaId, ids))
    .orderBy(asc(rutaParadas.rutaId), asc(rutaParadas.secuencia));
  for (const fila of filas) {
    const lista = mapa.get(fila.rutaId) || [];
    lista.push(fila);
    mapa.set(fila.rutaId, lista);
  }
  return mapa;
}

const seleccionRuta = {
  id: rutas.id,
  codigo: rutas.codigo,
  nombre: rutas.nombre,
  estado: rutas.estado,
  transportistaId: transportistas.id,
  transportistaNombre: transportistas.nombre,
  vehiculoId: vehiculos.id,
  placa: vehiculos.placa,
  capacidadKg: vehiculos.capacidadKg,
  creadoEn: rutas.creadoEn,
  iniciadaEn: rutas.iniciadaEn,
  completadaEn: rutas.completadaEn,
};

/** Consulta fresca de rutas con transportista y vehiculo (evita builders compartidos). */
function consultaRutas() {
  return base
    .select(seleccionRuta)
    .from(rutas)
    .innerJoin(transportistas, eq(rutas.transportistaId, transportistas.id))
    .innerJoin(vehiculos, eq(rutas.vehiculoId, vehiculos.id));
}

/**
 * Lista las rutas con sus paradas y el numero de despachos consolidados (CU-LG-005).
 */
export async function listarRutas() {
  const filas = await consultaRutas().orderBy(desc(rutas.id));
  const paradas = await paradasPorRuta(
    filas.map(function (fila) {
      return fila.id;
    }),
  );
  return filas.map(function (fila) {
    const lista = paradas.get(fila.id) || [];
    return {
      ...fila,
      paradas: lista,
      totalParadas: lista.length,
      totalDespachos: lista.filter(function (parada) {
        return parada.despachoId !== null;
      }).length,
    };
  });
}

/**
 * Consulta una ruta con sus paradas (CU-LG-005).
 */
export async function obtenerRuta(id: number) {
  const filas = await consultaRutas().where(eq(rutas.id, id)).limit(1);
  if (!filas[0]) return null;
  const paradas = await paradasPorRuta([id]);
  const lista = paradas.get(id) || [];
  return {
    ...filas[0],
    paradas: lista,
    totalParadas: lista.length,
    totalDespachos: lista.filter(function (parada) {
      return parada.despachoId !== null;
    }).length,
  };
}

/**
 * Valida que los despachos puedan consolidarse en una ruta (CU-LG-005).
 * Entrada: ids de despacho y la ruta destino (null al crear). Salida: error o despachos validos.
 * Reglas: el despacho debe existir, estar programado o en ruta y no pertenecer a otra ruta.
 */
async function validarDespachosConsolidables(ids: number[], rutaId: number | null) {
  const unicos = Array.from(new Set(ids));
  // Una ruta puede no llevar despachos asociados: solo valida los que vengan informados.
  if (!unicos.length) return { despachos: [] };
  const filas = await base.select().from(despachos).where(inArray(despachos.id, unicos));
  if (filas.length !== unicos.length) return { error: 'despacho_no_encontrado', codigoEstado: 404 };
  for (const despacho of filas) {
    if (despacho.estado !== DESPACHO_PROGRAMADO && despacho.estado !== DESPACHO_EN_RUTA)
      return { error: 'despacho_no_asignable', codigoEstado: 409 };
    if (despacho.rutaId && despacho.rutaId !== rutaId)
      return { error: 'despacho_ya_asignado', codigoEstado: 409 };
  }
  return { despachos: filas };
}

/**
 * Crea una ruta de distribucion (CU-LG-005).
 * Entrada: codigo opcional, nombre, vehiculo y paradas secuenciadas; actor autenticado.
 * Salida: id, codigo y estado planificada.
 * Reglas: codigo unico (RN-LG-01), paradas ordenadas sin destino repetido (RN-LG-02),
 * vehiculo activo y sin otra ruta vigente; los despachos de las paradas quedan consolidados.
 */
export async function crearRuta(datos: DatosRuta, actor: ActorRuta): Promise<ResultadoLogistica> {
  const nombre = limpiarTexto(datos.nombre);
  if (!nombre) return { ok: false, codigoEstado: 400, error: 'nombre_obligatorio' };
  const codigo = normalizarCodigoRuta(datos.codigo);
  if (codigo.error) return { ok: false, codigoEstado: 400, error: codigo.error };
  const paradas = normalizarParadas(datos.paradas);
  if (paradas.error) return { ok: false, codigoEstado: 400, error: paradas.error };
  const vehiculoId = Number(datos.vehiculoId);
  if (!vehiculoId) return { ok: false, codigoEstado: 400, error: 'datos_incompletos' };
  const vehiculo = await validarVehiculoDeRuta(vehiculoId);
  if (vehiculo.error)
    return { ok: false, codigoEstado: vehiculo.codigoEstado || 409, error: vehiculo.error };
  if (codigo.codigo) {
    const existente = await base
      .select()
      .from(rutas)
      .where(eq(rutas.codigo, codigo.codigo))
      .limit(1);
    if (existente[0]) return { ok: false, codigoEstado: 409, error: 'codigo_ruta_duplicado' };
  }
  const despachosParadas = (paradas.datos || [])
    .map(function (parada) {
      return parada.despachoId;
    })
    .filter(function (id) {
      return id !== null;
    }) as number[];
  const consolidables = await validarDespachosConsolidables(despachosParadas, null);
  if (consolidables.error)
    return {
      ok: false,
      codigoEstado: consolidables.codigoEstado || 400,
      error: consolidables.error,
    };

  const referencia =
    codigo.codigo || (await siguienteReferencia(PREFIJO_RUTA, rutas, rutas.codigo));
  let rutaId: number | undefined;
  await base.transaction(async function (transaccion) {
    const [creada] = await transaccion
      .insert(rutas)
      .values({
        codigo: referencia,
        nombre: nombre,
        transportistaId: vehiculo.transportistaId as number,
        vehiculoId: vehiculoId,
        estado: RUTA_PLANIFICADA,
        creadoPorRol: actor.rol || null,
      })
      .returning({ id: rutas.id, codigo: rutas.codigo, estado: rutas.estado });
    rutaId = creada.id;
    await transaccion.insert(rutaParadas).values(
      (paradas.datos || []).map(function (parada) {
        return {
          rutaId: creada.id,
          secuencia: parada.secuencia,
          destino: parada.destino,
          despachoId: parada.despachoId,
        };
      }),
    );
    if (despachosParadas.length) {
      await transaccion
        .update(despachos)
        .set({ rutaId: creada.id, ruta: creada.codigo + ' ' + nombre, actualizadoEn: new Date() })
        .where(inArray(despachos.id, despachosParadas));
    }
  });
  return { ok: true, datos: { id: rutaId, codigo: referencia, estado: RUTA_PLANIFICADA } };
}

/**
 * Modifica una ruta planificada (CU-LG-005).
 * Entrada: id, nombre y/o vehiculo y/o paradas nuevas (reemplazan el trayecto completo).
 * Salida: id y estado; FA-03: 422 si la ruta ya esta en progreso, completada o cancelada.
 */
export async function actualizarRuta(
  id: number,
  datos: Partial<DatosRuta>,
): Promise<ResultadoLogistica> {
  const filas = await base.select().from(rutas).where(eq(rutas.id, id)).limit(1);
  const ruta = filas[0];
  if (!ruta) return { ok: false, codigoEstado: 404, error: 'ruta_no_encontrada' };
  if (!rutaModificable(ruta.estado))
    return { ok: false, codigoEstado: 422, error: 'ruta_no_modificable' };
  const cambios: { nombre?: string; vehiculoId?: number; actualizadoEn: Date } = {
    actualizadoEn: new Date(),
  };
  if (datos.nombre !== undefined) {
    const nombre = limpiarTexto(datos.nombre);
    if (!nombre) return { ok: false, codigoEstado: 400, error: 'nombre_obligatorio' };
    cambios.nombre = nombre;
  }
  if (datos.vehiculoId !== undefined) {
    const vehiculoId = Number(datos.vehiculoId);
    if (!vehiculoId) return { ok: false, codigoEstado: 400, error: 'datos_incompletos' };
    const vehiculo = await validarVehiculoDeRuta(vehiculoId, id);
    if (vehiculo.error)
      return { ok: false, codigoEstado: vehiculo.codigoEstado || 409, error: vehiculo.error };
    cambios.vehiculoId = vehiculoId;
  }
  let paradas: { secuencia: number; destino: string; despachoId: number | null }[] | null = null;
  if (datos.paradas !== undefined) {
    const normalizadas = normalizarParadas(datos.paradas);
    if (normalizadas.error) return { ok: false, codigoEstado: 400, error: normalizadas.error };
    paradas = normalizadas.datos || [];
    const ids = paradas
      .map(function (parada) {
        return parada.despachoId;
      })
      .filter(function (valor) {
        return valor !== null;
      }) as number[];
    const consolidables = await validarDespachosConsolidables(ids, id);
    if (consolidables.error)
      return {
        ok: false,
        codigoEstado: consolidables.codigoEstado || 400,
        error: consolidables.error,
      };
  }
  await base.transaction(async function (transaccion) {
    await transaccion.update(rutas).set(cambios).where(eq(rutas.id, id));
    if (paradas) {
      // Reemplazo completo del trayecto: se liberan los despachos que ya no participan.
      await transaccion
        .update(despachos)
        .set({ rutaId: null, ruta: null, actualizadoEn: new Date() })
        .where(eq(despachos.rutaId, id));
      await transaccion.delete(rutaParadas).where(eq(rutaParadas.rutaId, id));
      await transaccion.insert(rutaParadas).values(
        paradas.map(function (parada) {
          return {
            rutaId: id,
            secuencia: parada.secuencia,
            destino: parada.destino,
            despachoId: parada.despachoId,
          };
        }),
      );
      const ids = paradas
        .map(function (parada) {
          return parada.despachoId;
        })
        .filter(function (valor) {
          return valor !== null;
        }) as number[];
      if (ids.length) {
        const nombreRuta = cambios.nombre || ruta.nombre;
        await transaccion
          .update(despachos)
          .set({
            rutaId: id,
            ruta: ruta.codigo + ' ' + nombreRuta,
            actualizadoEn: new Date(),
          })
          .where(inArray(despachos.id, ids));
      }
    }
  });
  return { ok: true, datos: { id: id, estado: ruta.estado } };
}

/**
 * Consolida despachos programados en una ruta planificada (CU-LG-005).
 * Entrada: id de ruta y ids de despacho. Salida: despachos consolidados.
 * Regla: solo rutas planificadas admiten consolidacion (RN-LG-03).
 */
export async function asignarDespachosARuta(
  id: number,
  despachoIds: number[],
): Promise<ResultadoLogistica> {
  const filas = await base.select().from(rutas).where(eq(rutas.id, id)).limit(1);
  const ruta = filas[0];
  if (!ruta) return { ok: false, codigoEstado: 404, error: 'ruta_no_encontrada' };
  if (!rutaModificable(ruta.estado))
    return { ok: false, codigoEstado: 422, error: 'ruta_no_modificable' };
  if (!Array.isArray(despachoIds) || !despachoIds.length)
    return { ok: false, codigoEstado: 400, error: 'despachos_obligatorios' };
  const consolidables = await validarDespachosConsolidables((despachoIds || []).map(Number), id);
  if (consolidables.error)
    return {
      ok: false,
      codigoEstado: consolidables.codigoEstado || 400,
      error: consolidables.error,
    };
  const ids = (consolidables.despachos || []).map(function (despacho: any) {
    return despacho.id;
  });
  await base
    .update(despachos)
    .set({ rutaId: id, ruta: ruta.codigo + ' ' + ruta.nombre, actualizadoEn: new Date() })
    .where(inArray(despachos.id, ids));
  return { ok: true, datos: { rutaId: id, despachos: ids } };
}

/**
 * Inicia la ejecucion de una ruta (CU-LG-005): planificada -> en_progreso.
 * Efecto: los despachos programados consolidados pasan a en_ruta (CU-LG-006).
 */
export async function iniciarRuta(id: number): Promise<ResultadoLogistica> {
  const filas = await base.select().from(rutas).where(eq(rutas.id, id)).limit(1);
  const ruta = filas[0];
  if (!ruta) return { ok: false, codigoEstado: 404, error: 'ruta_no_encontrada' };
  if (ruta.estado !== RUTA_PLANIFICADA)
    return { ok: false, codigoEstado: 422, error: 'ruta_no_iniciable' };
  const paradas = await base.select().from(rutaParadas).where(eq(rutaParadas.rutaId, id));
  if (!paradas.length) return { ok: false, codigoEstado: 422, error: 'ruta_sin_paradas' };
  await base.transaction(async function (transaccion) {
    await transaccion
      .update(rutas)
      .set({ estado: RUTA_EN_PROGRESO, iniciadaEn: new Date(), actualizadoEn: new Date() })
      .where(eq(rutas.id, id));
    await transaccion
      .update(despachos)
      .set({ estado: DESPACHO_EN_RUTA, actualizadoEn: new Date() })
      .where(and(eq(despachos.rutaId, id), eq(despachos.estado, DESPACHO_PROGRAMADO)));
  });
  return { ok: true, datos: { id: id, estado: RUTA_EN_PROGRESO } };
}

/**
 * Completa una ruta en ejecucion (CU-LG-005): en_progreso -> completada.
 */
export async function completarRuta(id: number): Promise<ResultadoLogistica> {
  const filas = await base.select().from(rutas).where(eq(rutas.id, id)).limit(1);
  const ruta = filas[0];
  if (!ruta) return { ok: false, codigoEstado: 404, error: 'ruta_no_encontrada' };
  if (ruta.estado !== RUTA_EN_PROGRESO)
    return { ok: false, codigoEstado: 422, error: 'ruta_no_completable' };
  await base
    .update(rutas)
    .set({ estado: RUTA_COMPLETADA, completadaEn: new Date(), actualizadoEn: new Date() })
    .where(eq(rutas.id, id));
  return { ok: true, datos: { id: id, estado: RUTA_COMPLETADA } };
}

/**
 * Cancela una ruta planificada (CU-LG-005) y libera sus despachos para reprogramacion.
 */
export async function cancelarRuta(id: number): Promise<ResultadoLogistica> {
  const filas = await base.select().from(rutas).where(eq(rutas.id, id)).limit(1);
  const ruta = filas[0];
  if (!ruta) return { ok: false, codigoEstado: 404, error: 'ruta_no_encontrada' };
  if (ruta.estado !== RUTA_PLANIFICADA)
    return { ok: false, codigoEstado: 422, error: 'ruta_no_cancelable' };
  await base.transaction(async function (transaccion) {
    await transaccion
      .update(rutas)
      .set({ estado: RUTA_CANCELADA, actualizadoEn: new Date() })
      .where(eq(rutas.id, id));
    await transaccion
      .update(despachos)
      .set({ rutaId: null, ruta: null, actualizadoEn: new Date() })
      .where(eq(despachos.rutaId, id));
  });
  return { ok: true, datos: { id: id, estado: RUTA_CANCELADA } };
}

/** Despachos disponibles para consolidar en una ruta (CU-LG-005). */
export async function despachosConsolidables() {
  const filas = await base
    .select({
      id: despachos.id,
      referencia: despachos.referencia,
      guia: despachos.guia,
      estado: despachos.estado,
      rutaId: despachos.rutaId,
      referenciaPedido: pedidos.referenciaPedido,
      clienteNombre: clientes.nombre,
    })
    .from(despachos)
    .innerJoin(pedidos, eq(despachos.pedidoId, pedidos.id))
    .innerJoin(clientes, eq(pedidos.clienteId, sql`${clientes.id}::text`))
    .where(eq(despachos.estado, DESPACHO_PROGRAMADO))
    .orderBy(desc(despachos.id));
  return filas;
}
