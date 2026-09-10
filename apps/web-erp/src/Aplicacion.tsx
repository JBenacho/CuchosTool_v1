// Sitio ERP (F5): login interno y dashboards con datos reales de la API.
import { Component, Fragment, useEffect, useState } from 'react';
import './Aplicacion.css';

const API = '/api';

// Topes y valores por defecto espejo de apps/api/src/dominio/constantes.ts.
// El ERP no reimplementa reglas de negocio: solo evita enviar valores fuera de rango.
const BASE_PUNTOS_BASICOS = 10000;
const TARIFA_IVA_BPS_POR_DEFECTO = 1900;
const MAXIMO_LINEAS_ORDEN = 50;
const MAXIMO_PARADAS_RUTA = 50;
const MESES_SERIE_DEFECTO = 6;
const MESES_SERIE_MAXIMO = 24;
const LIMITE_RANKING_DEFECTO = 5;
const LIMITE_RANKING_MAXIMO = 20;

// Abreviaturas de mes para etiquetar periodos AAAA-MM en tablas y graficas.
const MESES_CORTOS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

interface Resumen {
  pedidos: number;
  pedidosPagados: number;
  clientes: number;
  productos: number;
  casosAbiertos: number;
  ultimosPedidos: {
    referenciaPedido: string;
    estado: string;
    totalCentavos: number;
    creadoEn: string;
  }[];
  ultimosClientes: { id: number; correo: string; nombre: string }[];
}

interface Proveedor {
  id: number;
  nit: string;
  nombre: string;
  contacto: string | null;
  telefono: string | null;
  correo: string | null;
  direccion: string | null;
  sitioWeb: string | null;
  tarifaIvaBps: number;
  estado: string;
}

interface BodegaInv {
  id: number;
  nombre: string;
  ubicacion: string | null;
  estado: string;
}

interface ProductoCorto {
  id: number;
  nombre: string;
  stock: number;
}

interface FilaStock {
  bodegaId: number;
  bodegaNombre: string;
  productoId: number;
  productoNombre: string;
  cantidad: number;
  stockMinimo: number;
  bajoMinimo: boolean;
}

interface FilaKardex {
  id: number;
  consecutivo: string;
  tipo: string;
  cantidad: number;
  stockResultante: number;
  motivo: string;
  referencia: string | null;
  bodegaNombre: string;
  productoNombre: string;
  creadoEn: string;
}

interface LineaOrdenCompra {
  id: number;
  ordenId: number;
  numeroLinea: number;
  productoId: number;
  productoNombre: string;
  cantidadPedida: number;
  cantidadRecibida: number;
  precioUnitarioCentavos: number;
  subtotalCentavos: number;
  saldoPendiente: number;
}

interface FilaOrden {
  id: number;
  referencia: string;
  proveedorNombre: string;
  bodegaNombre: string;
  cantidadPedida: number;
  cantidadRecibida: number;
  saldoPendiente: number;
  tarifaIvaBps: number;
  subtotalCentavos: number;
  impuestoCentavos: number;
  totalCentavos: number;
  lineas: LineaOrdenCompra[];
  totalLineas: number;
  estado: string;
}

// Renglon en borrador de una orden multi-linea (CU-ERP-003): el precio se captura en COP.
interface LineaOrdenBorrador {
  productoId: string;
  cantidad: string;
  precioPesos: string;
}

interface FilaCuenta {
  id: number;
  ordenReferencia: string;
  proveedorNombre: string;
  montoCentavos: number;
  venceEn: string;
  estado: string;
  referenciaPago: string | null;
}

interface FilaVenta {
  id: number;
  referenciaPedido: string;
  clienteId: string;
  clienteCorreo: string | null;
  clienteNombre: string | null;
  totalCentavos: number;
  estado: string;
  creadoEn: string;
}

interface ResumenVentas {
  total: number;
  porEstado: Record<string, number>;
  ventasEfectivas: number;
  montoEfectivoCentavos: number;
  montoPendienteCentavos: number;
}

interface DetalleVenta {
  referenciaPedido: string;
  estado: string;
  totalCentavos: number;
  cliente: { id: number; correo: string; nombre: string } | null;
  lineas: {
    productoId: number;
    productoNombre: string;
    cantidad: number;
    precioUnitarioCentavos: number;
  }[];
}

interface UsuarioSesion {
  id: number;
  correo: string;
  rol: string;
}

interface FilaUsuario {
  id: number;
  correo: string;
  rol: string;
  zonaId: string | null;
  emprendedorId: number | null;
  estado: string;
  creadoEn: string;
}

interface TransportistaLog {
  id: number;
  nombre: string;
  nit: string;
  telefono: string | null;
  polizaVenceEn: string | null;
  estado: string;
}

interface VehiculoLog {
  id: number;
  placa: string;
  capacidadKg: number;
  estado: string;
  // Disponibilidad operativa derivada de las rutas vigentes (CU-LG-005).
  estadoOperativo: string;
  transportistaId: number;
  transportistaNombre: string;
}

interface VentaDespachable {
  id: number;
  referenciaPedido: string;
  clienteNombre: string;
  totalCentavos: number;
}

interface DespachoLog {
  id: number;
  referencia: string;
  guia: string;
  ruta: string | null;
  estado: string;
  referenciaPedido: string;
  clienteNombre: string;
  transportistaNombre: string;
  placa: string;
  creadoEn: string;
}

// Parada secuenciada de una ruta de distribucion (CU-LG-005).
interface ParadaRutaLog {
  id: number;
  rutaId: number;
  secuencia: number;
  destino: string;
  despachoId: number | null;
  guia: string | null;
}

// Ruta de distribucion con sus paradas y despachos consolidados (CU-LG-005).
interface RutaLog {
  id: number;
  codigo: string;
  nombre: string;
  estado: string;
  transportistaId: number;
  transportistaNombre: string;
  vehiculoId: number;
  placa: string;
  capacidadKg: number;
  creadoEn: string;
  iniciadaEn: string | null;
  completadaEn: string | null;
  paradas: ParadaRutaLog[];
  totalParadas: number;
  totalDespachos: number;
}

// Despacho programado disponible para consolidar en una ruta (CU-LG-005).
interface DespachoConsolidableLog {
  id: number;
  referencia: string;
  guia: string;
  estado: string;
  rutaId: number | null;
  referenciaPedido: string;
  clienteNombre: string | null;
}

// Parada en borrador antes de planificar la ruta.
interface ParadaRutaBorrador {
  destino: string;
  despachoId: string;
}

interface CargoRrhh {
  id: number;
  nombre: string;
  descripcion: string | null;
  estado: string;
}

interface EmpleadoRrhh {
  id: number;
  nombre: string;
  documentoUnico: string;
  correo: string | null;
  telefono: string | null;
  cargoId: number | null;
  cargoNombre: string | null;
  salarioBaseCentavos: number;
  estado: string;
}

interface AusenciaRrhh {
  id: number;
  empleadoNombre: string;
  fecha: string;
  motivo: string;
  estado: string;
}

interface NominaRrhh {
  id: number;
  periodo: string;
  empleadoNombre: string;
  cargoNombre: string | null;
  netoCentavos: number;
  estado: string;
  creadoEn: string;
}

interface ClienteEmpresa {
  id: number;
  nit: string;
  razonSocial: string;
  contacto: string | null;
  cupoCreditoCentavos: number;
  estado: string;
}

interface OrdenB2b {
  id: number;
  folio: string;
  clienteRazonSocial: string;
  bodegaNombre: string;
  formaPago: string;
  totalCentavos: number;
  estado: string;
  creadoEn: string;
}

interface ImpuestoFin {
  id: number;
  nombre: string;
  tipo: string;
  tarifaBps: number;
  estado: string;
}

interface FacturaFin {
  id: number;
  numero: string;
  clienteRazonSocial: string;
  baseCentavos: number;
  impuestoCentavos: number;
  totalCentavos: number;
  estado: string;
  estadoDian?: string;
  cufe?: string | null;
  creadoEn: string;
}

interface OrdenPorFacturar {
  id: number;
  folio: string;
  clienteRazonSocial: string;
  totalCentavos: number;
}

interface CuentaContable {
  id: number;
  codigo: string;
  nombre: string;
  naturaleza: string;
  estado: string;
}

interface AsientoContable {
  id: number;
  referencia: string;
  descripcion: string;
  fecha: string;
}

interface VendedorComercial {
  id: number;
  correo: string;
}

interface MetaComercial {
  id: number;
  vendedorId: string;
  periodo: string;
  montoMetaCentavos: number;
}

interface CumplimientoMeta {
  vendedorId: string;
  periodo: string;
  montoMetaCentavos: number;
  avanceCentavos: number;
  cumplimientoPct: number;
}

interface ComisionComercial {
  id: number;
  vendedorId: string;
  periodo: string;
  baseCentavos: number;
  porcentajeBps: number;
  montoCentavos: number;
  estado: string;
}

interface HorarioRrhh {
  id: number;
  empleadoNombre: string;
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
}

interface NovedadRrhh {
  id: number;
  empleadoNombre: string;
  periodo: string;
  tipo: string;
  concepto: string;
  montoCentavos: number;
}

interface ResumenGerencia {
  periodo: string;
  canal: { totalPedidos: number; montoEfectivoCentavos: number; porEstado: Record<string, number> };
  b2b: { totalOrdenes: number; montoPagadoCentavos: number; porEstado: Record<string, number> };
  facturacion: {
    totalFacturas: number;
    facturadoCentavos: number;
    ivaCentavos: number;
    dianEmitidas: number;
  };
  inventario: { referenciasBajoMinimo: number };
  casos: { abiertos: number; enProceso: number };
  comisiones: { calculadasCentavos: number; pagadasCentavos: number };
}

// Punto mensual de la serie gerencial (CU-GE): venta canal, B2B y facturacion.
interface PuntoSerieGerencial {
  periodo: string;
  pedidos: number;
  canalCentavos: number;
  ordenesB2b: number;
  b2bCentavos: number;
  facturas: number;
  facturadoCentavos: number;
  ivaCentavos: number;
  totalCentavos: number;
}

interface SerieGerencial {
  meses: number;
  serie: PuntoSerieGerencial[];
  totales: {
    canalCentavos: number;
    b2bCentavos: number;
    facturadoCentavos: number;
    ivaCentavos: number;
  };
}

interface FilaRankingGerencial {
  productoId: number;
  productoNombre: string;
  unidades: number;
  montoCentavos: number;
  unidadesCanal: number;
  montoCanalCentavos: number;
  unidadesB2b: number;
  montoB2bCentavos: number;
}

interface RankingGerencial {
  periodo: string;
  productos: FilaRankingGerencial[];
}

interface CarteraGerencial {
  porPagar: {
    totalCentavos: number;
    vencidoCentavos: number;
    cuentas: number;
    vencidas: number;
  };
  porCobrar: { totalCentavos: number; facturas: number };
  generadoEn: string;
}

const MODULOS = [
  'Dashboard',
  'Compras',
  'Inventario',
  'Ventas',
  'RRHH / Nomina',
  'Logistica',
  'Facturacion',
  'Contabilidad',
  'Gerencia',
  'Seguridad',
] as const;

// Modulos visibles por perfil en el menu lateral (RBAC de navegacion ERP).
const MODULOS_POR_ROL: Record<string, readonly string[]> = {
  ADMIN: [...MODULOS],
  COMPRAS: ['Dashboard', 'Compras', 'Inventario'],
  ALMACENISTA: ['Dashboard', 'Inventario', 'Compras', 'Logistica'],
  LOGISTICA: ['Dashboard', 'Logistica', 'Inventario'],
  RRHH: ['Dashboard', 'RRHH / Nomina'],
  CONTADOR: ['Dashboard', 'Compras', 'Inventario', 'Contabilidad', 'Facturacion'],
  VENDEDOR: ['Dashboard', 'Ventas'],
  AUDITOR: ['Dashboard', 'Inventario'],
  GERENTE_ZONA: ['Dashboard', 'Ventas', 'Gerencia'],
  AGENTE_SOPORTE: ['Dashboard'],
  SUPERVISOR_SOPORTE: ['Dashboard'],
  RESPONSABLE_GARANTIAS: ['Dashboard'],
  RESPONSABLE_CALIDAD: ['Dashboard'],
};

// Perfiles internos gestionables desde Seguridad (coinciden con ROLES_ERP_GESTIONABLES).
const PERFILES_GESTIONABLES = [
  'ADMIN',
  'COMPRAS',
  'ALMACENISTA',
  'CONTADOR',
  'VENDEDOR',
  'LOGISTICA',
  'RRHH',
  'AUDITOR',
  'AGENTE_SOPORTE',
  'SUPERVISOR_SOPORTE',
  'RESPONSABLE_GARANTIAS',
  'RESPONSABLE_CALIDAD',
  'GERENTE_ZONA',
] as const;

