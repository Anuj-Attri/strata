import React, { useEffect, useRef, useState } from 'react';

function ChannelTile({ data, width = 80, height = 80, onClick }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!data || !canvasRef.current) return;
    const canvas = canvasRef.current;
    if (!Array.isArray(data) || data.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const srcW = data[0]?.length ?? 1;
    const srcH = data.length;
    const maxPixels = 128 * 128;
    const renderW = Math.min(srcW, 128);
    const renderH = Math.min(srcH, 128);
    const sampled = [];
    for (let y = 0; y < renderH; y++) {
      const srcY = Math.floor((y * srcH) / renderH);
      for (let x = 0; x < renderW; x++) {
        const srcX = Math.floor((x * srcW) / renderW);
        const row = data[srcY];
        sampled.push(Array.isArray(row) ? (row[srcX] ?? 0) : row);
      }
    }
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < sampled.length; i++) {
      const v = sampled[i];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const range = max - min || 1;
    canvas.width = renderW;
    canvas.height = renderH;
    const imageData = ctx.createImageData(renderW, renderH);
    for (let i = 0; i < sampled.length; i++) {
      const normalized = Math.round(((sampled[i] - min) / range) * 255);
      imageData.data[i * 4] = normalized;
      imageData.data[i * 4 + 1] = normalized;
      imageData.data[i * 4 + 2] = normalized;
      imageData.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
  }, [data]);
  return (
    <canvas
      ref={canvasRef}
      style={{
        width,
        height,
        imageRendering: 'pixelated',
        cursor: 'pointer',
        border: '1px solid #222',
      }}
      onClick={onClick}
    />
  );
}

export default function FeatureMapGrid({ tensor, outputShape, stats }) {
  const [zoomed, setZoomed] = useState(null);

  if (!tensor || !outputShape || outputShape.length === 0) {
    return (
      <div style={{ color: '#444', fontSize: 12 }}>
        NO DATA — RUN INFERENCE FIRST
      </div>
    );
  }
  if (Array.isArray(tensor) && tensor.length === 0) {
    return (
      <div style={{ color: '#444', fontSize: 12 }}>
        NO DATA — RUN INFERENCE FIRST
      </div>
    );
  }

  const rank = outputShape?.length ?? 0;
  let channels = [];
  if (rank === 4 && Array.isArray(tensor[0])) {
    channels = tensor[0];
  } else if (rank === 3 && Array.isArray(tensor[0])) {
    const grid = tensor[0];
    return (
      <div>
        <div style={{ color: '#888', fontSize: 11, marginBottom: 8 }}>
          ATTENTION PATTERN — {grid.length} TOKENS × {grid[0]?.length ?? 0} DIMS
        </div>
        <ChannelTile data={grid} width={260} height={Math.min(grid.length * 4, 260)} />
        {stats && (
          <div style={{ color: '#888', fontSize: 11, marginTop: 8 }}>
            Shape: [{outputShape.join(', ')}] · mean {Number(stats.mean).toFixed(4)} · std {Number(stats.std).toFixed(4)} · min {Number(stats.min).toFixed(4)} · max {Number(stats.max).toFixed(4)}
          </div>
        )}
      </div>
    );
  } else if (rank === 2) {
    channels = [tensor];
  } else if (rank === 1 || (Array.isArray(tensor) && !Array.isArray(tensor[0]))) {
    channels = [tensor];
  } else {
    channels = Array.isArray(tensor) ? tensor : [tensor];
  }
  const displayChannels = channels.slice(0, 32);

  return (
    <div>
      {channels.length > 32 && (
        <div style={{ color: '#888', fontSize: 11, marginBottom: 8 }}>
          SHOWING 32 OF {channels.length} CHANNELS
        </div>
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 80px)',
          gap: 4,
        }}
      >
        {displayChannels.map((ch, i) => (
          <ChannelTile key={i} data={ch} onClick={() => setZoomed(ch)} />
        ))}
      </div>
      {(outputShape?.length || stats) && (
        <div style={{ color: '#888', fontSize: 11, marginTop: 8 }}>
          {outputShape?.length ? `Shape: [${outputShape.join(', ')}]` : ''}
          {stats && (
            <> · mean {Number(stats.mean).toFixed(4)} · std {Number(stats.std).toFixed(4)} · min {Number(stats.min).toFixed(4)} · max {Number(stats.max).toFixed(4)}</>
          )}
        </div>
      )}
      {zoomed && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setZoomed(null)}
        >
          <ChannelTile data={zoomed} width={400} height={400} />
        </div>
      )}
    </div>
  );
}
