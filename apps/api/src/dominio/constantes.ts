// Constantes de dominio de CuchosTool.
// Regla de calidad: ningun valor de negocio se escribe directamente en el codigo;
// siempre se referencia desde aqui para mantener un unico punto de verdad.

// Moneda oficial del proyecto: Peso colombiano (COP). Todos los importes monetarios
// se almacenan en centavos de peso (integer/bigint) para evitar errores de redondeo.
export const MONEDA_COP = 'COP';

// Estados de pedido (CU-EC-008/009). El flujo de pagos (F3) ampliara esta lista.
export const PEDIDO_PENDIENTE_PAGO = 'pendiente_pago';

// Estados genericos de entidades.
export const ESTADO_ACTIVO = 'ACTIVO';
export const ESTADO_INACTIVO = 'INACTIVO';

// Roles del sistema (RBAC, CU-SEC-001/002). Cualquier rol no listado es denegado (Default Deny).
export const ROL_ADMIN = 'ADMIN';
export const ROL_GERENTE_ZONA = 'GERENTE_ZONA';
export const ROL_AGENTE_SOPORTE = 'AGENTE_SOPORTE';
export const ROL_AUDITOR = 'AUDITOR';
export const ROL_CLIENTE = 'CLIENTE';

// Identidad: validacion de credenciales (CU-EC-013).
export const LONGITUD_MINIMA_CONTRASENA = 8;
export const RONDAS_BCRYPT = 10;
export const PATRON_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Paginacion del catalogo publico (evita consultas sin tope).
export const CATALOGO_LIMITE_DEFECTO = 50;
export const CATALOGO_LIMITE_MAXIMO = 200;

// Costo de envio mientras no exista regla de negocio de logistica (RN pendiente en F3).
export const COSTO_ENVIO_CENTAVOS = 0;

// Tipo de evento de dominio del buzon transaccional (CU-INT-001, contrato en /contracts).
export const EVENTO_PEDIDO_CREADO = 'com.cuchostool.pedido.creado';
// Estados de pedido ampliados en F3 (tras confirmacion del pago, CU-EC-010 / CU-INT-002).
export const PEDIDO_PAGADO = 'pagado';
export const PEDIDO_RECHAZADO = 'rechazado';

// Pagos (CU-EC-010, BL-035). Proveedor definido por el proyecto: Wompi.
export const PROVEEDOR_PAGOS = 'wompi';
export const PAGO_PENDIENTE = 'pendiente';
export const PAGO_APROBADO = 'aprobado';
export const PAGO_RECHAZADO = 'rechazado';

// Eventos del buzon y topicos de publicacion (CU-INT-001/002, BL-101).
export const EVENTO_PEDIDO_PAGADO = 'com.cuchostool.pedido.pagado';
export const TOPICO_PEDIDOS = 'pedidos';
export const TOPICO_GENERAL = 'general';
// Roles adicionales de F4 (CU-SEC-001/002, CU-EM, CU-SGC).
export const ROL_EMPRENDEDOR = 'EMPRENDEDOR';
export const ROL_AGENTE = 'AGENTE_SOPORTE';
export const ROL_SUPERVISOR = 'SUPERVISOR_SOPORTE';

// Estados del ciclo del emprendedor (CU-EM-002/004).
export const EMPRENDEDOR_ENROLADO = 'enrolado';
export const EMPRENDEDOR_ACTIVO = 'activo';
export const EMPRENDEDOR_SUSPENDIDO = 'suspendido';

// Estados de producto de emprendedor (CU-EM-007/010/011/012):
// pendiente_aval -> avalado (publico) o rechazado; avalado -> inactivo (CU-EM-012).
export const PRODUCTO_PENDIENTE_AVAL = 'pendiente_aval';
export const PRODUCTO_RECHAZADO = 'rechazado';
export const PRODUCTO_ACTIVO = 'ACTIVO';
export const PRODUCTO_INACTIVO = 'INACTIVO';

// Casos SGC (CU-SGC-002..017): estados y tipos validos.
export const CASO_ABIERTO = 'abierto';
export const CASO_EN_PROCESO = 'en_proceso';
export const CASO_CERRADO = 'cerrado';
export const CASO_CANCELADO = 'cancelado';
export const TIPOS_CASO = ['soporte', 'garantia', 'queja', 'reclamo', 'peticion'] as const;
export const PRIORIDAD_CASO_MEDIA = 'media';

// Transiciones validas de estado de caso (CU-SGC-009). Cualquier otra transicion se rechaza.
export const TRANSICIONES_CASO: Record<string, string[]> = {
  [CASO_ABIERTO]: [CASO_EN_PROCESO, CASO_CANCELADO],
  [CASO_EN_PROCESO]: [CASO_CERRADO, CASO_ABIERTO],
  [CASO_CERRADO]: [],
  [CASO_CANCELADO]: [],
};
// Entrega fisica y dispersion (CU-EM-015..018, BL-049/050/051).
export const PEDIDO_ENTREGADO = 'entregado';
export const DISPERSION_PENDIENTE = 'pendiente';
export const DISPERSION_COMPLETADA = 'completada';
export const DISPERSION_FALLIDA = 'fallida';

// Garantias SGC (CU-SGC-013..016): decision con evidencia; SGC no mueve dinero ni mercancia.
export const ROL_RESPONSABLE_GARANTIAS = 'RESPONSABLE_GARANTIAS';
export const GARANTIA_SOLICITADA = 'solicitada';
export const GARANTIA_PROCEDENTE = 'procedente';
export const GARANTIA_IMPROCEDENTE = 'improcedente';
export const REEMBOLSO_PENDIENTE = 'pendiente';
export const REEMBOLSO_COMPLETADO = 'completado';

