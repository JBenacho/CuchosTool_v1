// Shell CuchosTool: patrones IU_CT (header + sidebar oscuro, KPI, tabla, catalogo).
// F2: catalogo publico conectado a la API (/api/catalog/products).
import { useEffect, useState } from 'react';
import './App.css';

type Product = { id: number; name: string; price: string; category?: string | null };

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

const fallbackProducts: Product[] = [
  { id: 0, name: 'Cargando catalogo...', price: '', category: 'sin conexion a la API' },
];

const nav = ['Dashboard', 'Catalogo', 'Pedidos', 'Emprendedores', 'Soporte / Garantias', 'ERP', 'Gerencia', 'Seguridad'] as const;

function Header(): JSX.Element {
  return (
    <header className="app-header">
      <div className="brand">
        <span className="brand-logo">CT</span>
        <span className="brand-name">CuchosTool</span>
      </div>
      <div className="header-meta">
        <span className="chip chip--ok">Dev F2</span>
        <span className="header-user">Jose</span>
      </div>
    </header>
  );
}

function App(): JSX.Element {
  const [products, setProducts] = useState<Product[]>(fallbackProducts);
  const [catalogError, setCatalogError] = useState(false);

  useEffect(function () {
    let active = true;
    fetch('/api/catalog/products')
      .then(function (r) { if (!r.ok) throw new Error('bad status'); return r.json(); })
      .then(function (json) {
        if (active && json && Array.isArray(json.data)) setProducts(json.data);
      })
      .catch(function () { if (active) setCatalogError(true); });
    return function () { active = false; };
  }, []);

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
              <h1>Catalogo</h1>
              <p className="muted">F2 - Catalogo publico desde la API (Docker + Postgres).</p>
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

          <section className="catalog-grid">
            {products.map(function (p) {
              return (
                <article className="product-card" key={p.id}>
                  <div className="product-thumb">{p.name.charAt(0)}</div>
                  <h3>{p.name}</h3>
                  <span className="muted">{p.category || 'CuchosTool'}</span>
                  <strong>{p.price}</strong>
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

          {catalogError && <p className="muted">No se pudo conectar con la API (/api/catalog/products).</p>}

          <footer className="app-footer">
            CuchosTool.com - SRS v5.0 / ARQ v6.0 / Backlog v6.0 - Design System IU_CT
          </footer>
        </main>
      </div>
    </div>
  );
}

export default App;