function formatearPesos(centavos: number): string {
  // Pesos colombianos con dos decimales (ej. $ 1.000,50); sin etiquetas de centavos.
  return (
    '$ ' +
    (centavos / 100).toLocaleString('es-CO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

// Numero con dos decimales en formato es-CO (coma decimal), sin simbolo de moneda.
function formatearDecimal(valor: number): string {
  return Number(valor).toLocaleString('es-CO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Tarifa en puntos basicos como porcentaje es-CO (1900 -> '19,00 %', 500 -> '5,00 %').
function formatearPorcentaje(puntosBasicos: number): string {
  return formatearDecimal(Number(puntosBasicos) / 100) + ' %';
}

// Etiqueta legible de un periodo AAAA-MM (ej. 2025-03 -> mar 2025).
function etiquetaPeriodo(periodo: string): string {
  const partes = String(periodo || '').split('-');
  const indice = Number(partes[1]) - 1;
  if (partes.length !== 2 || !MESES_CORTOS[indice]) return String(periodo || '');
  return MESES_CORTOS[indice] + ' ' + partes[0];
}

// Importe abreviado para ejes y tarjetas (k = miles, M = millones de pesos).
function formatearPesosCorto(centavos: number): string {
  const pesos = centavos / 100;
  if (Math.abs(pesos) >= 1000000)
    return '$ ' + (pesos / 1000000).toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' M';
  if (Math.abs(pesos) >= 1000)
    return '$ ' + (pesos / 1000).toLocaleString('es-CO', { maximumFractionDigits: 0 }) + ' k';
  return formatearPesos(centavos);
}

// Clase visual del badge segun el estado del flujo: verde cerrado, naranja en curso, gris anulado.
function claseBadgeEstado(estado: string): string {
  const cerrados = ['completada', 'entregado', 'pagada', 'activo', 'aceptada_simulada'];
  const anulados = ['cancelada', 'anulada', 'devuelto', 'inactivo'];
  if (cerrados.indexOf(estado) >= 0) return 'badge badge--ok';
  if (anulados.indexOf(estado) >= 0) return 'badge badge--muted';
  return 'badge badge--warm';
}

// Traduce los codigos de error de la API (compras, logistica, gerencia) a mensajes para el usuario.
function mensajeErrorApi(error: string): string {
  const mensajes: Record<string, string> = {
    lineas_obligatorias: 'La orden necesita al menos un renglon',
    demasiadas_lineas: 'La orden admite maximo ' + MAXIMO_LINEAS_ORDEN + ' renglones',
    producto_duplicado_en_lineas: 'Hay un producto repetido en los renglones',
    cantidad_invalida: 'La cantidad debe ser un entero positivo',
    precio_invalido: 'El precio unitario debe ser un entero positivo en centavos',
    producto_invalido: 'El producto del renglon no es valido',
    producto_inactivo: 'El producto esta inactivo',
    proveedor_inactivo: 'El proveedor esta inactivo',
    bodega_inactiva: 'La bodega destino esta inactiva',
    orden_no_recibible: 'La orden ya no admite recepcion en su estado actual',
    recepcion_por_linea_requerida: 'Orden multi-linea: registre la recepcion por renglon',
    recepcion_sin_lineas: 'Indique las cantidades a recibir',
    linea_no_encontrada: 'El renglon indicado no pertenece a la orden',
    linea_duplicada: 'Hay un renglon repetido en la recepcion',
    cantidad_excede_saldo: 'La cantidad excede el saldo pendiente del renglon',
    ruta_no_modificable: 'La ruta ya no admite cambios en su estado actual',
    ruta_no_iniciable: 'Solo una ruta planificada puede iniciarse',
    ruta_no_completable: 'Solo una ruta en progreso puede completarse',
    ruta_no_cancelable: 'Solo una ruta planificada puede cancelarse',
    codigo_ruta_duplicado: 'El codigo de ruta ya existe',
    codigo_ruta_invalido: 'Codigo de ruta invalido (4 a 20 caracteres alfanumericos)',
    nombre_obligatorio: 'El nombre de la ruta es obligatorio',
    paradas_obligatorias: 'Agregue al menos una parada a la ruta',
    demasiadas_paradas: 'La ruta admite maximo ' + MAXIMO_PARADAS_RUTA + ' paradas',
    destino_obligatorio: 'Cada parada necesita un destino',
    destino_duplicado: 'Hay destinos repetidos en la ruta',
    vehiculo_en_ruta: 'El vehiculo ya tiene otra ruta vigente',
    vehiculo_no_disponible: 'El vehiculo no esta disponible',
    vehiculo_no_encontrado: 'El vehiculo seleccionado no existe',
    despacho_ya_asignado: 'El despacho ya pertenece a otra ruta',
    despacho_no_encontrado: 'El despacho seleccionado no existe',
    despacho_no_asignable: 'El despacho no esta en un estado consolidable',
    reporte_invalido: 'Reporte no soportado (resumen, series, ranking o cartera)',
    periodo_invalido: 'El periodo debe tener formato AAAA-MM',
    datos_incompletos: 'Complete todos los datos obligatorios',
    tarifa_iva_invalida: 'El IVA del proveedor debe estar entre 0 y 100%',
  };
  return (
    mensajes[error] || 'No se pudo completar la operacion (' + (error || 'error desconocido') + ')'
  );
}

// Extrae el nombre del archivo de la cabecera Content-Disposition de la exportacion CSV.
function nombreDesdeCabecera(cabecera: string | null, porDefecto: string): string {
  if (!cabecera) return porDefecto;
  const coincidencia = /filename="([^"]+)"/.exec(cabecera);
  return coincidencia ? coincidencia[1] : porDefecto;
}

// Serie mensual en barras agrupadas dibujada con SVG nativo (sin dependencias externas).
// Entrada: puntos de la serie con venta canal, B2B y facturado en centavos. Salida: grafica del panel.
function GraficaSeriesGerencial({ puntos }: { puntos: PuntoSerieGerencial[] }): JSX.Element {
  const ancho = 760;
  const alto = 280;
  const margen = { arriba: 18, derecha: 12, abajo: 34, izquierda: 78 };
  const anchoUtil = ancho - margen.izquierda - margen.derecha;
  const altoUtil = alto - margen.arriba - margen.abajo;
  const maximo = puntos.reduce(function (mayor, punto) {
    return Math.max(mayor, punto.canalCentavos, punto.b2bCentavos, punto.facturadoCentavos);
  }, 0);
  const techo = maximo > 0 ? maximo : 1;
  const anchoGrupo = puntos.length ? anchoUtil / puntos.length : anchoUtil;
  const anchoBarra = Math.max(3, Math.min(18, (anchoGrupo - 16) / 3));
  const referencias = [0, 0.25, 0.5, 0.75, 1];
  const grupos = [
    {
      clave: 'canal',
      etiqueta: 'Venta canal',
      valor: function (p: PuntoSerieGerencial) {
        return p.canalCentavos;
      },
    },
    {
      clave: 'b2b',
      etiqueta: 'Venta B2B',
      valor: function (p: PuntoSerieGerencial) {
        return p.b2bCentavos;
      },
    },
    {
      clave: 'facturado',
      etiqueta: 'Facturado',
      valor: function (p: PuntoSerieGerencial) {
        return p.facturadoCentavos;
      },
    },
  ];
  return (
    <div className="grafica-series">
      <svg
        role="img"
        aria-label="Serie mensual de venta canal, venta B2B y facturacion"
        viewBox={'0 0 ' + ancho + ' ' + alto}
      >
        {referencias.map(function (fraccion) {
          const y = margen.arriba + altoUtil * (1 - fraccion);
          return (
            <g key={fraccion}>
              <line
                className="grafica-linea"
                x1={margen.izquierda}
                y1={y}
                x2={ancho - margen.derecha}
                y2={y}
              />
              <text className="grafica-eje" x={margen.izquierda - 8} y={y + 4} textAnchor="end">
                {formatearPesosCorto(Math.round(techo * fraccion))}
              </text>
            </g>
          );
        })}
        {puntos.map(function (punto, indice) {
          const centro = margen.izquierda + anchoGrupo * indice + anchoGrupo / 2;
          return (
            <g key={punto.periodo}>
              {grupos.map(function (grupo, posicion) {
                const valor = grupo.valor(punto);
                const altura = (valor / techo) * altoUtil;
                const x = centro + (posicion - 1) * (anchoBarra + 3) - anchoBarra / 2;
                return (
                  <rect
                    key={grupo.clave}
                    className={'grafica-barra grafica-barra--' + grupo.clave}
                    x={x}
                    y={margen.arriba + altoUtil - altura}
                    width={anchoBarra}
                    height={altura}
                  >
                    <title>
                      {etiquetaPeriodo(punto.periodo) +
                        ' - ' +
                        grupo.etiqueta +
                        ': ' +
                        formatearPesos(valor)}
                    </title>
                  </rect>
                );
              })}
              <text className="grafica-eje" x={centro} y={alto - 12} textAnchor="middle">
                {etiquetaPeriodo(punto.periodo)}
              </text>
            </g>
          );
        })}
      </svg>
      <ul className="grafica-leyenda">
        {grupos.map(function (grupo) {
          return (
            <li key={grupo.clave}>
              <span className={'grafica-punto grafica-barra--' + grupo.clave} />
              {grupo.etiqueta}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

async function peticion(
  ruta: string,
  token: string,
  metodo = 'GET',
  cuerpo?: unknown,
): Promise<Response> {
  return fetch(API + ruta, {
    method: metodo,
    // Content-Type solo cuando hay cuerpo: evita rechazo por cuerpo vacio (PATCH inactivar).
    headers: {
      ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
}

function ContenidoAplicacion(): JSX.Element {
  const [token, setToken] = useState('');
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [usuarioSesion, setUsuarioSesion] = useState<UsuarioSesion | null>(null);
  const [moduloActivo, setModuloActivo] = useState<string>('Dashboard');
  const [resumen, setResumen] = useState<Resumen>({
    pedidos: 0,
    pedidosPagados: 0,
    clientes: 0,
    productos: 0,
    casosAbiertos: 0,
    ultimosPedidos: [],
    ultimosClientes: [],
  });
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [nitNuevo, setNitNuevo] = useState('');
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [contactoNuevo, setContactoNuevo] = useState('');
  const [telefonoNuevo, setTelefonoNuevo] = useState('');
  const [correoNuevo, setCorreoNuevo] = useState('');
  const [direccionNueva, setDireccionNueva] = useState('');
  const [sitioNuevo, setSitioNuevo] = useState('');
  // IVA pactado con el proveedor en porcentaje (se envia a la API en puntos basicos).
  const [ivaProveedorPct, setIvaProveedorPct] = useState('19');
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [terminoBusqueda, setTerminoBusqueda] = useState('');
  // Estado del modulo Inventario (CU-INV-001..008).
  const [bodegasInv, setBodegasInv] = useState<BodegaInv[]>([]);
  const [productosInv, setProductosInv] = useState<ProductoCorto[]>([]);
  const [stockInv, setStockInv] = useState<FilaStock[]>([]);
  const [kardexInv, setKardexInv] = useState<FilaKardex[]>([]);
  const [bodegaSel, setBodegaSel] = useState('');
  const [productoInvSel, setProductoInvSel] = useState('');
  const [cantidadInv, setCantidadInv] = useState('');
  const [motivoInv, setMotivoInv] = useState('');
  const [referenciaInv, setReferenciaInv] = useState('');
  const [minimoInv, setMinimoInv] = useState('');
  const [nombreBodegaNueva, setNombreBodegaNueva] = useState('');
  const [ubicacionBodegaNueva, setUbicacionBodegaNueva] = useState('');
  // Estado de Compras avanzado (CU-ERP-002..009).
  const [ordenesCompra, setOrdenesCompra] = useState<FilaOrden[]>([]);
  const [cuentasPagar, setCuentasPagar] = useState<FilaCuenta[]>([]);
  const [catalogoCompras, setCatalogoCompras] = useState<ProductoCorto[]>([]);
  const [bodegasCompras, setBodegasCompras] = useState<BodegaInv[]>([]);
  const [proveedorSel, setProveedorSel] = useState('');
  const [bodegaCompraSel, setBodegaCompraSel] = useState('');
  // Borrador de la orden multi-linea (CU-ERP-003) y recepcion por renglon (CU-ERP-007).
  const [lineasOrden, setLineasOrden] = useState<LineaOrdenBorrador[]>([]);
  const [productoLineaSel, setProductoLineaSel] = useState('');
  const [cantidadLinea, setCantidadLinea] = useState('');
  const [precioLinea, setPrecioLinea] = useState('');
  const [ordenDetalleId, setOrdenDetalleId] = useState<number | null>(null);
  const [recepcionLineas, setRecepcionLineas] = useState<Record<number, string>>({});
  // Estado del modulo Ventas (CU-CM-007 base).
  const [ventas, setVentas] = useState<FilaVenta[]>([]);
  const [resumenVentas, setResumenVentas] = useState<ResumenVentas | null>(null);
  const [filtroEstadoVenta, setFiltroEstadoVenta] = useState('');
  const [detalleVenta, setDetalleVenta] = useState<DetalleVenta | null>(null);
  // Usuarios y perfiles (Seguridad).
  const [usuariosInternos, setUsuariosInternos] = useState<FilaUsuario[]>([]);
  const [rolesEdicion, setRolesEdicion] = useState<Record<number, string>>({});
  // Estado del modulo RRHH / Nomina (CU-RH-001/002/005/007).
  const [cargosRrhh, setCargosRrhh] = useState<CargoRrhh[]>([]);
  const [empleadosRrhh, setEmpleadosRrhh] = useState<EmpleadoRrhh[]>([]);
  const [ausenciasRrhh, setAusenciasRrhh] = useState<AusenciaRrhh[]>([]);
  const [nominasRrhh, setNominasRrhh] = useState<NominaRrhh[]>([]);
  const [nombreCargo, setNombreCargo] = useState('');
  const [nombreEmpleado, setNombreEmpleado] = useState('');
  const [documentoEmpleado, setDocumentoEmpleado] = useState('');
  const [salarioEmpleadoPesos, setSalarioEmpleadoPesos] = useState('');
  const [cargoSelEmpleado, setCargoSelEmpleado] = useState('');
  const [empleadoSelAusencia, setEmpleadoSelAusencia] = useState('');
  const [fechaAusencia, setFechaAusencia] = useState('');
  const [motivoAusencia, setMotivoAusencia] = useState('');
  const [periodoNomina, setPeriodoNomina] = useState('');
  // Comercial B2B (CU-CM-004/007).
  const [clientesEmpresaB2b, setClientesEmpresaB2b] = useState<ClienteEmpresa[]>([]);
  const [ordenesB2b, setOrdenesB2b] = useState<OrdenB2b[]>([]);
  const [productosB2b, setProductosB2b] = useState<ProductoCorto[]>([]);
  const [bodegasB2b, setBodegasB2b] = useState<BodegaInv[]>([]);
  const [nitClienteB2b, setNitClienteB2b] = useState('');
  const [razonClienteB2b, setRazonClienteB2b] = useState('');
  const [cupoClienteB2b, setCupoClienteB2b] = useState('');
  const [clienteB2bSel, setClienteB2bSel] = useState('');
  const [productoB2bSel, setProductoB2bSel] = useState('');
  const [cantidadB2b, setCantidadB2b] = useState('');
  const [formaPagoB2b, setFormaPagoB2b] = useState('credito');
  // Facturacion y Contabilidad (CU-FC / CU-CT).
  const [impuestosFin, setImpuestosFin] = useState<ImpuestoFin[]>([]);
  const [facturasFin, setFacturasFin] = useState<FacturaFin[]>([]);
  const [porFacturarFin, setPorFacturarFin] = useState<OrdenPorFacturar[]>([]);
  const [cuentasFin, setCuentasFin] = useState<CuentaContable[]>([]);
  const [asientosFin, setAsientosFin] = useState<AsientoContable[]>([]);
  const [nombreImpuesto, setNombreImpuesto] = useState('');
  const [tarifaImpuestoPct, setTarifaImpuestoPct] = useState('19');
  const [tipoImpuesto, setTipoImpuesto] = useState('iva');
  const [ordenFacturarSel, setOrdenFacturarSel] = useState('');
  const [impuestoFacturaSel, setImpuestoFacturaSel] = useState('');
  const [facturaNotaSel, setFacturaNotaSel] = useState('');
  const [tipoNota, setTipoNota] = useState('credito');
  const [montoNotaPesos, setMontoNotaPesos] = useState('');
  const [motivoNota, setMotivoNota] = useState('');
  const [codigoCuenta, setCodigoCuenta] = useState('');
  const [nombreCuenta, setNombreCuenta] = useState('');
  const [naturalezaCuenta, setNaturalezaCuenta] = useState('debito');
  const [descripcionAsiento, setDescripcionAsiento] = useState('');
  const [cuentaDebeSel, setCuentaDebeSel] = useState('');
  const [cuentaHaberSel, setCuentaHaberSel] = useState('');
  const [montoAsientoPesos, setMontoAsientoPesos] = useState('');
  // Metas y comisiones comerciales (CU-CM-005/006).
  const [vendedoresCom, setVendedoresCom] = useState<VendedorComercial[]>([]);
  const [metasCom, setMetasCom] = useState<MetaComercial[]>([]);
  const [cumplimientoCom, setCumplimientoCom] = useState<CumplimientoMeta[]>([]);
  const [comisionesCom, setComisionesCom] = useState<ComisionComercial[]>([]);
  const [vendedorMetaSel, setVendedorMetaSel] = useState('');
  const [periodoMeta, setPeriodoMeta] = useState('');
  const [montoMetaPesos, setMontoMetaPesos] = useState('');
  const [vendedorComisionSel, setVendedorComisionSel] = useState('');
  const [porcentajeComisionPct, setPorcentajeComisionPct] = useState('5');
  const [periodoComision, setPeriodoComision] = useState('');
  // Horarios y novedades RRHH (CU-RH-004/006) y reportes de Gerencia.
  const [horariosRrhh, setHorariosRrhh] = useState<HorarioRrhh[]>([]);
  const [novedadesRrhh, setNovedadesRrhh] = useState<NovedadRrhh[]>([]);
  const [empleadoHorarioSel, setEmpleadoHorarioSel] = useState('');
  const [diaSemanaHorario, setDiaSemanaHorario] = useState('1');
  const [horaInicioHorario, setHoraInicioHorario] = useState('08:00');
  const [horaFinHorario, setHoraFinHorario] = useState('17:00');
  const [empleadoNovedadSel, setEmpleadoNovedadSel] = useState('');
  const [periodoNovedad, setPeriodoNovedad] = useState('');
  const [tipoNovedad, setTipoNovedad] = useState('devengo');
  const [conceptoNovedad, setConceptoNovedad] = useState('');
  const [montoNovedadPesos, setMontoNovedadPesos] = useState('');
  const [resumenGerencia, setResumenGerencia] = useState<ResumenGerencia | null>(null);
  const [periodoGerencia, setPeriodoGerencia] = useState('');
  // Reportes gerenciales avanzados (CU-GE): serie mensual, ranking y cartera.
  const [serieGerencia, setSerieGerencia] = useState<SerieGerencial | null>(null);
  const [rankingGerencia, setRankingGerencia] = useState<RankingGerencial | null>(null);
  const [carteraGerencia, setCarteraGerencia] = useState<CarteraGerencial | null>(null);
  const [mesesSerieGerencia, setMesesSerieGerencia] = useState(String(MESES_SERIE_DEFECTO));
  const [limiteRankingGerencia, setLimiteRankingGerencia] = useState(
    String(LIMITE_RANKING_DEFECTO),
  );
  // Estado del modulo Logistica (CU-LG-001..006).
  const [transportistasLog, setTransportistasLog] = useState<TransportistaLog[]>([]);
  const [vehiculosLog, setVehiculosLog] = useState<VehiculoLog[]>([]);
  const [ventasDesp, setVentasDesp] = useState<VentaDespachable[]>([]);
  const [despachosLog, setDespachosLog] = useState<DespachoLog[]>([]);
  const [nombreTransportista, setNombreTransportista] = useState('');
  const [nitTransportista, setNitTransportista] = useState('');
  const [telefonoTransportista, setTelefonoTransportista] = useState('');
  const [placaVehiculo, setPlacaVehiculo] = useState('');
  const [capacidadVehiculo, setCapacidadVehiculo] = useState('1000');
  const [transportistaSelLog, setTransportistaSelLog] = useState('');
  const [ventaSelLog, setVentaSelLog] = useState('');
  const [vehiculoSelLog, setVehiculoSelLog] = useState('');
  const [rutaDespacho, setRutaDespacho] = useState('');
  // Rutas de distribucion (CU-LG-005): planificacion con paradas y consolidacion de despachos.
  const [rutasLog, setRutasLog] = useState<RutaLog[]>([]);
  const [despachosConsolidablesLog, setDespachosConsolidablesLog] = useState<
    DespachoConsolidableLog[]
  >([]);
  const [codigoRutaNueva, setCodigoRutaNueva] = useState('');
  const [nombreRutaNueva, setNombreRutaNueva] = useState('');
  const [vehiculoRutaSel, setVehiculoRutaSel] = useState('');
  const [destinoParada, setDestinoParada] = useState('');
  const [despachoParadaSel, setDespachoParadaSel] = useState('');
  const [paradasRuta, setParadasRuta] = useState<ParadaRutaBorrador[]>([]);
  const [rutaConsolidarSel, setRutaConsolidarSel] = useState('');
  const [despachosConsolidar, setDespachosConsolidar] = useState<string[]>([]);
  const [detalleRutaLog, setDetalleRutaLog] = useState<RutaLog | null>(null);

  async function cargarResumen(tokenActivo: string): Promise<void> {
    try {
      const pedidos = (await (await peticion('/administracion/pedidos', tokenActivo)).json())
        .data as {
        estado: string;
        referenciaPedido: string;
        totalCentavos: number;
        creadoEn: string;
      }[];
      const clientes = (await (await peticion('/administracion/clientes', tokenActivo)).json())
        .data as { id: number; correo: string; nombre: string }[];
      const catalogo = (await (await peticion('/catalogo/productos', tokenActivo)).json())
        .data as unknown[];
      const casos = (await (await peticion('/casos/bandeja', tokenActivo)).json())
        .data as unknown[];
      setResumen({
        pedidos: pedidos.length,
        pedidosPagados: pedidos.filter(function (p) {
          return p.estado === 'pagado' || p.estado === 'entregado';
        }).length,
        clientes: clientes.length,
        productos: catalogo.length,
        casosAbiertos: casos.length,
        ultimosPedidos: pedidos.slice(0, 6),
        ultimosClientes: clientes.slice(0, 5),
      });
    } catch {
      // El resumen consume datos de otros modulos segun el rol; si no hay permiso
      // los KPIs quedan en cero en silencio (sin contaminar la interfaz).
    }
  }

  async function cargarProveedores(tokenActivo: string): Promise<void> {
    const respuesta = await peticion('/erp/proveedores', tokenActivo);
    if (!respuesta.ok) {
      setMensaje('Sin permisos o modulo no disponible');
      setProveedores([]);
      return;
    }
    const json = await respuesta.json();
    setProveedores(json.data as Proveedor[]);
  }

  function resetearFormulario(): void {
    setNitNuevo('');
    setNombreNuevo('');
    setContactoNuevo('');
    setTelefonoNuevo('');
    setCorreoNuevo('');
    setDireccionNueva('');
    setSitioNuevo('');
    setIvaProveedorPct('19');
  }

  function iniciarEdicion(proveedor: Proveedor): void {
    setEditandoId(proveedor.id);
    setNitNuevo(proveedor.nit);
    setNombreNuevo(proveedor.nombre);
    setContactoNuevo(proveedor.contacto || '');
    setTelefonoNuevo(proveedor.telefono || '');
    setCorreoNuevo(proveedor.correo || '');
    setDireccionNueva(proveedor.direccion || '');
    setSitioNuevo(proveedor.sitioWeb || '');
    // El IVA viaja en puntos basicos y se edita en porcentaje (1900 -> 19).
    setIvaProveedorPct(String((proveedor.tarifaIvaBps || 0) / 100));
  }

  function cancelarEdicion(): void {
    setEditandoId(null);
    resetearFormulario();
  }

  // Alta (POST) o edicion (PATCH) de proveedor segun editandoId (CU-ERP-001).
  async function guardarProveedor(): Promise<void> {
    if (!token) return;
    // Guard clause del IVA pactado: porcentaje entero entre 0 y 100 (se envia en puntos basicos).
    const ivaPct = ivaProveedorPct.trim() === '' ? 19 : Number(ivaProveedorPct);
    if (!Number.isFinite(ivaPct) || ivaPct < 0 || ivaPct > 100) {
      setMensaje('El IVA del proveedor debe estar entre 0 y 100%');
      return;
    }
    const tarifaIvaBps = Math.round(ivaPct * 100);
    if (editandoId !== null) {
      // Modo edicion: el NIT no cambia (identificador); enviamos '' para limpiar opcionales.
      if (!nombreNuevo.trim()) {
        setMensaje('El nombre es obligatorio');
        return;
      }
      const cuerpo = {
        nombre: nombreNuevo.trim(),
        contacto: contactoNuevo.trim(),
        telefono: telefonoNuevo.trim(),
        correo: correoNuevo.trim(),
        direccion: direccionNueva.trim(),
        sitioWeb: sitioNuevo.trim(),
        tarifaIvaBps: tarifaIvaBps,
      };
      const respuesta = await peticion('/erp/proveedores/' + editandoId, token, 'PATCH', cuerpo);
      if (!respuesta.ok) {
        const json = await respuesta.json().catch(function () {
          return {};
        });
        setMensaje(
          json.error === 'correo_invalido'
            ? 'El correo electronico no es valido'
            : mensajeErrorApi(json.error),
        );
        return;
      }
      setEditandoId(null);
      resetearFormulario();
      await cargarProveedores(token);
      return;
    }
    // Guard clause del alta: nit y nombre son obligatorios.
    if (!nitNuevo.trim() || !nombreNuevo.trim()) {
      setMensaje('NIT y nombre son obligatorios');
      return;
    }
    const cuerpo = {
      nit: nitNuevo.trim(),
      nombre: nombreNuevo.trim(),
      contacto: contactoNuevo.trim() || undefined,
      telefono: telefonoNuevo.trim() || undefined,
      correo: correoNuevo.trim() || undefined,
      direccion: direccionNueva.trim() || undefined,
      sitioWeb: sitioNuevo.trim() || undefined,
      tarifaIvaBps: tarifaIvaBps,
    };
    const respuesta = await peticion('/erp/proveedores', token, 'POST', cuerpo);
    if (!respuesta.ok) {
      const json = await respuesta.json().catch(function () {
        return {};
      });
      setMensaje(
        json.error === 'nit_ya_existe'
          ? 'El NIT ya existe'
          : json.error === 'correo_invalido'
            ? 'El correo electronico no es valido'
            : mensajeErrorApi(json.error),
      );
      return;
    }
    resetearFormulario();
    await cargarProveedores(token);
  }

  async function inactivarProveedorUI(id: number): Promise<void> {
    if (!token) return;
    const respuesta = await peticion('/erp/proveedores/' + id + '/inactivar', token, 'PATCH');
    if (!respuesta.ok) {
      setMensaje('No se pudo inactivar el proveedor');
      return;
    }
    await cargarProveedores(token);
  }

  async function cargarInventario(tokenActivo: string): Promise<void> {
    try {
      const bodegasJson = await (await peticion('/inventario/bodegas', tokenActivo)).json();
      setBodegasInv(bodegasJson.data as BodegaInv[]);
    } catch {
      setMensaje('No se pudieron cargar las bodegas');
    }
    try {
      const catalogoJson = await (await peticion('/catalogo/productos', tokenActivo)).json();
      setProductosInv(catalogoJson.data as ProductoCorto[]);
    } catch {
      setMensaje('No se pudo cargar el catalogo');
    }
    try {
      const stockJson = await (await peticion('/inventario/stock', tokenActivo)).json();
      setStockInv(stockJson.data as FilaStock[]);
    } catch {
      setMensaje('No se pudo cargar el stock');
    }
    try {
      const kardexJson = await (await peticion('/inventario/kardex', tokenActivo)).json();
      setKardexInv(kardexJson.data as FilaKardex[]);
    } catch {
      setMensaje('No se pudo cargar el kardex');
    }
  }

  // Registra entrada/salida (CU-INV-001/002) o ajuste por conteo fisico (CU-INV-003).
  async function registrarMovimientoInv(tipo: string): Promise<void> {
    if (!token) return;
    const bodegaId = Number(bodegaSel);
    const productoId = Number(productoInvSel);
    const cantidad = Number(cantidadInv);
    if (!bodegaId || !productoId || !cantidad || cantidad <= 0) {
      setMensaje('Seleccione bodega, producto y cantidad valida');
      return;
    }
    if (!motivoInv.trim()) {
      setMensaje('El motivo es obligatorio');
      return;
    }
    const cuerpo = {
      bodegaId: bodegaId,
      productoId: productoId,
      cantidad: cantidad,
      motivo: motivoInv.trim(),
      referencia: referenciaInv.trim() || undefined,
    };
    const ruta =
      tipo === 'entrada'
        ? '/inventario/movimientos/entrada'
        : tipo === 'salida'
          ? '/inventario/movimientos/salida'
          : '/inventario/movimientos/ajuste';
    const respuesta = await peticion(ruta, token, 'POST', cuerpo);
    if (!respuesta.ok) {
      const json = await respuesta.json().catch(function () {
        return {};
      });
      setMensaje(
        json.error === 'stock_insuficiente'
          ? 'Stock insuficiente en la bodega'
          : 'No se pudo registrar el movimiento',
      );
      return;
    }
    setCantidadInv('');
    setMotivoInv('');
    setReferenciaInv('');
    await cargarInventario(token);
  }

  // Crea una bodega (CU-INV-005).
  async function crearBodegaInv(): Promise<void> {
    if (!token) return;
    if (!nombreBodegaNueva.trim()) {
      setMensaje('El nombre de la bodega es obligatorio');
      return;
    }
    const respuesta = await peticion('/inventario/bodegas', token, 'POST', {
      nombre: nombreBodegaNueva.trim(),
      ubicacion: ubicacionBodegaNueva.trim() || undefined,
    });
    if (!respuesta.ok) {
      setMensaje('No se pudo crear la bodega');
      return;
    }
    setNombreBodegaNueva('');
    setUbicacionBodegaNueva('');
    await cargarInventario(token);
  }

  // Inactiva una bodega (CU-INV-005).
  async function inactivarBodegaInv(id: number): Promise<void> {
    if (!token) return;
    const respuesta = await peticion('/inventario/bodegas/' + id + '/inactivar', token, 'PATCH');
    if (!respuesta.ok) {
      setMensaje('No se pudo inactivar la bodega');
      return;
    }
    await cargarInventario(token);
  }

  // Configura el stock minimo de un producto en la bodega (CU-INV-007).
  async function fijarStockMinimoInv(): Promise<void> {
    if (!token) return;
    const bodegaId = Number(bodegaSel);
    const productoId = Number(productoInvSel);
    const stockMinimo = Number(minimoInv);
    if (!bodegaId || !productoId || stockMinimo < 0) {
      setMensaje('Seleccione bodega y producto con minimo valido');
      return;
    }
    const respuesta = await peticion('/inventario/stock/minimo', token, 'PATCH', {
      bodegaId: bodegaId,
      productoId: productoId,
      stockMinimo: stockMinimo,
    });
    if (!respuesta.ok) {
      setMensaje('No se pudo configurar el stock minimo');
      return;
    }
    setMinimoInv('');
    await cargarInventario(token);
  }

  // Carga datos de Compras avanzado (CU-ERP-002..009).
  async function cargarComprasAvanzado(tokenActivo: string): Promise<void> {
    // Cada consulta es opcional segun el rol: si la API responde 403/error se deja la lista anterior.
    const ordenesRespuesta = await peticion('/compras/ordenes', tokenActivo);
    if (ordenesRespuesta.ok) {
      const ordenesJson = await ordenesRespuesta.json();
      setOrdenesCompra((ordenesJson.data as FilaOrden[]) || []);
    } else {
      setOrdenesCompra([]);
    }
    const cuentasRespuesta = await peticion('/compras/cuentas-pagar', tokenActivo);
    if (cuentasRespuesta.ok) {
      const cuentasJson = await cuentasRespuesta.json();
      setCuentasPagar((cuentasJson.data as FilaCuenta[]) || []);
    } else {
      setCuentasPagar([]);
    }
    const catalogoRespuesta = await peticion('/catalogo/productos', tokenActivo);
    if (catalogoRespuesta.ok) {
      const catalogoJson = await catalogoRespuesta.json();
      setCatalogoCompras((catalogoJson.data as ProductoCorto[]) || []);
    } else {
      setCatalogoCompras([]);
    }
    const bodegasRespuesta = await peticion('/inventario/bodegas', tokenActivo);
    if (bodegasRespuesta.ok) {
      const bodegasJson = await bodegasRespuesta.json();
      setBodegasCompras((bodegasJson.data as BodegaInv[]) || []);
    } else {
      setBodegasCompras([]);
    }
  }

  // Nombre del producto de un renglon en borrador (catalogo cargado en el modulo).
  function nombreProductoLinea(productoId: string): string {
    const producto = catalogoCompras.find(function (p) {
      return String(p.id) === String(productoId);
    });
    return producto ? producto.nombre : 'Producto ' + productoId;
  }

  // Agrega un renglon al borrador de la orden multi-linea (CU-ERP-003).
  function agregarLineaOrdenUI(): void {
    const productoId = Number(productoLineaSel);
    const cantidad = Number(cantidadLinea);
    const precioPesos = Number(precioLinea);
    if (
      !productoId ||
      !Number.isInteger(cantidad) ||
      cantidad <= 0 ||
      !Number.isFinite(precioPesos) ||
      precioPesos <= 0
    ) {
      setMensaje('Seleccione producto, cantidad entera y precio unitario (COP)');
      return;
    }
    if (lineasOrden.length >= MAXIMO_LINEAS_ORDEN) {
      setMensaje('La orden admite maximo ' + MAXIMO_LINEAS_ORDEN + ' renglones');
      return;
    }
    const repetido = lineasOrden.some(function (linea) {
      return Number(linea.productoId) === productoId;
    });
    if (repetido) {
      setMensaje('El producto ya esta en la orden (no se repite producto por renglon)');
      return;
    }
    setLineasOrden(
      lineasOrden.concat([
        {
          productoId: String(productoId),
          cantidad: String(cantidad),
          precioPesos: String(precioPesos),
        },
      ]),
    );
    setProductoLineaSel('');
    setCantidadLinea('');
    setPrecioLinea('');
  }

  // Quita un renglon del borrador antes de crear la orden (CU-ERP-003).
  function quitarLineaOrdenUI(indice: number): void {
    setLineasOrden(
      lineasOrden.filter(function (_linea, posicion) {
        return posicion !== indice;
      }),
    );
  }

  // Crea la orden de compra multi-linea (CU-ERP-003): renglones + IVA pactado del proveedor.
  async function crearOrdenUI(): Promise<void> {
    if (!token) return;
    const proveedorId = Number(proveedorSel);
    const bodegaId = Number(bodegaCompraSel);
    if (!proveedorId || !bodegaId) {
      setMensaje('Seleccione proveedor y bodega destino');
      return;
    }
    if (!lineasOrden.length) {
      setMensaje('Agregue al menos un renglon a la orden');
      return;
    }
    const lineas = lineasOrden.map(function (linea) {
      return {
        productoId: Number(linea.productoId),
        cantidad: Number(linea.cantidad),
        // El precio se captura en pesos colombianos (COP) y viaja a la API en centavos.
        precioUnitarioCentavos: Math.round(Number(linea.precioPesos) * 100),
      };
    });
    const respuesta = await peticion('/compras/ordenes', token, 'POST', {
      proveedorId: proveedorId,
      bodegaDestinoId: bodegaId,
      lineas: lineas,
    });
    if (!respuesta.ok) {
      const json = await respuesta.json().catch(function () {
        return {};
      });
      setMensaje(mensajeErrorApi(json.error));
      return;
    }
    setLineasOrden([]);
    await Promise.all([cargarComprasAvanzado(token), cargarProveedores(token)]);
  }

  // Muestra u oculta el detalle de renglones de una orden (CU-ERP-006).
  function alternarDetalleOrdenUI(id: number): void {
    setOrdenDetalleId(ordenDetalleId === id ? null : id);
    setRecepcionLineas({});
  }

  // Registra la recepcion por renglon de una orden multi-linea (CU-ERP-007/008).
  async function recibirLineasOrdenUI(orden: FilaOrden): Promise<void> {
    if (!token) return;
    const lineas = orden.lineas
      .map(function (linea) {
        return { lineaId: linea.id, cantidad: Number(recepcionLineas[linea.id] || 0) };
      })
      .filter(function (linea) {
        return linea.cantidad > 0;
      });
    if (!lineas.length) {
      setMensaje('Indique al menos una cantidad a recibir por renglon');
      return;
    }
    const noEntera = lineas.some(function (linea) {
      return !Number.isInteger(linea.cantidad);
    });
    if (noEntera) {
      setMensaje('Las cantidades recibidas deben ser enteras');
      return;
    }
    const respuesta = await peticion('/compras/ordenes/' + orden.id + '/recepcion', token, 'POST', {
      lineas: lineas,
    });
    if (!respuesta.ok) {
      const json = await respuesta.json().catch(function () {
        return {};
      });
      setMensaje(
        respuesta.status === 403
          ? 'Requiere rol ALMACENISTA o ADMIN para registrar la recepcion'
          : mensajeErrorApi(json.error),
      );
      return;
    }
    setRecepcionLineas({});
    await Promise.all([cargarComprasAvanzado(token), cargarProveedores(token)]);
  }

  async function aprobarOrdenUI(id: number): Promise<void> {
    if (!token) return;
    const respuesta = await peticion('/compras/ordenes/' + id + '/aprobar', token, 'PATCH');
    if (!respuesta.ok) {
      setMensaje('No se pudo aprobar la orden');
      return;
    }
    await cargarComprasAvanzado(token);
  }

  async function cancelarOrdenUI(id: number): Promise<void> {
    if (!token) return;
    const respuesta = await peticion('/compras/ordenes/' + id + '/cancelar', token, 'PATCH');
    if (!respuesta.ok) {
      setMensaje('No se pudo cancelar la orden');
      return;
    }
    await cargarComprasAvanzado(token);
  }

  // Recibe el saldo pendiente de la orden e ingresa al inventario (CU-ERP-007/008).
  async function recibirSaldoOrdenUI(id: number): Promise<void> {
    if (!token) return;
    const orden = ordenesCompra.find(function (o) {
      return o.id === id;
    });
    if (!orden || orden.saldoPendiente <= 0) {
      setMensaje('No hay saldo pendiente por recibir');
      return;
    }
    // Orden multi-linea: la API exige recepcion por renglon (recepcion_por_linea_requerida).
    if (orden.totalLineas > 1) {
      setMensaje('Orden multi-linea: abra el detalle y reciba por renglon');
      setOrdenDetalleId(orden.id);
      return;
    }
    const respuesta = await peticion('/compras/ordenes/' + id + '/recepcion', token, 'POST', {
      cantidadRecibida: orden.saldoPendiente,
    });
    if (!respuesta.ok) {
      const json = await respuesta.json().catch(function () {
        return {};
      });
      setMensaje(mensajeErrorApi(json.error));
      return;
    }
    await Promise.all([cargarComprasAvanzado(token), cargarProveedores(token)]);
  }

  // Marca pagada una cuenta por pagar (CU-ERP-009).
  async function pagarCuentaUI(id: number): Promise<void> {
    if (!token) return;
    const respuesta = await peticion('/compras/cuentas-pagar/' + id + '/pagar', token, 'PATCH', {
      referenciaPago: 'PAGO-ERP-' + id,
    });
    if (!respuesta.ok) {
      setMensaje('No se pudo registrar el pago');
      return;
    }
    await cargarComprasAvanzado(token);
  }

  // Consulta las ventas y su resumen (CU-CM-007 base).
  async function cargarVentas(tokenActivo: string): Promise<void> {
    const ruta = filtroEstadoVenta ? '/ventas?estado=' + filtroEstadoVenta : '/ventas';
    const respuesta = await peticion(ruta, tokenActivo);
    if (!respuesta.ok) {
      setVentas([]);
      return;
    }
    const json = await respuesta.json();
    setVentas((json.data as FilaVenta[]) || []);
    const resRespuesta = await peticion('/ventas/resumen', tokenActivo);
    if (resRespuesta.ok) {
      const resJson = await resRespuesta.json();
      setResumenVentas((resJson.data as ResumenVentas) || null);
    }
  }

  async function entregarVentaUI(referencia: string): Promise<void> {
    if (!token) return;
    const respuesta = await peticion('/ventas/' + referencia + '/entregar', token, 'PATCH');
    if (!respuesta.ok) {
      setMensaje('No se pudo marcar la venta como entregada');
      return;
    }
    await cargarVentas(token);
  }

  async function cancelarVentaUI(referencia: string): Promise<void> {
    if (!token) return;
    const respuesta = await peticion('/ventas/' + referencia + '/cancelar', token, 'PATCH');
    if (!respuesta.ok) {
      setMensaje('No se pudo cancelar la venta');
      return;
    }
    await cargarVentas(token);
  }

  async function verDetalleVentaUI(referencia: string): Promise<void> {
    if (!token) return;
    const respuesta = await peticion('/ventas/' + referencia, token);
    if (!respuesta.ok) {
      setDetalleVenta(null);
      return;
    }
    const json = await respuesta.json();
    setDetalleVenta((json.data as DetalleVenta) || null);
  }

  // Comercial B2B (CU-CM-004/007): carga clientes, ordenes, catalogo y bodegas.
  async function cargarB2b(tokenActivo: string): Promise<void> {
    const clResp = await peticion('/comercial/clientes-empresa', tokenActivo);
    if (clResp.ok) setClientesEmpresaB2b(((await clResp.json()).data as ClienteEmpresa[]) || []);
    const orResp = await peticion('/comercial/ordenes', tokenActivo);
    if (orResp.ok) setOrdenesB2b(((await orResp.json()).data as OrdenB2b[]) || []);
    const caResp = await peticion('/catalogo/productos', tokenActivo);
    if (caResp.ok) setProductosB2b(((await caResp.json()).data as ProductoCorto[]) || []);
    const boResp = await peticion('/inventario/bodegas', tokenActivo);
    if (boResp.ok) setBodegasB2b(((await boResp.json()).data as BodegaInv[]) || []);
  }

  async function crearClienteEmpresaUI(): Promise<void> {
    if (!token) return;
    const cupoCentavos = Math.round((Number(cupoClienteB2b) || 0) * 100);
    if (!nitClienteB2b.trim() || !razonClienteB2b.trim()) {
      setMensaje('NIT y razon social son obligatorios');
      return;
    }
    const respuesta = await peticion('/comercial/clientes-empresa', token, 'POST', {
      nit: nitClienteB2b.trim(),
      razonSocial: razonClienteB2b.trim(),
      cupoCreditoCentavos: cupoCentavos,
    });
    if (!respuesta.ok) {
      setMensaje('No se pudo crear el cliente ERP');
      return;
    }
    setNitClienteB2b('');
    setRazonClienteB2b('');
    setCupoClienteB2b('');
    await cargarB2b(token);
  }

  async function inactivarClienteEmpresaUI(id: number): Promise<void> {
    if (!token) return;
    const respuesta = await peticion(
      '/comercial/clientes-empresa/' + id + '/inactivar',
      token,
      'PATCH',
    );
    if (!respuesta.ok) {
      setMensaje('No se pudo inactivar el cliente ERP');
      return;
    }
    await cargarB2b(token);
  }

  async function crearOrdenB2bUI(): Promise<void> {
    if (!token) return;
    const clienteId = Number(clienteB2bSel);
    const productoId = Number(productoB2bSel);
    const cantidad = Number(cantidadB2b);
    const bodegaId = bodegasB2b[0] ? bodegasB2b[0].id : 0;
    if (!clienteId || !productoId || !cantidad || cantidad <= 0 || !bodegaId) {
      setMensaje('Seleccione cliente, producto y cantidad');
      return;
    }
    const respuesta = await peticion('/comercial/ordenes', token, 'POST', {
      clienteEmpresaId: clienteId,
      bodegaId: bodegaId,
      formaPago: formaPagoB2b,
      lineas: [{ productoId: productoId, cantidad: cantidad }],
    });
    if (!respuesta.ok) {
      const json = await respuesta.json().catch(function () {
        return {};
      });
      setMensaje(
        json.error === 'cupo_insuficiente'
          ? 'Cupo de credito insuficiente'
          : 'No se pudo crear la orden B2B',
      );
      return;
    }
    setClienteB2bSel('');
    setProductoB2bSel('');
    setCantidadB2b('');
    await Promise.all([cargarB2b(token), cargarVentas(token)]);
  }

  async function accionOrdenB2bUI(id: number, accion: string): Promise<void> {
    if (!token) return;
    const respuesta = await peticion('/comercial/ordenes/' + id + '/' + accion, token, 'PATCH');
    if (!respuesta.ok) {
      setMensaje('No se pudo ' + accion + ' la orden B2B');
      return;
    }
    await Promise.all([cargarB2b(token), cargarVentas(token)]);
  }

  // Facturacion y Contabilidad (CU-FC / CU-CT).
  async function cargarFinanzas(tokenActivo: string): Promise<void> {
    const impResp = await peticion('/facturacion/impuestos', tokenActivo);
    if (impResp.ok) setImpuestosFin(((await impResp.json()).data as ImpuestoFin[]) || []);
    const facResp = await peticion('/facturacion/facturas', tokenActivo);
    if (facResp.ok) setFacturasFin(((await facResp.json()).data as FacturaFin[]) || []);
    const penResp = await peticion('/facturacion/ordenes-por-facturar', tokenActivo);
    if (penResp.ok) setPorFacturarFin(((await penResp.json()).data as OrdenPorFacturar[]) || []);
  }

  async function cargarContabilidad(tokenActivo: string): Promise<void> {
    const cueResp = await peticion('/contabilidad/cuentas', tokenActivo);
    if (cueResp.ok) setCuentasFin(((await cueResp.json()).data as CuentaContable[]) || []);
    const asiResp = await peticion('/contabilidad/asientos', tokenActivo);
    if (asiResp.ok) setAsientosFin(((await asiResp.json()).data as AsientoContable[]) || []);
  }

  async function crearImpuestoUI(): Promise<void> {
    if (!token) return;
    const bps = Math.round((Number(tarifaImpuestoPct) || 0) * 100);
    if (!nombreImpuesto.trim()) {
      setMensaje('El nombre del impuesto es obligatorio');
      return;
    }
    const respuesta = await peticion('/facturacion/impuestos', token, 'POST', {
      nombre: nombreImpuesto.trim(),
      tipo: tipoImpuesto,
      tarifaBps: bps,
    });
    if (!respuesta.ok) {
      setMensaje('No se pudo crear el impuesto (tarifa 0-100%)');
      return;
    }
    setNombreImpuesto('');
    await cargarFinanzas(token);
  }

  async function emitirFacturaUI(): Promise<void> {
    if (!token) return;
    const ordenB2bId = Number(ordenFacturarSel);
    if (!ordenB2bId) {
      setMensaje('Seleccione la orden B2B a facturar');
      return;
    }
    const respuesta = await peticion('/facturacion/facturas', token, 'POST', {
      ordenB2bId: ordenB2bId,
      impuestoId: impuestoFacturaSel ? Number(impuestoFacturaSel) : undefined,
    });
    if (!respuesta.ok) {
      setMensaje('No se pudo emitir la factura');
      return;
    }
    setOrdenFacturarSel('');
    await cargarFinanzas(token);
  }

  async function accionFacturaUI(id: number, accion: string): Promise<void> {
    if (!token) return;
    const respuesta = await peticion('/facturacion/facturas/' + id + '/' + accion, token, 'PATCH');
    if (!respuesta.ok) {
      setMensaje('No se pudo ' + accion + ' la factura');
      return;
    }
    await cargarFinanzas(token);
  }

  async function crearNotaUI(): Promise<void> {
    if (!token) return;
    const facturaId = Number(facturaNotaSel);
    const montoCentavos = Math.round((Number(montoNotaPesos) || 0) * 100);
    if (!facturaId || !motivoNota.trim() || montoCentavos <= 0) {
      setMensaje('Seleccione factura, monto (COP) y motivo');
      return;
    }
    const respuesta = await peticion('/facturacion/notas', token, 'POST', {
      facturaId: facturaId,
      tipo: tipoNota,
      montoCentavos: montoCentavos,
      motivo: motivoNota.trim(),
    });
    if (!respuesta.ok) {
      setMensaje('No se pudo crear la nota (revise el monto)');
      return;
    }
    setMontoNotaPesos('');
    setMotivoNota('');
  }

  async function crearCuentaUI(): Promise<void> {
    if (!token) return;
    if (!codigoCuenta.trim() || !nombreCuenta.trim()) {
      setMensaje('Codigo y nombre de la cuenta son obligatorios');
      return;
    }
    const respuesta = await peticion('/contabilidad/cuentas', token, 'POST', {
      codigo: codigoCuenta.trim(),
      nombre: nombreCuenta.trim(),
      naturaleza: naturalezaCuenta,
    });
    if (!respuesta.ok) {
      setMensaje('No se pudo crear la cuenta contable');
      return;
    }
    setCodigoCuenta('');
    setNombreCuenta('');
    await cargarContabilidad(token);
  }

  async function inactivarCuentaUI(id: number): Promise<void> {
    if (!token) return;
    const respuesta = await peticion('/contabilidad/cuentas/' + id + '/inactivar', token, 'PATCH');
    if (!respuesta.ok) {
      setMensaje('No se pudo inactivar la cuenta (puede tener movimientos)');
      return;
    }
    await cargarContabilidad(token);
  }

  async function crearAsientoUI(): Promise<void> {
    if (!token) return;
    const debe = Number(cuentaDebeSel);
    const haber = Number(cuentaHaberSel);
    const montoCentavos = Math.round((Number(montoAsientoPesos) || 0) * 100);
    if (!descripcionAsiento.trim() || !debe || !haber || montoCentavos <= 0) {
      setMensaje('Complete descripcion, cuentas y monto (COP)');
      return;
    }
    const respuesta = await peticion('/contabilidad/asientos', token, 'POST', {
      descripcion: descripcionAsiento.trim(),
      lineas: [
        { cuentaId: debe, debitoCentavos: montoCentavos, creditoCentavos: 0 },
        { cuentaId: haber, debitoCentavos: 0, creditoCentavos: montoCentavos },
      ],
    });
    if (!respuesta.ok) {
      setMensaje('No se pudo crear el asiento');
      return;
    }
    setDescripcionAsiento('');
    setMontoAsientoPesos('');
    await cargarContabilidad(token);
  }

  // Metas y comisiones comerciales (CU-CM-005/006).
  async function cargarMetasComisiones(tokenActivo: string, periodo: string): Promise<void> {
    const vdResp = await peticion('/comercial/vendedores', tokenActivo);
    if (vdResp.ok) setVendedoresCom(((await vdResp.json()).data as VendedorComercial[]) || []);
    const metResp = await peticion('/comercial/metas', tokenActivo);
    if (metResp.ok) setMetasCom(((await metResp.json()).data as MetaComercial[]) || []);
    const comResp = await peticion('/comercial/comisiones', tokenActivo);
    if (comResp.ok) setComisionesCom(((await comResp.json()).data as ComisionComercial[]) || []);
    if (periodo) {
      const cumResp = await peticion(
        '/comercial/metas/cumplimiento?periodo=' + periodo,
        tokenActivo,
      );
      if (cumResp.ok) setCumplimientoCom(((await cumResp.json()).data as CumplimientoMeta[]) || []);
    }
  }

  async function crearMetaUI(): Promise<void> {
    if (!token) return;
    const montoCentavos = Math.round((Number(montoMetaPesos) || 0) * 100);
    if (!vendedorMetaSel || !periodoMeta.trim() || montoCentavos <= 0) {
      setMensaje('Seleccione vendedor, periodo (YYYY-MM) y monto (COP)');
      return;
    }
    const respuesta = await peticion('/comercial/metas', token, 'POST', {
      vendedorId: vendedorMetaSel,
      periodo: periodoMeta.trim(),
      montoMetaCentavos: montoCentavos,
    });
    if (!respuesta.ok) {
      setMensaje('No se pudo crear la meta (unica por vendedor y periodo)');
      return;
    }
    setMontoMetaPesos('');
    await cargarMetasComisiones(token, periodoMeta.trim());
  }

  async function configurarComisionUI(): Promise<void> {
    if (!token) return;
    const bps = Math.round((Number(porcentajeComisionPct) || 0) * 100);
    if (!vendedorComisionSel || bps < 0 || bps > 10000) {
      setMensaje('Seleccione vendedor y porcentaje 0-100%');
      return;
    }
    const respuesta = await peticion('/comercial/comisiones/config', token, 'POST', {
      vendedorId: vendedorComisionSel,
      porcentajeBps: bps,
    });
    if (!respuesta.ok) {
      setMensaje('No se pudo configurar la comision');
      return;
    }
    await cargarMetasComisiones(token, periodoComision.trim());
  }

  async function calcularComisionesUI(): Promise<void> {
    if (!token) return;
    if (!periodoComision.trim()) {
      setMensaje('Indique el periodo (YYYY-MM)');
      return;
    }
    const respuesta = await peticion('/comercial/comisiones/calcular', token, 'POST', {
      periodo: periodoComision.trim(),
    });
    if (!respuesta.ok) {
      setMensaje('No se pudieron calcular las comisiones');
      return;
    }
    await cargarMetasComisiones(token, periodoComision.trim());
  }

  async function pagarComisionUI(id: number): Promise<void> {
    if (!token) return;
    const respuesta = await peticion('/comercial/comisiones/' + id + '/pagar', token, 'PATCH');
    if (!respuesta.ok) {
      setMensaje('No se pudo liquidar la comision');
      return;
    }
    await cargarMetasComisiones(token, periodoComision.trim());
  }

  // Horarios y novedades RRHH (CU-RH-004/006).
  async function cargarHorariosNovedades(tokenActivo: string): Promise<void> {
    const horResp = await peticion('/rrhh/horarios', tokenActivo);
    if (horResp.ok) setHorariosRrhh(((await horResp.json()).data as HorarioRrhh[]) || []);
    const novResp = await peticion('/rrhh/novedades', tokenActivo);
    if (novResp.ok) setNovedadesRrhh(((await novResp.json()).data as NovedadRrhh[]) || []);
  }

  async function crearHorarioUI(): Promise<void> {
    if (!token) return;
    const empleadoId = Number(empleadoHorarioSel);
    if (!empleadoId) {
      setMensaje('Seleccione el empleado del horario');
      return;
    }
    const respuesta = await peticion('/rrhh/horarios', token, 'POST', {
      empleadoId: empleadoId,
      diaSemana: Number(diaSemanaHorario),
      horaInicio: horaInicioHorario,
      horaFin: horaFinHorario,
    });
    if (!respuesta.ok) {
      setMensaje('Horario invalido (dia 1-7 y horas HH:MM con inicio < fin)');
      return;
    }
    await cargarHorariosNovedades(token);
  }

  async function crearNovedadUI(): Promise<void> {
    if (!token) return;
    const empleadoId = Number(empleadoNovedadSel);
    const montoCentavos = Math.round((Number(montoNovedadPesos) || 0) * 100);
    if (!empleadoId || !periodoNovedad.trim() || !conceptoNovedad.trim() || montoCentavos <= 0) {
      setMensaje('Complete empleado, periodo, concepto y monto (COP)');
      return;
    }
    const respuesta = await peticion('/rrhh/novedades', token, 'POST', {
      empleadoId: empleadoId,
      periodo: periodoNovedad.trim(),
      tipo: tipoNovedad,
      concepto: conceptoNovedad.trim(),
      montoCentavos: montoCentavos,
    });
    if (!respuesta.ok) {
      setMensaje('No se pudo registrar la novedad (nomina ya generada?)');
      return;
    }
    setConceptoNovedad('');
    setMontoNovedadPesos('');
    await cargarHorariosNovedades(token);
  }

  // Reportes gerenciales (CU-GE): resumen ejecutivo del periodo, serie mensual, ranking y cartera.
  async function cargarGerencia(
    tokenActivo: string,
    periodo: string,
    meses: string,
    limite: string,
  ): Promise<void> {
    const ruta = periodo
      ? '/gerencia/resumen?periodo=' + encodeURIComponent(periodo)
      : '/gerencia/resumen';
    const respuesta = await peticion(ruta, tokenActivo);
    if (!respuesta.ok) {
      setResumenGerencia(null);
      setSerieGerencia(null);
      setRankingGerencia(null);
      setCarteraGerencia(null);
      setMensaje(
        respuesta.status === 400
          ? 'El periodo debe tener formato AAAA-MM'
          : 'Requiere rol ADMIN o GERENTE_ZONA',
      );
      return;
    }
    const json = await respuesta.json();
    setResumenGerencia((json.data as ResumenGerencia) || null);
    await cargarReportesGerencia(tokenActivo, periodo, meses, limite);
  }

  // Carga los reportes avanzados de Gerencia: serie de meses, ranking de productos y cartera.
  async function cargarReportesGerencia(
    tokenActivo: string,
    periodo: string,
    meses: string,
    limite: string,
  ): Promise<void> {
    const serieRespuesta = await peticion(
      '/gerencia/series?meses=' + encodeURIComponent(meses),
      tokenActivo,
    );
    if (serieRespuesta.ok) {
      const serieJson = await serieRespuesta.json();
      setSerieGerencia((serieJson.data as SerieGerencial) || null);
    } else {
      setSerieGerencia(null);
    }
    const rankingRespuesta = await peticion(
      '/gerencia/ranking-productos?limite=' +
        encodeURIComponent(limite) +
        (periodo ? '&periodo=' + encodeURIComponent(periodo) : ''),
      tokenActivo,
    );
    if (rankingRespuesta.ok) {
      const rankingJson = await rankingRespuesta.json();
      setRankingGerencia((rankingJson.data as RankingGerencial) || null);
    } else {
      setRankingGerencia(null);
    }
    const carteraRespuesta = await peticion('/gerencia/cartera', tokenActivo);
    if (carteraRespuesta.ok) {
      const carteraJson = await carteraRespuesta.json();
      setCarteraGerencia((carteraJson.data as CarteraGerencial) || null);
    } else {
      setCarteraGerencia(null);
    }
  }

  // Descarga un reporte gerencial en CSV reutilizando el token de la sesion (CU-GE).
  async function descargarReporteGerencia(reporte: string): Promise<void> {
    if (!token) return;
    const consulta =
      '/gerencia/exportar?reporte=' +
      encodeURIComponent(reporte) +
      '&meses=' +
      encodeURIComponent(mesesSerieGerencia) +
      '&limite=' +
      encodeURIComponent(limiteRankingGerencia) +
      (periodoGerencia.trim() ? '&periodo=' + encodeURIComponent(periodoGerencia.trim()) : '');
    const respuesta = await peticion(consulta, token);
    if (!respuesta.ok) {
      const json = await respuesta.json().catch(function () {
        return {};
      });
      setMensaje(mensajeErrorApi(json.error));
      return;
    }
    const contenido = await respuesta.text();
    const nombreArchivo = nombreDesdeCabecera(
      respuesta.headers.get('Content-Disposition'),
      'reporte-' + reporte + '.csv',
    );
    const url = URL.createObjectURL(new Blob([contenido], { type: 'text/csv;charset=utf-8' }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombreArchivo;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    URL.revokeObjectURL(url);
  }

  async function emitirDianUI(id: number): Promise<void> {
    if (!token) return;
    const respuesta = await peticion('/facturacion/facturas/' + id + '/dian', token, 'PATCH');
    if (!respuesta.ok) {
      setMensaje('No se pudo emitir la factura electronica (DIAN)');
      return;
    }
    await cargarFinanzas(token);
  }

  async function ingresar(): Promise<void> {
    setMensaje('');
    const respuesta = await peticion('/autenticacion/ingreso-interno', '', 'POST', {
      correo: correo,
      contrasena: contrasena,
    });
    if (!respuesta.ok) {
      setMensaje('Credenciales invalidas');
      return;
    }
    const json = await respuesta.json();
    const tokenNuevo = json.data.token as string;
    setToken(tokenNuevo);
    const usuarioNuevo = json.data.usuario as { id?: number; correo?: string; rol?: string };
    setUsuarioSesion({
      id: usuarioNuevo.id || 0,
      correo: usuarioNuevo.correo || correo,
      rol: usuarioNuevo.rol || '',
    });
    await cargarResumen(tokenNuevo);
  }

  // Cierra la sesion y regresa al login; tambien sirve para cambiar de usuario.
  function cerrarSesion(): void {
    setToken('');
    setUsuarioSesion(null);
    setMensaje('');
    setModuloActivo('Dashboard');
    setDetalleVenta(null);
    setFiltroEstadoVenta('');
  }

  // Carga el listado de usuarios internos (Seguridad, solo ADMIN).
  async function cargarUsuarios(tokenActivo: string): Promise<void> {
    const respuesta = await peticion('/administracion/usuarios', tokenActivo);
    if (!respuesta.ok) {
      setUsuariosInternos([]);
      setMensaje('Requiere rol ADMIN para ver usuarios');
      return;
    }
    const json = await respuesta.json();
    setUsuariosInternos((json.data as FilaUsuario[]) || []);
  }
  // Activa o inactiva un usuario (Seguridad, ADMIN).
  // Carga datos de Logistica (CU-LG-001..006).
  async function cargarLogistica(tokenActivo: string): Promise<void> {
    const trResp = await peticion('/logistica/transportistas', tokenActivo);
    if (trResp.ok) setTransportistasLog(((await trResp.json()).data as TransportistaLog[]) || []);
    const veResp = await peticion('/logistica/vehiculos', tokenActivo);
    if (veResp.ok) setVehiculosLog(((await veResp.json()).data as VehiculoLog[]) || []);
    const vdResp = await peticion('/logistica/ventas-despachables', tokenActivo);
    if (vdResp.ok) setVentasDesp(((await vdResp.json()).data as VentaDespachable[]) || []);
    const dpResp = await peticion('/logistica/despachos', tokenActivo);
    if (dpResp.ok) setDespachosLog(((await dpResp.json()).data as DespachoLog[]) || []);
    await cargarRutasLog(tokenActivo);
  }

  // Carga las rutas de distribucion y los despachos consolidables (CU-LG-005).
  async function cargarRutasLog(tokenActivo: string): Promise<void> {
    const rutasRespuesta = await peticion('/logistica/rutas', tokenActivo);
    if (rutasRespuesta.ok) {
      const rutasJson = await rutasRespuesta.json();
      setRutasLog((rutasJson.data as RutaLog[]) || []);
    } else {
      setRutasLog([]);
    }
    const consolidablesRespuesta = await peticion(
      '/logistica/despachos-consolidables',
      tokenActivo,
    );
    if (consolidablesRespuesta.ok) {
      const consolidablesJson = await consolidablesRespuesta.json();
      setDespachosConsolidablesLog((consolidablesJson.data as DespachoConsolidableLog[]) || []);
    } else {
      setDespachosConsolidablesLog([]);
    }
  }

  // Agrega una parada secuenciada al borrador de la ruta (RN-LG-02: destino unico y tope).
  function agregarParadaRutaUI(): void {
    const destino = destinoParada.trim();
    if (!destino) {
      setMensaje('Escriba el destino de la parada');
      return;
    }
    if (paradasRuta.length >= MAXIMO_PARADAS_RUTA) {
      setMensaje('La ruta admite maximo ' + MAXIMO_PARADAS_RUTA + ' paradas');
      return;
    }
    const repetido = paradasRuta.some(function (parada) {
      return parada.destino.trim().toLowerCase() === destino.toLowerCase();
    });
    if (repetido) {
      setMensaje('El destino ya esta en la ruta (no se repiten destinos)');
      return;
    }
    setParadasRuta(paradasRuta.concat([{ destino: destino, despachoId: despachoParadaSel }]));
    setDestinoParada('');
    setDespachoParadaSel('');
  }

  // Quita una parada del borrador y renumera la secuencia (CU-LG-005).
  function quitarParadaRutaUI(indice: number): void {
    setParadasRuta(
      paradasRuta.filter(function (_parada, posicion) {
        return posicion !== indice;
      }),
    );
  }

  // Planifica la ruta de distribucion con sus paradas (CU-LG-005).
  async function crearRutaLogUI(): Promise<void> {
    if (!token) return;
    const vehiculoId = Number(vehiculoRutaSel);
    if (!nombreRutaNueva.trim()) {
      setMensaje('El nombre de la ruta es obligatorio');
      return;
    }
    if (!vehiculoId) {
      setMensaje('Seleccione el vehiculo de la ruta');
      return;
    }
    if (!paradasRuta.length) {
      setMensaje('Agregue al menos una parada a la ruta');
      return;
    }
    const respuesta = await peticion('/logistica/rutas', token, 'POST', {
      codigo: codigoRutaNueva.trim() || undefined,
      nombre: nombreRutaNueva.trim(),
      vehiculoId: vehiculoId,
      paradas: paradasRuta.map(function (parada) {
        return {
          destino: parada.destino,
          despachoId: parada.despachoId ? Number(parada.despachoId) : undefined,
        };
      }),
    });
    if (!respuesta.ok) {
      const json = await respuesta.json().catch(function () {
        return {};
      });
      setMensaje(
        respuesta.status === 403
          ? 'Requiere rol LOGISTICA o ADMIN para planificar rutas'
          : mensajeErrorApi(json.error),
      );
      return;
    }
    setCodigoRutaNueva('');
    setNombreRutaNueva('');
    setVehiculoRutaSel('');
    setParadasRuta([]);
    setDestinoParada('');
    setDespachoParadaSel('');
    await cargarLogistica(token);
  }

  // Ejecuta una transicion de estado de la ruta: iniciar, completar o cancelar (CU-LG-005).
  async function accionRutaUI(id: number, accion: string): Promise<void> {
    if (!token) return;
    const respuesta = await peticion('/logistica/rutas/' + id + '/' + accion, token, 'PATCH');
    if (!respuesta.ok) {
      const json = await respuesta.json().catch(function () {
        return {};
      });
      setMensaje(mensajeErrorApi(json.error));
      return;
    }
    setDetalleRutaLog(null);
    await cargarLogistica(token);
  }

  // Marca o desmarca un despacho programado para consolidarlo en una ruta (CU-LG-005).
  function alternarDespachoConsolidar(id: number, marcado: boolean): void {
    const clave = String(id);
    setDespachosConsolidar(
      marcado
        ? despachosConsolidar.concat([clave])
        : despachosConsolidar.filter(function (valor) {
            return valor !== clave;
          }),
    );
  }

  // Consolida los despachos marcados en la ruta planificada elegida (CU-LG-005).
  async function consolidarDespachosUI(): Promise<void> {
    if (!token) return;
    const rutaId = Number(rutaConsolidarSel);
    if (!rutaId) {
      setMensaje('Seleccione la ruta destino');
      return;
    }
    if (!despachosConsolidar.length) {
      setMensaje('Marque al menos un despacho programado');
      return;
    }
    const respuesta = await peticion('/logistica/rutas/' + rutaId + '/despachos', token, 'POST', {
      despachoIds: despachosConsolidar.map(Number),
    });
    if (!respuesta.ok) {
      const json = await respuesta.json().catch(function () {
        return {};
      });
      setMensaje(mensajeErrorApi(json.error));
      return;
    }
    setDespachosConsolidar([]);
    await cargarLogistica(token);
  }

  // Consulta el detalle de una ruta con sus paradas secuenciadas (CU-LG-005).
  async function verDetalleRutaUI(id: number): Promise<void> {
    if (!token) return;
    if (detalleRutaLog && detalleRutaLog.id === id) {
      setDetalleRutaLog(null);
      return;
    }
    const respuesta = await peticion('/logistica/rutas/' + id, token);
    if (!respuesta.ok) {
      setMensaje('No se pudo consultar la ruta');
      return;
    }
    const json = await respuesta.json();
    setDetalleRutaLog((json.data as RutaLog) || null);
  }

  async function crearTransportistaLogUI(): Promise<void> {
    if (!token) return;
    if (!nombreTransportista.trim() || !nitTransportista.trim()) {
      setMensaje('Nombre y NIT del transportista son obligatorios');
      return;
    }
    const respuesta = await peticion('/logistica/transportistas', token, 'POST', {
      nombre: nombreTransportista.trim(),
      nit: nitTransportista.trim(),
      telefono: telefonoTransportista.trim() || undefined,
    });
    if (!respuesta.ok) {
      setMensaje('No se pudo crear el transportista');
      return;
    }
    setNombreTransportista('');
    setNitTransportista('');
    setTelefonoTransportista('');
    await cargarLogistica(token);
  }

  async function inactivarTransportistaLogUI(id: number): Promise<void> {
    if (!token) return;
    const respuesta = await peticion(
      '/logistica/transportistas/' + id + '/inactivar',
      token,
      'PATCH',
    );
    if (!respuesta.ok) {
      setMensaje('No se pudo inactivar el transportista');
      return;
    }
    await cargarLogistica(token);
  }

  async function crearVehiculoLogUI(): Promise<void> {
    if (!token) return;
    const transportistaId = Number(transportistaSelLog);
    if (!transportistaId || !placaVehiculo.trim()) {
      setMensaje('Seleccione transportista y escriba la placa');
      return;
    }
    const respuesta = await peticion('/logistica/vehiculos', token, 'POST', {
      transportistaId: transportistaId,
      placa: placaVehiculo.trim(),
      capacidadKg: Number(capacidadVehiculo) || 1000,
    });
    if (!respuesta.ok) {
      setMensaje('No se pudo registrar el vehiculo');
      return;
    }
    setPlacaVehiculo('');
    setCapacidadVehiculo('1000');
    await cargarLogistica(token);
  }

  async function inactivarVehiculoLogUI(id: number): Promise<void> {
    if (!token) return;
    const respuesta = await peticion('/logistica/vehiculos/' + id + '/inactivar', token, 'PATCH');
    if (!respuesta.ok) {
      setMensaje('No se pudo inactivar el vehiculo');
      return;
    }
    await cargarLogistica(token);
  }

  async function crearDespachoLogUI(): Promise<void> {
    if (!token) return;
    const pedidoId = Number(ventaSelLog);
    const transportistaId = Number(transportistaSelLog);
    const vehiculoId = Number(vehiculoSelLog);
    if (!pedidoId || !transportistaId || !vehiculoId) {
      setMensaje('Seleccione venta, transportista y vehiculo');
      return;
    }
    const respuesta = await peticion('/logistica/despachos', token, 'POST', {
      pedidoId: pedidoId,
      transportistaId: transportistaId,
      vehiculoId: vehiculoId,
      ruta: rutaDespacho.trim() || undefined,
    });
    if (!respuesta.ok) {
      setMensaje('No se pudo crear el despacho');
      return;
    }
    setVentaSelLog('');
    setVehiculoSelLog('');
    setRutaDespacho('');
    await cargarLogistica(token);
  }

  async function accionDespachoUI(id: number, accion: string): Promise<void> {
    if (!token) return;
    const respuesta = await peticion('/logistica/despachos/' + id + '/' + accion, token, 'PATCH');
    if (!respuesta.ok) {
      setMensaje('No se pudo ' + accion + ' el despacho');
      return;
    }
    await cargarLogistica(token);
  }

  // Carga los datos de RRHH / Nomina (CU-RH-001/002/005/007).
  async function cargarRrhh(tokenActivo: string): Promise<void> {
    const rutaCargos = await peticion('/rrhh/cargos', tokenActivo);
    if (rutaCargos.ok) setCargosRrhh(((await rutaCargos.json()).data as CargoRrhh[]) || []);
    const rutaEmp = await peticion('/rrhh/empleados', tokenActivo);
    if (rutaEmp.ok) setEmpleadosRrhh(((await rutaEmp.json()).data as EmpleadoRrhh[]) || []);
    const rutaAus = await peticion('/rrhh/ausencias', tokenActivo);
    if (rutaAus.ok) setAusenciasRrhh(((await rutaAus.json()).data as AusenciaRrhh[]) || []);
    const rutaNom = await peticion('/rrhh/nominas', tokenActivo);
    if (rutaNom.ok) setNominasRrhh(((await rutaNom.json()).data as NominaRrhh[]) || []);
  }

  async function crearCargoUI(): Promise<void> {
    if (!token) return;
    if (!nombreCargo.trim()) {
      setMensaje('El nombre del cargo es obligatorio');
      return;
    }
    const respuesta = await peticion('/rrhh/cargos', token, 'POST', { nombre: nombreCargo.trim() });
    if (!respuesta.ok) {
      setMensaje('No se pudo crear el cargo');
      return;
    }
    setNombreCargo('');
    await cargarRrhh(token);
  }

  async function crearEmpleadoUI(): Promise<void> {
    if (!token) return;
    const salarioCentavos = Math.round((Number(salarioEmpleadoPesos) || 0) * 100);
    if (!nombreEmpleado.trim() || !documentoEmpleado.trim()) {
      setMensaje('Nombre y documento son obligatorios');
      return;
    }
    const respuesta = await peticion('/rrhh/empleados', token, 'POST', {
      nombre: nombreEmpleado.trim(),
      documentoUnico: documentoEmpleado.trim(),
      cargoId: cargoSelEmpleado ? Number(cargoSelEmpleado) : undefined,
      salarioBaseCentavos: salarioCentavos,
    });
    if (!respuesta.ok) {
      setMensaje('No se pudo crear el empleado');
      return;
    }
    setNombreEmpleado('');
    setDocumentoEmpleado('');
    setSalarioEmpleadoPesos('');
    setCargoSelEmpleado('');
    await cargarRrhh(token);
  }

  async function inactivarEmpleadoUI(id: number): Promise<void> {
    if (!token) return;
    const respuesta = await peticion('/rrhh/empleados/' + id + '/inactivar', token, 'PATCH');
    if (!respuesta.ok) {
      setMensaje('No se pudo inactivar el empleado');
      return;
    }
    await cargarRrhh(token);
  }

  async function registrarAusenciaUI(): Promise<void> {
    if (!token) return;
    const empleadoId = Number(empleadoSelAusencia);
    if (!empleadoId || !fechaAusencia || !motivoAusencia.trim()) {
      setMensaje('Seleccione empleado, fecha y motivo');
      return;
    }
    const respuesta = await peticion('/rrhh/ausencias', token, 'POST', {
      empleadoId: empleadoId,
      fecha: fechaAusencia,
      motivo: motivoAusencia.trim(),
    });
    if (!respuesta.ok) {
      setMensaje('No se pudo registrar la ausencia');
      return;
    }
    setEmpleadoSelAusencia('');
    setFechaAusencia('');
    setMotivoAusencia('');
    await cargarRrhh(token);
  }

  async function justificarAusenciaUI(id: number): Promise<void> {
    if (!token) return;
    const respuesta = await peticion('/rrhh/ausencias/' + id + '/justificar', token, 'PATCH');
    if (!respuesta.ok) {
      setMensaje('No se pudo justificar la ausencia');
      return;
    }
    await cargarRrhh(token);
  }

  async function generarNominaUI(): Promise<void> {
    if (!token) return;
    if (!periodoNomina.trim()) {
      setMensaje('Indique el periodo (YYYY-MM)');
      return;
    }
    const respuesta = await peticion('/rrhh/nominas/generar', token, 'POST', {
      periodo: periodoNomina.trim(),
    });
    if (!respuesta.ok) {
      setMensaje('No se pudo generar la nomina');
      return;
    }
    await cargarRrhh(token);
  }

  async function pagarNominaUI(id: number): Promise<void> {
    if (!token) return;
    const respuesta = await peticion('/rrhh/nominas/' + id + '/pagar', token, 'PATCH');
    if (!respuesta.ok) {
      setMensaje('No se pudo marcar la nomina como pagada');
      return;
    }
    await cargarRrhh(token);
  }

  async function cambiarEstadoUsuarioUI(id: number, estado: string): Promise<void> {
    if (!token) return;
    const respuesta = await peticion('/administracion/usuarios/' + id + '/estado', token, 'PATCH', {
      estado: estado,
    });
    if (!respuesta.ok) {
      setMensaje('No se pudo cambiar el estado del usuario');
      return;
    }
    await cargarUsuarios(token);
  }

  // Guarda el rol/perfil elegido de un usuario (Seguridad, ADMIN).
  async function guardarPerfilUsuarioUI(id: number): Promise<void> {
    if (!token) return;
    const rol = rolesEdicion[id];
    if (!rol) return;
    const respuesta = await peticion('/administracion/usuarios/' + id + '/perfil', token, 'PATCH', {
      rol: rol,
    });
    if (!respuesta.ok) {
      setMensaje('No se pudo actualizar el perfil del usuario');
      return;
    }
    const proximos = { ...rolesEdicion };
    delete proximos[id];
    setRolesEdicion(proximos);
    await cargarUsuarios(token);
  }

  useEffect(function () {
    if (token) cargarResumen(token);
  }, []);

  useEffect(
    function () {
      if (token && moduloActivo === 'Compras') {
        cargarProveedores(token);
        cargarComprasAvanzado(token);
      }
    },
    [moduloActivo, token],
  );

  useEffect(
    function () {
      if (token && moduloActivo === 'Inventario') {
        cargarInventario(token);
      }
    },
    [moduloActivo, token],
  );

  useEffect(
    function () {
      if (token && moduloActivo === 'Inventario') {
        cargarInventario(token);
      }
    },
    [moduloActivo, token],
  );

  useEffect(
    function () {
      if (token && moduloActivo === 'Ventas') {
        cargarVentas(token);
        cargarB2b(token);
        cargarMetasComisiones(token, periodoComision.trim());
      }
    },
    [moduloActivo, token, filtroEstadoVenta],
  );

  useEffect(
    function () {
      if (token && moduloActivo === 'Seguridad') {
        cargarUsuarios(token);
      }
    },
    [moduloActivo, token],
  );

  // Solo se muestran en el menu los modulos habilitados para el rol de la sesion.
  const modulosVisibles = usuarioSesion
    ? MODULOS_POR_ROL[usuarioSesion.rol] || ['Dashboard']
    : MODULOS;

  useEffect(
    function () {
      if (token && moduloActivo === 'Logistica') {
        cargarLogistica(token);
      }
    },
    [moduloActivo, token],
  );

  useEffect(
    function () {
      if (token && moduloActivo === 'RRHH / Nomina') {
        cargarRrhh(token);
        cargarHorariosNovedades(token);
      }
    },
    [moduloActivo, token],
  );

  useEffect(
    function () {
      if (token && moduloActivo === 'Facturacion') {
        cargarFinanzas(token);
      }
    },
    [moduloActivo, token],
  );

  useEffect(
    function () {
      if (token && moduloActivo === 'Contabilidad') {
        cargarContabilidad(token);
      }
    },
    [moduloActivo, token],
  );

  useEffect(
    function () {
      if (token && moduloActivo === 'Gerencia') {
        cargarGerencia(token, periodoGerencia.trim(), mesesSerieGerencia, limiteRankingGerencia);
      }
    },
    [moduloActivo, token],
  );

  const esDashboard = moduloActivo === 'Dashboard';
  const esCompras = moduloActivo === 'Compras';
  const esInventario = moduloActivo === 'Inventario';
  const esVentas = moduloActivo === 'Ventas';
  const esSeguridad = moduloActivo === 'Seguridad';
  const esLogistica = moduloActivo === 'Logistica';
  const esRrhh = moduloActivo === 'RRHH / Nomina';
  const esFacturacion = moduloActivo === 'Facturacion';
  const esContabilidad = moduloActivo === 'Contabilidad';
  const esGerencia = moduloActivo === 'Gerencia';
  const termino = terminoBusqueda.trim().toLowerCase();
  const proveedoresFiltrados = termino
    ? proveedores.filter(function (proveedor) {
        return (
          proveedor.nit.toLowerCase().includes(termino) ||
          proveedor.nombre.toLowerCase().includes(termino)
        );
      })
    : proveedores;
  // IVA del proveedor elegido: define el impuesto del borrador de orden (CU-ERP-003).
  const proveedorSelDatos = proveedores.find(function (proveedor) {
    return String(proveedor.id) === proveedorSel;
  });
  const tarifaIVABorradorBps = proveedorSelDatos
    ? proveedorSelDatos.tarifaIvaBps
    : TARIFA_IVA_BPS_POR_DEFECTO;
  const subtotalBorradorCentavos = lineasOrden.reduce(function (total, linea) {
    const precioCentavos = Math.round(Number(linea.precioPesos || '0') * 100);
    return total + Math.round(Number(linea.cantidad || '0')) * precioCentavos;
  }, 0);
  const ivaBorradorCentavos = Math.round(
    (subtotalBorradorCentavos * tarifaIVABorradorBps) / BASE_PUNTOS_BASICOS,
  );
  const totalBorradorCentavos = subtotalBorradorCentavos + ivaBorradorCentavos;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-logo">CT</span>
          <span className="brand-name">CuchosTool ERP</span>
        </div>
        <div className="header-meta">
          {token ? (
            <>
              <span className="chip chip--ok">
                {usuarioSesion ? usuarioSesion.correo + ' · ' + usuarioSesion.rol : 'Sesion activa'}
              </span>
              <div className="header-acciones">
                <button className="btn btn--line btn--sm" onClick={cerrarSesion}>
                  Cambiar usuario
                </button>
                <button className="btn btn--line btn--sm" onClick={cerrarSesion}>
                  Cerrar sesion
                </button>
              </div>
            </>
          ) : (
            <span className="chip chip--info">Fase F5</span>
          )}
        </div>
      </header>
      <div className="app-body">
        <aside className="app-sidebar">
          {!token && (
            <div className="login-box">
              <h2>Ingresar (ERP)</h2>
              <input
                className="input"
                placeholder="Correo"
                value={correo}
                onChange={function (e) {
                  setCorreo(e.target.value);
                }}
              />
              <input
                className="input"
                type="password"
                placeholder="Contrasena"
                value={contrasena}
                onChange={function (e) {
                  setContrasena(e.target.value);
                }}
              />
              <button className="btn btn--primary" onClick={ingresar}>
                Entrar
              </button>
              <p className="muted">Admin: admin@cuchostool.com / admin1234</p>
              <p className="muted">Compras: compras@cuchostool.com / admin1234</p>
              {mensaje && <p className="muted">{mensaje}</p>}
            </div>
          )}
          {token && (
            <nav className="side-nav">
              {modulosVisibles.map(function (modulo) {
                return (
                  <a
                    key={modulo}
                    className={'side-link' + (modulo === moduloActivo ? ' is-active' : '')}
                    onClick={function () {
                      setModuloActivo(modulo);
                    }}
                  >
                    {modulo}
                  </a>
                );
              })}
            </nav>
          )}
        </aside>
        <main className="app-main">
          <section className="page-head">
            <div>
              <h1>{moduloActivo}</h1>
              <p className="muted">Sitio ERP (F5) - datos reales de la API</p>
            </div>
          </section>
          {esDashboard && (
            <>
              <section className="kpi-grid">
                <article className="kpi-card">
                  <span className="muted">Pedidos</span>
                  <strong>{resumen.pedidos}</strong>
                </article>
                <article className="kpi-card">
                  <span className="muted">Ventas efectivas</span>
                  <strong>{resumen.pedidosPagados}</strong>
                </article>
                <article className="kpi-card">
                  <span className="muted">Clientes</span>
                  <strong>{resumen.clientes}</strong>
                </article>
                <article className="kpi-card">
                  <span className="muted">Productos</span>
                  <strong>{resumen.productos}</strong>
                </article>
                <article className="kpi-card">
                  <span className="muted">Casos abiertos</span>
                  <strong>{resumen.casosAbiertos}</strong>
                </article>
              </section>
              <section className="panel">
                <div className="panel-head">
                  <h2>Ultimos pedidos</h2>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Referencia</th>
                      <th>Estado</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumen.ultimosPedidos.map(function (p) {
                      return (
                        <tr key={p.referenciaPedido}>
                          <td>{p.referenciaPedido}</td>
                          <td>{p.estado}</td>
                          <td>{formatearPesos(p.totalCentavos)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            </>
          )}
          {esCompras && (
            <>
              {mensaje && <p className="alerta">{mensaje}</p>}
              <section className="panel">
                <div className="panel-head">
                  <h2>
                    {editandoId !== null
                      ? 'Editar proveedor (CU-ERP-001)'
                      : 'Nuevo proveedor (CU-ERP-001)'}
                  </h2>
                </div>
                <div className="form-grid">
                  <input
                    className="input"
                    placeholder="NIT"
                    value={nitNuevo}
                    readOnly={editandoId !== null}
                    title={editandoId !== null ? 'El NIT no se puede editar' : undefined}
                    onChange={function (e) {
                      setNitNuevo(e.target.value);
                    }}
                  />
                  <input
                    className="input"
                    placeholder="Nombre"
                    value={nombreNuevo}
                    onChange={function (e) {
                      setNombreNuevo(e.target.value);
                    }}
                  />
                  <input
                    className="input"
                    placeholder="Contacto"
                    value={contactoNuevo}
                    onChange={function (e) {
                      setContactoNuevo(e.target.value);
                    }}
                  />
                  <input
                    className="input"
                    placeholder="Telefono"
                    value={telefonoNuevo}
                    onChange={function (e) {
                      setTelefonoNuevo(e.target.value);
                    }}
                  />
                  <input
                    className="input"
                    placeholder="Correo electronico"
                    value={correoNuevo}
                    onChange={function (e) {
                      setCorreoNuevo(e.target.value);
                    }}
                  />
                  <input
                    className="input"
                    placeholder="Direccion de sede"
                    value={direccionNueva}
                    onChange={function (e) {
                      setDireccionNueva(e.target.value);
                    }}
                  />
                  <input
                    className="input"
                    placeholder="Sitio web"
                    value={sitioNuevo}
                    onChange={function (e) {
                      setSitioNuevo(e.target.value);
                    }}
                  />
                  <input
                    className="input"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder="IVA (%)"
                    title="IVA pactado con el proveedor en porcentaje (se guarda en puntos basicos)"
                    value={ivaProveedorPct}
                    onChange={function (e) {
                      setIvaProveedorPct(e.target.value);
                    }}
                  />
                  <button className="btn btn--primary" onClick={guardarProveedor}>
                    {editandoId !== null ? 'Guardar cambios' : 'Crear'}
                  </button>
                  {editandoId !== null && (
                    <button className="btn btn--line" onClick={cancelarEdicion}>
                      Cancelar
                    </button>
                  )}
                </div>
              </section>
              <section className="panel">
                <div className="panel-head">
                  <h2>Proveedores activos</h2>
                </div>
                <div className="search-box">
                  <input
                    className="input"
                    placeholder="Buscar por NIT o nombre"
                    value={terminoBusqueda}
                    onChange={function (e) {
                      setTerminoBusqueda(e.target.value);
                    }}
                  />
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>NIT</th>
                      <th>Nombre</th>
                      <th>Contacto</th>
                      <th>Telefono</th>
                      <th>Correo</th>
                      <th>Direccion</th>
                      <th>Sitio web</th>
                      <th>IVA</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proveedoresFiltrados.map(function (proveedor) {
                      return (
                        <tr key={proveedor.id}>
                          <td>{proveedor.nit}</td>
                          <td>{proveedor.nombre}</td>
                          <td>{proveedor.contacto || '-'}</td>
                          <td>{proveedor.telefono || '-'}</td>
                          <td>{proveedor.correo || '-'}</td>
                          <td>{proveedor.direccion || '-'}</td>
                          <td>{proveedor.sitioWeb || '-'}</td>
                          <td>{formatearPorcentaje(proveedor.tarifaIvaBps)}</td>
                          <td>
                            <span className={claseBadgeEstado(proveedor.estado)}>
                              {proveedor.estado}
                            </span>
                          </td>
                          <td>
                            <div className="acciones-fila">
                              <button
                                className="btn btn--line"
                                onClick={function () {
                                  iniciarEdicion(proveedor);
                                }}
                              >
                                Editar
                              </button>
                              <button
                                className="btn btn--warm"
                                onClick={function () {
                                  inactivarProveedorUI(proveedor.id);
                                }}
                              >
                                Inactivar
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {proveedores.length === 0 && (
                      <tr>
                        <td colSpan={10} className="muted" style={{ padding: '12px 16px' }}>
                          Sin proveedores registrados.
                        </td>
                      </tr>
                    )}
                    {proveedores.length > 0 && proveedoresFiltrados.length === 0 && (
                      <tr>
                        <td colSpan={10} className="muted" style={{ padding: '12px 16px' }}>
                          Sin coincidencias para la busqueda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
              <section className="panel">
                <div className="panel-head">
                  <h2>Ordenes de compra (CU-ERP-002..009)</h2>
                </div>
                <div className="form-grid">
                  <select
                    className="input"
                    value={proveedorSel}
                    onChange={function (e) {
                      setProveedorSel(e.target.value);
                    }}
                  >
                    <option value="">Proveedor...</option>
                    {proveedores.map(function (p) {
                      return (
                        <option key={p.id} value={p.id}>
                          {p.nombre}
                        </option>
                      );
                    })}
                  </select>
                  <select
                    className="input"
                    value={bodegaCompraSel}
                    onChange={function (e) {
                      setBodegaCompraSel(e.target.value);
                    }}
                  >
                    <option value="">Bodega destino...</option>
                    {bodegasCompras.map(function (b) {
                      return (
                        <option key={b.id} value={b.id}>
                          {b.nombre}
                        </option>
                      );
                    })}
                  </select>
                  <span className="chip chip--info">
                    IVA del proveedor: {formatearPorcentaje(tarifaIVABorradorBps)}
                  </span>
                </div>
                <div className="form-grid">
                  <select
                    className="input"
                    value={productoLineaSel}
                    onChange={function (e) {
                      setProductoLineaSel(e.target.value);
                    }}
                  >
                    <option value="">Producto del renglon...</option>
                    {catalogoCompras.map(function (p) {
                      return (
                        <option key={p.id} value={p.id}>
                          {p.nombre}
                        </option>
                      );
                    })}
                  </select>
                  <input
                    className="input"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Cantidad"
                    value={cantidadLinea}
                    onChange={function (e) {
                      setCantidadLinea(e.target.value);
                    }}
                  />
                  <input
                    className="input"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="Precio unitario (COP)"
                    title="Valor en pesos colombianos (COP), ej. 1.000,50"
                    value={precioLinea}
                    onChange={function (e) {
                      setPrecioLinea(e.target.value);
                    }}
                  />
                  <button className="btn btn--line" onClick={agregarLineaOrdenUI}>
                    Agregar renglon
                  </button>
                </div>
                <table className="table table--compacta">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Producto</th>
                      <th>Cantidad</th>
                      <th>Precio unitario</th>
                      <th>Subtotal</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineasOrden.map(function (linea, indice) {
                      const precioCentavos = Math.round(Number(linea.precioPesos) * 100);
                      const subtotalLinea = Math.round(Number(linea.cantidad)) * precioCentavos;
                      return (
                        <tr key={linea.productoId}>
                          <td>{indice + 1}</td>
                          <td>{nombreProductoLinea(linea.productoId)}</td>
                          <td>{linea.cantidad}</td>
                          <td>{formatearPesos(precioCentavos)}</td>
                          <td>{formatearPesos(subtotalLinea)}</td>
                          <td>
                            <button
                              className="btn btn--warm btn--sm"
                              onClick={function () {
                                quitarLineaOrdenUI(indice);
                              }}
                            >
                              Quitar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {lineasOrden.length === 0 && (
                      <tr>
                        <td colSpan={6} className="muted" style={{ padding: '12px 16px' }}>
                          Sin renglones: agregue productos antes de crear la orden.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <div className="totales-orden">
                  <span>
                    Renglones: <strong>{lineasOrden.length}</strong>
                  </span>
                  <span>
                    Subtotal: <strong>{formatearPesos(subtotalBorradorCentavos)}</strong>
                  </span>
                  <span>
                    IVA: <strong>{formatearPesos(ivaBorradorCentavos)}</strong>
                  </span>
                  <span>
                    Total: <strong>{formatearPesos(totalBorradorCentavos)}</strong>
                  </span>
                  <button className="btn btn--primary" onClick={crearOrdenUI}>
                    Crear orden multi-linea
                  </button>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Referencia</th>
                      <th>Proveedor</th>
                      <th>Bodega</th>
                      <th>Renglones</th>
                      <th>Pedido</th>
                      <th>Recibido</th>
                      <th>Subtotal</th>
                      <th>IVA</th>
                      <th>Total</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordenesCompra.map(function (o) {
                      const recibible = o.estado === 'aprobada' || o.estado === 'recibida_parcial';
                      const detalles = o.lineas || [];
                      return (
                        <Fragment key={o.id}>
                          <tr>
                            <td>{o.referencia}</td>
                            <td>{o.proveedorNombre}</td>
                            <td>{o.bodegaNombre}</td>
                            <td>
                              {o.totalLineas}{' '}
                              <button
                                className="btn btn--line btn--sm"
                                onClick={function () {
                                  alternarDetalleOrdenUI(o.id);
                                }}
                              >
                                {ordenDetalleId === o.id ? 'Ocultar' : 'Ver'}
                              </button>
                            </td>
                            <td>{o.cantidadPedida}</td>
                            <td>{o.cantidadRecibida}</td>
                            <td>{formatearPesos(o.subtotalCentavos)}</td>
                            <td>
                              {formatearPesos(o.impuestoCentavos)}
                              <span className="muted">
                                {' '}
                                ({formatearPorcentaje(o.tarifaIvaBps)})
                              </span>
                            </td>
                            <td>{formatearPesos(o.totalCentavos)}</td>
                            <td>
                              <span className={claseBadgeEstado(o.estado)}>{o.estado}</span>
                            </td>
                            <td>
                              <div className="acciones-fila">
                                {o.estado === 'pendiente_aprobacion' && (
                                  <button
                                    className="btn btn--primary btn--sm"
                                    onClick={function () {
                                      aprobarOrdenUI(o.id);
                                    }}
                                  >
                                    Aprobar
                                  </button>
                                )}
                                {recibible && o.totalLineas <= 1 && (
                                  <button
                                    className="btn btn--warm btn--sm"
                                    onClick={function () {
                                      recibirSaldoOrdenUI(o.id);
                                    }}
                                  >
                                    Recibir ({o.saldoPendiente})
                                  </button>
                                )}
                                {(o.estado === 'pendiente_aprobacion' ||
                                  o.estado === 'aprobada') && (
                                  <button
                                    className="btn btn--line btn--sm"
                                    onClick={function () {
                                      cancelarOrdenUI(o.id);
                                    }}
                                  >
                                    Cancelar
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {ordenDetalleId === o.id && (
                            <tr className="fila-detalle">
                              <td colSpan={11}>
                                <table className="table table--compacta">
                                  <thead>
                                    <tr>
                                      <th>#</th>
                                      <th>Producto</th>
                                      <th>Precio unitario</th>
                                      <th>Pedido</th>
                                      <th>Recibido</th>
                                      <th>Saldo</th>
                                      <th>Subtotal</th>
                                      <th>Recibir ahora</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {detalles.map(function (linea) {
                                      return (
                                        <tr key={linea.id}>
                                          <td>{linea.numeroLinea}</td>
                                          <td>{linea.productoNombre}</td>
                                          <td>{formatearPesos(linea.precioUnitarioCentavos)}</td>
                                          <td>{linea.cantidadPedida}</td>
                                          <td>{linea.cantidadRecibida}</td>
                                          <td>{linea.saldoPendiente}</td>
                                          <td>{formatearPesos(linea.subtotalCentavos)}</td>
                                          <td>
                                            <input
                                              className="input input--sm"
                                              type="number"
                                              min="0"
                                              step="1"
                                              max={linea.saldoPendiente}
                                              placeholder="0"
                                              disabled={!recibible || linea.saldoPendiente <= 0}
                                              value={recepcionLineas[linea.id] || ''}
                                              onChange={function (e) {
                                                const proximas = { ...recepcionLineas };
                                                proximas[linea.id] = e.target.value;
                                                setRecepcionLineas(proximas);
                                              }}
                                            />
                                          </td>
                                        </tr>
                                      );
                                    })}
                                    {detalles.length === 0 && (
                                      <tr>
                                        <td
                                          colSpan={8}
                                          className="muted"
                                          style={{ padding: '12px 16px' }}
                                        >
                                          La orden no tiene renglones registrados.
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                                <div className="totales-orden">
                                  <span className="muted">
                                    Recepcion por renglon (CU-ERP-007/008); la cuenta por pagar se
                                    causa al completar la orden.
                                  </span>
                                  <button
                                    className="btn btn--warm"
                                    disabled={!recibible}
                                    onClick={function () {
                                      recibirLineasOrdenUI(o);
                                    }}
                                  >
                                    Registrar recepcion
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                    {ordenesCompra.length === 0 && (
                      <tr>
                        <td colSpan={11} className="muted" style={{ padding: '12px 16px' }}>
                          Sin ordenes de compra.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
              <section className="panel">
                <div className="panel-head">
                  <h2>Cuentas por pagar de compras (CU-ERP-009)</h2>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Orden</th>
                      <th>Proveedor</th>
                      <th>Monto</th>
                      <th>Vence</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cuentasPagar.map(function (c) {
                      return (
                        <tr key={c.id}>
                          <td>{c.ordenReferencia}</td>
                          <td>{c.proveedorNombre}</td>
                          <td>{formatearPesos(c.montoCentavos)}</td>
                          <td>{c.venceEn.slice(0, 10)}</td>
                          <td>{c.estado}</td>
                          <td>
                            {c.estado === 'pendiente' && (
                              <button
                                className="btn btn--primary"
                                onClick={function () {
                                  pagarCuentaUI(c.id);
                                }}
                              >
                                Pagar
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {cuentasPagar.length === 0 && (
                      <tr>
                        <td colSpan={6} className="muted" style={{ padding: '12px 16px' }}>
                          Sin cuentas por pagar.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
            </>
          )}
          {esInventario && (
            <>
              {mensaje && <p className="alerta">{mensaje}</p>}
              <section className="panel">
                <div className="panel-head">
                  <h2>Registrar movimiento de inventario (CU-INV-001/002/003)</h2>
                </div>
                <div className="form-grid">
                  <select
                    className="input"
                    value={bodegaSel}
                    onChange={function (e) {
                      setBodegaSel(e.target.value);
                    }}
                  >
                    <option value="">Bodega...</option>
                    {bodegasInv.map(function (b) {
                      return (
                        <option key={b.id} value={b.id}>
                          {b.nombre}
                        </option>
                      );
                    })}
                  </select>
                  <select
                    className="input"
                    value={productoInvSel}
                    onChange={function (e) {
                      setProductoInvSel(e.target.value);
                    }}
                  >
                    <option value="">Producto...</option>
                    {productosInv.map(function (p) {
                      return (
                        <option key={p.id} value={p.id}>
                          {p.nombre}
                        </option>
                      );
                    })}
                  </select>
                  <input
                    className="input"
                    type="number"
                    min="1"
                    placeholder="Cantidad"
                    value={cantidadInv}
                    onChange={function (e) {
                      setCantidadInv(e.target.value);
                    }}
                  />
                  <input
                    className="input"
                    placeholder="Motivo (obligatorio)"
                    value={motivoInv}
                    onChange={function (e) {
                      setMotivoInv(e.target.value);
                    }}
                  />
                  <input
                    className="input"
                    placeholder="Referencia (OC, guia, acta)"
                    value={referenciaInv}
                    onChange={function (e) {
                      setReferenciaInv(e.target.value);
                    }}
                  />
                  <button
                    className="btn btn--primary"
                    onClick={function () {
                      registrarMovimientoInv('entrada');
                    }}
                  >
                    Entrada
                  </button>
                  <button
                    className="btn btn--warm"
                    onClick={function () {
                      registrarMovimientoInv('salida');
                    }}
                  >
                    Salida
                  </button>
                  <button
                    className="btn btn--line"
                    onClick={function () {
                      registrarMovimientoInv('ajuste');
                    }}
                  >
                    Ajuste (conteo)
                  </button>
                </div>
              </section>
              <section className="panel">
                <div className="panel-head">
                  <h2>Existencias por bodega (CU-INV-008)</h2>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Bodega</th>
                      <th>Producto</th>
                      <th>Cantidad</th>
                      <th>Minimo</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockInv.map(function (fila) {
                      return (
                        <tr key={fila.bodegaId + '-' + fila.productoId}>
                          <td>{fila.bodegaNombre}</td>
                          <td>{fila.productoNombre}</td>
                          <td>{fila.cantidad}</td>
                          <td>{fila.stockMinimo}</td>
                          <td>
                            {fila.bajoMinimo ? (
                              <span className="chip chip--warn">bajo minimo</span>
                            ) : (
                              <span className="chip chip--ok">ok</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {stockInv.length === 0 && (
                      <tr>
                        <td colSpan={5} className="muted" style={{ padding: '12px 16px' }}>
                          Sin existencias registradas.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
              <section className="panel">
                <div className="panel-head">
                  <h2>Bodegas (CU-INV-005) y stock minimo (CU-INV-007)</h2>
                </div>
                <div className="form-grid">
                  <input
                    className="input"
                    placeholder="Nombre nueva bodega"
                    value={nombreBodegaNueva}
                    onChange={function (e) {
                      setNombreBodegaNueva(e.target.value);
                    }}
                  />
                  <input
                    className="input"
                    placeholder="Ubicacion"
                    value={ubicacionBodegaNueva}
                    onChange={function (e) {
                      setUbicacionBodegaNueva(e.target.value);
                    }}
                  />
                  <button className="btn btn--primary" onClick={crearBodegaInv}>
                    Crear bodega
                  </button>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Bodega</th>
                      <th>Ubicacion</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bodegasInv.map(function (b) {
                      return (
                        <tr key={b.id}>
                          <td>{b.nombre}</td>
                          <td>{b.ubicacion || '-'}</td>
                          <td>{b.estado}</td>
                          <td>
                            <div className="acciones-fila">
                              <button
                                className="btn btn--line"
                                onClick={function () {
                                  setBodegaSel(String(b.id));
                                }}
                              >
                                Usar
                              </button>
                              <button
                                className="btn btn--warm"
                                onClick={function () {
                                  inactivarBodegaInv(b.id);
                                }}
                              >
                                Inactivar
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="form-grid">
                  <input
                    className="input"
                    type="number"
                    min="0"
                    placeholder="Stock minimo"
                    value={minimoInv}
                    onChange={function (e) {
                      setMinimoInv(e.target.value);
                    }}
                  />
                  <button className="btn btn--primary" onClick={fijarStockMinimoInv}>
                    Fijar minimo a producto seleccionado
                  </button>
                </div>
              </section>
              <section className="panel">
                <div className="panel-head">
                  <h2>Kardex reciente (CU-INV-006)</h2>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Consecutivo</th>
                      <th>Fecha</th>
                      <th>Tipo</th>
                      <th>Producto</th>
                      <th>Bodega</th>
                      <th>Cantidad</th>
                      <th>Saldo</th>
                      <th>Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kardexInv.map(function (k) {
                      return (
                        <tr key={k.id}>
                          <td>{k.consecutivo}</td>
                          <td>{k.creadoEn.slice(0, 19).replace('T', ' ')}</td>
                          <td>{k.tipo}</td>
                          <td>{k.productoNombre}</td>
                          <td>{k.bodegaNombre}</td>
                          <td>{k.cantidad > 0 ? '+' + k.cantidad : String(k.cantidad)}</td>
                          <td>{k.stockResultante}</td>
                          <td>{k.motivo}</td>
                        </tr>
                      );
                    })}
                    {kardexInv.length === 0 && (
                      <tr>
                        <td colSpan={8} className="muted" style={{ padding: '12px 16px' }}>
                          Sin movimientos registrados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
            </>
          )}
          {esVentas && (
            <>
              {mensaje && <p className="alerta">{mensaje}</p>}
              {resumenVentas && (
                <section className="kpi-grid">
                  <article className="kpi-card">
                    <span className="muted">Ventas totales</span>
                    <strong>{resumenVentas.total}</strong>
                  </article>
                  <article className="kpi-card">
                    <span className="muted">Ventas efectivas</span>
                    <strong>{resumenVentas.ventasEfectivas}</strong>
                  </article>
                  <article className="kpi-card">
                    <span className="muted">Monto efectivo</span>
                    <strong>{formatearPesos(resumenVentas.montoEfectivoCentavos)}</strong>
                  </article>
                  <article className="kpi-card">
                    <span className="muted">Monto pendiente de pago</span>
                    <strong>{formatearPesos(resumenVentas.montoPendienteCentavos)}</strong>
                  </article>
                </section>
              )}
              <section className="panel">
                <div className="panel-head">
                  <h2>Ventas / pedidos del canal (CU-CM-007 base)</h2>
                </div>
                <div className="form-grid">
                  <select
                    className="input"
                    value={filtroEstadoVenta}
                    onChange={function (e) {
                      setFiltroEstadoVenta(e.target.value);
                    }}
                  >
                    <option value="">Todos los estados</option>
                    <option value="pendiente_pago">Pendiente de pago</option>
                    <option value="pagado">Pagado</option>
                    <option value="entregado">Entregado</option>
                    <option value="cancelado">Cancelado</option>
                    <option value="rechazado">Rechazado</option>
                  </select>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Referencia</th>
                      <th>Cliente</th>
                      <th>Total</th>
                      <th>Estado</th>
                      <th>Fecha</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ventas.map(function (v) {
                      return (
                        <tr key={v.referenciaPedido}>
                          <td>{v.referenciaPedido}</td>
                          <td>{v.clienteNombre || v.clienteCorreo || v.clienteId}</td>
                          <td>{formatearPesos(v.totalCentavos)}</td>
                          <td>{v.estado}</td>
                          <td>{v.creadoEn.slice(0, 19).replace('T', ' ')}</td>
                          <td>
                            <div className="acciones-fila">
                              <button
                                className="btn btn--line"
                                onClick={function () {
                                  verDetalleVentaUI(v.referenciaPedido);
                                }}
                              >
                                Ver
                              </button>
                              {v.estado === 'pagado' && (
                                <button
                                  className="btn btn--primary"
                                  onClick={function () {
                                    entregarVentaUI(v.referenciaPedido);
                                  }}
                                >
                                  Entregar
                                </button>
                              )}
                              {v.estado === 'pendiente_pago' && (
                                <button
                                  className="btn btn--warm"
                                  onClick={function () {
                                    cancelarVentaUI(v.referenciaPedido);
                                  }}
                                >
                                  Cancelar
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {ventas.length === 0 && (
                      <tr>
                        <td colSpan={6} className="muted" style={{ padding: '12px 16px' }}>
                          Sin ventas para el filtro actual.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
              {detalleVenta && (
                <section className="panel">
                  <div className="panel-head">
                    <h2>Detalle de {detalleVenta.referenciaPedido}</h2>
                  </div>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Cantidad</th>
                        <th>Precio unitario</th>
                        <th>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalleVenta.lineas.map(function (linea, indice) {
                        return (
                          <tr key={indice}>
                            <td>{linea.productoNombre}</td>
                            <td>{linea.cantidad}</td>
                            <td>{formatearPesos(linea.precioUnitarioCentavos)}</td>
                            <td>{formatearPesos(linea.cantidad * linea.precioUnitarioCentavos)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </section>
              )}
              <section className="panel">
                <div className="panel-head">
                  <h2>Ventas corporativas B2B (CU-CM-004/007)</h2>
                </div>
                <div className="form-grid">
                  <input
                    className="input"
                    placeholder="NIT cliente"
                    value={nitClienteB2b}
                    onChange={function (e) {
                      setNitClienteB2b(e.target.value);
                    }}
                  />
                  <input
                    className="input"
                    placeholder="Razon social"
                    value={razonClienteB2b}
                    onChange={function (e) {
                      setRazonClienteB2b(e.target.value);
                    }}
                  />
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Cupo credito (COP)"
                    value={cupoClienteB2b}
                    onChange={function (e) {
                      setCupoClienteB2b(e.target.value);
                    }}
                  />
                  <button className="btn btn--primary" onClick={crearClienteEmpresaUI}>
                    Crear cliente ERP
                  </button>
                </div>
                <div className="form-grid">
                  <select
                    className="input"
                    value={clienteB2bSel}
                    onChange={function (e) {
                      setClienteB2bSel(e.target.value);
                    }}
                  >
                    <option value="">Cliente ERP...</option>
                    {clientesEmpresaB2b.map(function (c) {
                      return (
                        <option key={c.id} value={c.id}>
                          {c.razonSocial}
                        </option>
                      );
                    })}
                  </select>
                  <select
                    className="input"
                    value={productoB2bSel}
                    onChange={function (e) {
                      setProductoB2bSel(e.target.value);
                    }}
                  >
                    <option value="">Producto...</option>
                    {productosB2b.map(function (p) {
                      return (
                        <option key={p.id} value={p.id}>
                          {p.nombre}
                        </option>
                      );
                    })}
                  </select>
                  <input
                    className="input"
                    type="number"
                    min="1"
                    placeholder="Cantidad"
                    value={cantidadB2b}
                    onChange={function (e) {
                      setCantidadB2b(e.target.value);
                    }}
                  />
                  <select
                    className="input"
                    value={formaPagoB2b}
                    onChange={function (e) {
                      setFormaPagoB2b(e.target.value);
                    }}
                  >
                    <option value="credito">Credito</option>
                    <option value="contado">Contado</option>
                  </select>
                  <button className="btn btn--primary" onClick={crearOrdenB2bUI}>
                    Crear orden B2B
                  </button>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Cupo</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientesEmpresaB2b.map(function (c) {
                      return (
                        <tr key={c.id}>
                          <td>{c.razonSocial}</td>
                          <td>{formatearPesos(c.cupoCreditoCentavos)}</td>
                          <td>{c.estado}</td>
                          <td>
                            <button
                              className="btn btn--warm btn--sm"
                              onClick={function () {
                                inactivarClienteEmpresaUI(c.id);
                              }}
                            >
                              Inactivar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Folio</th>
                      <th>Cliente</th>
                      <th>Pago</th>
                      <th>Total</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordenesB2b.map(function (o) {
                      return (
                        <tr key={o.id}>
                          <td>{o.folio}</td>
                          <td>{o.clienteRazonSocial}</td>
                          <td>{o.formaPago}</td>
                          <td>{formatearPesos(o.totalCentavos)}</td>
                          <td>{o.estado}</td>
                          <td>
                            <div className="acciones-fila">
                              {o.estado === 'confirmada' && (
                                <button
                                  className="btn btn--warm btn--sm"
                                  onClick={function () {
                                    accionOrdenB2bUI(o.id, 'pagar');
                                  }}
                                >
                                  Pagar
                                </button>
                              )}
                              {o.estado === 'confirmada' && (
                                <button
                                  className="btn btn--line btn--sm"
                                  onClick={function () {
                                    accionOrdenB2bUI(o.id, 'anular');
                                  }}
                                >
                                  Anular
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
              <section className="panel">
                <div className="panel-head">
                  <h2>Metas comerciales (CU-CM-005)</h2>
                </div>
                <div className="form-grid">
                  <select
                    className="input"
                    value={vendedorMetaSel}
                    onChange={function (e) {
                      setVendedorMetaSel(e.target.value);
                    }}
                  >
                    <option value="">Vendedor...</option>
                    {vendedoresCom.map(function (v) {
                      return (
                        <option key={v.id} value={v.id}>
                          {v.correo}
                        </option>
                      );
                    })}
                  </select>
                  <input
                    className="input"
                    placeholder="Periodo (YYYY-MM)"
                    value={periodoMeta}
                    onChange={function (e) {
                      setPeriodoMeta(e.target.value);
                    }}
                  />
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Meta (COP)"
                    value={montoMetaPesos}
                    onChange={function (e) {
                      setMontoMetaPesos(e.target.value);
                    }}
                  />
                  <button className="btn btn--primary" onClick={crearMetaUI}>
                    Crear meta
                  </button>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Vendedor</th>
                      <th>Periodo</th>
                      <th>Meta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metasCom.map(function (m) {
                      return (
                        <tr key={m.id}>
                          <td>{m.vendedorId}</td>
                          <td>{m.periodo}</td>
                          <td>{formatearPesos(m.montoMetaCentavos)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Vendedor</th>
                      <th>Periodo</th>
                      <th>Meta</th>
                      <th>Avance</th>
                      <th>Cumplimiento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cumplimientoCom.map(function (c) {
                      return (
                        <tr key={c.vendedorId + c.periodo}>
                          <td>{c.vendedorId}</td>
                          <td>{c.periodo}</td>
                          <td>{formatearPesos(c.montoMetaCentavos)}</td>
                          <td>{formatearPesos(c.avanceCentavos)}</td>
                          <td>{formatearDecimal(c.cumplimientoPct)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
              <section className="panel">
                <div className="panel-head">
                  <h2>Comisiones (CU-CM-006)</h2>
                </div>
                <div className="form-grid">
                  <select
                    className="input"
                    value={vendedorComisionSel}
                    onChange={function (e) {
                      setVendedorComisionSel(e.target.value);
                    }}
                  >
                    <option value="">Vendedor...</option>
                    {vendedoresCom.map(function (v) {
                      return (
                        <option key={v.id} value={v.id}>
                          {v.correo}
                        </option>
                      );
                    })}
                  </select>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder="Comision %"
                    value={porcentajeComisionPct}
                    onChange={function (e) {
                      setPorcentajeComisionPct(e.target.value);
                    }}
                  />
                  <button className="btn btn--line" onClick={configurarComisionUI}>
                    Configurar comision
                  </button>
                  <input
                    className="input"
                    placeholder="Periodo (YYYY-MM)"
                    value={periodoComision}
                    onChange={function (e) {
                      setPeriodoComision(e.target.value);
                    }}
                  />
                  <button className="btn btn--primary" onClick={calcularComisionesUI}>
                    Calcular comisiones
                  </button>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Vendedor</th>
                      <th>Periodo</th>
                      <th>Base</th>
                      <th>Comision</th>
                      <th>Monto</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comisionesCom.map(function (c) {
                      return (
                        <tr key={c.id}>
                          <td>{c.vendedorId}</td>
                          <td>{c.periodo}</td>
                          <td>{formatearPesos(c.baseCentavos)}</td>
                          <td>{formatearPorcentaje(c.porcentajeBps)}%</td>
                          <td>{formatearPesos(c.montoCentavos)}</td>
                          <td>{c.estado}</td>
                          <td>
                            {c.estado === 'calculada' && (
                              <button
                                className="btn btn--warm btn--sm"
                                onClick={function () {
                                  pagarComisionUI(c.id);
                                }}
                              >
                                Liquidar
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            </>
          )}
          {esSeguridad && (
            <>
              {mensaje && <p className="alerta">{mensaje}</p>}
              <section className="panel">
                <div className="panel-head">
                  <h2>Usuarios internos y perfiles (CU-SEC-001..007)</h2>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Correo</th>
                      <th>Rol / Perfil</th>
                      <th>Zona</th>
                      <th>Emprendedor</th>
                      <th>Estado</th>
                      <th>Creado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuariosInternos.map(function (u) {
                      const esPropio = usuarioSesion ? usuarioSesion.id === u.id : false;
                      const rolPendiente = rolesEdicion[u.id];
                      const rolMostrado = rolPendiente || u.rol;
                      return (
                        <tr key={u.id}>
                          <td>
                            {u.correo}
                            {esPropio && <span className="muted"> (usted)</span>}
                          </td>
                          <td>
                            <span className="chip chip--info">{u.rol}</span>
                          </td>
                          <td>{u.zonaId || '-'}</td>
                          <td>{u.emprendedorId || '-'}</td>
                          <td>{u.estado}</td>
                          <td>{u.creadoEn.slice(0, 10)}</td>
                          <td>
                            {esPropio ? (
                              <span className="muted">No editable</span>
                            ) : (
                              <div className="acciones-fila">
                                <select
                                  className="input"
                                  style={{ margin: 0, minWidth: 150 }}
                                  value={rolMostrado}
                                  onChange={function (e) {
                                    setRolesEdicion({
                                      ...rolesEdicion,
                                      [u.id]: e.target.value,
                                    });
                                  }}
                                >
                                  {PERFILES_GESTIONABLES.map(function (perfil) {
                                    return (
                                      <option key={perfil} value={perfil}>
                                        {perfil}
                                      </option>
                                    );
                                  })}
                                </select>
                                <button
                                  className="btn btn--primary btn--sm"
                                  disabled={!rolPendiente || rolPendiente === u.rol}
                                  onClick={function () {
                                    guardarPerfilUsuarioUI(u.id);
                                  }}
                                >
                                  Guardar rol
                                </button>
                                <button
                                  className="btn btn--warm btn--sm"
                                  onClick={function () {
                                    cambiarEstadoUsuarioUI(
                                      u.id,
                                      u.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO',
                                    );
                                  }}
                                >
                                  {u.estado === 'ACTIVO' ? 'Inactivar' : 'Activar'}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {usuariosInternos.length === 0 && (
                      <tr>
                        <td colSpan={7} className="muted" style={{ padding: '12px 16px' }}>
                          Sin datos. Este modulo requiere el rol ADMIN.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
            </>
          )}
          {esLogistica && (
            <>
              {mensaje && <p className="alerta">{mensaje}</p>}
              <section className="panel">
                <div className="panel-head">
                  <h2>Transportistas (CU-LG-001)</h2>
                </div>
                <div className="form-grid">
                  <input
                    className="input"
                    placeholder="Nombre"
                    value={nombreTransportista}
                    onChange={function (e) {
                      setNombreTransportista(e.target.value);
                    }}
                  />
                  <input
                    className="input"
                    placeholder="NIT"
                    value={nitTransportista}
                    onChange={function (e) {
                      setNitTransportista(e.target.value);
                    }}
                  />
                  <input
                    className="input"
                    placeholder="Telefono"
                    value={telefonoTransportista}
                    onChange={function (e) {
                      setTelefonoTransportista(e.target.value);
                    }}
                  />
                  <button className="btn btn--primary" onClick={crearTransportistaLogUI}>
                    Crear transportista
                  </button>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>NIT</th>
                      <th>Telefono</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transportistasLog.map(function (t) {
                      return (
                        <tr key={t.id}>
                          <td>{t.nombre}</td>
                          <td>{t.nit}</td>
                          <td>{t.telefono || '-'}</td>
                          <td>{t.estado}</td>
                          <td>
                            <button
                              className="btn btn--warm btn--sm"
                              onClick={function () {
                                inactivarTransportistaLogUI(t.id);
                              }}
                            >
                              Inactivar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {transportistasLog.length === 0 && (
                      <tr>
                        <td colSpan={5} className="muted" style={{ padding: '12px 16px' }}>
                          Sin transportistas.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
              <section className="panel">
                <div className="panel-head">
                  <h2>Vehiculos (CU-LG-002)</h2>
                </div>
                <div className="form-grid">
                  <select
                    className="input"
                    value={transportistaSelLog}
                    onChange={function (e) {
                      setTransportistaSelLog(e.target.value);
                    }}
                  >
                    <option value="">Transportista...</option>
                    {transportistasLog.map(function (t) {
                      return (
                        <option key={t.id} value={t.id}>
                          {t.nombre}
                        </option>
                      );
                    })}
                  </select>
                  <input
                    className="input"
                    placeholder="Placa"
                    value={placaVehiculo}
                    onChange={function (e) {
                      setPlacaVehiculo(e.target.value);
                    }}
                  />
                  <input
                    className="input"
                    type="number"
                    min="1"
                    placeholder="Capacidad (kg)"
                    value={capacidadVehiculo}
                    onChange={function (e) {
                      setCapacidadVehiculo(e.target.value);
                    }}
                  />
                  <button className="btn btn--primary" onClick={crearVehiculoLogUI}>
                    Registrar vehiculo
                  </button>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Placa</th>
                      <th>Transportista</th>
                      <th>Capacidad kg</th>
                      <th>Estado</th>
                      <th>Operativo</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehiculosLog.map(function (v) {
                      return (
                        <tr key={v.id}>
                          <td>{v.placa}</td>
                          <td>{v.transportistaNombre}</td>
                          <td>{v.capacidadKg}</td>
                          <td>
                            <span className={claseBadgeEstado(v.estado)}>{v.estado}</span>
                          </td>
                          <td>
                            <span
                              className={claseBadgeEstado(
                                v.estadoOperativo === 'disponible' ? 'activo' : 'en_ruta',
                              )}
                            >
                              {v.estadoOperativo}
                            </span>
                          </td>
                          <td>
                            <button
                              className="btn btn--warm btn--sm"
                              onClick={function () {
                                inactivarVehiculoLogUI(v.id);
                              }}
                            >
                              Inactivar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {vehiculosLog.length === 0 && (
                      <tr>
                        <td colSpan={6} className="muted" style={{ padding: '12px 16px' }}>
                          Sin vehiculos.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
              <section className="panel">
                <div className="panel-head">
                  <h2>Despachos (CU-LG-003/004/005/006)</h2>
                </div>
                <div className="form-grid">
                  <select
                    className="input"
                    value={ventaSelLog}
                    onChange={function (e) {
                      setVentaSelLog(e.target.value);
                    }}
                  >
                    <option value="">Venta pagada...</option>
                    {ventasDesp.map(function (v) {
                      return (
                        <option key={v.id} value={v.id}>
                          {v.referenciaPedido} - {v.clienteNombre}
                        </option>
                      );
                    })}
                  </select>
                  <select
                    className="input"
                    value={transportistaSelLog}
                    onChange={function (e) {
                      setTransportistaSelLog(e.target.value);
                    }}
                  >
                    <option value="">Transportista...</option>
                    {transportistasLog.map(function (t) {
                      return (
                        <option key={t.id} value={t.id}>
                          {t.nombre}
                        </option>
                      );
                    })}
                  </select>
                  <select
                    className="input"
                    value={vehiculoSelLog}
                    onChange={function (e) {
                      setVehiculoSelLog(e.target.value);
                    }}
                  >
                    <option value="">Vehiculo...</option>
                    {vehiculosLog.map(function (v) {
                      return (
                        <option key={v.id} value={v.id}>
                          {v.placa}
                        </option>
                      );
                    })}
                  </select>
                  <input
                    className="input"
                    placeholder="Ruta (ej. Bogota - Cali)"
                    value={rutaDespacho}
                    onChange={function (e) {
                      setRutaDespacho(e.target.value);
                    }}
                  />
                  <button className="btn btn--primary" onClick={crearDespachoLogUI}>
                    Crear despacho
                  </button>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Despacho</th>
                      <th>Guia</th>
                      <th>Venta</th>
                      <th>Cliente</th>
                      <th>Transportista</th>
                      <th>Vehiculo</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {despachosLog.map(function (d) {
                      return (
                        <tr key={d.id}>
                          <td>{d.referencia}</td>
                          <td>{d.guia}</td>
                          <td>{d.referenciaPedido}</td>
                          <td>{d.clienteNombre}</td>
                          <td>{d.transportistaNombre}</td>
                          <td>{d.placa}</td>
                          <td>{d.estado}</td>
                          <td>
                            <div className="acciones-fila">
                              {d.estado === 'programado' && (
                                <button
                                  className="btn btn--primary btn--sm"
                                  onClick={function () {
                                    accionDespachoUI(d.id, 'despachar');
                                  }}
                                >
                                  Despachar
                                </button>
                              )}
                              {d.estado === 'programado' || d.estado === 'en_ruta' ? (
                                <button
                                  className="btn btn--warm btn--sm"
                                  onClick={function () {
                                    accionDespachoUI(d.id, 'entregar');
                                  }}
                                >
                                  Entregar
                                </button>
                              ) : null}
                              {d.estado === 'en_ruta' && (
                                <button
                                  className="btn btn--line btn--sm"
                                  onClick={function () {
                                    accionDespachoUI(d.id, 'devolver');
                                  }}
                                >
                                  Devolver
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {despachosLog.length === 0 && (
                      <tr>
                        <td colSpan={8} className="muted" style={{ padding: '12px 16px' }}>
                          Sin despachos.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
              <section className="panel">
                <div className="panel-head">
                  <h2>Rutas de distribucion (CU-LG-005)</h2>
                </div>
                <div className="form-grid">
                  <input
                    className="input"
                    placeholder="Codigo (opcional, ej. RT-2025-001)"
                    title="4 a 20 caracteres alfanumericos; vacio lo genera la API"
                    value={codigoRutaNueva}
                    onChange={function (e) {
                      setCodigoRutaNueva(e.target.value);
                    }}
                  />
                  <input
                    className="input"
                    placeholder="Nombre de la ruta"
                    value={nombreRutaNueva}
                    onChange={function (e) {
                      setNombreRutaNueva(e.target.value);
                    }}
                  />
                  <select
                    className="input"
                    value={vehiculoRutaSel}
                    onChange={function (e) {
                      setVehiculoRutaSel(e.target.value);
                    }}
                  >
                    <option value="">Vehiculo...</option>
                    {vehiculosLog.map(function (v) {
                      return (
                        <option key={v.id} value={v.id}>
                          {v.placa} - {v.transportistaNombre} ({v.estadoOperativo})
                        </option>
                      );
                    })}
                  </select>
                  <button className="btn btn--primary" onClick={crearRutaLogUI}>
                    Planificar ruta
                  </button>
                </div>
                <div className="form-grid">
                  <input
                    className="input"
                    placeholder="Destino de la parada (ej. Bogota - Cali)"
                    value={destinoParada}
                    onChange={function (e) {
                      setDestinoParada(e.target.value);
                    }}
                  />
                  <select
                    className="input"
                    value={despachoParadaSel}
                    onChange={function (e) {
                      setDespachoParadaSel(e.target.value);
                    }}
                  >
                    <option value="">Despacho de la parada (opcional)</option>
                    {despachosConsolidablesLog.map(function (d) {
                      return (
                        <option key={d.id} value={d.id}>
                          {d.referencia} - {d.guia}
                        </option>
                      );
                    })}
                  </select>
                  <button className="btn btn--line" onClick={agregarParadaRutaUI}>
                    Agregar parada
                  </button>
                </div>
                <table className="table table--compacta">
                  <thead>
                    <tr>
                      <th>Secuencia</th>
                      <th>Destino</th>
                      <th>Despacho</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paradasRuta.map(function (parada, indice) {
                      return (
                        <tr key={parada.destino}>
                          <td>{indice + 1}</td>
                          <td>{parada.destino}</td>
                          <td>
                            {parada.despachoId
                              ? 'Despacho ' + parada.despachoId
                              : 'Sin despacho asociado'}
                          </td>
                          <td>
                            <button
                              className="btn btn--warm btn--sm"
                              onClick={function () {
                                quitarParadaRutaUI(indice);
                              }}
                            >
                              Quitar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {paradasRuta.length === 0 && (
                      <tr>
                        <td colSpan={4} className="muted" style={{ padding: '12px 16px' }}>
                          Sin paradas: la ruta necesita al menos un destino.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Codigo</th>
                      <th>Nombre</th>
                      <th>Transportista</th>
                      <th>Vehiculo</th>
                      <th>Paradas</th>
                      <th>Despachos</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rutasLog.map(function (ruta) {
                      const modificable = ruta.estado === 'planificada';
                      return (
                        <tr key={ruta.id}>
                          <td>{ruta.codigo}</td>
                          <td>{ruta.nombre}</td>
                          <td>{ruta.transportistaNombre}</td>
                          <td>
                            {ruta.placa} ({ruta.capacidadKg} kg)
                          </td>
                          <td>{ruta.totalParadas}</td>
                          <td>{ruta.totalDespachos}</td>
                          <td>
                            <span className={claseBadgeEstado(ruta.estado)}>{ruta.estado}</span>
                          </td>
                          <td>
                            <div className="acciones-fila">
                              <button
                                className="btn btn--line btn--sm"
                                onClick={function () {
                                  verDetalleRutaUI(ruta.id);
                                }}
                              >
                                {detalleRutaLog && detalleRutaLog.id === ruta.id
                                  ? 'Ocultar paradas'
                                  : 'Ver paradas'}
                              </button>
                              {modificable && (
                                <button
                                  className="btn btn--primary btn--sm"
                                  onClick={function () {
                                    accionRutaUI(ruta.id, 'iniciar');
                                  }}
                                >
                                  Iniciar
                                </button>
                              )}
                              {ruta.estado === 'en_progreso' && (
                                <button
                                  className="btn btn--warm btn--sm"
                                  onClick={function () {
                                    accionRutaUI(ruta.id, 'completar');
                                  }}
                                >
                                  Completar
                                </button>
                              )}
                              {modificable && (
                                <button
                                  className="btn btn--line btn--sm"
                                  onClick={function () {
                                    accionRutaUI(ruta.id, 'cancelar');
                                  }}
                                >
                                  Cancelar
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {rutasLog.length === 0 && (
                      <tr>
                        <td colSpan={8} className="muted" style={{ padding: '12px 16px' }}>
                          Sin rutas de distribucion.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {detalleRutaLog && (
                  <table className="table table--compacta">
                    <thead>
                      <tr>
                        <th>Secuencia</th>
                        <th>Destino</th>
                        <th>Guia del despacho</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalleRutaLog.paradas.map(function (parada) {
                        return (
                          <tr key={parada.id}>
                            <td>{parada.secuencia}</td>
                            <td>{parada.destino}</td>
                            <td>{parada.guia || 'Sin despacho asociado'}</td>
                          </tr>
                        );
                      })}
                      {detalleRutaLog.paradas.length === 0 && (
                        <tr>
                          <td colSpan={3} className="muted" style={{ padding: '12px 16px' }}>
                            La ruta no tiene paradas registradas.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </section>
              <section className="panel">
                <div className="panel-head">
                  <h2>Consolidar despachos programados (CU-LG-005/006)</h2>
                </div>
                <div className="form-grid">
                  <select
                    className="input"
                    value={rutaConsolidarSel}
                    onChange={function (e) {
                      setRutaConsolidarSel(e.target.value);
                    }}
                  >
                    <option value="">Ruta destino...</option>
                    {rutasLog
                      .filter(function (ruta) {
                        return ruta.estado === 'planificada';
                      })
                      .map(function (ruta) {
                        return (
                          <option key={ruta.id} value={ruta.id}>
                            {ruta.codigo} - {ruta.nombre}
                          </option>
                        );
                      })}
                  </select>
                  <button className="btn btn--primary" onClick={consolidarDespachosUI}>
                    Consolidar despachos
                  </button>
                  <span className="muted">
                    Marcados: {despachosConsolidar.length} de {despachosConsolidablesLog.length}
                  </span>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Consolidar</th>
                      <th>Despacho</th>
                      <th>Guia</th>
                      <th>Venta</th>
                      <th>Cliente</th>
                      <th>Ruta asignada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {despachosConsolidablesLog.map(function (despacho) {
                      return (
                        <tr key={despacho.id}>
                          <td>
                            <input
                              type="checkbox"
                              aria-label={'Consolidar despacho ' + despacho.referencia}
                              checked={despachosConsolidar.indexOf(String(despacho.id)) >= 0}
                              onChange={function (e) {
                                alternarDespachoConsolidar(despacho.id, e.target.checked);
                              }}
                            />
                          </td>
                          <td>{despacho.referencia}</td>
                          <td>{despacho.guia}</td>
                          <td>{despacho.referenciaPedido}</td>
                          <td>{despacho.clienteNombre || '-'}</td>
                          <td>{despacho.rutaId ? 'Ruta ' + despacho.rutaId : 'Sin ruta'}</td>
                        </tr>
                      );
                    })}
                    {despachosConsolidablesLog.length === 0 && (
                      <tr>
                        <td colSpan={6} className="muted" style={{ padding: '12px 16px' }}>
                          Sin despachos programados disponibles para consolidar.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
            </>
          )}
          {esRrhh && (
            <>
              {mensaje && <p className="alerta">{mensaje}</p>}
              <section className="panel">
                <div className="panel-head">
                  <h2>Cargos (CU-RH-002)</h2>
                </div>
                <div className="form-grid">
                  <input
                    className="input"
                    placeholder="Nombre del cargo"
                    value={nombreCargo}
                    onChange={function (e) {
                      setNombreCargo(e.target.value);
                    }}
                  />
                  <button className="btn btn--primary" onClick={crearCargoUI}>
                    Crear cargo
                  </button>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Cargo</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cargosRrhh.map(function (c) {
                      return (
                        <tr key={c.id}>
                          <td>{c.nombre}</td>
                          <td>{c.estado}</td>
                          <td>
                            <button
                              className="btn btn--warm btn--sm"
                              onClick={function () {
                                inactivarEmpleadoUI(c.id);
                              }}
                            >
                              Inactivar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
              <section className="panel">
                <div className="panel-head">
                  <h2>Empleados (CU-RH-001)</h2>
                </div>
                <div className="form-grid">
                  <input
                    className="input"
                    placeholder="Nombre"
                    value={nombreEmpleado}
                    onChange={function (e) {
                      setNombreEmpleado(e.target.value);
                    }}
                  />
                  <input
                    className="input"
                    placeholder="Documento"
                    value={documentoEmpleado}
                    onChange={function (e) {
                      setDocumentoEmpleado(e.target.value);
                    }}
                  />
                  <select
                    className="input"
                    value={cargoSelEmpleado}
                    onChange={function (e) {
                      setCargoSelEmpleado(e.target.value);
                    }}
                  >
                    <option value="">Cargo...</option>
                    {cargosRrhh.map(function (c) {
                      return (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      );
                    })}
                  </select>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Salario (COP)"
                    value={salarioEmpleadoPesos}
                    onChange={function (e) {
                      setSalarioEmpleadoPesos(e.target.value);
                    }}
                  />
                  <button className="btn btn--primary" onClick={crearEmpleadoUI}>
                    Crear empleado
                  </button>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Documento</th>
                      <th>Cargo</th>
                      <th>Salario</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {empleadosRrhh.map(function (em) {
                      return (
                        <tr key={em.id}>
                          <td>{em.nombre}</td>
                          <td>{em.documentoUnico}</td>
                          <td>{em.cargoNombre || '-'}</td>
                          <td>{formatearPesos(em.salarioBaseCentavos)}</td>
                          <td>{em.estado}</td>
                          <td>
                            <button
                              className="btn btn--warm btn--sm"
                              onClick={function () {
                                inactivarEmpleadoUI(em.id);
                              }}
                            >
                              Inactivar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
              <section className="panel">
                <div className="panel-head">
                  <h2>Ausencias (CU-RH-005)</h2>
                </div>
                <div className="form-grid">
                  <select
                    className="input"
                    value={empleadoSelAusencia}
                    onChange={function (e) {
                      setEmpleadoSelAusencia(e.target.value);
                    }}
                  >
                    <option value="">Empleado...</option>
                    {empleadosRrhh.map(function (em) {
                      return (
                        <option key={em.id} value={em.id}>
                          {em.nombre}
                        </option>
                      );
                    })}
                  </select>
                  <input
                    className="input"
                    type="date"
                    value={fechaAusencia}
                    onChange={function (e) {
                      setFechaAusencia(e.target.value);
                    }}
                  />
                  <input
                    className="input"
                    placeholder="Motivo"
                    value={motivoAusencia}
                    onChange={function (e) {
                      setMotivoAusencia(e.target.value);
                    }}
                  />
                  <button className="btn btn--primary" onClick={registrarAusenciaUI}>
                    Registrar ausencia
                  </button>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Empleado</th>
                      <th>Fecha</th>
                      <th>Motivo</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ausenciasRrhh.map(function (a) {
                      return (
                        <tr key={a.id}>
                          <td>{a.empleadoNombre}</td>
                          <td>{a.fecha.slice(0, 10)}</td>
                          <td>{a.motivo}</td>
                          <td>{a.estado}</td>
                          <td>
                            {a.estado !== 'justificada' && (
                              <button
                                className="btn btn--line btn--sm"
                                onClick={function () {
                                  justificarAusenciaUI(a.id);
                                }}
                              >
                                Justificar
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
              <section className="panel">
                <div className="panel-head">
                  <h2>Nomina (CU-RH-007)</h2>
                </div>
                <div className="form-grid">
                  <input
                    className="input"
                    placeholder="Periodo (YYYY-MM)"
                    value={periodoNomina}
                    onChange={function (e) {
                      setPeriodoNomina(e.target.value);
                    }}
                  />
                  <button className="btn btn--primary" onClick={generarNominaUI}>
                    Generar nomina del periodo
                  </button>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Periodo</th>
                      <th>Empleado</th>
                      <th>Cargo</th>
                      <th>Neto</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nominasRrhh.map(function (n) {
                      return (
                        <tr key={n.id}>
                          <td>{n.periodo}</td>
                          <td>{n.empleadoNombre}</td>
                          <td>{n.cargoNombre || '-'}</td>
                          <td>{formatearPesos(n.netoCentavos)}</td>
                          <td>{n.estado}</td>
                          <td>
                            {n.estado === 'generada' && (
                              <button
                                className="btn btn--warm btn--sm"
                                onClick={function () {
                                  pagarNominaUI(n.id);
                                }}
                              >
                                Pagar
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
              <section className="panel">
                <div className="panel-head">
                  <h2>Horarios (CU-RH-004)</h2>
                </div>
                <div className="form-grid">
                  <select
                    className="input"
                    value={empleadoHorarioSel}
                    onChange={function (e) {
                      setEmpleadoHorarioSel(e.target.value);
                    }}
                  >
                    <option value="">Empleado...</option>
                    {empleadosRrhh.map(function (em) {
                      return (
                        <option key={em.id} value={em.id}>
                          {em.nombre}
                        </option>
                      );
                    })}
                  </select>
                  <select
                    className="input"
                    value={diaSemanaHorario}
                    onChange={function (e) {
                      setDiaSemanaHorario(e.target.value);
                    }}
                  >
                    <option value="1">Lunes</option>
                    <option value="2">Martes</option>
                    <option value="3">Miercoles</option>
                    <option value="4">Jueves</option>
                    <option value="5">Viernes</option>
                    <option value="6">Sabado</option>
                    <option value="7">Domingo</option>
                  </select>
                  <input
                    className="input"
                    placeholder="Hora inicio (HH:MM)"
                    value={horaInicioHorario}
                    onChange={function (e) {
                      setHoraInicioHorario(e.target.value);
                    }}
                  />
                  <input
                    className="input"
                    placeholder="Hora fin (HH:MM)"
                    value={horaFinHorario}
                    onChange={function (e) {
                      setHoraFinHorario(e.target.value);
                    }}
                  />
                  <button className="btn btn--primary" onClick={crearHorarioUI}>
                    Crear horario
                  </button>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Empleado</th>
                      <th>Dia</th>
                      <th>Inicio</th>
                      <th>Fin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {horariosRrhh.map(function (h) {
                      return (
                        <tr key={h.id}>
                          <td>{h.empleadoNombre}</td>
                          <td>{h.diaSemana}</td>
                          <td>{h.horaInicio}</td>
                          <td>{h.horaFin}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
              <section className="panel">
                <div className="panel-head">
                  <h2>Novedades de nomina (CU-RH-006)</h2>
                </div>
                <div className="form-grid">
                  <select
                    className="input"
                    value={empleadoNovedadSel}
                    onChange={function (e) {
                      setEmpleadoNovedadSel(e.target.value);
                    }}
                  >
                    <option value="">Empleado...</option>
                    {empleadosRrhh.map(function (em) {
                      return (
                        <option key={em.id} value={em.id}>
                          {em.nombre}
                        </option>
                      );
                    })}
                  </select>
                  <input
                    className="input"
                    placeholder="Periodo (YYYY-MM)"
                    value={periodoNovedad}
                    onChange={function (e) {
                      setPeriodoNovedad(e.target.value);
                    }}
                  />
                  <select
                    className="input"
                    value={tipoNovedad}
                    onChange={function (e) {
                      setTipoNovedad(e.target.value);
                    }}
                  >
                    <option value="devengo">Devengo</option>
                    <option value="deduccion">Deduccion</option>
                  </select>
                  <input
                    className="input"
                    placeholder="Concepto"
                    value={conceptoNovedad}
                    onChange={function (e) {
                      setConceptoNovedad(e.target.value);
                    }}
                  />
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Monto (COP)"
                    value={montoNovedadPesos}
                    onChange={function (e) {
                      setMontoNovedadPesos(e.target.value);
                    }}
                  />
                  <button className="btn btn--primary" onClick={crearNovedadUI}>
                    Registrar novedad
                  </button>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Empleado</th>
                      <th>Periodo</th>
                      <th>Tipo</th>
                      <th>Concepto</th>
                      <th>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {novedadesRrhh.map(function (nv) {
                      return (
                        <tr key={nv.id}>
                          <td>{nv.empleadoNombre}</td>
                          <td>{nv.periodo}</td>
                          <td>{nv.tipo}</td>
                          <td>{nv.concepto}</td>
                          <td>{formatearPesos(nv.montoCentavos)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            </>
          )}
          {esFacturacion && (
            <>
              {mensaje && <p className="alerta">{mensaje}</p>}
              <section className="panel">
                <div className="panel-head">
                  <h2>Impuestos (CU-FC-004)</h2>
                </div>
                <div className="form-grid">
                  <input
                    className="input"
                    placeholder="Nombre (ej. IVA 19%)"
                    value={nombreImpuesto}
                    onChange={function (e) {
                      setNombreImpuesto(e.target.value);
                    }}
                  />
                  <select
                    className="input"
                    value={tipoImpuesto}
                    onChange={function (e) {
                      setTipoImpuesto(e.target.value);
                    }}
                  >
                    <option value="iva">IVA</option>
                    <option value="retencion">Retencion</option>
                    <option value="otro">Otro</option>
                  </select>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder="Tarifa %"
                    value={tarifaImpuestoPct}
                    onChange={function (e) {
                      setTarifaImpuestoPct(e.target.value);
                    }}
                  />
                  <button className="btn btn--primary" onClick={crearImpuestoUI}>
                    Crear impuesto
                  </button>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Impuesto</th>
                      <th>Tipo</th>
                      <th>Tarifa</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {impuestosFin.map(function (i) {
                      return (
                        <tr key={i.id}>
                          <td>{i.nombre}</td>
                          <td>{i.tipo}</td>
                          <td>{formatearPorcentaje(i.tarifaBps)}%</td>
                          <td>{i.estado}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
              <section className="panel">
                <div className="panel-head">
                  <h2>Facturas (CU-FC-001/003) y notas (CU-FC-002)</h2>
                </div>
                <div className="form-grid">
                  <select
                    className="input"
                    value={ordenFacturarSel}
                    onChange={function (e) {
                      setOrdenFacturarSel(e.target.value);
                    }}
                  >
                    <option value="">Orden B2B por facturar...</option>
                    {porFacturarFin.map(function (o) {
                      return (
                        <option key={o.id} value={o.id}>
                          {o.folio} - {o.clienteRazonSocial}
                        </option>
                      );
                    })}
                  </select>
                  <select
                    className="input"
                    value={impuestoFacturaSel}
                    onChange={function (e) {
                      setImpuestoFacturaSel(e.target.value);
                    }}
                  >
                    <option value="">Sin impuesto</option>
                    {impuestosFin.map(function (i) {
                      return (
                        <option key={i.id} value={i.id}>
                          {i.nombre}
                        </option>
                      );
                    })}
                  </select>
                  <button className="btn btn--primary" onClick={emitirFacturaUI}>
                    Emitir factura
                  </button>
                </div>
                <div className="form-grid">
                  <select
                    className="input"
                    value={facturaNotaSel}
                    onChange={function (e) {
                      setFacturaNotaSel(e.target.value);
                    }}
                  >
                    <option value="">Factura...</option>
                    {facturasFin.map(function (f) {
                      return (
                        <option key={f.id} value={f.id}>
                          {f.numero}
                        </option>
                      );
                    })}
                  </select>
                  <select
                    className="input"
                    value={tipoNota}
                    onChange={function (e) {
                      setTipoNota(e.target.value);
                    }}
                  >
                    <option value="credito">Nota credito</option>
                    <option value="debito">Nota debito</option>
                  </select>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Monto (COP)"
                    value={montoNotaPesos}
                    onChange={function (e) {
                      setMontoNotaPesos(e.target.value);
                    }}
                  />
                  <input
                    className="input"
                    placeholder="Motivo"
                    value={motivoNota}
                    onChange={function (e) {
                      setMotivoNota(e.target.value);
                    }}
                  />
                  <button className="btn btn--line" onClick={crearNotaUI}>
                    Crear nota
                  </button>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Numero</th>
                      <th>Cliente</th>
                      <th>Base</th>
                      <th>Impuesto</th>
                      <th>Total</th>
                      <th>Estado</th>
                      <th>DIAN</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facturasFin.map(function (f) {
                      return (
                        <tr key={f.id}>
                          <td>{f.numero}</td>
                          <td>{f.clienteRazonSocial}</td>
                          <td>{formatearPesos(f.baseCentavos)}</td>
                          <td>{formatearPesos(f.impuestoCentavos)}</td>
                          <td>{formatearPesos(f.totalCentavos)}</td>
                          <td>{f.estado}</td>
                          <td>{f.estadoDian || '-'}</td>
                          <td>
                            <div className="acciones-fila">
                              {f.estado === 'emitida' && f.estadoDian === 'no_enviada' && (
                                <button
                                  className="btn btn--primary btn--sm"
                                  onClick={function () {
                                    emitirDianUI(f.id);
                                  }}
                                >
                                  Emitir DIAN
                                </button>
                              )}
                              {f.estado === 'emitida' && (
                                <button
                                  className="btn btn--warm btn--sm"
                                  onClick={function () {
                                    accionFacturaUI(f.id, 'pagar');
                                  }}
                                >
                                  Pagar
                                </button>
                              )}
                              {f.estado === 'emitida' && (
                                <button
                                  className="btn btn--line btn--sm"
                                  onClick={function () {
                                    accionFacturaUI(f.id, 'anular');
                                  }}
                                >
                                  Anular
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            </>
          )}
          {esContabilidad && (
            <>
              {mensaje && <p className="alerta">{mensaje}</p>}
              <section className="panel">
                <div className="panel-head">
                  <h2>Plan unico de cuentas (CU-CT-001)</h2>
                </div>
                <div className="form-grid">
                  <input
                    className="input"
                    placeholder="Codigo (PUC)"
                    value={codigoCuenta}
                    onChange={function (e) {
                      setCodigoCuenta(e.target.value);
                    }}
                  />
                  <input
                    className="input"
                    placeholder="Nombre de la cuenta"
                    value={nombreCuenta}
                    onChange={function (e) {
                      setNombreCuenta(e.target.value);
                    }}
                  />
                  <select
                    className="input"
                    value={naturalezaCuenta}
                    onChange={function (e) {
                      setNaturalezaCuenta(e.target.value);
                    }}
                  >
                    <option value="debito">Debito</option>
                    <option value="credito">Credito</option>
                  </select>
                  <button className="btn btn--primary" onClick={crearCuentaUI}>
                    Crear cuenta
                  </button>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Codigo</th>
                      <th>Cuenta</th>
                      <th>Naturaleza</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cuentasFin.map(function (c) {
                      return (
                        <tr key={c.id}>
                          <td>{c.codigo}</td>
                          <td>{c.nombre}</td>
                          <td>{c.naturaleza}</td>
                          <td>{c.estado}</td>
                          <td>
                            <button
                              className="btn btn--warm btn--sm"
                              onClick={function () {
                                inactivarCuentaUI(c.id);
                              }}
                            >
                              Inactivar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
              <section className="panel">
                <div className="panel-head">
                  <h2>Asientos contables (CU-CT-002 base)</h2>
                </div>
                <div className="form-grid">
                  <input
                    className="input"
                    placeholder="Descripcion"
                    value={descripcionAsiento}
                    onChange={function (e) {
                      setDescripcionAsiento(e.target.value);
                    }}
                  />
                  <select
                    className="input"
                    value={cuentaDebeSel}
                    onChange={function (e) {
                      setCuentaDebeSel(e.target.value);
                    }}
                  >
                    <option value="">Cuenta debito...</option>
                    {cuentasFin.map(function (c) {
                      return (
                        <option key={c.id} value={c.id}>
                          {c.codigo} {c.nombre}
                        </option>
                      );
                    })}
                  </select>
                  <select
                    className="input"
                    value={cuentaHaberSel}
                    onChange={function (e) {
                      setCuentaHaberSel(e.target.value);
                    }}
                  >
                    <option value="">Cuenta credito...</option>
                    {cuentasFin.map(function (c) {
                      return (
                        <option key={c.id} value={c.id}>
                          {c.codigo} {c.nombre}
                        </option>
                      );
                    })}
                  </select>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Monto (COP)"
                    value={montoAsientoPesos}
                    onChange={function (e) {
                      setMontoAsientoPesos(e.target.value);
                    }}
                  />
                  <button className="btn btn--primary" onClick={crearAsientoUI}>
                    Crear asiento
                  </button>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Referencia</th>
                      <th>Descripcion</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {asientosFin.map(function (a) {
                      return (
                        <tr key={a.id}>
                          <td>{a.referencia}</td>
                          <td>{a.descripcion}</td>
                          <td>{a.fecha.slice(0, 10)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            </>
          )}
          {esGerencia && (
            <>
              {mensaje && <p className="alerta">{mensaje}</p>}
              <section className="panel">
                <div className="panel-head">
                  <h2>Resumen gerencial (CU-GE base)</h2>
                </div>
                <div className="form-grid">
                  <input
                    className="input"
                    placeholder="Periodo (YYYY-MM)"
                    value={periodoGerencia}
                    onChange={function (e) {
                      setPeriodoGerencia(e.target.value);
                    }}
                  />
                  <select
                    className="input"
                    value={mesesSerieGerencia}
                    onChange={function (e) {
                      setMesesSerieGerencia(e.target.value);
                    }}
                  >
                    {Array.from({ length: MESES_SERIE_MAXIMO }, function (_valor, indice) {
                      return indice + 1;
                    }).map(function (mes) {
                      return (
                        <option key={mes} value={mes}>
                          {mes} {mes === 1 ? 'mes' : 'meses'} de serie
                        </option>
                      );
                    })}
                  </select>
                  <select
                    className="input"
                    value={limiteRankingGerencia}
                    onChange={function (e) {
                      setLimiteRankingGerencia(e.target.value);
                    }}
                  >
                    {Array.from({ length: LIMITE_RANKING_MAXIMO }, function (_valor, indice) {
                      return indice + 1;
                    }).map(function (tope) {
                      return (
                        <option key={tope} value={tope}>
                          Top {tope} productos
                        </option>
                      );
                    })}
                  </select>
                  <button
                    className="btn btn--primary"
                    onClick={function () {
                      if (token)
                        cargarGerencia(
                          token,
                          periodoGerencia.trim(),
                          mesesSerieGerencia,
                          limiteRankingGerencia,
                        );
                    }}
                  >
                    Consultar periodo
                  </button>
                </div>
                {resumenGerencia && (
                  <>
                    <section className="kpi-grid">
                      <article className="kpi-card">
                        <span className="muted">Ventas canal (efectivas)</span>
                        <strong>
                          {formatearPesos(resumenGerencia.canal.montoEfectivoCentavos)}
                        </strong>
                      </article>
                      <article className="kpi-card">
                        <span className="muted">Ventas B2B pagadas</span>
                        <strong>{formatearPesos(resumenGerencia.b2b.montoPagadoCentavos)}</strong>
                      </article>
                      <article className="kpi-card">
                        <span className="muted">Facturado (sin anuladas)</span>
                        <strong>
                          {formatearPesos(resumenGerencia.facturacion.facturadoCentavos)}
                        </strong>
                      </article>
                      <article className="kpi-card">
                        <span className="muted">IVA causado</span>
                        <strong>{formatearPesos(resumenGerencia.facturacion.ivaCentavos)}</strong>
                      </article>
                      <article className="kpi-card">
                        <span className="muted">Referencias bajo minimo</span>
                        <strong>{resumenGerencia.inventario.referenciasBajoMinimo}</strong>
                      </article>
                      <article className="kpi-card">
                        <span className="muted">Casos abiertos / en proceso</span>
                        <strong>
                          {resumenGerencia.casos.abiertos} / {resumenGerencia.casos.enProceso}
                        </strong>
                      </article>
                    </section>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Indicador</th>
                          <th>Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>Pedidos del canal</td>
                          <td>{resumenGerencia.canal.totalPedidos}</td>
                        </tr>
                        <tr>
                          <td>Ordenes B2B del periodo</td>
                          <td>{resumenGerencia.b2b.totalOrdenes}</td>
                        </tr>
                        <tr>
                          <td>Facturas emitidas</td>
                          <td>{resumenGerencia.facturacion.totalFacturas}</td>
                        </tr>
                        <tr>
                          <td>Facturas electronicas (DIAN)</td>
                          <td>{resumenGerencia.facturacion.dianEmitidas}</td>
                        </tr>
                        <tr>
                          <td>Comisiones por liquidar</td>
                          <td>{formatearPesos(resumenGerencia.comisiones.calculadasCentavos)}</td>
                        </tr>
                        <tr>
                          <td>Comisiones liquidadas</td>
                          <td>{formatearPesos(resumenGerencia.comisiones.pagadasCentavos)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </>
                )}
              </section>
              <section className="panel">
                <div className="panel-head">
                  <h2>Serie mensual de ventas y facturacion (CU-GE)</h2>
                </div>
                <div className="form-grid">
                  <button
                    className="btn btn--primary"
                    onClick={function () {
                      if (token)
                        cargarReportesGerencia(
                          token,
                          periodoGerencia.trim(),
                          mesesSerieGerencia,
                          limiteRankingGerencia,
                        );
                    }}
                  >
                    Consultar serie
                  </button>
                  <button
                    className="btn btn--line"
                    onClick={function () {
                      descargarReporteGerencia('series');
                    }}
                  >
                    Descargar CSV de serie
                  </button>
                </div>
                {serieGerencia ? (
                  <>
                    <GraficaSeriesGerencial puntos={serieGerencia.serie || []} />
                    <section className="kpi-grid">
                      <article className="kpi-card">
                        <span className="muted">Venta canal ({serieGerencia.meses} meses)</span>
                        <strong>{formatearPesos(serieGerencia.totales.canalCentavos)}</strong>
                      </article>
                      <article className="kpi-card">
                        <span className="muted">Venta B2B pagada</span>
                        <strong>{formatearPesos(serieGerencia.totales.b2bCentavos)}</strong>
                      </article>
                      <article className="kpi-card">
                        <span className="muted">Facturado</span>
                        <strong>{formatearPesos(serieGerencia.totales.facturadoCentavos)}</strong>
                      </article>
                      <article className="kpi-card">
                        <span className="muted">IVA causado</span>
                        <strong>{formatearPesos(serieGerencia.totales.ivaCentavos)}</strong>
                      </article>
                    </section>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Periodo</th>
                          <th>Pedidos canal</th>
                          <th>Venta canal</th>
                          <th>Ordenes B2B</th>
                          <th>Venta B2B</th>
                          <th>Facturas</th>
                          <th>Facturado</th>
                          <th>IVA</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(serieGerencia.serie || []).map(function (punto) {
                          return (
                            <tr key={punto.periodo}>
                              <td>{etiquetaPeriodo(punto.periodo)}</td>
                              <td>{punto.pedidos}</td>
                              <td>{formatearPesos(punto.canalCentavos)}</td>
                              <td>{punto.ordenesB2b}</td>
                              <td>{formatearPesos(punto.b2bCentavos)}</td>
                              <td>{punto.facturas}</td>
                              <td>{formatearPesos(punto.facturadoCentavos)}</td>
                              <td>{formatearPesos(punto.ivaCentavos)}</td>
                              <td>{formatearPesos(punto.totalCentavos)}</td>
                            </tr>
                          );
                        })}
                        {(serieGerencia.serie || []).length === 0 && (
                          <tr>
                            <td colSpan={9} className="muted" style={{ padding: '12px 16px' }}>
                              Sin movimientos en los meses consultados.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </>
                ) : (
                  <p className="muted" style={{ padding: '12px 16px' }}>
                    Consulte la serie para ver la grafica y el detalle mensual.
                  </p>
                )}
              </section>
              <section className="panel">
                <div className="panel-head">
                  <h2>Ranking de productos vendidos (CU-GE)</h2>
                </div>
                <div className="form-grid">
                  <button
                    className="btn btn--primary"
                    onClick={function () {
                      if (token)
                        cargarReportesGerencia(
                          token,
                          periodoGerencia.trim(),
                          mesesSerieGerencia,
                          limiteRankingGerencia,
                        );
                    }}
                  >
                    Consultar ranking
                  </button>
                  <button
                    className="btn btn--line"
                    onClick={function () {
                      descargarReporteGerencia('ranking');
                    }}
                  >
                    Descargar CSV de ranking
                  </button>
                  <span className="muted">
                    Periodo del ranking: {periodoGerencia.trim() || 'mes en curso'}
                  </span>
                </div>
                {rankingGerencia && (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Producto</th>
                        <th>Unidades</th>
                        <th>Monto total</th>
                        <th>Unidades canal</th>
                        <th>Monto canal</th>
                        <th>Unidades B2B</th>
                        <th>Monto B2B</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(rankingGerencia.productos || []).map(function (producto, indice) {
                        return (
                          <tr key={producto.productoId}>
                            <td>{indice + 1}</td>
                            <td>{producto.productoNombre}</td>
                            <td>{producto.unidades}</td>
                            <td>{formatearPesos(producto.montoCentavos)}</td>
                            <td>{producto.unidadesCanal}</td>
                            <td>{formatearPesos(producto.montoCanalCentavos)}</td>
                            <td>{producto.unidadesB2b}</td>
                            <td>{formatearPesos(producto.montoB2bCentavos)}</td>
                          </tr>
                        );
                      })}
                      {(rankingGerencia.productos || []).length === 0 && (
                        <tr>
                          <td colSpan={8} className="muted" style={{ padding: '12px 16px' }}>
                            Sin ventas registradas para el periodo.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </section>
              <section className="panel">
                <div className="panel-head">
                  <h2>Cartera por pagar y por cobrar (CU-GE)</h2>
                </div>
                <div className="form-grid">
                  <button
                    className="btn btn--primary"
                    onClick={function () {
                      if (token)
                        cargarReportesGerencia(
                          token,
                          periodoGerencia.trim(),
                          mesesSerieGerencia,
                          limiteRankingGerencia,
                        );
                    }}
                  >
                    Actualizar cartera
                  </button>
                  <button
                    className="btn btn--line"
                    onClick={function () {
                      descargarReporteGerencia('cartera');
                    }}
                  >
                    Descargar CSV de cartera
                  </button>
                  <button
                    className="btn btn--line"
                    onClick={function () {
                      descargarReporteGerencia('resumen');
                    }}
                  >
                    Descargar CSV de resumen
                  </button>
                </div>
                {carteraGerencia && (
                  <>
                    <section className="kpi-grid">
                      <article className="kpi-card">
                        <span className="muted">Cuentas por pagar pendientes</span>
                        <strong>{formatearPesos(carteraGerencia.porPagar.totalCentavos)}</strong>
                        <span className="muted">{carteraGerencia.porPagar.cuentas} cuentas</span>
                      </article>
                      <article className="kpi-card">
                        <span className="muted">Por pagar vencido</span>
                        <strong>{formatearPesos(carteraGerencia.porPagar.vencidoCentavos)}</strong>
                        <span className="muted">
                          {carteraGerencia.porPagar.vencidas} cuentas vencidas
                        </span>
                      </article>
                      <article className="kpi-card">
                        <span className="muted">Por cobrar (facturas emitidas)</span>
                        <strong>{formatearPesos(carteraGerencia.porCobrar.totalCentavos)}</strong>
                        <span className="muted">{carteraGerencia.porCobrar.facturas} facturas</span>
                      </article>
                    </section>
                    <p className="muted" style={{ padding: '0 16px 16px' }}>
                      Corte de cartera: {String(carteraGerencia.generadoEn || '').slice(0, 10)} (los
                      importes viajan y se muestran en pesos colombianos, COP).
                    </p>
                  </>
                )}
              </section>
            </>
          )}
          {!esDashboard &&
            !esCompras &&
            !esInventario &&
            !esVentas &&
            !esSeguridad &&
            !esLogistica &&
            !esRrhh &&
            !esFacturacion &&
            !esContabilidad &&
            !esGerencia && (
              <section className="panel">
                <div className="panel-head">
                  <h2>{moduloActivo}</h2>
                </div>
                <p className="muted" style={{ padding: '12px 16px' }}>
                  Modulo de la fase F5 (ERP) en desarrollo sobre la API modular; el Dashboard y
                  Compras ya consumen datos reales.
                </p>
              </section>
            )}
          <footer className="app-footer">CuchosTool.com - ERP (F5) - Design System IU_CT</footer>
        </main>
      </div>
    </div>
  );
}

// Limite de errores: si un modulo falla se muestra un aviso en vez de pantalla en negro.
class LimiteErrores extends Component<{ children: unknown }, { error: unknown }> {
  constructor(props: { children: unknown }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: unknown) {
    return { error: error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="app-shell">
          <div
            className="panel"
            style={{ margin: 'var(--ct-space-5)', padding: 'var(--ct-space-4)' }}
          >
            <h2>Ocurrio un error inesperado en el modulo</h2>
            <p className="muted">
              Recarga la pagina para continuar. Si persiste, revisa la consola del navegador.
            </p>
            <button
              className="btn btn--primary"
              onClick={function () {
                window.location.reload();
              }}
            >
              Recargar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children as any;
  }
}

function Aplicacion(): JSX.Element {
  return (
    <LimiteErrores>
      <ContenidoAplicacion />
    </LimiteErrores>
  );
}

export default Aplicacion;
