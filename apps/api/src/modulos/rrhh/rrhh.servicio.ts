// Servicio de RRHH / Nomina (CU-RH-001/002/005/007, F5).
import { and, asc, desc, eq } from 'drizzle-orm';
import { base } from '../../bd/base';
import { ausencias, cargos, empleados, nominas } from '../../bd/esquema';
import {
  AUSENCIA_JUSTIFICADA,
  AUSENCIA_REGISTRADA,
  ESTADO_ACTIVO,
  ESTADO_INACTIVO,
  NOMINA_GENERADA,
  NOMINA_PAGADA,
} from '../../dominio/constantes';

export type ResultadoRrhh = { ok: boolean; codigoEstado?: number; error?: string; datos?: unknown };

function limpiar(valor: unknown): string {
  return String(valor || '').trim();
}

export async function listarCargos(soloActivos = true) {
  const consulta = base.select().from(cargos);
  return soloActivos
    ? consulta.where(eq(cargos.estado, ESTADO_ACTIVO)).orderBy(asc(cargos.nombre))
    : consulta.orderBy(asc(cargos.nombre));
}

export async function crearCargo(datos: {
  nombre: string;
  descripcion?: string;
}): Promise<ResultadoRrhh> {
  const nombre = limpiar(datos.nombre);
  if (!nombre) return { ok: false, codigoEstado: 400, error: 'nombre_obligatorio' };
  const existente = await base.select().from(cargos).where(eq(cargos.nombre, nombre)).limit(1);
  if (existente[0]) return { ok: false, codigoEstado: 409, error: 'cargo_ya_existe' };
  const [creado] = await base
    .insert(cargos)
    .values({ nombre: nombre, descripcion: limpiar(datos.descripcion) || null })
    .returning({ id: cargos.id, nombre: cargos.nombre });
  return { ok: true, datos: creado };
}

export async function inactivarCargo(id: number): Promise<ResultadoRrhh> {
  const filas = await base.select().from(cargos).where(eq(cargos.id, id)).limit(1);
  if (!filas[0]) return { ok: false, codigoEstado: 404, error: 'cargo_no_encontrado' };
  await base
    .update(cargos)
    .set({ estado: ESTADO_INACTIVO, actualizadoEn: new Date() })
    .where(eq(cargos.id, id));
  return { ok: true, datos: { id: id } };
}

export async function listarEmpleados() {
  return base
    .select({
      id: empleados.id,
      nombre: empleados.nombre,
      documentoUnico: empleados.documentoUnico,
      correo: empleados.correo,
      telefono: empleados.telefono,
      cargoId: cargos.id,
      cargoNombre: cargos.nombre,
      salarioBaseCentavos: empleados.salarioBaseCentavos,
      estado: empleados.estado,
    })
    .from(empleados)
    .leftJoin(cargos, eq(empleados.cargoId, cargos.id))
    .orderBy(asc(empleados.nombre));
}

export async function crearEmpleado(datos: any): Promise<ResultadoRrhh> {
  const nombre = limpiar(datos.nombre);
  const documentoUnico = limpiar(datos.documentoUnico);
  if (!nombre || !documentoUnico)
    return { ok: false, codigoEstado: 400, error: 'datos_incompletos' };
  const existente = await base
    .select()
    .from(empleados)
    .where(eq(empleados.documentoUnico, documentoUnico))
    .limit(1);
  if (existente[0]) return { ok: false, codigoEstado: 409, error: 'documento_ya_existe' };
  if (datos.cargoId) {
    const cargo = await base
      .select()
      .from(cargos)
      .where(eq(cargos.id, Number(datos.cargoId)))
      .limit(1);
    if (!cargo[0] || cargo[0].estado !== ESTADO_ACTIVO)
      return { ok: false, codigoEstado: 409, error: 'cargo_inactivo' };
  }
  const [creado] = await base
    .insert(empleados)
    .values({
      nombre: nombre,
      documentoUnico: documentoUnico,
      correo: limpiar(datos.correo) || null,
      telefono: limpiar(datos.telefono) || null,
      cargoId: datos.cargoId ? Number(datos.cargoId) : null,
      salarioBaseCentavos: Number(datos.salarioBaseCentavos) || 0,
      estado: ESTADO_ACTIVO,
    })
    .returning({
      id: empleados.id,
      nombre: empleados.nombre,
      documentoUnico: empleados.documentoUnico,
    });
  return { ok: true, datos: creado };
}

export async function inactivarEmpleado(id: number): Promise<ResultadoRrhh> {
  const filas = await base.select().from(empleados).where(eq(empleados.id, id)).limit(1);
  if (!filas[0]) return { ok: false, codigoEstado: 404, error: 'empleado_no_encontrado' };
  await base
    .update(empleados)
    .set({ estado: ESTADO_INACTIVO, actualizadoEn: new Date() })
    .where(eq(empleados.id, id));
  return { ok: true, datos: { id: id } };
}

