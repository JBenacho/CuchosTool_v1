// Servicio Comercial B2B (CU-CM-001/004/007, F5): clientes ERP con cupo en COP y ordenes corporativas.
// Reglas clave: nit/cliente unico; cupo en COP; orden confirmada descuenta stock ACID por linea;
// forma de pago credito valida el cupo disponible; estados confirmada/pagada/anulada.
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { base } from '../../bd/base';
import {
  bodegas,
  clientesEmpresa,
  ordenVentaB2bArticulos,
  ordenesVentaB2b,
  productos,
} from '../../bd/esquema';
import {
  ESTADO_ACTIVO,
  ESTADO_INACTIVO,
  EVENTO_VENTA_B2B_CREADA,
  VENTA_B2B_ANULADA,
  VENTA_B2B_CONFIRMADA,
  VENTA_B2B_PAGADA,
} from '../../dominio/constantes';
import { encolarEvento } from '../eventos/buzon.servicio';
import { registrarEntrada, registrarSalida } from '../inventario/inventario.servicio';

export type ResultadoComercial = {
  ok: boolean;
  codigoEstado?: number;
  error?: string;
  datos?: unknown;
};

function limpiar(valor: unknown): string {
  return String(valor || '').trim();
}

// ------------------------------- Clientes ERP (CU-CM-004) -------------------------------
export async function listarClientesEmpresa() {
  return base.select().from(clientesEmpresa).orderBy(asc(clientesEmpresa.razonSocial));
}
export async function crearClienteEmpresa(datos: any): Promise<ResultadoComercial> {
  const nit = limpiar(datos.nit);
  const razonSocial = limpiar(datos.razonSocial);
  if (!nit || !razonSocial) return { ok: false, codigoEstado: 400, error: 'datos_incompletos' };
  const existente = await base
    .select()
    .from(clientesEmpresa)
    .where(eq(clientesEmpresa.nit, nit))
    .limit(1);
  if (existente[0]) return { ok: false, codigoEstado: 409, error: 'nit_ya_existe' };
  const [creado] = await base
    .insert(clientesEmpresa)
    .values({
      nit: nit,
      razonSocial: razonSocial,
      contacto: limpiar(datos.contacto) || null,
      telefono: limpiar(datos.telefono) || null,
      correo: limpiar(datos.correo) || null,
      cupoCreditoCentavos: Math.max(Number(datos.cupoCreditoCentavos) || 0, 0),
      estado: ESTADO_ACTIVO,
    })
    .returning({ id: clientesEmpresa.id, nit: clientesEmpresa.nit });
  return { ok: true, datos: creado };
}
export async function inactivarClienteEmpresa(id: number): Promise<ResultadoComercial> {
  const filas = await base
    .select()
    .from(clientesEmpresa)
    .where(eq(clientesEmpresa.id, id))
    .limit(1);
  if (!filas[0]) return { ok: false, codigoEstado: 404, error: 'cliente_no_encontrado' };
  const pendiente = await base
    .select()
    .from(ordenesVentaB2b)
    .where(
      and(
        eq(ordenesVentaB2b.clienteEmpresaId, id),
        eq(ordenesVentaB2b.estado, VENTA_B2B_CONFIRMADA),
      ),
    )
    .limit(1);
  if (pendiente[0]) return { ok: false, codigoEstado: 409, error: 'cliente_con_cartera' };
  await base
    .update(clientesEmpresa)
    .set({ estado: ESTADO_INACTIVO, actualizadoEn: new Date() })
    .where(eq(clientesEmpresa.id, id));
  return { ok: true, datos: { id: id } };
}

// ------------------------------- Ordenes B2B (CU-CM-007) -------------------------------
function like(columna: unknown, patron: string) {
  return sql`${columna} like ${patron}`;
}
async function proximoFolio(): Promise<string> {
  const anio = new Date().getFullYear();
  const filas = await base
    .select({ folio: ordenesVentaB2b.folio })
    .from(ordenesVentaB2b)
    .where(like(ordenesVentaB2b.folio, 'SV-' + anio + '-%'))
    .orderBy(desc(ordenesVentaB2b.folio))
    .limit(1);
  const ultimo = filas[0] ? parseInt(String(filas[0].folio).split('-').pop() || '0', 10) : 0;
  return 'SV-' + anio + '-' + String(ultimo + 1).padStart(6, '0');
}

