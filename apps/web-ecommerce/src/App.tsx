// Storefront E-Commerce (F4): catalogo publico, login de cliente, carrito y checkout
// conectado a /carrito y /pagos (design system IU_CT).
import { useEffect, useState } from 'react';
import './App.css';

const API = '/api';

interface Producto {
  id: number;
  nombre: string;
  precio: string;
  categoria?: string | null;
}

interface ArticuloCarrito {
  productoId: number;
  cantidad: number;
  nombre: string;
  precioCentavos: number;
}

interface Carrito {
  articulos: ArticuloCarrito[];
  totalCentavos: number;
}

/**
 * Peticion a la API con JSON y token opcional (Bearer).
 */
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

function App(): JSX.Element {
  const [token, setToken] = useState('');
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [productos, setProductos] = useState<Producto[]>([]);
  const [carrito, setCarrito] = useState<Carrito>({ articulos: [], totalCentavos: 0 });
  const [referenciaPago, setReferenciaPago] = useState('');
  const [urlPago, setUrlPago] = useState('');
  const [confirmacion, setConfirmacion] = useState('');

  async function cargarCatalogo(): Promise<void> {
    const respuesta = await peticion('/catalogo/productos', token);
    if (respuesta.ok) {
      const json = await respuesta.json();
      setProductos(json.data || []);
    }
  }

  async function cargarCarrito(tokenActivo: string): Promise<void> {
    if (!tokenActivo) return;
    const respuesta = await peticion('/carrito', tokenActivo);
    if (respuesta.ok) {
      const json = await respuesta.json();
      setCarrito(json.data || { articulos: [], totalCentavos: 0 });
    }
  }

  async function ingresar(): Promise<void> {
    setMensaje('');
    const respuesta = await peticion('/autenticacion/ingreso', '', 'POST', {
      correo: correo,
      contrasena: contrasena,
    });
    if (!respuesta.ok) {
      setMensaje('Credenciales invalidas');
      return;
    }
    const json = await respuesta.json();
    setToken(json.data.token);
    await cargarCarrito(json.data.token);
  }

  async function agregarAlCarrito(productoId: number): Promise<void> {
    if (!token) {
      setMensaje('Inicia sesion para comprar');
      return;
    }
    const respuesta = await peticion('/carrito/articulos', token, 'POST', {
      productoId: productoId,
      cantidad: 1,
    });
    if (respuesta.ok) {
      const json = await respuesta.json();
      setCarrito(json.data);
    } else {
      setMensaje('No se pudo agregar al carrito');
    }
  }

  async function pagarCarrito(): Promise<void> {
    setMensaje('');
    const respuestaPedido = await peticion('/carrito/pagar', token, 'POST', {});
    if (!respuestaPedido.ok) {
      setMensaje('No se pudo crear el pedido');
      return;
    }
    const pedido = (await respuestaPedido.json()).data as {
      referenciaPedido: string;
      totalCentavos: number;
    };
    const respuestaPago = await peticion('/pagos/iniciar', token, 'POST', {
      referenciaPedido: pedido.referenciaPedido,
    });
    if (!respuestaPago.ok) {
      setMensaje('No se pudo iniciar el pago');
      return;
    }
    const pago = (await respuestaPago.json()).data as {
      referenciaPago: string;
      urlPagoSimulada?: string;
    };
    setReferenciaPago(pago.referenciaPago);
    setUrlPago(pago.urlPagoSimulada || '');
    setConfirmacion(
      'Pedido ' + pedido.referenciaPedido + ' - ' + formatearPesos(pedido.totalCentavos),
    );
  }

  async function simularPago(): Promise<void> {
    const respuesta = await peticion(urlPago, token, 'POST', {});
    if (respuesta.ok) {
      const json = await respuesta.json();
      setConfirmacion('Pago ' + json.data.estado + ' - ' + confirmacion);
      setUrlPago('');
      await cargarCarrito(token);
    } else {
      setMensaje('El pago simulado fallo');
    }
  }

  useEffect(function () {
    cargarCatalogo();
  }, []);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-logo">CT</span>
          <span className="brand-name">CuchosTool E-Commerce</span>
        </div>
        <div className="header-meta">
          {token ? (
            <span className="chip chip--ok">Sesion activa</span>
          ) : (
            <span className="chip chip--info">Visitante</span>
          )}
        </div>
      </header>
      <div className="app-body">
        <aside className="app-sidebar">
          <h2>Ingresar</h2>
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
          <p className="muted">Dev: f3@example.com / secreto123</p>
          {mensaje && <p className="muted">{mensaje}</p>}
          <h2 className="mt">Carrito</h2>
          {carrito.articulos.length === 0 && <p className="muted">Vacio</p>}
          {carrito.articulos.map(function (a) {
            return (
              <p className="muted" key={a.productoId}>
                {a.nombre} x{a.cantidad}
              </p>
            );
          })}
          <p className="cart-total">Total: {formatearPesos(carrito.totalCentavos)}</p>
          <button
            className="btn btn--primary"
            disabled={carrito.articulos.length === 0 || !token}
            onClick={pagarCarrito}
          >
            Pagar
          </button>
          {urlPago && (
            <button className="btn btn--warm mt" onClick={simularPago}>
              Simular pago ({referenciaPago})
            </button>
          )}
          {confirmacion && <p className="muted">{confirmacion}</p>}
        </aside>
        <main className="app-main">
          <section className="page-head">
            <div>
              <h1>Catalogo</h1>
              <p className="muted">Productos avalados (CU-EC-001..006, CU-EM-012)</p>
            </div>
          </section>
          <section className="catalog-grid">
            {productos.map(function (p) {
              return (
                <article className="product-card" key={p.id}>
                  <div className="product-thumb">{p.nombre.charAt(0)}</div>
                  <h3>{p.nombre}</h3>
                  <span className="muted">{p.categoria || 'CuchosTool'}</span>
                  <strong>{p.precio}</strong>
                  <button
                    className="btn btn--primary"
                    onClick={function () {
                      agregarAlCarrito(p.id);
                    }}
                  >
                    Agregar
                  </button>
                </article>
              );
            })}
          </section>
          <footer className="app-footer">CuchosTool.com - E-Commerce - Design System IU_CT</footer>
        </main>
      </div>
    </div>
  );
}

export default App;
