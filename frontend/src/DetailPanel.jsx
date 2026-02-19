import React, { useState, useEffect } from 'react';
import { useStore } from './store';
import { theme } from './theme';
import FeatureMapGrid from './FeatureMapGrid';
import FileSizeModal from './FileSizeModal';
import InfoIcon from './InfoIcon';

const API_BASE = 'http://127.0.0.1:8000';

const sectionStyle = {
  padding: '16px 20px',
  borderBottom: '1px solid #111111',
};

const labelStyle = {
  fontFamily: theme.font,
  fontSize: 10,
  letterSpacing: theme.tracking,
  textTransform: 'uppercase',
  color: theme.secondary,
  marginBottom: 6,
  fontWeight: 300,
};

const valueStyle = {
  color: theme.primary,
  fontSize: 13,
};

function cleanForMatch(s) {
  return s?.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || '';
}

export default function DetailPanel() {
  const { selectedLayerId, inferenceCache, modelGraph } = useStore();
  const selectedNode = selectedLayerId
    ? modelGraph?.nodes?.find((n) => n.id === selectedLayerId)
    : null;
  const record =
    selectedLayerId == null
      ? null
      : inferenceCache[selectedLayerId] ||
        inferenceCache[selectedLayerId?.replace(/[^a-zA-Z0-9_]/g, '_')] ||
        (() => {
          const nodeName = selectedNode?.name?.split('/').pop();
          return Object.values(inferenceCache).find((r) => {
            const rClean = cleanForMatch(r.name);
            const nClean = cleanForMatch(nodeName);
            return nClean && rClean && rClean.includes(nClean);
          }) ?? null;
        })();
  const [estimateSize, setEstimateSize] = useState({ bytes: 0, human_readable: '0 B' });
  const [showFileSizeModal, setShowFileSizeModal] = useState(false);
  const [copyStatus, setCopyStatus] = useState(false);

  const layerIdToFetch = record?.layer_id ?? selectedLayerId;

  useEffect(() => {
    if (!layerIdToFetch) return;
    fetch(`${API_BASE}/estimate-size?layer_id=${encodeURIComponent(layerIdToFetch)}`)
      .then((r) => (r.ok ? r.json() : { bytes: 0, human_readable: '0 B' }))
      .then(setEstimateSize)
      .catch(() => setEstimateSize({ bytes: 0, human_readable: '0 B' }));
  }, [layerIdToFetch]);

  const handleSaveToFile = async () => {
    setShowFileSizeModal(true);
  };

  const handleConfirmExport = async () => {
    if (!layerIdToFetch || !window.strata?.saveFile) return;
    const result = await window.strata.saveFile();
    if (result.canceled || !result.filePath) {
      setShowFileSizeModal(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/save-tensor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layer_id: layerIdToFetch, path: result.filePath }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || 'Save failed');
      setShowFileSizeModal(false);
    } catch (e) {
      console.error(e);
      alert(e.message || 'Save failed');
    }
  };

  const handleCopyJson = async () => {
    if (!layerIdToFetch) return;
    try {
      const res = await fetch(`${API_BASE}/copy-tensor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layer_id: layerIdToFetch }),
      });
      if (!res.ok) throw new Error('Copy failed');
      const json = await res.json();
      const text = JSON.stringify(json, null, 2);
      if (window.strata?.writeClipboard) await window.strata.writeClipboard(text);
      setCopyStatus(true);
      setTimeout(() => setCopyStatus(false), 1500);
    } catch (e) {
      console.error(e);
      alert('Copy failed');
    }
  };

  if (!selectedLayerId) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.secondary,
          fontSize: 11,
          letterSpacing: theme.tracking,
          textTransform: 'uppercase',
        }}
      >
        SELECT A LAYER
      </div>
    );
  }

  const hasInference = record != null;
  const stats = record?.stats || {};
  const inputShape = record?.input_shape ?? selectedNode?.input_dims ?? [];
  const outputShape = record?.output_shape ?? selectedNode?.output_dims ?? [];

  return (
    <div style={{ height: '100%', overflow: 'auto', background: '#050505' }}>
      <div style={{ ...sectionStyle, borderLeft: '2px solid #FFFFFF' }}>
        <div style={labelStyle}>Layer</div>
        <div style={valueStyle}>{selectedNode?.name ?? record?.name ?? selectedLayerId}</div>
        <div style={{ ...labelStyle, marginTop: 12, display: 'flex', alignItems: 'center' }}>
          Type <InfoIcon tooltip="The kind of mathematical operation this layer performs." />
        </div>
        <div style={valueStyle}>{selectedNode?.type ?? record?.type ?? '—'}</div>
        <div style={{ ...labelStyle, marginTop: 12, display: 'flex', alignItems: 'center' }}>
          Param count <InfoIcon tooltip="The number of learnable values inside this layer." />
        </div>
        <div style={valueStyle}>
          {(selectedNode?.param_count ?? record?.param_count ?? 0).toLocaleString()}
        </div>
        <div style={{ ...labelStyle, marginTop: 8 }}>Trainable params</div>
        <div style={valueStyle}>
          {(selectedNode?.trainable_params ?? record?.trainable_params ?? 0).toLocaleString()}
        </div>
        {(inputShape?.length > 0 || outputShape?.length > 0) && (
          <>
            <div style={{ ...labelStyle, marginTop: 12 }}>Input shape</div>
            <div style={valueStyle}>[{inputShape.join(', ')}]</div>
            <div style={{ ...labelStyle, marginTop: 8 }}>Output shape</div>
            <div style={valueStyle}>[{outputShape.join(', ')}]</div>
          </>
        )}
      </div>

      {hasInference && (
        <>
          <div style={sectionStyle}>
            <div style={{ ...labelStyle, display: 'flex', alignItems: 'center' }}>
              Statistics <InfoIcon tooltip="From the output tensor of this layer after inference." />
            </div>
            <div style={valueStyle}>
              Mean: {(stats.mean ?? 0).toFixed(8)}<br />
              Std: {(stats.std ?? 0).toFixed(8)}<br />
              Min: {(stats.min ?? 0).toFixed(8)}<br />
              Max: {(stats.max ?? 0).toFixed(8)}
            </div>
          </div>

          <div style={sectionStyle}>
            <div style={{ ...labelStyle, display: 'flex', alignItems: 'center' }}>
              Output tensor heatmap <InfoIcon tooltip="Per-channel feature map view." />
            </div>
            <FeatureMapGrid
              tensor={record?.output_tensor}
              outputShape={record?.output_shape}
              stats={record?.stats}
            />
          </div>
        </>
      )}

      <div style={{ padding: '16px', borderTop: '1px solid #222' }}>
        <div style={{ color: '#888', fontSize: 10, letterSpacing: '0.15em', marginBottom: 12 }}>
          EXPORT SIZE — ~{estimateSize.human_readable}
          <InfoIcon tooltip="Approximate file size with full untruncated tensor data." />
        </div>
        <button
          type="button"
          onClick={handleSaveToFile}
          style={{
            width: '100%',
            padding: '12px',
            marginBottom: 8,
            background: '#FFFFFF',
            color: '#000000',
            border: 'none',
            letterSpacing: '0.15em',
            fontSize: 12,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          SAVE TO FILE
        </button>
        <button
          type="button"
          onClick={handleCopyJson}
          style={{
            width: '100%',
            padding: '12px',
            background: 'transparent',
            color: '#FFFFFF',
            border: '1px solid #FFFFFF',
            letterSpacing: '0.15em',
            fontSize: 12,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {copyStatus ? 'COPIED' : 'COPY JSON'}
        </button>
      </div>

      {showFileSizeModal && (
        <FileSizeModal
          size={estimateSize.human_readable}
          onConfirm={handleConfirmExport}
          onCancel={() => setShowFileSizeModal(false)}
        />
      )}
    </div>
  );
}
