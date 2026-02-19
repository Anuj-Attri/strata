import React, { useState, useEffect } from 'react';
import { useStore } from './store';
import { theme } from './theme';
import TensorHeatmap from './TensorHeatmap';
import FileSizeModal from './FileSizeModal';

const API_BASE = 'http://localhost:8000';

const sectionStyle = {
  padding: '16px 20px',
  borderBottom: `1px solid ${theme.border}`,
};

const labelStyle = {
  fontFamily: theme.font,
  fontSize: 10,
  letterSpacing: theme.tracking,
  textTransform: 'uppercase' as const,
  color: theme.secondary,
  marginBottom: 6,
  fontWeight: 300,
};

const valueStyle = {
  color: theme.primary,
  fontSize: 13,
};

function InfoIcon({ title }) {
  return (
    <span
      title={title}
      style={{ marginLeft: 6, cursor: 'help', color: theme.secondary, fontSize: 10 }}
    >
      (i)
    </span>
  );
}

export default function DetailPanel() {
  const { selectedLayerId, inferenceCache, modelGraph } = useStore();
  const record = selectedLayerId ? inferenceCache[selectedLayerId] : null;
  const [estimateSize, setEstimateSize] = useState({ bytes: 0, human_readable: '0 B' });
  const [showFileSizeModal, setShowFileSizeModal] = useState(false);
  const [copyStatus, setCopyStatus] = useState(false);

  useEffect(() => {
    if (!selectedLayerId) return;
    fetch(`${API_BASE}/estimate-size?layer_id=${encodeURIComponent(selectedLayerId)}`)
      .then((r) => r.ok ? r.json() : { bytes: 0, human_readable: '0 B' })
      .then(setEstimateSize)
      .catch(() => setEstimateSize({ bytes: 0, human_readable: '0 B' }));
  }, [selectedLayerId]);

  const handleSaveToFile = async () => {
    setShowFileSizeModal(true);
  };

  const handleConfirmExport = async () => {
    if (!selectedLayerId || !window.strata?.saveFile) return;
    const result = await window.strata.saveFile();
    if (result.canceled || !result.filePath) {
      setShowFileSizeModal(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/save-tensor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layer_id: selectedLayerId, path: result.filePath }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || 'Save failed');
      setShowFileSizeModal(false);
    } catch (e) {
      console.error(e);
      alert(e.message || 'Save failed');
    }
  };

  const handleCopyJson = async () => {
    if (!selectedLayerId) return;
    try {
      const res = await fetch(`${API_BASE}/copy-tensor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layer_id: selectedLayerId }),
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
  const inputShape = record?.input_shape ?? [];
  const outputShape = record?.output_shape ?? [];

  return (
    <div style={{ height: '100%', overflow: 'auto', background: theme.bg }}>
      <div style={sectionStyle}>
        <div style={labelStyle}>
          Layer
        </div>
        <div style={valueStyle}>{record?.name ?? selectedLayerId}</div>
        <div style={{ ...labelStyle, marginTop: 12, display: 'flex', alignItems: 'center' }}>
          Type <InfoIcon title="The kind of mathematical operation this layer performs, e.g. Conv2d applies a sliding filter across an image." />
        </div>
        <div style={valueStyle}>{record?.type ?? '—'}</div>
        <div style={{ ...labelStyle, marginTop: 12, display: 'flex', alignItems: 'center' }}>
          Param count <InfoIcon title="The number of learnable values inside this layer. More params = more capacity to learn complex patterns." />
        </div>
        <div style={valueStyle}>{(record?.param_count ?? 0).toLocaleString()}</div>
        <div style={{ ...labelStyle, marginTop: 8 }}>Trainable params</div>
        <div style={valueStyle}>{(record?.trainable_params ?? 0).toLocaleString()}</div>
      </div>

      {hasInference && (
        <>
          <div style={sectionStyle}>
            <div style={{ ...labelStyle, display: 'flex', alignItems: 'center' }}>
              Input shape <InfoIcon title="Shape describes the dimensions of the data entering this layer. For example [1, 64, 224, 224] = 1 image, 64 channels, 224×224 pixels." />
            </div>
            <div style={valueStyle}>[{inputShape.join(', ')}]</div>
            <div style={{ ...labelStyle, marginTop: 12, display: 'flex', alignItems: 'center' }}>
              Output shape <InfoIcon title="Shape of the data leaving this layer after the operation is applied." />
            </div>
            <div style={valueStyle}>[{outputShape.join(', ')}]</div>
          </div>

          <div style={sectionStyle}>
            <div style={{ ...labelStyle, display: 'flex', alignItems: 'center' }}>
              Statistics <InfoIcon title="Computed from the complete output tensor of this layer. No values are approximated or truncated." />
            </div>
            <div style={valueStyle}>
              Mean: {(stats.mean ?? 0).toFixed(8)}<br />
              Std:  {(stats.std ?? 0).toFixed(8)}<br />
              Min:  {(stats.min ?? 0).toFixed(8)}<br />
              Max:  {(stats.max ?? 0).toFixed(8)}
            </div>
          </div>

          <div style={sectionStyle}>
            <div style={{ ...labelStyle, display: 'flex', alignItems: 'center' }}>
              Output tensor heatmap <InfoIcon title="A visual map of every value in this layer's output tensor. Brighter = higher value. Computed from complete, untruncated data." />
            </div>
            <TensorHeatmap tensor={record?.output_tensor} width="100%" />
          </div>
        </>
      )}

      <div style={sectionStyle}>
        <div style={{ ...labelStyle, display: 'flex', alignItems: 'center' }}>
          EXPORT SIZE — ~{estimateSize.human_readable} <InfoIcon title="The approximate file size if you save this layer's full tensor data. Strata never truncates — what you save is complete and exact." />
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleSaveToFile}
            style={{
              padding: '8px 14px',
              background: theme.bg,
              border: `1px solid ${theme.border}`,
              color: theme.primary,
              fontFamily: theme.font,
              fontSize: 10,
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
            Save to file
          </button>
          <button
            type="button"
            onClick={handleCopyJson}
            style={{
              padding: '8px 14px',
              background: theme.bg,
              border: `1px solid ${theme.border}`,
              color: theme.primary,
              fontFamily: theme.font,
              fontSize: 10,
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
            {copyStatus ? 'Copied' : 'Copy JSON'}
          </button>
        </div>
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
