// Servicio de catalogo (capa de negocio).
// Unica puerta de acceso a productos/categorias: las rutas no consultan la base directamente.
import { and, asc, eq, sql } from 'drizzle-orm';
import { base } from '../../bd/base';
import { categorias, productos } from '../../bd/esquema';
import { CATALOGO_LIMITE_DEFECTO, CATALOGO_LIMITE_MAXIMO, ESTADO_ACTIVO } from '../../dominio/constantes';

// Resumen de producto que expone la API (nunca se expone la fila cruda de la base).
export interface ProductoResumen {
  id: number;
  slug: string;
  nombre: string;
  descripcion: string | null;
  precioCentavos: number;
  moneda: string;
  stock: number;
  urlImagen: string | null;
  categoria: string | null;
}

export interface FiltroCatalogo {
  busqueda: string;
  limite: number;
  desplazamiento: number;
}

/**
 * Convierte centavos a texto legible en pesos colombianos.
 * @param centavos monto en centavos.
 * @returns texto como '$ 145.000'.
 */
export function formatearPrecioPesos(centavos: number): string {
  return '$ ' + (centavos / 100).toLocaleString('es-CO', { minimumFractionDigits: 0 });
}

/**
 * Normaliza los limites de paginacion recibidos desde la API (dato externo).
 * Regla: ningun cliente puede pedir mas de CATALOGO_LIMITE_MAXIMO registros.
 */
function normalizarLimites(valorLimite: string | undefined, valorDesplazamiento: string | undefined): { limite: number; desplazamiento: number } {
  const limite = Math.min(parseInt(valorLimite || '', 10) || CATALOGO_LIMITE_DEFECTO, CATALOGO_LIMITE_MAXIMO);
  const desplazamiento = Math.max(parseInt(valorDesplazamiento || '', 10) || 0, 0);
  return { limite: limite, desplazamiento: desplazamiento };
}

/**
 * Lista productos activos del catalogo publico (CU-EC-001/002).
 * @param busqueda texto opcional de busqueda por nombre o descripcion.
 * @param valorLimite, valorDesplazamiento valores crudos del query string (se normalizan).
 * @returns productos activos junto con totales de paginacion.
 */
export async function listarProductosActivos(busqueda: string, valorLimite?: string, valorDesplazamiento?: string) {
  const { limite, desplazamiento } = normalizarLimites(valorLimite, valorDesplazamiento);
  const texto = (busqueda || '').trim();
  const condiciones = [eq(productos.estado, ESTADO_ACTIVO)];
  if (texto) {
    const patron = '%' + texto.toLowerCase() + '%';
    condiciones.push(sql`(${productos.nombre} ilike ${patron} or coalesce(${productos.descripcion}, '') ilike ${patron})`);
  }
  const filas = await base
    .select({
      id: productos.id,
      slug: productos.slug,
      nombre: productos.nombre,
      descripcion: productos.descripcion,
      precioCentavos: productos.precioCentavos,
      moneda: productos.moneda,
      stock: productos.stock,
      urlImagen: productos.urlImagen,
      categoria: categorias.slug,
    })
    .from(productos)
    .leftJoin(categorias, eq(productos.categoriaId, categorias.id))
    .where(and(...condiciones))
    .orderBy(asc(productos.id))
    .limit(limite)
    .offset(desplazamiento);
  return { filas: filas, limite: limite, desplazamiento: desplazamiento };
}

/**
 * Obtiene un producto activo por id (CU-EC-004).
 * @returns el resumen del producto o null si no existe o esta inactivo.
 */
export async function obtenerProductoActivo(id: number): Promise<ProductoResumen | null> {
  const filas = await base
    .select({
      id: productos.id,
      slug: productos.slug,
      nombre: productos.nombre,
      descripcion: productos.descripcion,
      precioCentavos: productos.precioCentavos,
      moneda: productos.moneda,
      stock: productos.stock,
      urlImagen: productos.urlImagen,
      categoria: categorias.slug,
    })
    .from(productos)
    .leftJoin(categorias, eq(productos.categoriaId, categorias.id))
    .where(and(eq(productos.id, id), eq(productos.estado, ESTADO_ACTIVO)))
    .limit(1);
  return filas[0] || null;
}
