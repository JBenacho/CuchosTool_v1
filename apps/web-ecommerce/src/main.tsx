import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@cuchostool/tokens-diseno/tokens.css';
import '@cuchostool/tokens-diseno/global.css';

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
