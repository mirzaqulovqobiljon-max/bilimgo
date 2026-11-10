import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { loadContent } from './content';
import { createLocalStore } from './engine/storage';
import './styles.css';

const root = createRoot(document.getElementById('root')!);

try {
  const content = loadContent();
  root.render(
    <StrictMode>
      <App content={content} store={createLocalStore()} />
    </StrictMode>,
  );
} catch (e) {
  // Kontent xatosi — o'qituvchi/muallif uchun aniq xabar.
  root.render(
    <pre className="fatal">{e instanceof Error ? e.message : String(e)}</pre>,
  );
}
