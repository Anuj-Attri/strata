import React, { useEffect, useRef, useState } from 'react';
import { useStore } from './store';
import { theme } from './theme';
import GraphView from './GraphView';
import DetailPanel from './DetailPanel';
import InputPanel from './InputPanel';
import OnboardingFlow from './OnboardingFlow';
import InfoIcon from './InfoIcon';

const API_BASE = 'http://127.0.0.1:8000';
const WS_URL = 'ws://127.0.0.1:8000/ws/stream';

const INFERENCE_TIMEOUT_MS = 120000;

function flushPending(pendingRef, flushTimerRef, addToCacheBatch, setRunning) {
  const batch = { ...pendingRef.current };
  pendingRef.current = {};
  if (flushTimerRef.current) {
    clearTimeout(flushTimerRef.current);
    flushTimerRef.current = null;
  }
  if (Object.keys(batch).length > 0) {
    addToCacheBatch(batch);
  }
}

export default function App() {
  const {
    modelGraph,
    setModelGraph,
    addToCacheBatch,
    setRunning,
    setLayerOrder,
    clearCache,
    fullRender,
    setFullRender,
  } = useStore();
  const wsRef = useRef(null);
  const pendingRef = useRef({});
  const flushTimerRef = useRef(null);
  const inferenceTimeoutRef = useRef(null);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data === null) {
          if (inferenceTimeoutRef.current) {
            clearTimeout(inferenceTimeoutRef.current);
            inferenceTimeoutRef.current = null;
          }
          setRunning(false);
          flushPending(pendingRef, flushTimerRef, addToCacheBatch, setRunning);
          return;
        }
        const raw = data.layer_id ?? '';
        const sanitized = raw.replace(/[^a-zA-Z0-9_]/g, '_');
        pendingRef.current[raw || 'layer'] = data;
        if (sanitized) pendingRef.current[sanitized] = data;
        if (data.layer_id) {
          window.dispatchEvent(
            new CustomEvent('strata:layer-fired', { detail: { layer_id: data.layer_id } })
          );
        }
        if (!inferenceTimeoutRef.current) {
          inferenceTimeoutRef.current = setTimeout(() => {
            setRunning(false);
            inferenceTimeoutRef.current = null;
            alert('Inference timed out after 120 seconds. The model may be too large for your hardware.');
          }, INFERENCE_TIMEOUT_MS);
        }
        if (!flushTimerRef.current) {
          flushTimerRef.current = setTimeout(() => {
            flushPending(pendingRef, flushTimerRef, addToCacheBatch, setRunning);
          }, 100);
        }
      } catch (_) {
        setRunning(false);
      }
    };

    ws.onclose = () => setRunning(false);
    ws.onerror = () => setRunning(false);

    return () => {
      if (ws.readyState === WebSocket.OPEN) ws.close();
      wsRef.current = null;
    };
  }, [addToCacheBatch, setRunning]);

  const handleLoadModel = async () => {
    if (!window.strata?.openFile) return;
    const result = await window.strata.openFile();
    if (result.canceled || !result.filePaths?.length) return;
    clearCache();
    setLayerOrder([]);
    const path = result.filePaths[0];
    try {
      const res = await fetch(`${API_BASE}/load-model`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = err.error || err.detail || res.statusText;
        alert(`Failed to load model: ${msg}\n\nMake sure your file is a valid .pt, .pth, or .onnx model.`);
        return;
      }
      const graph = await res.json();
      console.log('Graph data:', JSON.stringify(graph, null, 2));
      setModelGraph(graph);
    } catch (e) {
      console.error(e);
      alert(e.message || 'Failed to load model');
    }
  };

  const modelLabel = modelGraph ? (modelGraph.model_type?.toUpperCase() || 'MODEL') : '';

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: theme.bg }}>
      <OnboardingFlow />
      <header
        style={{
          height: 64,
          minHeight: 64,
          borderBottom: '1px solid #1a1a1a',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 24,
          paddingRight: 24,
          background: 'linear-gradient(180deg, #0a0a0a 0%, #000000 100%)',
        }}
      >
        <span
          style={{
            fontFamily: theme.font,
            fontWeight: 200,
            letterSpacing: '0.2em',
            color: theme.primary,
            textTransform: 'uppercase',
            fontSize: 22,
          }}
        >
          STRATA
        </span>
        <button
          type="button"
          onClick={handleLoadModel}
          style={{
            marginLeft: 24,
            padding: '10px 24px',
            background: theme.bg,
            border: `1px solid ${theme.border}`,
            color: theme.primary,
            fontFamily: theme.font,
            fontSize: 13,
            letterSpacing: '0.15em',
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
          LOAD MODEL
        </button>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginLeft: 24,
            fontSize: 11,
            letterSpacing: '0.15em',
            color: '#888',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={fullRender}
            onChange={(e) => setFullRender(e.target.checked)}
            style={{ accentColor: '#ffffff' }}
          />
          FULL RENDER
          <InfoIcon tooltip="When enabled, node faces display their output tensor as a feature map after inference. Disabled by default for performance." />
        </label>
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
          {modelLabel}
        </span>
      </header>

      <main style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <section style={{ flex: '0 0 70%', height: '100%', position: 'relative' }}>
          <GraphView fullRender={fullRender} />
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
