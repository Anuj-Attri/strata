import React, { useEffect, useRef } from 'react';
import { useStore } from './store';
import { theme } from './theme';
import GraphView from './GraphView';
import DetailPanel from './DetailPanel';
import InputPanel from './InputPanel';
import OnboardingFlow from './OnboardingFlow';

const API_BASE = 'http://localhost:8000';
const WS_URL = 'ws://localhost:8000/ws/stream';

export default function App() {
  const {
    modelGraph,
    setModelGraph,
    addToCache,
    setRunning,
    setLayerOrder,
    clearCache,
  } = useStore();
  const wsRef = useRef(null);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data === null) return;
        addToCache(data);
        if (data.layer_id) {
          window.dispatchEvent(
            new CustomEvent('strata:layer-fired', { detail: { layer_id: data.layer_id } })
          );
        }
      } catch (_) {}
    };

    ws.onclose = () => setRunning(false);
    ws.onerror = () => setRunning(false);

    return () => {
      if (ws.readyState === WebSocket.OPEN) ws.close();
      wsRef.current = null;
    };
  }, [addToCache, setRunning]);

  const handleLoadModel = async () => {
    if (!window.strata?.openFile) return;
    const result = await window.strata.openFile();
    if (result.canceled || !result.filePaths?.length) return;
    const path = result.filePaths[0];
    try {
      const res = await fetch(`${API_BASE}/load-model`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || res.statusText);
      }
      const graph = await res.json();
      setModelGraph(graph);
    } catch (e) {
      console.error(e);
      alert(e.message || 'Failed to load model');
    }
  };

  const modelName = modelGraph
    ? `${modelGraph.model_type?.toUpperCase() || 'Model'} • ${(modelGraph.total_params ?? 0).toLocaleString()} params`
    : '';

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: theme.bg }}>
      <OnboardingFlow />
      <header
        style={{
          height: 48,
          minHeight: 48,
          borderBottom: `1px solid ${theme.border}`,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 24,
          paddingRight: 24,
          background: theme.bg,
        }}
      >
        <span
          style={{
            fontFamily: theme.font,
            fontWeight: 100,
            letterSpacing: theme.tracking,
            color: theme.primary,
            textTransform: 'uppercase',
            fontSize: 14,
          }}
        >
          STRATA
        </span>
        <button
          type="button"
          onClick={handleLoadModel}
          style={{
            marginLeft: 24,
            padding: '6px 12px',
            background: theme.bg,
            border: `1px solid ${theme.border}`,
            color: theme.primary,
            fontFamily: theme.font,
            fontSize: 11,
            letterSpacing: theme.tracking,
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = theme.hover;
            e.currentTarget.style.borderColor = theme.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = theme.bg;
            e.currentTarget.style.borderColor = theme.border;
          }}
        >
          Load model
        </button>
        <span
          style={{
            flex: 1,
            textAlign: 'center',
            color: theme.secondary,
            fontSize: 12,
            letterSpacing: theme.tracking,
            textTransform: 'uppercase',
          }}
        >
          {modelName}
        </span>
      </header>

      <main style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <section style={{ flex: '0 0 70%', height: '100%', position: 'relative' }}>
          <GraphView />
        </section>
        <section style={{ flex: '0 0 30%', height: '100%', borderLeft: `1px solid ${theme.border}` }}>
          <DetailPanel />
        </section>
      </main>

      <footer
        style={{
          flex: '0 0 120px',
          minHeight: 120,
          borderTop: `1px solid ${theme.border}`,
        }}
      >
        <InputPanel />
      </footer>
    </div>
  );
}
