import { useState } from 'react';
import MarginTool, { type Lang } from './MarginTool';
import OrganizeTool from './OrganizeTool';

type Mode = 'margin' | 'organize';

export default function App() {
  const [mode, setMode] = useState<Mode>('margin');
  const [lang, setLang] = useState<Lang>('zh');

  function handleToggleLang() {
    setLang((current) => (current === 'zh' ? 'en' : 'zh'));
  }

  return (
    <div className="app-shell">
      <nav className="mode-switch" aria-label="Feature mode selector">
        <button
          type="button"
          className={`mode-switch-button ${mode === 'margin' ? 'active' : ''}`}
          onClick={() => setMode('margin')}
        >
          Margin
        </button>
        <button
          type="button"
          className={`mode-switch-button ${mode === 'organize' ? 'active' : ''}`}
          onClick={() => setMode('organize')}
        >
          Organize
        </button>
      </nav>
      {mode === 'margin'
        ? <MarginTool lang={lang} onToggleLang={handleToggleLang} />
        : <OrganizeTool lang={lang} onToggleLang={handleToggleLang} />}
    </div>
  );
}
