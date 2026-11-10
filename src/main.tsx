import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { loadContent } from './content';
import type { ContentBundle } from './content/validate';
import { createLocalStore } from './engine/storage';
import { ApiClient } from './net/api';
import { TeacherApp } from './teacher/TeacherApp';
import './styles.css';

// PWA: oflayn ishlash uchun service worker. Ba'zi muhitlarda (iframe/sandbox) taqiqlangan — jim o'tkazib yuboramiz.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    try {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    } catch {
      /* ignore */
    }
  });
}

const root = createRoot(document.getElementById('root')!);
const api = new ApiClient();
const store = createLocalStore();

/** #oqituvchi — o'qituvchi paneli; qolgan hamma narsa — o'yin. */
function Root({ content }: { content: ContentBundle }) {
  const [hash, setHash] = useState(() => location.hash);
  useEffect(() => {
    const on = () => setHash(location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash === '#oqituvchi' ? <TeacherApp content={content} api={api} /> : <App content={content} store={store} api={api} />;
}

try {
  const content = loadContent();
  root.render(
    <StrictMode>
      <Root content={content} />
    </StrictMode>,
  );
} catch (e) {
  // Kontent xatosi — o'qituvchi/muallif uchun aniq xabar.
  root.render(<pre className="fatal">{e instanceof Error ? e.message : String(e)}</pre>);
}
