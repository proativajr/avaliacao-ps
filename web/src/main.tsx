import { render } from 'preact';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import './estilo.css';
import { App } from './App';

render(<App />, document.getElementById('app')!);

// App instalável e que abre sem internet (só em produção; no "npm run dev" atrapalharia).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
