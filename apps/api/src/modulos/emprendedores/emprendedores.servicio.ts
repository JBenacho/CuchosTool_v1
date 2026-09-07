// Servicio de emprendedores (CU-EM-001..004, CU-EM-007/010..012).
// Reglas: el Gerente de Zona enrola y avala; el emprendedor gestiona sus productos;
// cada producto de emprendedor pasa por aval antes de ser publico (Default Deny comercial).
import { and, asc, eq } from 'drizzle-orm';
import { base } from '../../bd/base';
import { emprendedores, productos } from '../../bd/esquema';
import {
  EMPRENDEDOR_ACTIVO,
  EMPRENDEDOR_ENROLADO,
  PRODUCTO_ACTIVO,
  PRODUCTO_PENDIENTE_AVAL,
  PRODUCTO_RECHAZADO,
} from '../../dominio/constantes';

export interface DatosEnrolamiento {
  documentoIdentidad: string;
  nombre: string;
  correo: string;
  telefono?: string;
  zonaId?: string;
}

export interface DatosProductoEmprendedor {
  nombre: string;
  slug: string;
  descripcion?: string;
  precioCentavos: number;
  stock: number;
}

export type ResultadoOperacion = {
  ok: boolean;
  codigoEstado?: number;
  error?: string;
  datos?: unknown;
};

/**
 * Enrola un nuevo emprendedor (CU-EM-001). Ejecutado por el Gerente de Zona.
 * Guard clauses: documento y correo unicos; nombre requerido.
 */
export async function enrolarEmprendedor(
  creadoPor: string,
  datos: DatosEnrolamiento,
): Promise<ResultadoOperacion> {
  const documento = String(datos.documentoIdentidad || '').trim();
  const nombre = String(datos.nombre || '').trim();
  const correo = String(datos.correo || '')
    .trim()
    .toLowerCase();
  if (!documento || !nombre || !correo)
    return { ok: false, codigoEstado: 400, error: 'datos_incompletos' };
  const existenteDoc = await base
    .select()
    .from(emprendedores)
    .where(eq(emprendedores.documentoIdentidad, documento))
    .limit(1);
  if (existenteDoc[0]) return { ok: false, codigoEstado: 409, error: 'documento_ya_registrado' };
  const existenteCorreo = await base
    .select()
    .from(emprendedores)
    .where(eq(emprendedores.correo, correo))
    .limit(1);
  if (existenteCorreo[0]) return { ok: false, codigoEstado: 409, error: 'correo_ya_registrado' };
  const [creado] = await base
    .insert(emprendedores)
    .values({
      documentoIdentidad: documento,
      nombre: nombre,
      correo: correo,
      telefono: String(datos.telefono || '').trim() || null,
      zonaId: String(datos.zonaId || '').trim() || null,
      estado: EMPRENDEDOR_ENROLADO,
      creadoPor: creadoPor,
    })
    .returning({
      id: emprendedores.id,
      documentoIdentidad: emprendedores.documentoIdentidad,
      nombre: emprendedores.nombre,
      correo: emprendedores.correo,
      estado: emprendedores.estado,
    });
  return { ok: true, datos: creado };
}

/**
 * Lista emprendedores (consola del Gerente de Zona, CU-EM-002).
 */
export async function listarEmprendedores() {
  return base.select().from(emprendedores).orderBy(asc(emprendedores.id));
}

/**
 * Activa un emprendedor validado (CU-EM-004).
 */
export async function activarEmprendedor(id: number): Promise<ResultadoOperacion> {
  const existente = await base
    .select()
    .from(emprendedores)
    .where(eq(emprendedores.id, id))
    .limit(1);
  if (!existente[0]) return { ok: false, codigoEstado: 404, error: 'emprendedor_no_encontrado' };
  await base
    .update(emprendedores)
    .set({ estado: EMPRENDEDOR_ACTIVO, actualizadoEn: new Date() })
    .where(eq(emprendedores.id, id));
  return { ok: true, datos: { id: id, estado: EMPRENDEDOR_ACTIVO } };
}

/**
 * Crea un producto del emprendedor (CU-EM-007). Nace pendiente de aval (no publico).
 * @param emprendedorId emprendedor autenticado (claim del JWT).
 */
export async function crearProductoEmprendedor(
  emprendedorId: number,
  datos: DatosProductoEmprendedor,
): Promise<ResultadoOperacion> {
  const emprendedor = await base
    .select()
    .from(emprendedores)
    .where(eq(emprendedores.id, emprendedorId))
    .limit(1);
  if (!emprendedor[0]) return { ok: false, codigoEstado: 404, error: 'emprendedor_no_encontrado' };
  if (emprendedor[0].estado !== EMPRENDEDOR_ACTIVO)
    return { ok: false, codigoEstado: 409, error: 'emprendedor_inactivo' };
  const nombre = String(datos.nombre || '').trim();
  const slug = String(datos.slug || '').trim();
  if (!nombre || !slug || !(datos.precioCentavos > 0) || !(datos.stock >= 0))
    return { ok: false, codigoEstado: 400, error: 'datos_incompletos' };
  const slugExistente = await base
    .select()
    .from(productos)
    .where(eq(productos.slug, slug))
    .limit(1);
  if (slugExistente[0]) return { ok: false, codigoEstado: 409, error: 'slug_ya_existe' };
  const [creado] = await base
    .insert(productos)
    .values({
      emprendedorId: emprendedorId,
      nombre: nombre,
      slug: slug,
      descripcion: String(datos.descripcion || '').trim() || null,
      precioCentavos: datos.precioCentavos,
      stock: datos.stock,
      estado: PRODUCTO_PENDIENTE_AVAL,
    })
    .returning({ id: productos.id, slug: productos.slug, estado: productos.estado });
  return { ok: true, datos: creado };
}

/**
 * Decision de aval del Gerente de Zona (CU-EM-011): aprobar hace publico el producto;
 * rechazar lo marca rechazado. Solo productos pendientes de aval.
 */
export async function avalarProducto(
  productoId: number,
  decision: 'aprobar' | 'rechazar',
): Promise<ResultadoOperacion> {
  const producto = await base.select().from(productos).where(eq(productos.id, productoId)).limit(1);
  if (!producto[0]) return { ok: false, codigoEstado: 404, error: 'producto_no_encontrado' };
  if (producto[0].estado !== PRODUCTO_PENDIENTE_AVAL)
    return { ok: false, codigoEstado: 409, error: 'producto_no_avaluable' };
  const estadoNuevo = decision === 'aprobar' ? PRODUCTO_ACTIVO : PRODUCTO_RECHAZADO;
  await base
    .update(productos)
    .set({ estado: estadoNuevo, actualizadoEn: new Date() })
    .where(eq(productos.id, productoId));
  return { ok: true, datos: { id: productoId, estado: estadoNuevo } };
}

/**
 * Lista los productos del emprendedor (CU-EM-008) con su estado de aval.
 */
export async function listarProductosEmprendedor(emprendedorId: number) {
  return base
    .select()
    .from(productos)
    .where(and(eq(productos.emprendedorId, emprendedorId)))
    .orderBy(asc(productos.id));
}
