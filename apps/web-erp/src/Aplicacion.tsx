// Sitio ERP (F5): login interno y dashboards con datos reales de la API.
import { useEffect, useState } from 'react';
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
  estado: string;
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
  return '$ ' + (centavos / 100).toLocaleString('es-CO');
}

async function peticion(
  ruta: string,
  token: string,
  metodo = 'GET',
  cuerpo?: unknown,
): Promise<Response> {
  return fetch(API + ruta, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
}

function Aplicacion(): JSX.Element {
  const [token, setToken] = useState('');
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [mensaje, setMensaje] = useState('');
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
      setMensaje('No se pudo cargar el resumen');
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

  async function crearProveedorNuevo(): Promise<void> {
    if (!token) return;
    // Guard clause: nit y nombre son obligatorios (CU-ERP-001).
    if (!nitNuevo.trim() || !nombreNuevo.trim()) {
      setMensaje('NIT y nombre son obligatorios');
      return;
    }
    const cuerpo = {
      nit: nitNuevo.trim(),
      nombre: nombreNuevo.trim(),
      contacto: contactoNuevo.trim() || undefined,
      telefono: telefonoNuevo.trim() || undefined,
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
    setNitNuevo('');
    setNombreNuevo('');
    setContactoNuevo('');
    setTelefonoNuevo('');
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
    await cargarResumen(tokenNuevo);
  }

  useEffect(function () {
    if (token) cargarResumen(token);
  }, []);

  useEffect(
    function () {
      if (token && moduloActivo === 'Compras') {
        cargarProveedores(token);
      }
    },
    [moduloActivo, token],
  );

  const esDashboard = moduloActivo === 'Dashboard';
  const esCompras = moduloActivo === 'Compras';

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-logo">CT</span>
          <span className="brand-name">CuchosTool ERP</span>
        </div>
        <div className="header-meta">
          {token ? (
            <span className="chip chip--ok">Sesion activa</span>
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
              <section className="panel">
                <div className="panel-head">
                  <h2>Nuevo proveedor (CU-ERP-001)</h2>
                </div>
                <div className="form-grid">
                  <input
                    className="input"
                    placeholder="NIT"
                    value={nitNuevo}
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
                  <button className="btn btn--primary" onClick={crearProveedorNuevo}>
                    Crear
                  </button>
                </div>
              </section>
              <section className="panel">
                <div className="panel-head">
                  <h2>Proveedores activos</h2>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>NIT</th>
                      <th>Nombre</th>
                      <th>Contacto</th>
                      <th>Telefono</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proveedores.map(function (proveedor) {
                      return (
                        <tr key={proveedor.id}>
                          <td>{proveedor.nit}</td>
                          <td>{proveedor.nombre}</td>
                          <td>{proveedor.contacto || '-'}</td>
                          <td>{proveedor.telefono || '-'}</td>
                          <td>
                            <span className="badge badge--ok">{proveedor.estado}</span>
                          </td>
                          <td>
                            <button
                              className="btn btn--warm"
                              onClick={function () {
                                inactivarProveedorUI(proveedor.id);
                              }}
                            >
                              Inactivar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {proveedores.length === 0 && (
                      <tr>
                        <td colSpan={6} className="muted" style={{ padding: '12px 16px' }}>
                          Sin proveedores registrados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
            </>
          )}
          {!esDashboard && !esCompras && (
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

export default Aplicacion;
