// Servicio de pedidos (Order Service, CU-ARCH-001 / CU-EC-008).
// Responsabilidades: validar articulos y stock, calcular totales, persistir pedido y
// registrar el evento OrderCreated en el buzon transaccional (CU-INT-001, BL-033).
import { randomUUID } from 'crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { base } from '../../bd/base';
import { eventosBuzon, pedidoArticulos, pedidos, productos } from '../../bd/esquema';
import {
  COSTO_ENVIO_CENTAVOS,
  ESTADO_ACTIVO,
  EVENTO_PEDIDO_CREADO,
  MONEDA_COP,
  PEDIDO_PENDIENTE_PAGO,
} from '../../dominio/constantes';

export interface ArticuloPedido {
  productoId: number;
  cantidad: number;
}

export type ResultadoCrearPedido =
  | { creado: true; referenciaPedido: string; totalCentavos: number }
  | { creado: false; codigoEstado: number; error: string; productoId?: number; stock?: number };

/**
 * Genera la referencia publica del pedido (ej. ORD-1A2B3C4D5E6F).
 * Usa uuid v4 para evitar colisiones sin depender de la secuencia interna.
 */
function generarReferenciaPedido(): string {
  return 'ORD-' + randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
}

/**
 * Calculo puro de totales del pedido (unidad testeable sin base de datos).
 * @param articulos articulos solicitados.
 * @param precioDe funcion que devuelve el precio unitario en centavos por producto.
 * @returns subtotal, envio y total en centavos.
 */
export function calcularTotales(
  articulos: ArticuloPedido[],
  precioDe: (productoId: number) => number | undefined,
): { subtotalCentavos: number; envioCentavos: number; totalCentavos: number } {
  const subtotalCentavos = articulos.reduce(function (acumulado, articulo) {
    return acumulado + (precioDe(articulo.productoId) || 0) * articulo.cantidad;
  }, 0);
  // Costo de envio por definir (regla logistica pendiente en F3); constante nombrada.
  const envioCentavos = COSTO_ENVIO_CENTAVOS;
  return {
    subtotalCentavos: subtotalCentavos,
    envioCentavos: envioCentavos,
    totalCentavos: subtotalCentavos + envioCentavos,
  };
}

/**
 * Crea un pedido transaccionalmente y registra su evento en el buzon.
 * Reglas de negocio: solo productos activos; cantidad minima 1; la cantidad no puede
 * superar el stock disponible; clave de idempotencia evita pedidos duplicados (RN-INT-003).
 * @param clienteId identificador del cliente autenticado (sub del JWT).
 * @param claveIdempotencia clave opcional enviada por el cliente (Idempotency-Key).
 * @param articulos articulos solicitados desde el checkout o carrito.
 */
export async function crearPedido(
  clienteId: string,
  claveIdempotencia: string | undefined,
  articulos: ArticuloPedido[],
): Promise<ResultadoCrearPedido> {
  if (articulos.length === 0)
    return { creado: false, codigoEstado: 400, error: 'articulos_invalidos' };

  // Idempotencia: si la clave ya fue usada, se devuelve el pedido existente sin duplicar.
  if (claveIdempotencia) {
    const existentes = await base
      .select()
      .from(pedidos)
      .where(eq(pedidos.claveIdempotencia, claveIdempotencia))
      .limit(1);
    if (existentes[0])
      return {
        creado: true,
        referenciaPedido: existentes[0].referenciaPedido,
        totalCentavos: existentes[0].totalCentavos,
      };
  }

  const idsProducto = Array.from(
    new Set(
      articulos.map(function (a) {
        return a.productoId;
      }),
    ),
  );
  const filasProductos = await base
    .select()
    .from(productos)
    .where(and(inArray(productos.id, idsProducto), eq(productos.estado, ESTADO_ACTIVO)));
  const precioPorProducto = new Map(
    filasProductos.map(function (p) {
      return [p.id, p];
    }),
  );

  for (const articulo of articulos) {
    const producto = precioPorProducto.get(articulo.productoId);
    if (!producto)
      return {
        creado: false,
        codigoEstado: 422,
        error: 'producto_no_disponible',
        productoId: articulo.productoId,
      };
    if (!(articulo.cantidad >= 1))
      return {
        creado: false,
        codigoEstado: 400,
        error: 'cantidad_invalida',
        productoId: articulo.productoId,
      };
    if (articulo.cantidad > producto.stock)
      return {
        creado: false,
        codigoEstado: 409,
        error: 'stock_insuficiente',
        productoId: articulo.productoId,
        stock: producto.stock,
      };
  }

  const totales = calcularTotales(articulos, function (id) {
    const p = precioPorProducto.get(id);
    return p ? p.precioCentavos : undefined;
  });
  const referenciaPedido = generarReferenciaPedido();
  const correlacionId = randomUUID();

  await base.transaction(async function (transaccion) {
    const [creado] = await transaccion
      .insert(pedidos)
      .values({
        referenciaPedido: referenciaPedido,
        clienteId: clienteId,
        estado: PEDIDO_PENDIENTE_PAGO,
        subtotalCentavos: totales.subtotalCentavos,
        envioCentavos: totales.envioCentavos,
        totalCentavos: totales.totalCentavos,
        moneda: MONEDA_COP,
        claveIdempotencia: claveIdempotencia || null,
      })
      .returning({ id: pedidos.id });

    await transaccion.insert(pedidoArticulos).values(
      articulos.map(function (a) {
        return {
          pedidoId: creado.id,
          productoId: a.productoId,
          cantidad: a.cantidad,
          precioUnitarioCentavos: precioPorProducto.get(a.productoId)!.precioCentavos,
        };
      }),
    );

    // Buzon transaccional: el evento se publica en la misma transaccion (sin perdida).
    await transaccion.insert(eventosBuzon).values({
      tipoAgregado: 'Pedido',
      idAgregado: referenciaPedido,
      tipoEvento: EVENTO_PEDIDO_CREADO,
      correlacionId: correlacionId,
      claveIdempotencia: claveIdempotencia || null,
      carga: {
        eventId: randomUUID(),
        type: EVENTO_PEDIDO_CREADO,
        version: '1.0',
        occurredAt: new Date().toISOString(),
        correlationId: correlacionId,
        idempotencyKey: claveIdempotencia || null,
        data: {
          pedidoId: referenciaPedido,
          clienteId: clienteId,
          articulos: articulos,
          subtotalCentavos: totales.subtotalCentavos,
          envioCentavos: totales.envioCentavos,
          totalCentavos: totales.totalCentavos,
          moneda: MONEDA_COP,
        },
      },
    });
  });

  return { creado: true, referenciaPedido: referenciaPedido, totalCentavos: totales.totalCentavos };
}
