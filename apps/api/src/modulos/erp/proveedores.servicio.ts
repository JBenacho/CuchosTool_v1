// Servicio de proveedores del ERP (F5, CU-ERP-001).
// Reglas: nit unico; solo roles de compras/admin pueden operar; no se elimina, se inactiva.
// Datos de contacto del proveedor: correo, direccion de sede y sitio web (validacion de correo).
import { asc, eq } from 'drizzle-orm';
import { base } from '../../bd/base';
import { proveedores } from '../../bd/esquema';
import {
  ESTADO_ACTIVO,
  ESTADO_INACTIVO,
  TARIFA_BPS_MAXIMA,
  TARIFA_IVA_BPS_POR_DEFECTO,
} from '../../dominio/constantes';

// Patron basico de correo electronico para validar entrada externa (no hardcodeado por ruta).
const PATRON_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ResultadoProveedor = {
  ok: boolean;
  codigoEstado?: number;
  error?: string;
  datos?: unknown;
};

export interface DatosProveedor {
  nit: string;
  nombre: string;
  contacto?: string;
  telefono?: string;
  correo?: string;
  direccion?: string;
  sitioWeb?: string;
  /** IVA pactado con el proveedor en puntos basicos (1900 = 19,00%, CU-ERP-003). */
  tarifaIvaBps?: number;
}

export interface ProveedorNormalizado {
  nit: string;
  nombre: string;
  contacto: string | null;
  telefono: string | null;
  correo: string | null;
  direccion: string | null;
  sitioWeb: string | null;
  tarifaIvaBps: number;
}

/**
 * Normaliza la tarifa de IVA de un proveedor (CU-ERP-003).
 * Entrada: valor crudo del cuerpo HTTP. Salida: tarifa valida o codigo de error.
 * Reglas: vacio usa el valor por defecto; debe ser entero entre 0 y 10000 bps (0%..100%).
 */
export function normalizarTarifaIva(valor: unknown): { error?: string; tarifa?: number } {
  if (valor === undefined || valor === null || valor === '')
    return { tarifa: TARIFA_IVA_BPS_POR_DEFECTO };
  const tarifa = Number(valor);
  if (!Number.isInteger(tarifa) || tarifa < 0 || tarifa > TARIFA_BPS_MAXIMA)
    return { error: 'tarifa_iva_invalida' };
  return { tarifa: tarifa };
}

/**
 * Normaliza y valida los datos de un proveedor (puro, sin acceso a BD).
 * Entrada: datos crudos del cuerpo HTTP. Salida: campos recortados o codigo de error.
 * Regla: si se recibe correo, debe tener formato valido (correo_invalido).
 */
export function normalizarDatosProveedor(datos: Partial<DatosProveedor>): {
  error?: string;
  datos?: ProveedorNormalizado;
} {
  const nit = String(datos.nit || '').trim();
  const nombre = String(datos.nombre || '').trim();
  if (!nit || !nombre) return { error: 'datos_incompletos' };
  const correo = String(datos.correo || '').trim() || null;
  if (correo && !PATRON_CORREO.test(correo)) return { error: 'correo_invalido' };
  const iva = normalizarTarifaIva(datos.tarifaIvaBps);
  if (iva.error) return { error: iva.error };
  return {
    datos: {
      nit: nit,
      nombre: nombre,
      contacto: String(datos.contacto || '').trim() || null,
      telefono: String(datos.telefono || '').trim() || null,
      correo: correo,
      direccion: String(datos.direccion || '').trim() || null,
      sitioWeb: String(datos.sitioWeb || '').trim() || null,
      tarifaIvaBps: iva.tarifa as number,
    },
  };
}

/**
 * Crea un proveedor (CU-ERP-001). Guard clauses: nit y nombre requeridos; nit unico.
 */
