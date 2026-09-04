import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Aplicacion from './Aplicacion';
import '@cuchostool/tokens-diseno/tokens.css';
import '@cuchostool/tokens-diseno/global.css';

const contenedor = document.getElementById('root');
if (contenedor) {
  createRoot(contenedor).render(
    <StrictMode>
      <Aplicacion />
    </StrictMode>
  );
}
