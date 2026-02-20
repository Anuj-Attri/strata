import React, { useState, useEffect, useRef } from 'react';
import { useStore } from './store';
import { theme } from './theme';
import FeatureMapGrid from './FeatureMapGrid';
import FileSizeModal from './FileSizeModal';
import InfoIcon from './InfoIcon';

const PLOT_W = 160;
const PLOT_H = 80;
const MAX_SAMPLE = 2000;
const HISTOGRAM_BINS = 20;
const MAX_CHANNELS = 32;

function sampleTensorFlat(tensor, maxLen) {
  const out = [];
  function recurse(arr) {
    if (out.length >= maxLen) return;
    if (Array.isArray(arr)) {
      for (let i = 0; i < arr.length && out.length < maxLen; i++) recurse(arr[i]);
    } else {
      out.push(Number(arr));
    }
  }
  recurse(tensor);
  return out;
}

function getChannels(tensor, shape) {
  const rank = shape?.length ?? 0;
  if (rank === 4 && tensor[0]) {
    const ch = tensor[0];
    const n = Math.min(Array.isArray(ch) ? ch.length : 0, MAX_CHANNELS);
    const means = [];
    for (let c = 0; c < n; c++) {
      const slice = ch[c];
      if (!Array.isArray(slice)) continue;
      let sum = 0;
      let count = 0;
      for (let i = 0; i < slice.length; i++) {
        const row = slice[i];
        if (Array.isArray(row)) {
          for (let j = 0; j < row.length; j++) {
            sum += Number(row[j]);
            count++;
          }
        } else {
          sum += Number(row);
          count++;
        }
      }
      means.push(count > 0 ? sum / count : 0);
    }
    return means;
  }
  if (rank === 3 && tensor[0]) {
    const grid = tensor[0];
    const n = Math.min(Array.isArray(grid) ? grid.length : 0, MAX_CHANNELS);
    const means = [];
    for (let s = 0; s < n; s++) {
      const row = grid[s];
      if (!Array.isArray(row)) continue;
      let sum = 0;
      for (let i = 0; i < row.length; i++) sum += Number(row[i]);
      means.push(row.length > 0 ? sum / row.length : 0);
    }
    return means;
  }
  return [];
}

function getSparsityPerChannel(tensor, shape) {
  const rank = shape?.length ?? 0;
  const out = [];
  if (rank === 4 && tensor[0]) {
    const ch = tensor[0];
    const n = Math.min(Array.isArray(ch) ? ch.length : 0, MAX_CHANNELS);
    for (let c = 0; c < n; c++) {
      const slice = ch[c];
      if (!Array.isArray(slice)) continue;
      let count = 0;
      let zero = 0;
      for (let i = 0; i < slice.length; i++) {
        const row = slice[i];
        if (Array.isArray(row)) {
          for (let j = 0; j < row.length; j++) {
            count++;
            if (Math.abs(Number(row[j])) < 0.01) zero++;
          }
        } else {
          count++;
          if (Math.abs(Number(row)) < 0.01) zero++;
        }
      }
      out.push(count > 0 ? (zero / count) * 100 : 0);
    }
    return out;
  }
  if (rank === 3 && tensor[0]) {
    const grid = tensor[0];
    const n = Math.min(Array.isArray(grid) ? grid.length : 0, MAX_CHANNELS);
    for (let s = 0; s < n; s++) {
      const row = grid[s];
      if (!Array.isArray(row)) continue;
      let zero = 0;
      for (let i = 0; i < row.length; i++) {
        if (Math.abs(Number(row[i])) < 0.01) zero++;
      }
      out.push(row.length > 0 ? (zero / row.length) * 100 : 0);
    }
    return out;
  }
  return out;
}

