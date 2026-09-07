// Servicio de emprendedores (CU-EM-001..004, CU-EM-007/010..012).
// Reglas: el Gerente de Zona enrola y avala; el emprendedor gestiona sus productos;
// cada producto de emprendedor pasa por aval antes de ser publico (Default Deny comercial).
import { and, asc, count, eq, inArray, sql, sum } from 'drizzle-orm';
import { base } from '../../bd/base';
import { emprendedores, ofertas, pedidoArticulos, pedidos, productos } from '../../bd/esquema';
import {
  EMPRENDEDOR_SUSPENDIDO,
  ESTADOS_PEDIDO_VENTA_EFECTIVA,
  OFERTA_ACTIVA,
  OFERTA_INACTIVA,
} from '../../dominio/constantes';
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

/**
 * Configura los medios de envio y pago del emprendedor (CU-EM-005/006).
 * @param id id del emprendedor.
 * @param medios campos opcionales a actualizar.
 */
export async function configurarMediosEmprendedor(
  id: number,
  medios: { medioEnvio?: string; medioPagoElectronico?: string },
): Promise<ResultadoOperacion> {
  const existente = await base
    .select()
    .from(emprendedores)
    .where(eq(emprendedores.id, id))
    .limit(1);
  if (!existente[0]) return { ok: false, codigoEstado: 404, error: 'emprendedor_no_encontrado' };
  const cambios: {
    medioEnvio?: string | null;
    medioPagoElectronico?: string | null;
    actualizadoEn: Date;
  } = {
    actualizadoEn: new Date(),
  };
  if (medios.medioEnvio !== undefined)
    cambios.medioEnvio = String(medios.medioEnvio).trim() || null;
  if (medios.medioPagoElectronico !== undefined)
    cambios.medioPagoElectronico = String(medios.medioPagoElectronico).trim() || null;
  await base.update(emprendedores).set(cambios).where(eq(emprendedores.id, id));
  return {
    ok: true,
    datos: {
      id: id,
      medioEnvio: cambios.medioEnvio,
      medioPagoElectronico: cambios.medioPagoElectronico,
    },
  };
}

/**
 * Crea una oferta del emprendedor (CU-EM-013).
 * Reglas: descuento entre 0 y 10000 bps; la vigencia debe ser valida.
 */
export async function crearOferta(
  emprendedorId: number,
  datos: { nombre: string; descuentoBps: number; iniciaEn: string; finalizaEn: string },
): Promise<ResultadoOperacion> {
  const nombre = String(datos.nombre || '').trim();
  const descuentoBps = Number(datos.descuentoBps);
  const iniciaEn = new Date(datos.iniciaEn);
  const finalizaEn = new Date(datos.finalizaEn);
  if (!nombre) return { ok: false, codigoEstado: 400, error: 'nombre_requerido' };
  if (!(descuentoBps >= 0 && descuentoBps <= 10000))
    return { ok: false, codigoEstado: 400, error: 'descuento_invalido' };
  if (
    Number.isNaN(iniciaEn.getTime()) ||
    Number.isNaN(finalizaEn.getTime()) ||
    iniciaEn >= finalizaEn
  )
    return { ok: false, codigoEstado: 400, error: 'vigencia_invalida' };
  const [creada] = await base
    .insert(ofertas)
    .values({
      emprendedorId: emprendedorId,
      nombre: nombre,
      descuentoBps: descuentoBps,
      iniciaEn: iniciaEn,
      finalizaEn: finalizaEn,
      estado: OFERTA_ACTIVA,
    })
    .returning({
      id: ofertas.id,
      nombre: ofertas.nombre,
      descuentoBps: ofertas.descuentoBps,
      estado: ofertas.estado,
    });
  return { ok: true, datos: creada };
}

/**
 * Lista las ofertas del emprendedor (CU-EM-013).
 */
export async function listarOfertasEmprendedor(emprendedorId: number) {
  return base
    .select()
    .from(ofertas)
    .where(eq(ofertas.emprendedorId, emprendedorId))
    .orderBy(asc(ofertas.id));
}