export async function crearProveedor(datos: DatosProveedor): Promise<ResultadoProveedor> {
  const normalizado = normalizarDatosProveedor(datos);
  if (normalizado.error) return { ok: false, codigoEstado: 400, error: normalizado.error };
  const { nit, nombre, contacto, telefono, correo, direccion, sitioWeb, tarifaIvaBps } =
    normalizado.datos as ProveedorNormalizado;
  const existente = await base.select().from(proveedores).where(eq(proveedores.nit, nit)).limit(1);
  if (existente[0]) return { ok: false, codigoEstado: 409, error: 'nit_ya_existe' };
  const [creado] = await base
    .insert(proveedores)
    .values({
      nit: nit,
      nombre: nombre,
      contacto: contacto,
      telefono: telefono,
      correo: correo,
      direccion: direccion,
      sitioWeb: sitioWeb,
      tarifaIvaBps: tarifaIvaBps,
      estado: ESTADO_ACTIVO,
    })
    .returning({
      id: proveedores.id,
      nit: proveedores.nit,
      nombre: proveedores.nombre,
      correo: proveedores.correo,
      direccion: proveedores.direccion,
      sitioWeb: proveedores.sitioWeb,
      tarifaIvaBps: proveedores.tarifaIvaBps,
      estado: proveedores.estado,
    });
  return { ok: true, datos: creado };
}

/**
 * Lista proveedores (activos por defecto).
 */
export async function listarProveedores(soloActivos = true) {
  const consulta = base.select().from(proveedores);
  const filas = soloActivos
    ? await consulta.where(eq(proveedores.estado, ESTADO_ACTIVO)).orderBy(asc(proveedores.nombre))
    : await consulta.orderBy(asc(proveedores.nombre));
  return filas;
}

/**
 * Actualiza datos de contacto/sede de un proveedor (contacto, telefono, correo, direccion, sitio web).
 */
export async function actualizarProveedor(
  id: number,
  cambios: {
    nombre?: string;
    contacto?: string;
    telefono?: string;
    correo?: string;
    direccion?: string;
    sitioWeb?: string;
    tarifaIvaBps?: number;
  },
): Promise<ResultadoProveedor> {
  const existente = await base.select().from(proveedores).where(eq(proveedores.id, id)).limit(1);
  if (!existente[0]) return { ok: false, codigoEstado: 404, error: 'proveedor_no_encontrado' };
  if (cambios.nombre !== undefined) {
    const nombre = String(cambios.nombre).trim();
    if (!nombre) return { ok: false, codigoEstado: 400, error: 'datos_incompletos' };
  }
  if (cambios.correo !== undefined) {
    const correo = String(cambios.correo).trim() || null;
    if (correo && !PATRON_CORREO.test(correo))
      return { ok: false, codigoEstado: 400, error: 'correo_invalido' };
  }
  if (cambios.tarifaIvaBps !== undefined) {
    const iva = normalizarTarifaIva(cambios.tarifaIvaBps);
    if (iva.error) return { ok: false, codigoEstado: 400, error: iva.error };
  }
  const actualizacion: {
    nombre?: string;
    contacto?: string | null;
    telefono?: string | null;
    correo?: string | null;
    direccion?: string | null;
    sitioWeb?: string | null;
    tarifaIvaBps?: number;
    actualizadoEn: Date;
  } = { actualizadoEn: new Date() };
  if (cambios.nombre !== undefined) actualizacion.nombre = String(cambios.nombre).trim();
  if (cambios.contacto !== undefined)
    actualizacion.contacto = String(cambios.contacto).trim() || null;
  if (cambios.telefono !== undefined)
    actualizacion.telefono = String(cambios.telefono).trim() || null;
  if (cambios.correo !== undefined) actualizacion.correo = String(cambios.correo).trim() || null;
  if (cambios.direccion !== undefined)
    actualizacion.direccion = String(cambios.direccion).trim() || null;
  if (cambios.sitioWeb !== undefined)
    actualizacion.sitioWeb = String(cambios.sitioWeb).trim() || null;
  if (cambios.tarifaIvaBps !== undefined)
    actualizacion.tarifaIvaBps = normalizarTarifaIva(cambios.tarifaIvaBps).tarifa;
  await base.update(proveedores).set(actualizacion).where(eq(proveedores.id, id));
  return { ok: true, datos: { id: id } };
}

/**
 * Inactiva un proveedor (CU-ERP-001).
 */
export async function inactivarProveedor(id: number): Promise<ResultadoProveedor> {
  const existente = await base.select().from(proveedores).where(eq(proveedores.id, id)).limit(1);
  if (!existente[0]) return { ok: false, codigoEstado: 404, error: 'proveedor_no_encontrado' };
  await base
    .update(proveedores)
    .set({ estado: ESTADO_INACTIVO, actualizadoEn: new Date() })
    .where(eq(proveedores.id, id));
  return { ok: true, datos: { id: id, estado: ESTADO_INACTIVO } };
}