export async function cupoDisponibleCliente(clienteId: number): Promise<number> {
  const cliente = await base
    .select()
    .from(clientesEmpresa)
    .where(eq(clientesEmpresa.id, clienteId))
    .limit(1);
  if (!cliente[0]) return 0;
  const abiertas = await base
    .select({ totalCentavos: ordenesVentaB2b.totalCentavos })
    .from(ordenesVentaB2b)
    .where(
      and(
        eq(ordenesVentaB2b.clienteEmpresaId, clienteId),
        eq(ordenesVentaB2b.estado, VENTA_B2B_CONFIRMADA),
      ),
    );
  const usado = abiertas.reduce(function (s, o) {
    return s + o.totalCentavos;
  }, 0);
  return cliente[0].cupoCreditoCentavos - usado;
}

export async function crearOrdenVentaB2b(datos: any, actor: any): Promise<ResultadoComercial> {
  const clienteId = Number(datos.clienteEmpresaId);
  const bodegaId = Number(datos.bodegaId);
  const formaPago = datos.formaPago === 'contado' ? 'contado' : 'credito';
  const lineas = Array.isArray(datos.lineas) ? datos.lineas : [];
  if (!clienteId || !bodegaId || lineas.length === 0)
    return { ok: false, codigoEstado: 400, error: 'datos_incompletos' };
  const cliente = await base
    .select()
    .from(clientesEmpresa)
    .where(eq(clientesEmpresa.id, clienteId))
    .limit(1);
  if (!cliente[0] || cliente[0].estado !== ESTADO_ACTIVO)
    return { ok: false, codigoEstado: 409, error: 'cliente_inactivo' };
  const bodega = await base.select().from(bodegas).where(eq(bodegas.id, bodegaId)).limit(1);
  if (!bodega[0] || bodega[0].estado !== ESTADO_ACTIVO)
    return { ok: false, codigoEstado: 409, error: 'bodega_inactiva' };

  const detalles: { productoId: number; cantidad: number; precio: number }[] = [];
  let subtotal = 0;
  for (const linea of lineas) {
    const productoId = Number(linea.productoId);
    const cantidad = Number(linea.cantidad);
    if (!productoId || !Number.isInteger(cantidad) || cantidad <= 0)
      return { ok: false, codigoEstado: 400, error: 'linea_invalida' };
    const prod = await base.select().from(productos).where(eq(productos.id, productoId)).limit(1);
    if (!prod[0] || prod[0].estado !== ESTADO_ACTIVO)
      return { ok: false, codigoEstado: 409, error: 'producto_inactivo' };
    const precio = prod[0].precioCentavos;
    subtotal += precio * cantidad;
    detalles.push({ productoId: productoId, cantidad: cantidad, precio: precio });
  }
  if (formaPago === 'credito') {
    const disponible = await cupoDisponibleCliente(clienteId);
    if (subtotal > disponible)
      return {
        ok: false,
        codigoEstado: 422,
        error: 'cupo_insuficiente',
        datos: { disponible: disponible },
      };
  }

  // Descuento de inventario por linea (CU-CM-007 RN-CM-02) con compensacion si algo falla.
  for (const detalle of detalles) {
    const salida = await registrarSalida(
      {
        bodegaId: bodegaId,
        productoId: detalle.productoId,
        cantidad: detalle.cantidad,
        motivo: 'Venta B2B',
        referencia: 'PENDIENTE',
      },
      actor,
    );
    if (!salida.ok) {
      for (const previo of detalles) {
        if (previo.productoId === detalle.productoId) break;
        await registrarEntrada(
          {
            bodegaId: bodegaId,
            productoId: previo.productoId,
            cantidad: previo.cantidad,
            motivo: 'Revertir venta B2B fallida',
          },
          actor,
        );
      }
      return { ok: false, codigoEstado: 422, error: 'stock_insuficiente' };
    }
  }
  const folio = await proximoFolio();
  const [orden] = await base
    .insert(ordenesVentaB2b)
    .values({
      folio: folio,
      clienteEmpresaId: clienteId,
      vendedorId: String(actor.id || 'anonimo'),
      bodegaId: bodegaId,
      formaPago: formaPago,
      subtotalCentavos: subtotal,
      totalCentavos: subtotal,
      estado: VENTA_B2B_CONFIRMADA,
    })
    .returning({
      id: ordenesVentaB2b.id,
      folio: ordenesVentaB2b.folio,
      estado: ordenesVentaB2b.estado,
    });
  await base.insert(ordenVentaB2bArticulos).values(
    detalles.map(function (d) {
      return {
        ordenId: orden.id,
        productoId: d.productoId,
        cantidad: d.cantidad,
        precioUnitarioCentavos: d.precio,
        subtotalCentavos: d.precio * d.cantidad,
      };
    }),
  );
  await encolarEvento(base, {
    tipoAgregado: 'OrdenVentaB2b',
    idAgregado: folio,
    tipoEvento: EVENTO_VENTA_B2B_CREADA,
    claveIdempotencia: folio,
    datos: { folio: folio, clienteId: clienteId, totalCentavos: subtotal },
  });
  return {
    ok: true,
    datos: { id: orden.id, folio: folio, estado: VENTA_B2B_CONFIRMADA, totalCentavos: subtotal },
  };
}

