import React, { useRef, useEffect, useMemo } from 'react';
import { theme } from './theme';

function flattenToFloats(arr) {
  if (arr == null) return [];
  if (typeof arr === 'number') return [arr];
  if (Array.isArray(arr)) {
    return arr.flatMap(flattenToFloats);
  }
  return [];
}

function getShape(arr) {
  if (arr == null || typeof arr === 'number') return [];
  if (Array.isArray(arr)) {
    return [arr.length, ...getShape(arr[0])];
  }
  return [];
}

export default function TensorHeatmap({ tensor, width = '100%' }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const { data, minVal, maxVal, gridW, gridH } = useMemo(() => {
    const shape = getShape(tensor);
    let slice = tensor;
    if (shape.length === 4) {
      slice = tensor?.[0]?.[0];
    } else if (shape.length === 2 || shape.length === 1) {
      slice = tensor;
    }
    const flat = flattenToFloats(slice);
    if (flat.length === 0) return { data: null, minVal: 0, maxVal: 0, gridW: 0, gridH: 0 };
    let minVal = Infinity;
    let maxVal = -Infinity;
    for (let i = 0; i < flat.length; i++) {
      if (flat[i] < minVal) minVal = flat[i];
      if (flat[i] > maxVal) maxVal = flat[i];
    }
    const range = maxVal - minVal || 1;
    let gridW = 1;
    let gridH = 1;
    if (shape.length === 4) {
      gridH = shape[2];
      gridW = shape[3];
    } else if (shape.length === 2) {
      gridH = shape[0];
      gridW = shape[1];
    } else if (shape.length === 1) {
      gridW = shape[0];
      gridH = 1;
    } else if (shape.length >= 2) {
      gridH = shape[0];
      gridW = shape.slice(1).reduce((a, b) => a * b, 1);
    }
    const data = flat.map((v) => Math.round(((v - minVal) / range) * 255));
    return { data, minVal, maxVal, gridW, gridH };
  }, [tensor]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !data || data.length === 0) return;
    const w = gridW;
    const h = gridH;
    if (w <= 0 || h <= 0) return;
    const rect = container.getBoundingClientRect();
    const maxWidth = rect.width || 300;
    let scale = 1;
    if (w > maxWidth) scale = maxWidth / w;
    const cw = Math.min(w * scale, maxWidth);
    const ch = Math.max(1, h * scale);
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const imageData = ctx.createImageData(cw, ch);
    const pw = Math.max(1, Math.floor(w / cw));
    const ph = Math.max(1, Math.floor(h / ch));
    for (let dy = 0; dy < ch; dy++) {
      for (let dx = 0; dx < cw; dx++) {
        const sx = Math.floor((dx / cw) * w);
        const sy = Math.floor((dy / ch) * h);
        const idx = sy * w + sx;
        const v = data[idx] ?? 0;
        const i = (dy * cw + dx) * 4;
        imageData.data[i] = v;
        imageData.data[i + 1] = v;
        imageData.data[i + 2] = v;
        imageData.data[i + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }, [data, gridW, gridH]);

  if (tensor == null || flattenToFloats(tensor).length === 0) {
    return (
      <div
        ref={containerRef}
        style={{
          width: width || '100%',
          minHeight: 80,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#444444',
          fontSize: 11,
          letterSpacing: theme.tracking,
          textTransform: 'uppercase',
        }}
      >
        No data
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ width: width || '100%' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', display: 'block', border: `1px solid ${theme.border}` }}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 6,
          color: theme.secondary,
          fontSize: 11,
        }}
      >
        <span>min: {minVal.toFixed(6)}</span>
        <span>max: {maxVal.toFixed(6)}</span>
      </div>
    </div>
  );
}
