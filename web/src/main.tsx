import { render } from 'preact';
import '@fontsource/poppins/latin-400.css';
import '@fontsource/poppins/latin-500.css';
import '@fontsource/poppins/latin-600.css';
import '@fontsource/poppins/latin-700.css';
import '@fontsource/poppins/latin-ext-400.css';
import '@fontsource/poppins/latin-ext-600.css';
import './estilo.css';
import { App } from './App';

render(<App />, document.getElementById('app')!);

// App instalável e que abre sem internet (só em produção; no "npm run dev" atrapalharia).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
