import { app, BrowserWindow, ipcMain, powerMonitor, screen } from 'electron';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { AppState, BuildItem, FocusRuntimeState, FocusSession, OverlayState } from '../shared/types';
import { loadState, saveState } from './store';

const IS_DEV = Boolean(process.env.VITE_DEV_SERVER_URL);
const OVERLAY_START_IDLE_SECONDS = 10;
const FAIL_IDLE_SECONDS = 25;

let mainWindow: BrowserWindow | null = null;
const overlayWindows = new Map<number, BrowserWindow>();
let appState: AppState;
let idleTicker: NodeJS.Timeout | null = null;
let focusTicker: NodeJS.Timeout | null = null;

let runtimeState: FocusRuntimeState = {
  running: false,
  remainingSeconds: 0,
  plannedMinutes: 20,
  pointsAtStake: 20,
  currentBuildTarget: null
};

let activeSession: FocusSession | null = null;

const getRendererUrl = (entry: 'main' | 'overlay'): string => {
  if (IS_DEV) {
    return entry === 'main'
      ? `${process.env.VITE_DEV_SERVER_URL}/index.html`
      : `${process.env.VITE_DEV_SERVER_URL}/overlay.html`;
  }

  const base = join(__dirname, '../../renderer');
  return `file://${join(base, entry === 'main' ? 'index.html' : 'overlay.html')}`;
};

const createMainWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 740,
    minWidth: 900,
    minHeight: 640,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadURL(getRendererUrl('main'));
};

const createOverlayWindow = (displayId: number) => {
  const display = screen.getAllDisplays().find((d) => d.id === displayId);
  if (!display) return;

  const overlay = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    movable: false,
    resizable: false,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  overlay.setIgnoreMouseEvents(true, { forward: true });
  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.loadURL(getRendererUrl('overlay'));
  overlayWindows.set(display.id, overlay);
};

const syncOverlayWindows = () => {
  const displays = screen.getAllDisplays();
  const ids = new Set(displays.map((d) => d.id));

  for (const [id, win] of overlayWindows.entries()) {
    if (!ids.has(id)) {
      win.close();
      overlayWindows.delete(id);
    }
  }

  for (const display of displays) {
    const existing = overlayWindows.get(display.id);
    if (!existing) {
      createOverlayWindow(display.id);
    } else {
      existing.setBounds(display.bounds);
    }
  }
};

const broadcast = (channel: string, payload: unknown) => {
  mainWindow?.webContents.send(channel, payload);
  for (const overlay of overlayWindows.values()) {
    overlay.webContents.send(channel, payload);
  }
};

const overlayFromIdle = (idleSeconds: number): OverlayState => {
  if (!runtimeState.running) return { active: false, progress: 0 };
  if (idleSeconds <= OVERLAY_START_IDLE_SECONDS) return { active: false, progress: 0 };

  const progress = Math.min(
    1,
    (idleSeconds - OVERLAY_START_IDLE_SECONDS) / (FAIL_IDLE_SECONDS - OVERLAY_START_IDLE_SECONDS)
  );

  return { active: true, progress };
};

const updateRuntimeState = (patch: Partial<FocusRuntimeState>) => {
  runtimeState = { ...runtimeState, ...patch };
  broadcast('runtime-state', runtimeState);
};

const failSession = () => {
  if (!activeSession) return;

  activeSession.status = 'failed';
  activeSession.pointsAwarded = 0;
  activeSession.failReason = 'Idle';

  appState.sessions.unshift(activeSession);
  saveState(appState);

  activeSession = null;
  if (focusTicker) clearInterval(focusTicker);
  focusTicker = null;

  updateRuntimeState({ running: false, remainingSeconds: 0 });
  broadcast('overlay-state', { active: false, progress: 0 } satisfies OverlayState);
  broadcast('state-updated', appState);
};

const completeSession = () => {
  if (!activeSession) return;

  activeSession.status = 'success';
  activeSession.pointsAwarded = activeSession.plannedMinutes;

  appState.points += activeSession.pointsAwarded;
  appState.sessions.unshift(activeSession);
  saveState(appState);

  activeSession = null;
  if (focusTicker) clearInterval(focusTicker);
  focusTicker = null;

  updateRuntimeState({ running: false, remainingSeconds: 0 });
  broadcast('overlay-state', { active: false, progress: 0 } satisfies OverlayState);
  broadcast('state-updated', appState);
};

const startSession = (minutes: number) => {
  if (runtimeState.running) return;

  const now = new Date().toISOString();
  activeSession = {
    id: randomUUID(),
    startedAt: now,
    plannedMinutes: minutes,
    status: 'running',
    pointsAwarded: 0
  };

  updateRuntimeState({
    running: true,
    plannedMinutes: minutes,
    remainingSeconds: minutes * 60,
    pointsAtStake: minutes
  });

  focusTicker = setInterval(() => {
    if (!runtimeState.running) return;

    if (runtimeState.remainingSeconds <= 1) {
      completeSession();
      return;
    }

    updateRuntimeState({ remainingSeconds: runtimeState.remainingSeconds - 1 });
  }, 1000);
};

const stopSession = () => {
  if (!runtimeState.running || !activeSession) return;

  activeSession.status = 'stopped';
  appState.sessions.unshift(activeSession);
  saveState(appState);

  activeSession = null;
  if (focusTicker) clearInterval(focusTicker);
  focusTicker = null;

  updateRuntimeState({ running: false, remainingSeconds: 0 });
  broadcast('overlay-state', { active: false, progress: 0 } satisfies OverlayState);
  broadcast('state-updated', appState);
};

const createDefaultBuildOptions = (): BuildItem[] => [
  { id: 'house-1', name: 'Tiny House', cost: 10, color: '#7A9E9F', direction: 'N' },
  { id: 'farm-1', name: 'Garden Patch', cost: 12, color: '#95B46A', direction: 'E' },
  { id: 'shop-1', name: 'Corner Shop', cost: 20, color: '#C78D5C', direction: 'S' }
];

const bootstrap = async () => {
  appState = loadState();
  if (appState.builds.length === 0) {
    appState.builds = createDefaultBuildOptions();
    saveState(appState);
  }

  createMainWindow();
  syncOverlayWindows();

  screen.on('display-added', syncOverlayWindows);
  screen.on('display-removed', syncOverlayWindows);
  screen.on('display-metrics-changed', syncOverlayWindows);

  idleTicker = setInterval(() => {
    const idleSeconds = powerMonitor.getSystemIdleTime();
    const overlay = overlayFromIdle(idleSeconds);
    broadcast('overlay-state', overlay);

    if (runtimeState.running && idleSeconds >= FAIL_IDLE_SECONDS) {
      failSession();
    }
  }, 200);

  ipcMain.handle('get-app-state', () => appState);
  ipcMain.handle('get-runtime-state', () => runtimeState);
  ipcMain.handle('start-session', (_, minutes: number) => startSession(minutes));
  ipcMain.handle('stop-session', () => stopSession());
  ipcMain.handle('spend-points', (_, buildId: string) => {
    const item = appState.builds.find((b) => b.id === buildId);
    if (!item || appState.points < item.cost) return appState;

    appState.points -= item.cost;
    saveState(appState);
    broadcast('state-updated', appState);
    return appState;
  });
};

app.whenReady().then(bootstrap);

app.on('window-all-closed', () => {
  if (idleTicker) clearInterval(idleTicker);
  if (focusTicker) clearInterval(focusTicker);
  if (process.platform !== 'darwin') app.quit();
});
