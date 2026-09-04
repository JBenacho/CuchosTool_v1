// Shell del sitio ERP (fase F5 del backlog). Consume el design system IU_CT compartido.
import './Aplicacion.css';

const modulosErp = [
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

function Aplicacion(): JSX.Element {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-logo">CT</span>
          <span className="brand-name">CuchosTool ERP</span>
        </div>
        <div className="header-meta">
          <span className="chip chip--info">Sitio administrativo</span>
        </div>
      </header>
      <div className="app-body">
        <aside className="app-sidebar">
          <nav className="side-nav">
            {modulosErp.map(function (modulo, indice) {
              return (
                <a
                  key={modulo}
                  className={'side-link' + (indice === 0 ? ' is-active' : '')}
                  href={'#' + modulo.toLowerCase()}
                >
                  {modulo}
                </a>
              );
            })}
          </nav>
        </aside>
        <main className="app-main">
          <section className="page-head">
            <div>
              <h1>Dashboard</h1>
              <p className="muted">
                Sitio ERP (dominio independiente). Modulos del backlog F5 (CU-ERP/CU-GE/CU-SEC).
              </p>
            </div>
            <button className="btn btn--primary">Nueva orden de compra</button>
          </section>
          <section className="panel">
            <div className="panel-head">
              <h2>Proximamente</h2>
            </div>
            <p className="muted" style={{ padding: '12px 16px' }}>
              El ciclo E-Commerce (F2) ya funciona en apps/web-ecommerce; este sitio se completa en
              F5.
            </p>
          </section>
          <footer className="app-footer">CuchosTool.com - ERP - Design System IU_CT</footer>
        </main>
      </div>
    </div>
  );
}

export default Aplicacion;
