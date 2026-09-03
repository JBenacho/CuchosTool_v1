// Shell F0 (Backlog v6 BL-002/BL-003): patrones IU_CT - header + sidebar oscuro,
// tarjetas KPI, tabla densa y tarjetas de catalogo. Contenido de demostracion.
const kpis = [
  { label: 'Pedidos hoy', value: '128', delta: '+12%', tone: 'ok' },
  { label: 'Ingresos (COP)', value: '$ 8.4M', delta: '+4%', tone: 'ok' },
  { label: 'Disponibilidad', value: '96.8%', delta: '-0.5%', tone: 'warn' },
  { label: 'Casos abiertos', value: '34', delta: 'SLA 98%', tone: 'info' },
] as const;

const orders = [
  { id: 'ORD-10421', client: 'Ana Torres', total: '$ 186.000', state: 'PENDING_PAYMENT', tone: 'warn' },
  { id: 'ORD-10420', client: 'Luis Rojas', total: '$ 92.500', state: 'PAID', tone: 'ok' },
  { id: 'ORD-10419', client: 'Carla Ruiz', total: '$ 41.200', state: 'SHIPPED', tone: 'info' },
  { id: 'ORD-10418', client: 'Pedro Gil', total: '$ 312.700', state: 'DELIVERED', tone: 'ok' },
] as const;

const products = [
  { name: 'Aretes artesanales', empre: 'Bogota Craft', price: '$ 38.000' },
  { name: 'Mochila Wayuu', empre: 'Guajira Tejidos', price: '$ 145.000' },
  { name: 'Cafe organico 500g', empre: 'Cafe del Huila', price: '$ 28.500' },
] as const;

const nav = ['Dashboard', 'Catalogo', 'Pedidos', 'Emprendedores', 'Soporte / Garantias', 'ERP', 'Gerencia', 'Seguridad'] as const;

import './App.css';

function Header(): JSX.Element {
  return (
    <header className="app-header">
      <div className="brand">
        <span className="brand-logo">CT</span>
        <span className="brand-name">CuchosTool</span>
      </div>
      <div className="header-meta">
        <span className="chip chip--ok">Dev F0</span>
        <span className="header-user">Jose</span>
      </div>
    </header>
  );
}

function App(): JSX.Element {
  return (
    <div className="app-shell">
      <Header />
      <div className="app-body">
        <aside className="app-sidebar">
          <nav className="side-nav">
            {nav.map(function (item, i) {
              return <a key={item} className={'side-link' + (i === 0 ? ' is-active' : '')} href={'#' + item.toLowerCase()}>{item}</a>;
            })}
          </nav>
        </aside>
        <main className="app-main">
          <section className="page-head">
            <div>
              <h1>Dashboard</h1>
              <p className="muted">F0 - Fundacion local (Docker + API + UI). Catalogo real: fase F2.</p>
            </div>
            <button className="btn btn--primary">Nuevo pedido</button>
          </section>

          <section className="kpi-grid">
            {kpis.map(function (k) {
              return (
                <article className="kpi-card" key={k.label}>
                  <span className="muted">{k.label}</span>
                  <strong>{k.value}</strong>
                  <span className={'chip chip--' + k.tone}>{k.delta}</span>
                </article>
              );
            })}
          </section>

          <section className="panel">
            <div className="panel-head"><h2>Pedidos recientes</h2></div>
            <table className="table">
              <thead><tr><th>Pedido</th><th>Cliente</th><th>Total</th><th>Estado</th></tr></thead>
              <tbody>
                {orders.map(function (o) {
                  return (
                    <tr key={o.id}>
                      <td>{o.id}</td><td>{o.client}</td><td>{o.total}</td>
                      <td><span className={'chip chip--' + o.tone}>{o.state}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="catalog-grid">
            {products.map(function (p) {
              return (
                <article className="product-card" key={p.name}>
                  <div className="product-thumb">{p.name.charAt(0)}</div>
                  <h3>{p.name}</h3>
                  <span className="muted">{p.empre}</span>
                  <strong>{p.price}</strong>
                </article>
              );
            })}
          </section>

          <footer className="app-footer">
            CuchosTool.com - SRS v5.0 / ARQ v6.0 / Backlog v6.0 - Design System IU_CT
          </footer>
        </main>
      </div>
    </div>
  );
}

export default App;