/**
 * Activa o inactiva una oferta propia (CU-EM-013).
 */
export async function cambiarEstadoOferta(
  ofertaId: number,
  emprendedorId: number,
  estado: string,
): Promise<ResultadoOperacion> {
  if (estado !== OFERTA_ACTIVA && estado !== OFERTA_INACTIVA)
    return { ok: false, codigoEstado: 400, error: 'estado_invalido' };
  const filas = await base
    .select()
    .from(ofertas)
    .where(and(eq(ofertas.id, ofertaId), eq(ofertas.emprendedorId, emprendedorId)))
    .limit(1);
  if (!filas[0]) return { ok: false, codigoEstado: 404, error: 'oferta_no_encontrada' };
  await base
    .update(ofertas)
    .set({ estado: estado, actualizadoEn: new Date() })
    .where(eq(ofertas.id, ofertaId));
  return { ok: true, datos: { id: ofertaId, estado: estado } };
}

/**
 * Reporte de ventas del emprendedor (CU-EM-014): articulos vendidos y monto total
 * sobre pedidos con venta efectiva (pagados o entregados).
 */
export async function reportesEmprendedor(emprendedorId: number) {
  const filas = await base
    .select({
      articulosVendidos: sum(pedidoArticulos.cantidad),
      montoTotalCentavos: sum(
        sql`${pedidoArticulos.cantidad} * ${pedidoArticulos.precioUnitarioCentavos}`,
      ),
      pedidos: count(),
    })
    .from(pedidoArticulos)
    .innerJoin(productos, eq(pedidoArticulos.productoId, productos.id))
    .innerJoin(pedidos, eq(pedidoArticulos.pedidoId, pedidos.id))
    .where(
      and(
        eq(productos.emprendedorId, emprendedorId),
        inArray(pedidos.estado, [...ESTADOS_PEDIDO_VENTA_EFECTIVA]),
      ),
    );
  const fila = filas[0];
  return {
    articulosVendidos: Number(fila && fila.articulosVendidos ? fila.articulosVendidos : 0),
    montoTotalCentavos: Number(fila && fila.montoTotalCentavos ? fila.montoTotalCentavos : 0),
    pedidos: Number(fila && fila.pedidos ? fila.pedidos : 0),
  };
}

/**
 * Suspende un emprendedor (CU-EM-002). Solo emprendedores activos.
 */
export async function suspenderEmprendedor(id: number): Promise<ResultadoOperacion> {
  const existente = await base.select().from(emprendedores).where(eq(emprendedores.id, id)).limit(1);
  if (!existente[0]) return { ok: false, codigoEstado: 404, error: 'emprendedor_no_encontrado' };
  if (existente[0].estado !== EMPRENDEDOR_ACTIVO) return { ok: false, codigoEstado: 409, error: 'emprendedor_no_suspendible' };
  await base.update(emprendedores).set({ estado: EMPRENDEDOR_SUSPENDIDO, actualizadoEn: new Date() }).where(eq(emprendedores.id, id));
  return { ok: true, datos: { id: id, estado: EMPRENDEDOR_SUSPENDIDO } };
}

/**
 * Configura el servicio logistico del emprendedor (CU-EM-019).
 */
export async function configurarLogisticaEmprendedor(id: number, proveedorLogistico: string): Promise<ResultadoOperacion> {
  const existente = await base.select().from(emprendedores).where(eq(emprendedores.id, id)).limit(1);
  if (!existente[0]) return { ok: false, codigoEstado: 404, error: 'emprendedor_no_encontrado' };
  const proveedor = String(proveedorLogistico || '').trim();
  if (!proveedor) return { ok: false, codigoEstado: 400, error: 'proveedor_requerido' };
  await base.update(emprendedores).set({ proveedorLogistico: proveedor, actualizadoEn: new Date() }).where(eq(emprendedores.id, id));
  return { ok: true, datos: { id: id, proveedorLogistico: proveedor } };
}

