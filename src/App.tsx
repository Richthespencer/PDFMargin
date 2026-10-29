import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import MarginTool from './MarginTool';
import OrganizeTool from './OrganizeTool';
import CompressTool from './CompressTool';
import { APP_COPY, LANG_OPTIONS, loadPersistedLang, type Lang } from './i18n';

type Mode = 'margin' | 'organize' | 'compress';
export type Theme = 'light' | 'dark';

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
  const [lang, setLang] = useState<Lang>(loadPersistedLang);
  const [theme, setTheme] = useState<Theme>(loadPersistedTheme);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [loadedByMode, setLoadedByMode] = useState<Record<Mode, boolean>>({
    margin: false,
    organize: false,
    compress: false,
  });

  const langMenuRef = useRef<HTMLDivElement | null>(null);
  const langButtonRef = useRef<HTMLButtonElement | null>(null);

  const hasPdfLoaded = loadedByMode.margin || loadedByMode.organize || loadedByMode.compress;
  const appUi = APP_COPY[lang];
  const currentLangOption = LANG_OPTIONS.find((item) => item.code === lang) ?? LANG_OPTIONS[0];

  const handleMarginLoaded = useCallback((loaded: boolean) => {
    setLoadedByMode((prev) => (prev.margin === loaded ? prev : { ...prev, margin: loaded }));
  }, []);

  const handleOrganizeLoaded = useCallback((loaded: boolean) => {
    setLoadedByMode((prev) => (prev.organize === loaded ? prev : { ...prev, organize: loaded }));
  }, []);

  const handleCompressLoaded = useCallback((loaded: boolean) => {
    setLoadedByMode((prev) => (prev.compress === loaded ? prev : { ...prev, compress: loaded }));
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('pdfmargin-theme', theme);
    } catch {}
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem('pdfmargin-mode', mode);
    } catch {}
  }, [mode]);

  useEffect(() => {
    document.documentElement.lang = currentLangOption.htmlLang;
    document.title = appUi.appTitle;
    try {
      localStorage.setItem('pdfmargin-lang', lang);
    } catch {}
  }, [lang, currentLangOption.htmlLang, appUi.appTitle]);

  useEffect(() => {
    if (!hasPdfLoaded) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = appUi.beforeUnloadConfirm;
      return appUi.beforeUnloadConfirm;
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasPdfLoaded, appUi.beforeUnloadConfirm]);

  useEffect(() => {
    if (!isLangMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setIsLangMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsLangMenuOpen(false);
        langButtonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isLangMenuOpen]);

  function handleSelectLang(nextLang: Lang) {
    setLang(nextLang);
    setIsLangMenuOpen(false);
  }

  function handleToggleTheme() {
    setTheme((current) => (current === 'light' ? 'dark' : 'light'));
  }

  function handleModeSwitch(targetMode: Mode) {
    if (targetMode === mode) return;
    setMode(targetMode);
  }

  const modeItems: Array<{ id: Mode; label: string; icon: ReactNode }> = [
    {
      id: 'margin',
      label: appUi.modes.margin,
      icon: (
        <svg className="mode-icon" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="3" width="16" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <rect x="8" y="7" width="8" height="10" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2 1.6" />
        </svg>
      ),
    },
    {
      id: 'organize',
      label: appUi.modes.organize,
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
      label: appUi.modes.compress,
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

        <nav className="mode-switch" aria-label={appUi.modeSelectorAria}>
          {modeItems.map((item) => {
            const isActive = mode === item.id;
            const isLoadedInBg = !isActive && loadedByMode[item.id];
            return (
              <button
                key={item.id}
                type="button"
                className={`mode-switch-button ${isActive ? 'active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => handleModeSwitch(item.id)}
              >
                {item.icon}
                <span>{item.label}</span>
                {isLoadedInBg ? (
                  <span className="mode-loaded-dot" title={appUi.loadedBadgeTitle} aria-label={appUi.loadedBadgeTitle} />
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="topbar-actions">
          <div className="lang-menu-wrap" ref={langMenuRef}>
            <button
              ref={langButtonRef}
              type="button"
              className={`lang-toggle ${isLangMenuOpen ? 'is-open' : ''}`}
              onClick={() => setIsLangMenuOpen((open) => !open)}
              aria-haspopup="listbox"
              aria-expanded={isLangMenuOpen}
              aria-label={appUi.langMenuAria}
              title={appUi.langMenuAria}
            >
              <svg className="theme-icon" viewBox="0 0 24 24" aria-hidden="true">
                <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                  <circle cx="12" cy="12" r="8.5" />
                  <path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.2 3.5 8.5s-1.1 6.1-3.5 8.5M12 3.5C9.6 5.9 8.5 8.7 8.5 12s1.1 6.1 3.5 8.5" />
                </g>
              </svg>
              <span>{currentLangOption.label}</span>
              <svg className="lang-chevron" viewBox="0 0 24 24" aria-hidden="true">
                <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {isLangMenuOpen ? (
              <div className="lang-dropdown" role="listbox" aria-label={appUi.langMenuAria}>
                {LANG_OPTIONS.map((option) => {
                  const isSelected = option.code === lang;
                  return (
                    <button
                      key={option.code}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      data-lang={option.code}
                      className={`lang-option ${isSelected ? 'active' : ''}`}
                      onClick={() => handleSelectLang(option.code)}
                    >
                      <span>{option.label}</span>
                      {isSelected ? (
                        <svg className="lang-check" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            className="theme-toggle"
            onClick={handleToggleTheme}
            aria-label={theme === 'light' ? appUi.switchToDark : appUi.switchToLight}
            title={theme === 'light' ? appUi.switchToDark : appUi.switchToLight}
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

      <div className="tool-pane" hidden={mode !== 'margin'} aria-hidden={mode !== 'margin'}>
        <MarginTool lang={lang} theme={theme} onPdfLoadedChange={handleMarginLoaded} />
      </div>
      <div className="tool-pane" hidden={mode !== 'organize'} aria-hidden={mode !== 'organize'}>
        <OrganizeTool lang={lang} onPdfLoadedChange={handleOrganizeLoaded} />
      </div>
      <div className="tool-pane" hidden={mode !== 'compress'} aria-hidden={mode !== 'compress'}>
        <CompressTool lang={lang} onPdfLoadedChange={handleCompressLoaded} />
      </div>

      <footer className="app-footer">
        <span>© 2026 PDFMargin. All rights reserved.</span>
        <a href="https://github.com/Richthespencer/PDFMargin" target="_blank" rel="noreferrer">
          GitHub
        </a>
      </footer>
    </div>
  );
}
