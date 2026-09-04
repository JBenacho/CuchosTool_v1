// Constantes de dominio de CuchosTool.
// Regla de calidad: ningun valor de negocio se escribe directamente en el codigo;
// siempre se referencia desde aqui para mantener un unico punto de verdad.

// Moneda unica de la plataforma (peso colombiano).
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
