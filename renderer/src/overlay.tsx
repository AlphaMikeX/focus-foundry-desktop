import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { OverlayState } from '../../shared/types';
import './overlay.css';

const OverlayApp = () => {
  const [state, setState] = useState<OverlayState>({ active: false, progress: 0 });

  useEffect(() => {
    return window.focusFoundry.onOverlayState(setState);
  }, []);

  return (
    <div
      className={`vignette ${state.active ? 'active' : ''}`}
      style={{ '--progress': state.progress } as React.CSSProperties}
    />
  );
};

createRoot(document.getElementById('overlay-root')!).render(<OverlayApp />);