export async function listarOrdenesB2b() {
  return base
    .select({
      id: ordenesVentaB2b.id,
      folio: ordenesVentaB2b.folio,
      clienteEmpresaId: clientesEmpresa.id,
      clienteRazonSocial: clientesEmpresa.razonSocial,
      bodegaNombre: bodegas.nombre,
      formaPago: ordenesVentaB2b.formaPago,
      totalCentavos: ordenesVentaB2b.totalCentavos,
      estado: ordenesVentaB2b.estado,
      creadoEn: ordenesVentaB2b.creadoEn,
    })
    .from(ordenesVentaB2b)
    .innerJoin(clientesEmpresa, eq(ordenesVentaB2b.clienteEmpresaId, clientesEmpresa.id))
    .innerJoin(bodegas, eq(ordenesVentaB2b.bodegaId, bodegas.id))
    .orderBy(desc(ordenesVentaB2b.id));
}
export async function obtenerOrdenB2b(id: number) {
  const orden = await base
    .select()
    .from(ordenesVentaB2b)
    .where(eq(ordenesVentaB2b.id, id))
    .limit(1);
  if (!orden[0]) return null;
  const lineas = await base
    .select({
      productoNombre: productos.nombre,
      cantidad: ordenVentaB2bArticulos.cantidad,
      precioUnitarioCentavos: ordenVentaB2bArticulos.precioUnitarioCentavos,
      subtotalCentavos: ordenVentaB2bArticulos.subtotalCentavos,
    })
    .from(ordenVentaB2bArticulos)
    .innerJoin(productos, eq(ordenVentaB2bArticulos.productoId, productos.id))
    .where(eq(ordenVentaB2bArticulos.ordenId, orden[0].id));
  return { ...orden[0], lineas: lineas };
}
export async function pagarOrdenB2b(id: number): Promise<ResultadoComercial> {
  const filas = await base
    .select()
    .from(ordenesVentaB2b)
    .where(eq(ordenesVentaB2b.id, id))
    .limit(1);
  if (!filas[0]) return { ok: false, codigoEstado: 404, error: 'orden_no_encontrada' };
  if (filas[0].estado !== VENTA_B2B_CONFIRMADA)
    return { ok: false, codigoEstado: 409, error: 'orden_no_pagable' };
  await base
    .update(ordenesVentaB2b)
    .set({ estado: VENTA_B2B_PAGADA, actualizadoEn: new Date() })
    .where(eq(ordenesVentaB2b.id, id));
  return { ok: true, datos: { id: id, estado: VENTA_B2B_PAGADA } };
}
export async function anularOrdenB2b(id: number, actor: any): Promise<ResultadoComercial> {
  const filas = await base
    .select()
    .from(ordenesVentaB2b)
    .where(eq(ordenesVentaB2b.id, id))
    .limit(1);
  if (!filas[0]) return { ok: false, codigoEstado: 404, error: 'orden_no_encontrada' };
  if (filas[0].estado !== VENTA_B2B_CONFIRMADA)
    return { ok: false, codigoEstado: 409, error: 'orden_no_anulable' };
  const lineas = await base
    .select()
    .from(ordenVentaB2bArticulos)
    .where(eq(ordenVentaB2bArticulos.ordenId, id));
  for (const linea of lineas) {
    await registrarEntrada(
      {
        bodegaId: filas[0].bodegaId,
        productoId: linea.productoId,
        cantidad: linea.cantidad,
        motivo: 'Anulacion ' + filas[0].folio,
        referencia: filas[0].folio,
      },
      actor,
    );
  }
  await base
    .update(ordenesVentaB2b)
    .set({ estado: VENTA_B2B_ANULADA, actualizadoEn: new Date() })
    .where(eq(ordenesVentaB2b.id, id));
  return { ok: true, datos: { id: id, estado: VENTA_B2B_ANULADA } };
}