// Prioridades de caso (CU-SGC-008) y SLA (CU-SGC-011): el vencimiento se calcula
// con la hora de respuesta configurada (SLA_HORAS_RESPUESTA en config).
export const PRIORIDAD_BAJA = 'baja';
export const PRIORIDAD_MEDIA = 'media';
export const PRIORIDAD_ALTA = 'alta';
export const PRIORIDAD_URGENTE = 'urgente';
export const PRIORIDADES_CASO = [
  PRIORIDAD_BAJA,
  PRIORIDAD_MEDIA,
  PRIORIDAD_ALTA,
  PRIORIDAD_URGENTE,
] as const;

// Ofertas del emprendedor (CU-EM-013).
export const OFERTA_ACTIVA = 'activa';
export const OFERTA_INACTIVA = 'inactiva';

// Estados de pedido considerados venta efectiva para reportes del emprendedor (CU-EM-014).
export const ESTADOS_PEDIDO_VENTA_EFECTIVA = ['pagado', 'entregado'] as const;

// Tipos de evidencia validos en casos (CU-SGC-006).
export const TIPOS_EVIDENCIA = ['foto', 'video', 'documento', 'otro'] as const;

// Calidad (CU-SGC-020..023): rol, alertas y acciones correctivas.
export const ROL_RESPONSABLE_CALIDAD = 'RESPONSABLE_CALIDAD';
export const ALERTA_ACTIVA = 'activa';
export const ALERTA_ATENDIDA = 'atendida';
export const ACCION_ABIERTA = 'abierta';
export const ACCION_CERRADA = 'cerrada';

// Roles ERP (F5): compras (CU-ERP-001) e inventario (CU-INV-001..008).
export const ROL_COMPRAS = 'COMPRAS';
export const ROL_ALMACENISTA = 'ALMACENISTA';
export const ROL_CONTADOR = 'CONTADOR';
export const ROL_VENDEDOR = 'VENDEDOR';
export const ROL_LOGISTICA = 'LOGISTICA';
export const ROL_RRHH = 'RRHH';
// Roles internos gestionables desde Seguridad (requieren vinculos especificos: CLIENTE/EMPRENDEDOR fuera).
export const ROLES_ERP_GESTIONABLES = [
  ROL_ADMIN,
  ROL_COMPRAS,
  ROL_ALMACENISTA,
  ROL_CONTADOR,
  ROL_VENDEDOR,
  ROL_LOGISTICA,
  ROL_RRHH,
  ROL_AUDITOR,
  ROL_AGENTE,
  ROL_SUPERVISOR,
  ROL_RESPONSABLE_GARANTIAS,
  ROL_RESPONSABLE_CALIDAD,
  ROL_GERENTE_ZONA,
] as const;
// Inventario (CU-INV-001..003): tipos de movimiento del kardex.
export const MOVIMIENTO_ENTRADA = 'ENTRADA';
export const MOVIMIENTO_SALIDA = 'SALIDA';
export const MOVIMIENTO_AJUSTE = 'AJUSTE';
export const EVENTO_INVENTARIO_STOCK_ACTUALIZADO = 'com.cuchostool.inventario.stock_actualizado';
// Compras avanzado (CU-ERP-002..009): estados de solicitud, orden y cuentas por pagar.
// Trazabilidad con los codigos de ficha: PENDING_REVIEW, PENDING_APPROVAL, APPROVED, PENDING/PAID.
export const SOLICITUD_PENDIENTE_REVISION = 'pendiente_revision';
export const SOLICITUD_CONVERTIDA = 'convertida';
export const SOLICITUD_CANCELADA = 'cancelada';
export const ORDEN_PENDIENTE_APROBACION = 'pendiente_aprobacion';
export const ORDEN_APROBADA = 'aprobada';
export const ORDEN_CANCELADA = 'cancelada';
export const ORDEN_RECIBIDA_PARCIAL = 'recibida_parcial';
export const ORDEN_COMPLETADA = 'completada';
export const CUENTA_PENDIENTE = 'pendiente';
export const CUENTA_PAGADA = 'pagada';
export const TERMINO_PAGO_DIAS_POR_DEFECTO = 30;
// Estados del ciclo de venta del canal E-Commerce (modulo ERP Ventas, CU-CM-007 base).
export const PEDIDO_CANCELADO = 'cancelado';
export const EVENTO_PEDIDO_ENTREGADO = 'com.cuchostool.pedido.entregado';
// Logistica (CU-LG-001..006): estados de despacho y entrega (CREATED -> IN_TRANSIT -> DELIVERED/RETURNED).
export const DESPACHO_PROGRAMADO = 'programado';
export const DESPACHO_EN_RUTA = 'en_ruta';
export const DESPACHO_ENTREGADO = 'entregado';
export const DESPACHO_DEVUELTO = 'devuelto';
// RRHH / Nomina (CU-RH-001..007).
export const NOMINA_GENERADA = 'generada';
export const NOMINA_PAGADA = 'pagada';
export const AUSENCIA_REGISTRADA = 'registrada';
export const AUSENCIA_JUSTIFICADA = 'justificada';
// SLA por tipo de caso (CU-SGC-011): horas de primera respuesta segun el tipo.
// Valores de dominio configurables aqui (unico punto de verdad); refinables por spike.
export const SLA_HORAS_DEFECTO = 24;
export const SLA_HORAS_POR_TIPO: Record<string, number> = {
  soporte: 24,
  garantia: 48,
  queja: 24,
  reclamo: 24,
  peticion: 48,
};
