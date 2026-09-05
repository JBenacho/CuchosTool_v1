// Esquema de datos de CuchosTool (capa de datos).
// Convencion: tablas y campos en espanol (snake_case en base de datos), camelCase en el codigo.
// Precios en centavos (bigint) para evitar errores de redondeo con decimales.
import {
  pgTable,
  serial,
  text,
  integer,
  bigint,
  timestamp,
  index,
  jsonb,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// Catalogo publico (CU-EC-001..006).
export const categorias = pgTable('categorias', {
  id: serial('id').primaryKey(),
  nombre: text('nombre').notNull(),
  slug: text('slug').notNull().unique(),
  posicion: integer('posicion').notNull().default(0),
});

export const productos = pgTable(
  'productos',
  {
    id: serial('id').primaryKey(),
    categoriaId: integer('categoria_id').references(() => categorias.id),
    nombre: text('nombre').notNull(),
    slug: text('slug').notNull().unique(),
    descripcion: text('descripcion'),
    precioCentavos: bigint('precio_centavos', { mode: 'number' }).notNull(),
    moneda: text('moneda').notNull().default('COP'),
    estado: text('estado').notNull().default('ACTIVO'),
    stock: integer('stock').notNull().default(0),
    urlImagen: text('url_imagen'),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (tabla) => [
    index('productos_categoria_idx').on(tabla.categoriaId),
    index('productos_estado_idx').on(tabla.estado),
  ],
);

// Cliente del canal E-Commerce (CU-EC-013/014).
export const clientes = pgTable('clientes', {
  id: serial('id').primaryKey(),
  correo: text('correo').notNull().unique(),
  hashContrasena: text('hash_contrasena').notNull(),
  nombre: text('nombre').notNull(),
  estado: text('estado').notNull().default('ACTIVO'),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
});

// Carrito de compra (CU-EC-007). Precios se resuelven vivos al pagar.
export const carritos = pgTable('carritos', {
  id: serial('id').primaryKey(),
  clienteId: text('cliente_id').notNull().unique(),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
});

export const carritoArticulos = pgTable(
  'carrito_articulos',
  {
    id: serial('id').primaryKey(),
    carritoId: integer('carrito_id')
      .notNull()
      .references(() => carritos.id),
    productoId: integer('producto_id').notNull(),
    cantidad: integer('cantidad').notNull(),
    agregadoEn: timestamp('agregado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (tabla) => [
    uniqueIndex('carrito_articulos_carrito_producto_idx').on(tabla.carritoId, tabla.productoId),
  ],
);

// Pedido empresarial unico (CU-ARCH-001 / CU-EC-008). Order Service es dueno del ciclo (RN-GOB-003).
export const pedidos = pgTable('pedidos', {
  id: serial('id').primaryKey(),
  referenciaPedido: text('referencia_pedido').notNull().unique(),
  clienteId: text('cliente_id').notNull(),
  estado: text('estado').notNull().default('pendiente_pago'),
  subtotalCentavos: bigint('subtotal_centavos', { mode: 'number' }).notNull(),
  envioCentavos: bigint('envio_centavos', { mode: 'number' }).notNull().default(0),
  totalCentavos: bigint('total_centavos', { mode: 'number' }).notNull(),
  moneda: text('moneda').notNull().default('COP'),
  claveIdempotencia: text('clave_idempotencia').unique(),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
});

export const pedidoArticulos = pgTable('pedido_articulos', {
  id: serial('id').primaryKey(),
  pedidoId: integer('pedido_id')
    .notNull()
    .references(() => pedidos.id),
  productoId: integer('producto_id').notNull(),
  cantidad: integer('cantidad').notNull(),
  precioUnitarioCentavos: bigint('precio_unitario_centavos', { mode: 'number' }).notNull(),
});

// Buzon transaccional (patron Transactional Outbox, CU-INT-001).
export const eventosBuzon = pgTable('eventos_buzon', {
  id: serial('id').primaryKey(),
  tipoAgregado: text('tipo_agregado').notNull(),
  idAgregado: text('id_agregado').notNull(),
  tipoEvento: text('tipo_evento').notNull(),
  carga: jsonb('carga').$type<Record<string, unknown>>().notNull(),
  correlacionId: text('correlacion_id'),
  claveIdempotencia: text('clave_idempotencia'),
  version: integer('version').notNull().default(1),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  publicadoEn: timestamp('publicado_en', { withTimezone: true }),
});
// Pagos (CU-EC-010, BL-035). Wompi es el proveedor definido; Payments conserva el dinero (RN-GOB-005).
export const pagos = pgTable('pagos', {
  id: serial('id').primaryKey(),
  referenciaPago: text('referencia_pago').notNull().unique(),
  pedidoId: integer('pedido_id')
    .notNull()
    .references(() => pedidos.id),
  clienteId: text('cliente_id').notNull(),
  montoCentavos: bigint('monto_centavos', { mode: 'number' }).notNull(),
  moneda: text('moneda').notNull().default('COP'),
  proveedor: text('proveedor').notNull().default('wompi'),
  estado: text('estado').notNull().default('pendiente'),
  idTransaccionProveedor: text('id_transaccion_proveedor'),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
});

// Eventos ya publicados por el publicador del buzon (evidencia local del Pub/Sub).
export const eventosPublicados = pgTable('eventos_publicados', {
  id: serial('id').primaryKey(),
  topico: text('topico').notNull(),
  eventId: text('event_id').notNull().unique(),
  tipoEvento: text('tipo_evento').notNull(),
  carga: jsonb('carga').$type<Record<string, unknown>>().notNull(),
  publicadoEn: timestamp('publicado_en', { withTimezone: true }).notNull().defaultNow(),
});

// Cola de eventos fallidos (DLQ operable, BL-091).
export const eventosFallidos = pgTable('eventos_fallidos', {
  id: serial('id').primaryKey(),
  topico: text('topico').notNull(),
  eventId: text('event_id').notNull(),
  tipoEvento: text('tipo_evento').notNull(),
  carga: jsonb('carga').$type<Record<string, unknown>>().notNull(),
  motivo: text('motivo').notNull(),
  reintentos: integer('reintentos').notNull().default(0),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
});

// Usuarios internos (RBAC/ABAC, CU-SEC-001..007).
export const usuarios = pgTable('usuarios', {
  id: serial('id').primaryKey(),
  correo: text('correo').notNull().unique(),
  hashContrasena: text('hash_contrasena').notNull(),
  rol: text('rol').notNull(),
  zonaId: text('zona_id'),
  vendedorId: text('vendedor_id'),
  estado: text('estado').notNull().default('ACTIVO'),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
});

// Auditoria de operaciones sensibles (CU-SEC-014/015).
export const auditoriaRegistros = pgTable('auditoria_registros', {
  id: serial('id').primaryKey(),
  actorId: text('actor_id'),
  actorRol: text('actor_rol'),
  accion: text('accion').notNull(),
  recurso: text('recurso').notNull(),
  recursoId: text('recurso_id'),
  resultado: text('resultado').notNull(),
  metadatos: jsonb('metadatos').$type<Record<string, unknown>>(),
  ip: text('ip'),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
});