export async function registrarAusencia(datos: any): Promise<ResultadoRrhh> {
  const empleadoId = Number(datos.empleadoId);
  const motivo = limpiar(datos.motivo);
  const fecha = datos.fecha ? new Date(datos.fecha) : null;
  if (!empleadoId || !motivo || !fecha || Number.isNaN(fecha.getTime()))
    return { ok: false, codigoEstado: 400, error: 'datos_incompletos' };
  const empleado = await base.select().from(empleados).where(eq(empleados.id, empleadoId)).limit(1);
  if (!empleado[0] || empleado[0].estado !== ESTADO_ACTIVO)
    return { ok: false, codigoEstado: 409, error: 'empleado_inactivo' };
  const [creada] = await base
    .insert(ausencias)
    .values({ empleadoId: empleadoId, fecha: fecha, motivo: motivo, estado: AUSENCIA_REGISTRADA })
    .returning({ id: ausencias.id, empleadoId: ausencias.empleadoId, fecha: ausencias.fecha });
  return { ok: true, datos: creada };
}

export async function listarAusencias() {
  return base
    .select({
      id: ausencias.id,
      empleadoId: empleados.id,
      empleadoNombre: empleados.nombre,
      fecha: ausencias.fecha,
      motivo: ausencias.motivo,
      estado: ausencias.estado,
    })
    .from(ausencias)
    .innerJoin(empleados, eq(ausencias.empleadoId, empleados.id))
    .orderBy(desc(ausencias.fecha));
}

export async function justificarAusencia(id: number): Promise<ResultadoRrhh> {
  const filas = await base.select().from(ausencias).where(eq(ausencias.id, id)).limit(1);
  if (!filas[0]) return { ok: false, codigoEstado: 404, error: 'ausencia_no_encontrada' };
  await base.update(ausencias).set({ estado: AUSENCIA_JUSTIFICADA }).where(eq(ausencias.id, id));
  return { ok: true, datos: { id: id, estado: AUSENCIA_JUSTIFICADA } };
}

export async function generarNomina(periodo: string): Promise<ResultadoRrhh> {
  const periodoLimpio = limpiar(periodo);
  if (!/^\d{4}-\d{2}$/.test(periodoLimpio))
    return { ok: false, codigoEstado: 400, error: 'periodo_invalido' };
  const activos = await base.select().from(empleados).where(eq(empleados.estado, ESTADO_ACTIVO));
  let generadas = 0;
  for (const empleado of activos) {
    const existente = await base
      .select()
      .from(nominas)
      .where(and(eq(nominas.periodo, periodoLimpio), eq(nominas.empleadoId, empleado.id)))
      .limit(1);
    if (!existente[0]) {
      await base.insert(nominas).values({
        periodo: periodoLimpio,
        empleadoId: empleado.id,
        salarioBaseCentavos: empleado.salarioBaseCentavos,
        deduccionesCentavos: 0,
        netoCentavos: empleado.salarioBaseCentavos,
        estado: NOMINA_GENERADA,
      });
      generadas++;
    }
  }
  return { ok: true, datos: { periodo: periodoLimpio, generadas: generadas } };
}

export async function listarNominas(periodo?: string) {
  const consulta = base
    .select({
      id: nominas.id,
      periodo: nominas.periodo,
      empleadoId: empleados.id,
      empleadoNombre: empleados.nombre,
      cargoNombre: cargos.nombre,
      salarioBaseCentavos: nominas.salarioBaseCentavos,
      deduccionesCentavos: nominas.deduccionesCentavos,
      netoCentavos: nominas.netoCentavos,
      estado: nominas.estado,
      creadoEn: nominas.creadoEn,
    })
    .from(nominas)
    .innerJoin(empleados, eq(nominas.empleadoId, empleados.id))
    .leftJoin(cargos, eq(empleados.cargoId, cargos.id));
  const filas = periodo
    ? await consulta
        .where(eq(nominas.periodo, periodo))
        .orderBy(asc(nominas.periodo), asc(empleados.nombre))
    : await consulta.orderBy(desc(nominas.periodo), asc(empleados.nombre));
  return filas;
}

export async function pagarNomina(id: number): Promise<ResultadoRrhh> {
  const filas = await base.select().from(nominas).where(eq(nominas.id, id)).limit(1);
  if (!filas[0]) return { ok: false, codigoEstado: 404, error: 'nomina_no_encontrada' };
  if (filas[0].estado !== NOMINA_GENERADA)
    return { ok: false, codigoEstado: 409, error: 'nomina_no_pagable' };
  await base
    .update(nominas)
    .set({ estado: NOMINA_PAGADA, pagadaEn: new Date() })
    .where(eq(nominas.id, id));
  return { ok: true, datos: { id: id, estado: NOMINA_PAGADA } };
}
