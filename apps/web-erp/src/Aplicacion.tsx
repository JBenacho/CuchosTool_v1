// Sitio ERP (F5): login interno y dashboards con datos reales de la API.
import { Component, useEffect, useState } from 'react';
import './Aplicacion.css';

const API = '/api';

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

interface FilaOrden {
  id: number;
  referencia: string;
  proveedorNombre: string;
  productoNombre: string;
  cantidadPedida: number;
  cantidadRecibida: number;
  saldoPendiente: number;
  totalCentavos: number;
  estado: string;
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
  const [productoCompraSel, setProductoCompraSel] = useState('');
  const [bodegaCompraSel, setBodegaCompraSel] = useState('');
  const [cantidadOrden, setCantidadOrden] = useState('');
  const [precioOrden, setPrecioOrden] = useState('');
  // Estado del modulo Ventas (CU-CM-007 base).
  const [ventas, setVentas] = useState<FilaVenta[]>([]);
  const [resumenVentas, setResumenVentas] = useState<ResumenVentas | null>(null);
  const [filtroEstadoVenta, setFiltroEstadoVenta] = useState('');
  const [detalleVenta, setDetalleVenta] = useState<DetalleVenta | null>(null);
  // Usuarios y perfiles (Seguridad).
  const [usuariosInternos, setUsuariosInternos] = useState<FilaUsuario[]>([]);

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
      // El resumen es solo del Dashboard; no contaminar otros modulos con su error.
      if (moduloActivo === 'Dashboard') setMensaje('No se pudo cargar el resumen');
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
  }

  function cancelarEdicion(): void {
    setEditandoId(null);
    resetearFormulario();
  }

  // Alta (POST) o edicion (PATCH) de proveedor segun editandoId (CU-ERP-001).
  async function guardarProveedor(): Promise<void> {
    if (!token) return;
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
      };
      const respuesta = await peticion('/erp/proveedores/' + editandoId, token, 'PATCH', cuerpo);
      if (!respuesta.ok) {
        setMensaje('No se pudo guardar el proveedor');
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
    };
    const respuesta = await peticion('/erp/proveedores', token, 'POST', cuerpo);
    if (!respuesta.ok) {
      const json = await respuesta.json().catch(function () {
        return {};
      });
      setMensaje(
        json.error === 'nit_ya_existe' ? 'El NIT ya existe' : 'No se pudo crear el proveedor',
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

  // Crea una orden de compra directa (CU-ERP-003).
  async function crearOrdenUI(): Promise<void> {
    if (!token) return;
    const proveedorId = Number(proveedorSel);
    const productoId = Number(productoCompraSel);
    const bodegaId = Number(bodegaCompraSel);
    const cantidad = Number(cantidadOrden);
    // El precio se captura en pesos colombianos (COP) y se almacena en centavos (MONEDA_COP).
    const precioPesos = Number(precioOrden);
    if (
      !proveedorId ||
      !productoId ||
      !bodegaId ||
      !cantidad ||
      cantidad <= 0 ||
      !precioPesos ||
      precioPesos <= 0
    ) {
      setMensaje('Complete proveedor, producto, bodega, cantidad y precio (COP)');
      return;
    }
    const precioCentavos = Math.round(precioPesos * 100);
    const respuesta = await peticion('/compras/ordenes', token, 'POST', {
      proveedorId: proveedorId,
      productoId: productoId,
      bodegaDestinoId: bodegaId,
      cantidad: cantidad,
      precioUnitarioCentavos: precioCentavos,
    });
    if (!respuesta.ok) {
      setMensaje('No se pudo crear la orden de compra');
      return;
    }
    setCantidadOrden('');
    setPrecioOrden('');
    await cargarComprasAvanzado(token);
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
    const respuesta = await peticion('/compras/ordenes/' + id + '/recepcion', token, 'POST', {
      cantidadRecibida: orden.saldoPendiente,
    });
    if (!respuesta.ok) {
      const json = await respuesta.json().catch(function () {
        return {};
      });
      setMensaje(
        json.error === 'cantidad_excede_saldo'
          ? 'La cantidad excede el saldo'
          : 'No se pudo registrar la recepcion',
      );
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

  const esDashboard = moduloActivo === 'Dashboard';
  const esCompras = moduloActivo === 'Compras';
  const esInventario = moduloActivo === 'Inventario';
  const esVentas = moduloActivo === 'Ventas';
  const esSeguridad = moduloActivo === 'Seguridad';
  const termino = terminoBusqueda.trim().toLowerCase();
  const proveedoresFiltrados = termino
    ? proveedores.filter(function (proveedor) {
        return (
          proveedor.nit.toLowerCase().includes(termino) ||
          proveedor.nombre.toLowerCase().includes(termino)
        );
      })
    : proveedores;

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
              {MODULOS.map(function (modulo) {
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
                          <td>
                            <span className="badge badge--ok">{proveedor.estado}</span>
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
                        <td colSpan={9} className="muted" style={{ padding: '12px 16px' }}>
                          Sin proveedores registrados.
                        </td>
                      </tr>
                    )}
                    {proveedores.length > 0 && proveedoresFiltrados.length === 0 && (
                      <tr>
                        <td colSpan={9} className="muted" style={{ padding: '12px 16px' }}>
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
                    value={productoCompraSel}
                    onChange={function (e) {
                      setProductoCompraSel(e.target.value);
                    }}
                  >
                    <option value="">Producto...</option>
                    {catalogoCompras.map(function (p) {
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
                  <input
                    className="input"
                    type="number"
                    min="1"
                    placeholder="Cantidad"
                    value={cantidadOrden}
                    onChange={function (e) {
                      setCantidadOrden(e.target.value);
                    }}
                  />
                  <input
                    className="input"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="Precio unitario (COP)"
                    title="Valor en pesos colombianos (COP), ej. 1000,50"
                    value={precioOrden}
                    onChange={function (e) {
                      setPrecioOrden(e.target.value);
                    }}
                  />
                  <button className="btn btn--primary" onClick={crearOrdenUI}>
                    Crear orden
                  </button>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Referencia</th>
                      <th>Proveedor</th>
                      <th>Producto</th>
                      <th>Pedido</th>
                      <th>Recibido</th>
                      <th>Total</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordenesCompra.map(function (o) {
                      return (
                        <tr key={o.id}>
                          <td>{o.referencia}</td>
                          <td>{o.proveedorNombre}</td>
                          <td>{o.productoNombre}</td>
                          <td>{o.cantidadPedida}</td>
                          <td>{o.cantidadRecibida}</td>
                          <td>{formatearPesos(o.totalCentavos)}</td>
                          <td>{o.estado}</td>
                          <td>
                            <div className="acciones-fila">
                              {o.estado === 'pendiente_aprobacion' && (
                                <button
                                  className="btn btn--primary"
                                  onClick={function () {
                                    aprobarOrdenUI(o.id);
                                  }}
                                >
                                  Aprobar
                                </button>
                              )}
                              {(o.estado === 'aprobada' || o.estado === 'recibida_parcial') && (
                                <button
                                  className="btn btn--warm"
                                  onClick={function () {
                                    recibirSaldoOrdenUI(o.id);
                                  }}
                                >
                                  Recibir ({o.saldoPendiente})
                                </button>
                              )}
                              {(o.estado === 'pendiente_aprobacion' || o.estado === 'aprobada') && (
                                <button
                                  className="btn btn--line"
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
                      );
                    })}
                    {ordenesCompra.length === 0 && (
                      <tr>
                        <td colSpan={8} className="muted" style={{ padding: '12px 16px' }}>
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
                    </tr>
                  </thead>
                  <tbody>
                    {usuariosInternos.map(function (u) {
                      return (
                        <tr key={u.id}>
                          <td>{u.correo}</td>
                          <td>
                            <span className="chip chip--info">{u.rol}</span>
                          </td>
                          <td>{u.zonaId || '-'}</td>
                          <td>{u.emprendedorId || '-'}</td>
                          <td>{u.estado}</td>
                          <td>{u.creadoEn.slice(0, 10)}</td>
                        </tr>
                      );
                    })}
                    {usuariosInternos.length === 0 && (
                      <tr>
                        <td colSpan={6} className="muted" style={{ padding: '12px 16px' }}>
                          Sin datos. Este modulo requiere el rol ADMIN.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
            </>
          )}
          {!esDashboard && !esCompras && !esInventario && !esVentas && !esSeguridad && (
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
