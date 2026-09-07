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

  const esDashboard = moduloActivo === 'Dashboard';

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
              <p className="muted">Dev: admin@cuchostool.com / admin1234</p>
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
          {!esDashboard && (
            <section className="panel">
              <div className="panel-head">
                <h2>{moduloActivo}</h2>
              </div>
              <p className="muted" style={{ padding: '12px 16px' }}>
                Modulo de la fase F5 (ERP) en desarrollo sobre la API modular; el Dashboard ya
                consume datos reales.
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
