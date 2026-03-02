import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppState } from '../shared/types';

const defaultState: AppState = {
  points: 0,
  sessions: [],
  builds: [],
  settings: {
    captureFailProcessName: false
  }
};

const dataDir = join(app.getPath('userData'), 'data');
const statePath = join(dataDir, 'state.json');

export const loadState = (): AppState => {
  if (!existsSync(statePath)) {
    return defaultState;
  }

  try {
    const data = readFileSync(statePath, 'utf8');
    return { ...defaultState, ...JSON.parse(data) } as AppState;
  } catch {
    return defaultState;
  }
};

export const saveState = (state: AppState): void => {
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
};