function getRangePerChannel(tensor, shape) {
  const rank = shape?.length ?? 0;
  const out = [];
  if (rank === 4 && tensor[0]) {
    const ch = tensor[0];
    const n = Math.min(Array.isArray(ch) ? ch.length : 0, MAX_CHANNELS);
    for (let c = 0; c < n; c++) {
      const slice = ch[c];
      if (!Array.isArray(slice)) continue;
      let min = Infinity;
      let max = -Infinity;
      for (let i = 0; i < slice.length; i++) {
        const row = slice[i];
        if (Array.isArray(row)) {
          for (let j = 0; j < row.length; j++) {
            const v = Number(row[j]);
            if (v < min) min = v;
            if (v > max) max = v;
          }
        } else {
          const v = Number(row);
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
      out.push(min !== Infinity ? max - min : 0);
    }
    return out;
  }
  if (rank === 3 && tensor[0]) {
    const grid = tensor[0];
    const n = Math.min(Array.isArray(grid) ? grid.length : 0, MAX_CHANNELS);
    for (let s = 0; s < n; s++) {
      const row = grid[s];
      if (!Array.isArray(row)) continue;
      let min = Infinity;
      let max = -Infinity;
      for (let i = 0; i < row.length; i++) {
        const v = Number(row[i]);
        if (v < min) min = v;
        if (v > max) max = v;
      }
      out.push(min !== Infinity ? max - min : 0);
    }
    return out;
  }
  return out;
}

function LayerStatsPlots({ record }) {
  const tensor = record?.output_tensor;
  const shape = record?.output_shape;
  const ref1 = useRef(null);
  const ref2 = useRef(null);
  const ref3 = useRef(null);
  const ref4 = useRef(null);

  useEffect(() => {
    if (!tensor || !shape?.length) return;
    const sampled = sampleTensorFlat(tensor, MAX_SAMPLE);
    if (sampled.length === 0) return;

    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < sampled.length; i++) {
      const v = sampled[i];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const range = max - min || 1;
    const bins = new Array(HISTOGRAM_BINS).fill(0);
    for (let i = 0; i < sampled.length; i++) {
      const idx = Math.min(Math.floor(((sampled[i] - min) / range) * HISTOGRAM_BINS), HISTOGRAM_BINS - 1);
      bins[idx]++;
    }
    const maxCount = Math.max(...bins, 1);

    if (ref1.current) {
      const ctx = ref1.current.getContext('2d');
      ref1.current.width = PLOT_W;
      ref1.current.height = PLOT_H;
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, PLOT_W, PLOT_H);
      ctx.fillStyle = '#666';
      ctx.font = '10px sans-serif';
      ctx.letterSpacing = '0.1em';
      ctx.fillText('ACTIVATION DIST', 4, 10);
      const barW = (PLOT_W - 8) / HISTOGRAM_BINS;
      for (let i = 0; i < HISTOGRAM_BINS; i++) {
        const h = (bins[i] / maxCount) * (PLOT_H - 20);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(4 + i * barW, PLOT_H - 4 - h, Math.max(1, barW - 1), h);
      }
      ctx.strokeStyle = '#111';
      ctx.strokeRect(0, 0, PLOT_W, PLOT_H);
    }

    const channelMeans = getChannels(tensor, shape);
    const maxMean = Math.max(...channelMeans, 1);
    if (ref2.current && channelMeans.length > 0) {
      const ctx = ref2.current.getContext('2d');
      ref2.current.width = PLOT_W;
      ref2.current.height = PLOT_H;
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, PLOT_W, PLOT_H);
      ctx.fillStyle = '#666';
      ctx.font = '10px sans-serif';
      ctx.fillText('CHANNEL MEANS', 4, 10);
      const barH = (PLOT_H - 18) / channelMeans.length;
      for (let i = 0; i < channelMeans.length; i++) {
        const w = (channelMeans[i] / maxMean) * (PLOT_W - 8);
        ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.7 * (channelMeans[i] / maxMean)})`;
        ctx.fillRect(4, 14 + i * barH, Math.max(0, w), Math.max(1, barH - 1));
      }
      ctx.strokeStyle = '#111';
      ctx.strokeRect(0, 0, PLOT_W, PLOT_H);
    }

    const sparsity = getSparsityPerChannel(tensor, shape);
    if (ref3.current && sparsity.length > 0) {
      const ctx = ref3.current.getContext('2d');
      ref3.current.width = PLOT_W;
      ref3.current.height = PLOT_H;
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, PLOT_W, PLOT_H);
      ctx.fillStyle = '#666';
      ctx.font = '10px sans-serif';
      ctx.fillText('SPARSITY', 4, 10);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const stepX = (PLOT_W - 8) / Math.max(sparsity.length - 1, 1);
      for (let i = 0; i < sparsity.length; i++) {
        const x = 4 + i * stepX;
        const y = PLOT_H - 4 - (sparsity[i] / 100) * (PLOT_H - 18);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.strokeStyle = '#111';
      ctx.strokeRect(0, 0, PLOT_W, PLOT_H);
    }

    const ranges = getRangePerChannel(tensor, shape);
    const maxRange = Math.max(...ranges, 1);
    if (ref4.current && ranges.length > 0) {
      const ctx = ref4.current.getContext('2d');
      ref4.current.width = PLOT_W;
      ref4.current.height = PLOT_H;
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, PLOT_W, PLOT_H);
      ctx.fillStyle = '#666';
      ctx.font = '10px sans-serif';
      ctx.fillText('ACTIVATION RANGE', 4, 10);
      const barW = (PLOT_W - 8) / ranges.length;
      for (let i = 0; i < ranges.length; i++) {
        const intensity = ranges[i] / maxRange;
        const g = Math.round(80 + intensity * 175);
        ctx.fillStyle = `rgb(${g},${g},${g})`;
        ctx.fillRect(4 + i * barW, 14, Math.max(1, barW - 1), PLOT_H - 18);
      }
      ctx.strokeStyle = '#111';
      ctx.strokeRect(0, 0, PLOT_W, PLOT_H);
    }
  }, [tensor, shape]);

  if (!tensor || !shape?.length) return null;

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 10, color: '#444', letterSpacing: '0.2em', marginBottom: 8 }}>LAYER STATISTICS</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <canvas ref={ref1} width={PLOT_W} height={PLOT_H} style={{ width: PLOT_W, height: PLOT_H, border: '1px solid #111', background: '#0a0a0a' }} title="Activation distribution histogram" />
        <canvas ref={ref2} width={PLOT_W} height={PLOT_H} style={{ width: PLOT_W, height: PLOT_H, border: '1px solid #111', background: '#0a0a0a' }} title="Channel means" />
        <canvas ref={ref3} width={PLOT_W} height={PLOT_H} style={{ width: PLOT_W, height: PLOT_H, border: '1px solid #111', background: '#0a0a0a' }} title="Sparsity % per channel" />
        <canvas ref={ref4} width={PLOT_W} height={PLOT_H} style={{ width: PLOT_W, height: PLOT_H, border: '1px solid #111', background: '#0a0a0a' }} title="Value range per channel" />
      </div>
    </div>
  );
}

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

          {record?.output_tensor && (
            <div style={sectionStyle}>
              <LayerStatsPlots record={record} />
            </div>
          )}

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
