// Servicio de proveedores del ERP (F5, CU-ERP-001).
// Reglas: nit unico; solo roles de compras/admin pueden operar; no se elimina, se inactiva.
import { asc, eq } from 'drizzle-orm';
import { base } from '../../bd/base';
import { proveedores } from '../../bd/esquema';
import { ESTADO_ACTIVO, ESTADO_INACTIVO } from '../../dominio/constantes';

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
}

export interface ProveedorNormalizado {
  nit: string;
  nombre: string;
  contacto: string | null;
  telefono: string | null;
}

/**
 * Normaliza y valida los datos de un proveedor (puro, sin acceso a BD).
 * Entrada: datos crudos del cuerpo HTTP. Salida: campos recortados o codigo de error.
 */
export function normalizarDatosProveedor(datos: Partial<DatosProveedor>): {
  error?: string;
  datos?: ProveedorNormalizado;
} {
  const nit = String(datos.nit || '').trim();
  const nombre = String(datos.nombre || '').trim();
  if (!nit || !nombre) return { error: 'datos_incompletos' };
  return {
    datos: {
      nit: nit,
      nombre: nombre,
      contacto: String(datos.contacto || '').trim() || null,
      telefono: String(datos.telefono || '').trim() || null,
    },
  };
}

/**
 * Crea un proveedor (CU-ERP-001). Guard clauses: nit y nombre requeridos; nit unico.
 */
export async function crearProveedor(datos: DatosProveedor): Promise<ResultadoProveedor> {
  const normalizado = normalizarDatosProveedor(datos);
  if (normalizado.error) return { ok: false, codigoEstado: 400, error: normalizado.error };
  const { nit, nombre, contacto, telefono } = normalizado.datos as ProveedorNormalizado;
  const existente = await base.select().from(proveedores).where(eq(proveedores.nit, nit)).limit(1);
  if (existente[0]) return { ok: false, codigoEstado: 409, error: 'nit_ya_existe' };
  const [creado] = await base
    .insert(proveedores)
    .values({
      nit: nit,
      nombre: nombre,
      contacto: contacto,
      telefono: telefono,
      estado: ESTADO_ACTIVO,
    })
    .returning({
      id: proveedores.id,
      nit: proveedores.nit,
      nombre: proveedores.nombre,
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
 * Actualiza datos de contacto de un proveedor.
 */
export async function actualizarProveedor(
  id: number,
  cambios: { contacto?: string; telefono?: string },
): Promise<ResultadoProveedor> {
  const existente = await base.select().from(proveedores).where(eq(proveedores.id, id)).limit(1);
  if (!existente[0]) return { ok: false, codigoEstado: 404, error: 'proveedor_no_encontrado' };
  const actualizacion: { contacto?: string | null; telefono?: string | null; actualizadoEn: Date } =
    { actualizadoEn: new Date() };
  if (cambios.contacto !== undefined)
    actualizacion.contacto = String(cambios.contacto).trim() || null;
  if (cambios.telefono !== undefined)
    actualizacion.telefono = String(cambios.telefono).trim() || null;
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
