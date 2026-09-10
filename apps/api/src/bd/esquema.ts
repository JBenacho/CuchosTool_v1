// Esquema de datos de CuchosTool (capa de datos).
// Convencion: tablas y campos en espanol (snake_case en base de datos), camelCase en el codigo.
// Precios en centavos (bigint) para evitar errores de redondeo con decimales.
import {
  pgTable,
  serial,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  index,
  jsonb,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// Emprendedores de la plataforma (CU-EM-001..004). Aislados por emprendedorId (RN-SEC-005).
export const emprendedores = pgTable('emprendedores', {
  id: serial('id').primaryKey(),
  documentoIdentidad: text('documento_identidad').notNull().unique(),
  nombre: text('nombre').notNull(),
  correo: text('correo').notNull().unique(),
  telefono: text('telefono'),
  zonaId: text('zona_id'),
  estado: text('estado').notNull().default('enrolado'),
  // Medios configurados por el emprendedor (CU-EM-005/006) y logistica (CU-EM-019).
  medioEnvio: text('medio_envio'),
  medioPagoElectronico: text('medio_pago_electronico'),
  proveedorLogistico: text('proveedor_logistico'),
  // Paquete documental de validacion (CU-EM-003).
  documentosCompletos: boolean('documentos_completos').notNull().default(false),
  creadoPor: text('creado_por'),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
});

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
    // Productos de emprendedores (F4): pasan por aval antes de ser publicos.
    emprendedorId: integer('emprendedor_id').references(() => emprendedores.id),
    // Validacion de requisitos multimedia (CU-EM-009).
    multimediaValidada: boolean('multimedia_validada').notNull().default(false),
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
// Casos de Soporte, Garantias y Calidad (CU-SGC-002..017). Caso unico y trazable.
export const casos = pgTable('casos', {
  id: serial('id').primaryKey(),
  referenciaCaso: text('referencia_caso').notNull().unique(),
  tipo: text('tipo').notNull(), // soporte | garantia | queja | reclamo | peticion
  estado: text('estado').notNull().default('abierto'),
  prioridad: text('prioridad').notNull().default('media'),
  clienteId: text('cliente_id'),
  emprendedorId: integer('emprendedor_id').references(() => emprendedores.id),
  pedidoId: integer('pedido_id').references(() => pedidos.id),
  asunto: text('asunto').notNull(),
  descripcion: text('descripcion'),
  // Garantias (CU-SGC-013/014) y coordinacion logistica (CU-SGC-015).
  garantiaEstado: text('garantia_estado').notNull().default('solicitada'),
  garantiaDecididaEn: timestamp('garantia_decidida_en', { withTimezone: true }),
  logisticaAccion: text('logistica_accion'),
  // SLA de primera respuesta (CU-SGC-011) y satisfaccion (CU-SGC-018/019).
  slaVenceEn: timestamp('sla_vence_en', { withTimezone: true }),
  calificacion: integer('calificacion'),
  // Agente asignado al caso (CU-SGC-007).
  asignadoA: text('asignado_a'),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
});

// Evidencias seguras del caso (CU-SGC-006). En GCP la URL apunta a Cloud Storage privado.
export const casoEvidencias = pgTable('caso_evidencias', {
  id: serial('id').primaryKey(),
  casoId: integer('caso_id')
    .notNull()
    .references(() => casos.id),
  tipo: text('tipo').notNull(), // foto | video | documento | otro
  url: text('url').notNull(),
  descripcion: text('descripcion'),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
});
export const casoMensajes = pgTable('caso_mensajes', {
  id: serial('id').primaryKey(),
  casoId: integer('caso_id')
    .notNull()
    .references(() => casos.id),
  autorTipo: text('autor_tipo').notNull(), // cliente | agente | sistema
  autorId: text('autor_id'),
  contenido: text('contenido').notNull(),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
});

// Dispersiones al emprendedor (CU-EM-015..018). Payments ejecuta el dinero;
// Emprendedor solo coordina (RN-GOB-005). La comision es configurable (TBD de negocio).
export const dispersiones = pgTable('dispersiones', {
  id: serial('id').primaryKey(),
  referenciaDispersion: text('referencia_dispersion').notNull().unique(),
  pedidoId: integer('pedido_id')
    .notNull()
    .references(() => pedidos.id),
  emprendedorId: integer('emprendedor_id')
    .notNull()
    .references(() => emprendedores.id),
  montoCentavos: bigint('monto_centavos', { mode: 'number' }).notNull(),
  comisionCentavos: bigint('comision_centavos', { mode: 'number' }),
  estado: text('estado').notNull().default('pendiente'),
  ejecutadoEn: timestamp('ejecutado_en', { withTimezone: true }),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
});

// Reembolsos coordinados por SGC y ejecutados por Payments (CU-SGC-016, BL-062).
export const reembolsos = pgTable('reembolsos', {
  id: serial('id').primaryKey(),
  referenciaReembolso: text('referencia_reembolso').notNull().unique(),
  pagoId: integer('pago_id')
    .notNull()
    .references(() => pagos.id),
  casoId: integer('caso_id').references(() => casos.id),
  montoCentavos: bigint('monto_centavos', { mode: 'number' }).notNull(),
  estado: text('estado').notNull().default('pendiente'),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
});

// Ofertas del emprendedor (CU-EM-013): descuento en puntos basicos con vigencia.
export const ofertas = pgTable('ofertas', {
  id: serial('id').primaryKey(),
  emprendedorId: integer('emprendedor_id')
    .notNull()
    .references(() => emprendedores.id),
  nombre: text('nombre').notNull(),
  descuentoBps: integer('descuento_bps').notNull(),
  iniciaEn: timestamp('inicia_en', { withTimezone: true }).notNull(),
  finalizaEn: timestamp('finaliza_en', { withTimezone: true }).notNull(),
  estado: text('estado').notNull().default('activa'),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
});
// Calidad (CU-SGC-020..023): alertas por umbral y acciones correctivas.
export const alertasCalidad = pgTable('alertas_calidad', {
  id: serial('id').primaryKey(),
  tipo: text('tipo').notNull(),
  mensaje: text('mensaje').notNull(),
  valores: jsonb('valores').$type<Record<string, unknown>>(),
  estado: text('estado').notNull().default('activa'),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  atendidaEn: timestamp('atendida_en', { withTimezone: true }),
});

export const accionesCorrectivas = pgTable('acciones_correctivas', {
  id: serial('id').primaryKey(),
  referenciaAccion: text('referencia_accion').notNull().unique(),
  descripcion: text('descripcion').notNull(),
  origenCasoId: integer('origen_caso_id').references(() => casos.id),
  estado: text('estado').notNull().default('abierta'),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  cerradaEn: timestamp('cerrada_en', { withTimezone: true }),
});
// Proveedores del ERP (F5, CU-ERP-001).
export const proveedores = pgTable('proveedores', {
  id: serial('id').primaryKey(),
  nit: text('nit').notNull().unique(),
  nombre: text('nombre').notNull(),
  contacto: text('contacto'),
  telefono: text('telefono'),
  correo: text('correo'),
  direccion: text('direccion'),
  sitioWeb: text('sitio_web'),
  estado: text('estado').notNull().default('ACTIVO'),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
});
// Inventario del ERP (CU-INV-001..008): bodegas, existencias por bodega y kardex.
export const bodegas = pgTable('bodegas', {
  id: serial('id').primaryKey(),
  nombre: text('nombre').notNull().unique(),
  ubicacion: text('ubicacion'),
  estado: text('estado').notNull().default('ACTIVO'),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
});

// Existencias por bodega y producto (fuente unica de verdad del inventario, CU-INV-010).
export const inventarioStock = pgTable(
  'inventario_stock',
  {
    id: serial('id').primaryKey(),
    bodegaId: integer('bodega_id')
      .notNull()
      .references(() => bodegas.id),
    productoId: integer('producto_id')
      .notNull()
      .references(() => productos.id),
    cantidad: integer('cantidad').notNull().default(0),
    stockMinimo: integer('stock_minimo').notNull().default(0),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (tabla) => [
    uniqueIndex('inventario_stock_bodega_producto_idx').on(tabla.bodegaId, tabla.productoId),
  ],
);

// Kardex transaccional (CU-INV-006): cada movimiento inmutable con consecutivo oficial.
export const movimientosInventario = pgTable(
  'movimientos_inventario',
  {
    id: serial('id').primaryKey(),
    consecutivo: text('consecutivo').notNull().unique(),
    bodegaId: integer('bodega_id')
      .notNull()
      .references(() => bodegas.id),
    productoId: integer('producto_id')
      .notNull()
      .references(() => productos.id),
    tipo: text('tipo').notNull(),
    // Cantidad firmada: positiva en entradas/ajustes al alza; negativa en salidas/ajustes a la baja.
    cantidad: integer('cantidad').notNull(),
    stockResultante: integer('stock_resultante').notNull(),
    motivo: text('motivo').notNull(),
    referencia: text('referencia'),
    actorId: text('actor_id'),
    actorRol: text('actor_rol'),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (tabla) => [
    index('movimientos_inventario_producto_idx').on(tabla.productoId),
    index('movimientos_inventario_bodega_idx').on(tabla.bodegaId),
  ],
);

// Compras avanzado (CU-ERP-002..008): solicitudes y ordenes de compra de una linea (MVP).
export const solicitudesCompra = pgTable('solicitudes_compra', {
  id: serial('id').primaryKey(),
  referencia: text('referencia').notNull().unique(),
  productoId: integer('producto_id')
    .notNull()
    .references(() => productos.id),
  cantidad: integer('cantidad').notNull(),
  motivo: text('motivo').notNull(),
  solicitanteId: text('solicitante_id'),
  solicitanteRol: text('solicitante_rol'),
  estado: text('estado').notNull().default('pendiente_revision'),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
});

export const ordenesCompra = pgTable('ordenes_compra', {
  id: serial('id').primaryKey(),
  referencia: text('referencia').notNull().unique(),
  solicitudId: integer('solicitud_id').references(() => solicitudesCompra.id),
  proveedorId: integer('proveedor_id')
    .notNull()
    .references(() => proveedores.id),
  productoId: integer('producto_id')
    .notNull()
    .references(() => productos.id),
  bodegaDestinoId: integer('bodega_destino_id')
    .notNull()
    .references(() => bodegas.id),
  cantidadPedida: integer('cantidad_pedida').notNull(),
  cantidadRecibida: integer('cantidad_recibida').notNull().default(0),
  precioUnitarioCentavos: bigint('precio_unitario_centavos', { mode: 'number' }).notNull(),
  estado: text('estado').notNull().default('pendiente_aprobacion'),
  creadoPorRol: text('creado_por_rol'),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
});

// Cuentas por pagar de compras (CU-ERP-009): se causan al completar la recepcion.
export const cuentasPorPagar = pgTable('cuentas_por_pagar', {
  id: serial('id').primaryKey(),
  ordenId: integer('orden_id')
    .notNull()
    .references(() => ordenesCompra.id)
    .unique(),
  proveedorId: integer('proveedor_id')
    .notNull()
    .references(() => proveedores.id),
  montoCentavos: bigint('monto_centavos', { mode: 'number' }).notNull(),
  venceEn: timestamp('vence_en', { withTimezone: true }).notNull(),
  estado: text('estado').notNull().default('pendiente'),
  referenciaPago: text('referencia_pago'),
  pagadaEn: timestamp('pagada_en', { withTimezone: true }),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
});

// Logistica (CU-LG-001..006): transportistas, vehiculos y despachos con guia y estados de entrega.
export const transportistas = pgTable('transportistas', {
  id: serial('id').primaryKey(),
  nombre: text('nombre').notNull(),
  nit: text('nit').notNull().unique(),
  telefono: text('telefono'),
  polizaVenceEn: timestamp('poliza_vence_en', { withTimezone: true }),
  estado: text('estado').notNull().default('ACTIVO'),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
});

export const vehiculos = pgTable('vehiculos', {
  id: serial('id').primaryKey(),
  transportistaId: integer('transportista_id')
    .notNull()
    .references(() => transportistas.id),
  placa: text('placa').notNull().unique(),
  capacidadKg: integer('capacidad_kg').notNull().default(1000),
  estado: text('estado').notNull().default('ACTIVO'),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
});

export const despachos = pgTable('despachos', {
  id: serial('id').primaryKey(),
  referencia: text('referencia').notNull().unique(),
  pedidoId: integer('pedido_id')
    .notNull()
    .references(() => pedidos.id)
    .unique(),
  transportistaId: integer('transportista_id')
    .notNull()
    .references(() => transportistas.id),
  vehiculoId: integer('vehiculo_id')
    .notNull()
    .references(() => vehiculos.id),
  guia: text('guia').notNull().unique(),
  ruta: text('ruta'),
  estado: text('estado').notNull().default('programado'),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  entregadoEn: timestamp('entregado_en', { withTimezone: true }),
});

// RRHH / Nomina (CU-RH-001/002/005/007): cargos, empleados, ausencias y proceso de nomina.
export const cargos = pgTable('cargos', {
  id: serial('id').primaryKey(),
  nombre: text('nombre').notNull().unique(),
  descripcion: text('descripcion'),
  estado: text('estado').notNull().default('ACTIVO'),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
});

export const empleados = pgTable('empleados', {
  id: serial('id').primaryKey(),
  nombre: text('nombre').notNull(),
  documentoUnico: text('documento_unico').notNull().unique(),
  correo: text('correo'),
  telefono: text('telefono'),
  cargoId: integer('cargo_id').references(() => cargos.id),
  salarioBaseCentavos: bigint('salario_base_centavos', { mode: 'number' }).notNull().default(0),
  fechaIngreso: timestamp('fecha_ingreso', { withTimezone: true }),
  estado: text('estado').notNull().default('ACTIVO'),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
});

export const ausencias = pgTable('ausencias', {
  id: serial('id').primaryKey(),
  empleadoId: integer('empleado_id')
    .notNull()
    .references(() => empleados.id),
  fecha: timestamp('fecha', { withTimezone: true }).notNull(),
  motivo: text('motivo').notNull(),
  estado: text('estado').notNull().default('registrada'),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
});

export const nominas = pgTable('nominas', {
  id: serial('id').primaryKey(),
  periodo: text('periodo').notNull(),
  empleadoId: integer('empleado_id')
    .notNull()
    .references(() => empleados.id),
  salarioBaseCentavos: bigint('salario_base_centavos', { mode: 'number' }).notNull(),
  deduccionesCentavos: bigint('deducciones_centavos', { mode: 'number' }).notNull().default(0),
  netoCentavos: bigint('neto_centavos', { mode: 'number' }).notNull(),
  estado: text('estado').notNull().default('generada'),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  pagadaEn: timestamp('pagada_en', { withTimezone: true }),
});

// Comercial B2B (CU-CM-001/004/007): clientes ERP, vendedores (usuarios VENDEDOR) y ordenes corporativas.
export const clientesEmpresa = pgTable('clientes_empresa', {
  id: serial('id').primaryKey(),
  nit: text('nit').notNull().unique(),
  razonSocial: text('razon_social').notNull(),
  contacto: text('contacto'),
  telefono: text('telefono'),
  correo: text('correo'),
  cupoCreditoCentavos: bigint('cupo_credito_centavos', { mode: 'number' }).notNull().default(0),
  estado: text('estado').notNull().default('ACTIVO'),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
});

export const ordenesVentaB2b = pgTable('ordenes_venta_b2b', {
  id: serial('id').primaryKey(),
  folio: text('folio').notNull().unique(),
  clienteEmpresaId: integer('cliente_empresa_id')
    .notNull()
    .references(() => clientesEmpresa.id),
  vendedorId: text('vendedor_id').notNull(),
  bodegaId: integer('bodega_id')
    .notNull()
    .references(() => bodegas.id),
  formaPago: text('forma_pago').notNull().default('credito'),
  subtotalCentavos: bigint('subtotal_centavos', { mode: 'number' }).notNull(),
  totalCentavos: bigint('total_centavos', { mode: 'number' }).notNull(),
  moneda: text('moneda').notNull().default('COP'),
  estado: text('estado').notNull().default('confirmada'),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
});

export const ordenVentaB2bArticulos = pgTable('orden_venta_b2b_articulos', {
  id: serial('id').primaryKey(),
  ordenId: integer('orden_id')
    .notNull()
    .references(() => ordenesVentaB2b.id),
  productoId: integer('producto_id')
    .notNull()
    .references(() => productos.id),
  cantidad: integer('cantidad').notNull(),
  precioUnitarioCentavos: bigint('precio_unitario_centavos', { mode: 'number' }).notNull(),
  subtotalCentavos: bigint('subtotal_centavos', { mode: 'number' }).notNull(),
});

// Facturacion y Contabilidad (CU-FC-001..004, CU-CT-001): impuestos, facturas, notas, PUC y asientos.
export const impuestos = pgTable('impuestos', {
  id: serial('id').primaryKey(),
  nombre: text('nombre').notNull().unique(),
  tipo: text('tipo').notNull().default('iva'),
  // Tarifa en puntos basicos: 1900 = 19,00% (RN-FC-01: 0..100%).
  tarifaBps: integer('tarifa_bps').notNull().default(0),
  estado: text('estado').notNull().default('ACTIVO'),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
});

export const facturas = pgTable('facturas', {
  id: serial('id').primaryKey(),
  numero: text('numero').notNull().unique(),
  clienteEmpresaId: integer('cliente_empresa_id')
    .notNull()
    .references(() => clientesEmpresa.id),
  ordenB2bId: integer('orden_b2b_id')
    .references(() => ordenesVentaB2b.id)
    .unique(),
  impuestoId: integer('impuesto_id').references(() => impuestos.id),
  baseCentavos: bigint('base_centavos', { mode: 'number' }).notNull(),
  impuestoCentavos: bigint('impuesto_centavos', { mode: 'number' }).notNull().default(0),
  totalCentavos: bigint('total_centavos', { mode: 'number' }).notNull(),
  moneda: text('moneda').notNull().default('COP'),
  estado: text('estado').notNull().default('emitida'),
  // Factura electronica DIAN (simulada en local): CUFE unico y estado de envio.
  cufe: text('cufe').unique(),
  estadoDian: text('estado_dian').notNull().default('no_enviada'),
  dianEmitidaEn: timestamp('dian_emitida_en', { withTimezone: true }),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  anuladoEn: timestamp('anulado_en', { withTimezone: true }),
});

export const notasFactura = pgTable('notas_factura', {
  id: serial('id').primaryKey(),
  facturaId: integer('factura_id')
    .notNull()
    .references(() => facturas.id),
  tipo: text('tipo').notNull(),
  montoCentavos: bigint('monto_centavos', { mode: 'number' }).notNull(),
  motivo: text('motivo').notNull(),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
});

export const cuentasContables = pgTable('cuentas_contables', {
  id: serial('id').primaryKey(),
  codigo: text('codigo').notNull().unique(),
  nombre: text('nombre').notNull(),
  naturaleza: text('naturaleza').notNull().default('debito'),
  estado: text('estado').notNull().default('ACTIVO'),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
});

export const asientosContables = pgTable('asientos_contables', {
  id: serial('id').primaryKey(),
  referencia: text('referencia').notNull().unique(),
  descripcion: text('descripcion').notNull(),
  fecha: timestamp('fecha', { withTimezone: true }).notNull().defaultNow(),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
});

export const asientoLineas = pgTable('asiento_lineas', {
  id: serial('id').primaryKey(),
  asientoId: integer('asiento_id')
    .notNull()
    .references(() => asientosContables.id),
  cuentaId: integer('cuenta_id')
    .notNull()
    .references(() => cuentasContables.id),
  debitoCentavos: bigint('debito_centavos', { mode: 'number' }).notNull().default(0),
  creditoCentavos: bigint('credito_centavos', { mode: 'number' }).notNull().default(0),
});

// Metas y comisiones comerciales (CU-CM-005/006).
export const metasComerciales = pgTable('metas_comerciales', {
  id: serial('id').primaryKey(),
  vendedorId: text('vendedor_id').notNull(),
  zonaId: text('zona_id'),
  periodo: text('periodo').notNull(),
  montoMetaCentavos: bigint('monto_meta_centavos', { mode: 'number' }).notNull(),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
});

export const comisionesVendedor = pgTable('comisiones_vendedor', {
  id: serial('id').primaryKey(),
  vendedorId: text('vendedor_id').notNull().unique(),
  porcentajeBps: integer('porcentaje_bps').notNull().default(0),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
});

export const comisiones = pgTable('comisiones', {
  id: serial('id').primaryKey(),
  vendedorId: text('vendedor_id').notNull(),
  periodo: text('periodo').notNull(),
  baseCentavos: bigint('base_centavos', { mode: 'number' }).notNull(),
  porcentajeBps: integer('porcentaje_bps').notNull(),
  montoCentavos: bigint('monto_centavos', { mode: 'number' }).notNull(),
  estado: text('estado').notNull().default('calculada'),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  pagadaEn: timestamp('pagada_en', { withTimezone: true }),
});

// RRHH: horarios (CU-RH-004) y novedades de nomina (CU-RH-006).
export const horarios = pgTable('horarios', {
  id: serial('id').primaryKey(),
  empleadoId: integer('empleado_id')
    .notNull()
    .references(() => empleados.id),
  diaSemana: integer('dia_semana').notNull(),
  horaInicio: text('hora_inicio').notNull(),
  horaFin: text('hora_fin').notNull(),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
});

export const novedadesNomina = pgTable('novedades_nomina', {
  id: serial('id').primaryKey(),
  empleadoId: integer('empleado_id')
    .notNull()
    .references(() => empleados.id),
  periodo: text('periodo').notNull(),
  tipo: text('tipo').notNull().default('devengo'),
  concepto: text('concepto').notNull(),
  montoCentavos: bigint('monto_centavos', { mode: 'number' }).notNull(),
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
  // Vinculo del usuario interno con su emprendedor (rol EMPRENDEDOR).
  emprendedorId: integer('emprendedor_id').references(() => emprendedores.id),
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
