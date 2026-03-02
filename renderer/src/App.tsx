import { useEffect, useMemo, useState } from 'react';
import { AppState, FocusRuntimeState } from '../../shared/types';

const sessionOptions = [20, 30, 45];

const initialRuntime: FocusRuntimeState = {
  running: false,
  remainingSeconds: 0,
  plannedMinutes: 20,
  pointsAtStake: 20,
  currentBuildTarget: null
};

const emptyState: AppState = {
  points: 0,
  sessions: [],
  builds: [],
  settings: {
    captureFailProcessName: false
  }
};

export const App = () => {
  const [tab, setTab] = useState<'focus' | 'build'>('focus');
  const [appState, setAppState] = useState<AppState>(emptyState);
  const [runtime, setRuntime] = useState<FocusRuntimeState>(initialRuntime);
  const [selectedMinutes, setSelectedMinutes] = useState<number>(20);

  useEffect(() => {
    window.focusFoundry.getAppState().then(setAppState);
    window.focusFoundry.getRuntimeState().then(setRuntime);

    const offState = window.focusFoundry.onStateUpdated(setAppState);
    const offRuntime = window.focusFoundry.onRuntimeState(setRuntime);

    return () => {
      offState();
      offRuntime();
    };
  }, []);

  const countdown = useMemo(() => {
    const m = Math.floor(runtime.remainingSeconds / 60)
      .toString()
      .padStart(2, '0');
    const s = (runtime.remainingSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }, [runtime.remainingSeconds]);

  return (
    <div className="app-shell">
      <header>
        <h1>Focus Foundry</h1>
        <p>Points: {appState.points}</p>
      </header>

      <nav className="tabs">
        <button className={tab === 'focus' ? 'active' : ''} onClick={() => setTab('focus')}>
          Focus Mode
        </button>
        <button className={tab === 'build' ? 'active' : ''} onClick={() => setTab('build')}>
          Build Mode
        </button>
      </nav>

      {tab === 'focus' ? (
        <section className="card">
          <h2>Focus Mode</h2>
          <label>Session length</label>
          <div className="length-options">
            {sessionOptions.map((minutes) => (
              <button
                key={minutes}
                disabled={runtime.running}
                className={selectedMinutes === minutes ? 'active' : ''}
                onClick={() => setSelectedMinutes(minutes)}
              >
                {minutes} min
              </button>
            ))}
          </div>

          <p className="counter">Countdown: {runtime.running ? countdown : '--:--'}</p>
          <p>Current build target: {runtime.currentBuildTarget?.name ?? 'Tiny House'}</p>
          <p>Points at stake: {runtime.running ? runtime.pointsAtStake : selectedMinutes}</p>

          {!runtime.running ? (
            <button className="primary" onClick={() => window.focusFoundry.startSession(selectedMinutes)}>
              Start
            </button>
          ) : (
            <button className="danger" onClick={() => window.focusFoundry.stopSession()}>
              Stop
            </button>
          )}
        </section>
      ) : (
        <section className="card">
          <h2>Build Mode</h2>
          <p>Spend focus points on your town.</p>
          <div className="build-grid">
            {appState.builds.map((item) => (
              <div key={item.id} className="build-item">
                <div className="swatch" style={{ background: item.color }} />
                <h3>{item.name}</h3>
                <p>Cost: {item.cost}</p>
                <p>Direction: {item.direction}</p>
                <button
                  disabled={appState.points < item.cost}
                  onClick={async () => setAppState(await window.focusFoundry.spendPoints(item.id))}
                >
                  Build
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <h2>Recent Sessions</h2>
        <ul>
          {appState.sessions.slice(0, 6).map((session) => (
            <li key={session.id}>
              {new Date(session.startedAt).toLocaleString()} — {session.plannedMinutes} min — {session.status}
              {' · '}
              points: {session.pointsAwarded}
              {session.failReason ? ` · reason: ${session.failReason}` : ''}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};
