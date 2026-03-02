import { contextBridge, ipcRenderer } from 'electron';
import { AppState, FocusRuntimeState, OverlayState } from '../shared/types';

contextBridge.exposeInMainWorld('focusFoundry', {
  getAppState: () => ipcRenderer.invoke('get-app-state') as Promise<AppState>,
  getRuntimeState: () => ipcRenderer.invoke('get-runtime-state') as Promise<FocusRuntimeState>,
  startSession: (minutes: number) => ipcRenderer.invoke('start-session', minutes),
  stopSession: () => ipcRenderer.invoke('stop-session'),
  spendPoints: (buildId: string) => ipcRenderer.invoke('spend-points', buildId) as Promise<AppState>,
  onOverlayState: (cb: (state: OverlayState) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: OverlayState) => cb(payload);
    ipcRenderer.on('overlay-state', handler);
    return () => ipcRenderer.removeListener('overlay-state', handler);
  },
  onRuntimeState: (cb: (state: FocusRuntimeState) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: FocusRuntimeState) => cb(payload);
    ipcRenderer.on('runtime-state', handler);
    return () => ipcRenderer.removeListener('runtime-state', handler);
  },
  onStateUpdated: (cb: (state: AppState) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: AppState) => cb(payload);
    ipcRenderer.on('state-updated', handler);
    return () => ipcRenderer.removeListener('state-updated', handler);
  }
});
