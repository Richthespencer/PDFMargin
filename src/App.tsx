import { useEffect, useState, type ReactNode } from 'react';
import MarginTool, { type Lang } from './MarginTool';
import OrganizeTool from './OrganizeTool';
import CompressTool from './CompressTool';

type Mode = 'margin' | 'organize' | 'compress';
export type Theme = 'light' | 'dark';

function detectBrowserLang(): Lang {
  const lang = navigator.language || (navigator as { userLanguage?: string }).userLanguage || '';
  return lang.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

function loadPersistedMode(): Mode {
  try {
    const saved = localStorage.getItem('pdfmargin-mode');
    if (saved === 'margin' || saved === 'organize' || saved === 'compress') {
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

  const modeItems: Array<{ id: Mode; label: Record<Lang, string>; icon: ReactNode }> = [
    {
      id: 'margin',
      label: { zh: '边距', en: 'Margin' },
      icon: (
        <svg className="mode-icon" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="3" width="16" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <rect x="8" y="7" width="8" height="10" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2 1.6" />
        </svg>
      ),
    },
    {
      id: 'organize',
      label: { zh: '整理', en: 'Organize' },
      icon: (
        <svg className="mode-icon" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.35" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      ),
    },
    {
      id: 'compress',
      label: { zh: '压缩', en: 'Compress' },
      icon: (
        <svg className="mode-icon" viewBox="0 0 24 24" aria-hidden="true">
          <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v6M9 6.5 12 9l3-2.5" />
            <path d="M12 21v-6M9 17.5 12 15l3 2.5" />
            <path d="M4 12h16" />
          </g>
        </svg>
      ),
    },
  ];

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M6 2.5h8.5L19 7v13.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-17a1 1 0 0 1 1-1z" fill="currentColor" opacity="0.18" />
              <path d="M6 2.5h8.5L19 7v13.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-17a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              <path d="M8.5 9.5h7M8.5 13h7M8.5 16.5h4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </span>
          <span className="brand-name">PDFMargin</span>
        </div>

        <nav className="mode-switch" aria-label="Feature mode selector">
          {modeItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`mode-switch-button ${mode === item.id ? 'active' : ''}`}
              aria-current={mode === item.id ? 'page' : undefined}
              onClick={() => handleModeSwitch(item.id)}
            >
              {item.icon}
              <span>{item.label[lang]}</span>
            </button>
          ))}
        </nav>

        <div className="topbar-actions">
          <button
            type="button"
            className="lang-toggle"
            onClick={handleToggleLang}
            aria-label={lang === 'zh' ? 'Switch to English' : '切换到中文'}
            title={lang === 'zh' ? 'Switch to English' : '切换到中文'}
          >
            <svg className="theme-icon" viewBox="0 0 24 24" aria-hidden="true">
              <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                <circle cx="12" cy="12" r="8.5" />
                <path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.2 3.5 8.5s-1.1 6.1-3.5 8.5M12 3.5C9.6 5.9 8.5 8.7 8.5 12s1.1 6.1 3.5 8.5" />
              </g>
            </svg>
            <span>{lang === 'zh' ? 'EN' : '中文'}</span>
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
        </div>
      </header>
      {mode === 'margin' ? (
        <MarginTool lang={lang} theme={theme} onPdfLoadedChange={setHasPdfLoaded} />
      ) : mode === 'organize' ? (
        <OrganizeTool lang={lang} onPdfLoadedChange={setHasPdfLoaded} />
      ) : (
        <CompressTool lang={lang} onPdfLoadedChange={setHasPdfLoaded} />
      )}
      <footer className="app-footer">
        <span>© 2026 PDFMargin. All rights reserved.</span>
        <a href="https://github.com/Richthespencer/PDFMargin" target="_blank" rel="noreferrer">
          GitHub
        </a>
      </footer>
    </div>
  );
}
