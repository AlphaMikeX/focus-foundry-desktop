/// <reference types="vite/client" />

import { AppState, FocusRuntimeState, OverlayState } from '../../shared/types';

declare global {
  interface Window {
    focusFoundry: {
      getAppState: () => Promise<AppState>;
      getRuntimeState: () => Promise<FocusRuntimeState>;
      startSession: (minutes: number) => Promise<void>;
      stopSession: () => Promise<void>;
      spendPoints: (buildId: string) => Promise<AppState>;
      onOverlayState: (cb: (state: OverlayState) => void) => () => void;
      onRuntimeState: (cb: (state: FocusRuntimeState) => void) => () => void;
      onStateUpdated: (cb: (state: AppState) => void) => () => void;
    };
  }
}

export {};
