import { useEffect, useState } from 'react';
import MarginTool, { type Lang } from './MarginTool';
import OrganizeTool from './OrganizeTool';

type Mode = 'margin' | 'organize';
export type Theme = 'light' | 'dark';

function detectBrowserLang(): Lang {
  const lang = navigator.language || (navigator as { userLanguage?: string }).userLanguage || '';
  return lang.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

function loadPersistedMode(): Mode {
  try {
    const saved = localStorage.getItem('pdfmargin-mode');
    if (saved === 'margin' || saved === 'organize') {
      return saved;
    }
  } catch {}
  return 'margin';
}

function loadPersistedTheme(): Theme {
  try {
    const saved = localStorage.getItem('pdfmargin-theme');
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
  } catch {}
  return 'light';
}

export default function App() {
  const [mode, setMode] = useState<Mode>(loadPersistedMode);
  const [lang, setLang] = useState<Lang>(detectBrowserLang);
  const [theme, setTheme] = useState<Theme>(loadPersistedTheme);
  const [hasPdfLoaded, setHasPdfLoaded] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('pdfmargin-theme', theme); } catch {}
  }, [theme]);

  useEffect(() => {
    try { localStorage.setItem('pdfmargin-mode', mode); } catch {}
  }, [mode]);

  useEffect(() => {
    const confirmMsg: Record<Lang, string> = {
      zh: '页面即将刷新，未保存的操作将会丢失。确定要刷新吗？',
      en: 'The page will refresh and unsaved changes will be lost. Continue?',
    };
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = confirmMsg[lang];
      return confirmMsg[lang];
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [lang]);

  function handleToggleLang() {
    setLang((current) => (current === 'zh' ? 'en' : 'zh'));
  }

  function handleToggleTheme() {
    setTheme((current) => (current === 'light' ? 'dark' : 'light'));
  }

  function handleModeSwitch(targetMode: Mode) {
    if (targetMode === mode) return;
    if (hasPdfLoaded) {
      const confirmMsg: Record<Lang, string> = {
        zh: '当前已加载 PDF 文件，切换功能后将丢失当前操作。确定要切换吗？',
        en: 'A PDF is currently loaded. Switching modes will lose your current work. Continue?',
      };
      if (!window.confirm(confirmMsg[lang])) return;
    }
    setMode(targetMode);
  }

  return (
    <div className="app-shell">
      <nav className="mode-switch" aria-label="Feature mode selector">
        <button
          type="button"
          className={`mode-switch-button ${mode === 'margin' ? 'active' : ''}`}
          onClick={() => handleModeSwitch('margin')}
        >
          Margin
        </button>
        <button
          type="button"
          className={`mode-switch-button ${mode === 'organize' ? 'active' : ''}`}
          onClick={() => handleModeSwitch('organize')}
        >
          Organize
        </button>
        <button
          type="button"
          className="theme-toggle"
          onClick={handleToggleTheme}
          aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {theme === 'light' ? (
            <svg className="theme-icon" viewBox="0 0 24 24" role="img" aria-hidden="true">
              <path
                d="M21 12.8A9 9 0 1 1 11.2 3a1 1 0 0 1 1.1 1.4 7 7 0 0 0 7.3 9.4 1 1 0 0 1 1.4 1z"
                fill="currentColor"
              />
            </svg>
          ) : (
            <svg className="theme-icon" viewBox="0 0 24 24" role="img" aria-hidden="true">
              <circle cx="12" cy="12" r="4.4" fill="currentColor" />
              <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <line x1="12" y1="2.8" x2="12" y2="5.2" />
                <line x1="12" y1="18.8" x2="12" y2="21.2" />
                <line x1="2.8" y1="12" x2="5.2" y2="12" />
                <line x1="18.8" y1="12" x2="21.2" y2="12" />
                <line x1="5.3" y1="5.3" x2="7" y2="7" />
                <line x1="17" y1="17" x2="18.7" y2="18.7" />
                <line x1="17" y1="7" x2="18.7" y2="5.3" />
                <line x1="5.3" y1="18.7" x2="7" y2="17" />
              </g>
            </svg>
          )}
        </button>
      </nav>
      {mode === 'margin'
        ? <MarginTool lang={lang} onToggleLang={handleToggleLang} theme={theme} onPdfLoadedChange={setHasPdfLoaded} />
        : <OrganizeTool lang={lang} onToggleLang={handleToggleLang} onPdfLoadedChange={setHasPdfLoaded} />}
      <footer className="app-footer">
        <span>© 2026 PDFMargin. All rights reserved.</span>
        <a href="https://github.com/Richthespencer/PDFMargin" target="_blank" rel="noreferrer">
          GitHub
        </a>
      </footer>
    </div>
  );
}
