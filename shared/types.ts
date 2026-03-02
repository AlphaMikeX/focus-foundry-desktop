export type FailReason = 'Idle';

export interface FocusSession {
  id: string;
  startedAt: string;
  plannedMinutes: number;
  status: 'running' | 'success' | 'failed' | 'stopped';
  pointsAwarded: number;
  failReason?: FailReason;
  failProcessName?: string;
}

export interface BuildItem {
  id: string;
  name: string;
  cost: number;
  color: string;
  direction: 'N' | 'E' | 'S' | 'W';
}

export interface AppState {
  points: number;
  sessions: FocusSession[];
  builds: BuildItem[];
  settings: {
    captureFailProcessName: boolean;
  };
}

export interface OverlayState {
  active: boolean;
  progress: number;
}

export interface FocusRuntimeState {
  running: boolean;
  remainingSeconds: number;
  plannedMinutes: number;
  pointsAtStake: number;
  currentBuildTarget: BuildItem | null;
}
