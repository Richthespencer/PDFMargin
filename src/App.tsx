import { useState } from 'react';
import MarginTool from './MarginTool';
import OrganizeTool from './OrganizeTool';

type Mode = 'margin' | 'organize';

export default function App() {
  const [mode, setMode] = useState<Mode>('margin');

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
      {mode === 'margin' ? <MarginTool /> : <OrganizeTool />}
    </div>
  );
}
