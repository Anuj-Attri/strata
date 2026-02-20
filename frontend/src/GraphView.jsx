import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from './store';
import { theme } from './theme';
import InfoIcon from './InfoIcon';
import BackgroundGrid from './BackgroundGrid';

const NODE_LIMIT = 200;
const INITIAL_DISPLAY_COUNT = 50;
const TEXTURE_CAP = 50;

function buildLayout(nodes) {
  const positions = {};
  nodes.forEach((node, index) => {
    const col = index % 20;
    const row = Math.floor(index / 20);
    positions[node.id] = [col * 3 - 30, row * -2.5 + 10, 0];
  });
  return positions;
}

function getNodeColor(type, isSelected, hasFired) {
  if (isSelected) return '#FFFFFF';
  if (!hasFired) {
    const t = type?.toLowerCase() || '';
    if (t.includes('conv')) return '#2a2a2a';
    if (t.includes('sigmoid') || t.includes('mul')) return '#1e1e1e';
    if (t.includes('concat') || t.includes('add')) return '#252525';
    if (t.includes('resize') || t.includes('upsample')) return '#1a1a1a';
    return '#222222';
  }
  const t = type?.toLowerCase() || '';
  if (t.includes('conv')) return '#FFFFFF';
  if (t.includes('sigmoid') || t.includes('mul')) return '#CCCCCC';
  if (t.includes('concat')) return '#AAAAAA';
  return '#BBBBBB';
}

function makeTextTexture(line1, line2) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 24px monospace';
  ctx.textAlign = 'center';
  ctx.fillText((line1 || 'OP').slice(0, 14), 128, 50);
  ctx.fillStyle = '#444444';
  ctx.font = '16px monospace';
  ctx.fillText((line2 || '').slice(0, 22), 128, 85);
  return new THREE.CanvasTexture(canvas);
}

function makeTensorTexture(outputTensor, outputShape) {
  if (!outputTensor || !outputShape || outputShape.length === 0) return null;
  if (Array.isArray(outputTensor) && outputTensor.length === 0) return null;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 64, 64);
  try {
    let grid = null;
    if (outputShape?.length === 4) {
      grid = outputTensor[0]?.[0];
    } else if (outputShape?.length === 3) {
      grid = outputTensor[0];
    } else if (outputShape?.length === 2) {
      grid = [outputTensor[0]];
    } else {
      const flat = outputTensor.flat(Infinity).slice(0, 64);
      grid = [flat];
    }
    if (grid && Array.isArray(grid)) {
      const srcH = grid.length;
      const srcW = grid[0]?.length ?? 1;
      const renderW = Math.min(srcW, 64);
      const renderH = Math.min(srcH, 64);
      const sampled = [];
      for (let y = 0; y < renderH; y++) {
        const srcY = Math.floor((y * srcH) / renderH);
        for (let x = 0; x < renderW; x++) {
          const srcX = Math.floor((x * srcW) / renderW);
          const row = grid[srcY];
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
      const imageData = ctx.createImageData(renderW, renderH);
      for (let i = 0; i < sampled.length; i++) {
        const n = Math.round(((sampled[i] - min) / range) * 255);
        imageData.data[i * 4] = n;
        imageData.data[i * 4 + 1] = n;
        imageData.data[i * 4 + 2] = n;
        imageData.data[i * 4 + 3] = 255;
      }
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = renderW;
      tempCanvas.height = renderH;
      tempCanvas.getContext('2d').putImageData(imageData, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tempCanvas, 0, 0, 64, 64);
    }
  } catch (e) {
    ctx.fillStyle = '#333';
    ctx.fillRect(8, 8, 48, 48);
  }
  return new THREE.CanvasTexture(canvas);
}

function GraphNode({ node, position, isSelected, hasFired, record, onSelect, hasTexture, getTexture }) {
  const texture = hasTexture && getTexture ? getTexture(node, record) : null;
  const selectNode = (e) => {
    e.stopPropagation();
    onSelect(node.id);
  };

  return (
    <group position={position}>
      <mesh position={[0, 0, 0.06]} onPointerDown={selectNode}>
        <planeGeometry args={[2.9, 1.3]} />
        {texture ? (
          <meshBasicMaterial map={texture} transparent={false} />
        ) : (
          <meshBasicMaterial color="#111111" />
        )}
      </mesh>
      <mesh position={[0, 0, -0.06]} onPointerDown={selectNode}>
        <boxGeometry args={[3, 1.4, 0.12]} />
        <meshBasicMaterial color="#111111" />
      </mesh>
    </group>
  );
}

function GraphEdges({ edges, positions, visibleIds }) {
  const visibleSet = useMemo(() => new Set(visibleIds), [visibleIds]);
  const filteredEdges = useMemo(
    () => edges.filter((e) => visibleSet.has(e.from) && visibleSet.has(e.to)),
    [edges, visibleSet]
  );
  const linePoints = useMemo(() => {
    const pts = [];
    filteredEdges.forEach((e) => {
      const from = positions[e.from] || [0, 0, 0];
      const to = positions[e.to] || [0, 0, 0];
      pts.push(from, to);
    });
    return pts;
  }, [filteredEdges, positions]);

  if (linePoints.length === 0) return null;
  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={linePoints.length}
          array={new Float32Array(linePoints.flat())}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color="#444444" />
    </lineSegments>
  );
}

function Scene({ nodes, edges, positions, showAllNodes }) {
  const selectedLayerId = useStore((state) => state.selectedLayerId);
  const setSelectedLayer = useStore((state) => state.setSelectedLayer);
  const inferenceCache = useStore((state) => state.inferenceCache);
  const layerOrder = useStore((state) => state.layerOrder);
  const controlsRef = useRef(null);
  const textureCache = useRef({});
  const [textureVisibleSet, setTextureVisibleSet] = useState(() => new Set());

  const visibleNodes = useMemo(
    () =>
      nodes.length > NODE_LIMIT && !showAllNodes
        ? nodes.slice(0, INITIAL_DISPLAY_COUNT)
        : nodes,
    [nodes, showAllNodes]
  );
  const visibleIds = useMemo(() => visibleNodes.map((n) => n.id), [visibleNodes]);
  const firedSet = useMemo(() => new Set(layerOrder), [layerOrder]);

  const textureVisibleIds = useMemo(() => {
    if (visibleNodes.length <= TEXTURE_CAP) return new Set(visibleIds);
    return new Set(visibleNodes.slice(0, TEXTURE_CAP).map((n) => n.id));
  }, [visibleNodes, visibleIds]);

  useFrame(({ camera }) => {
    const camY = camera.position.y;
    const nearby = new Set(
      visibleNodes.filter((_, i) => {
        const row = Math.floor(i / 20);
        const nodeY = row * -2.5 + 10;
        return Math.abs(nodeY - camY) < 25;
      }).map((n) => n.id)
    );
    setTextureVisibleSet((prev) => {
      if (prev.size !== nearby.size || [...prev].some((id) => !nearby.has(id))) return nearby;
      return prev;
    });
  });

  useEffect(() => {
    if (Object.keys(inferenceCache).length === 0) {
      Object.values(textureCache.current).forEach((t) => t && t.dispose && t.dispose());
      textureCache.current = {};
    }
  }, [inferenceCache]);

  const getTexture = useCallback((node, record) => {
    const hasFired = record?.output_tensor != null && record?.output_shape?.length;
    const key = `${node.id}-${hasFired ? 'fired' : 'label'}`;
    if (textureCache.current[key]) return textureCache.current[key];
    let tex;
    if (hasFired && record?.output_tensor != null && record?.output_shape?.length) {
      tex = makeTensorTexture(record.output_tensor, record.output_shape);
    } else {
      tex = makeTextTexture(
        node.type?.toUpperCase() || 'OP',
        node.name?.split('/').pop()?.slice(0, 20) || ''
      );
    }
    if (tex) textureCache.current[key] = tex;
    return tex;
  }, []);

  const showTextureSet = useMemo(() => {
    const s = new Set();
    textureVisibleIds.forEach((id) => s.add(id));
    textureVisibleSet.forEach((id) => s.add(id));
    return s;
  }, [textureVisibleIds, textureVisibleSet]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && controlsRef.current) {
        controlsRef.current.mouseButtons = {
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        };
      }
    };
    const handleKeyUp = () => {
      if (controlsRef.current) {
        controlsRef.current.mouseButtons = {
          LEFT: THREE.MOUSE.PAN,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.ROTATE,
        };
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const defaultMouseButtons = useMemo(
    () => ({
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    }),
    []
  );

  return (
    <>
      <ambientLight intensity={2} />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.05}
        minDistance={5}
        maxDistance={200}
        mouseButtons={defaultMouseButtons}
        touches={{
          ONE: THREE.TOUCH.PAN,
          TWO: THREE.TOUCH.DOLLY_ROTATE,
        }}
      />
      {visibleNodes.map((node) => {
        const pos = positions[node.id] || [0, 0, 0];
        let record =
          inferenceCache[node.id] ||
          inferenceCache[node.id?.replace(/[^a-zA-Z0-9_]/g, '_')];
        if (!record) {
          const nodeName = node.name?.split('/').pop();
          const clean = (s) => s?.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || '';
          const nClean = clean(nodeName);
          record = Object.values(inferenceCache).find((r) => {
            const rClean = clean(r.name);
            return nClean && rClean && rClean.includes(nClean);
          }) ?? null;
        }
        return (
          <GraphNode
            key={node.id}
            node={node}
            position={pos}
            isSelected={selectedLayerId === node.id}
            hasFired={firedSet.has(node.id)}
            record={record}
            onSelect={setSelectedLayer}
            hasTexture={showTextureSet.has(node.id)}
            getTexture={getTexture}
          />
        );
      })}
      <GraphEdges edges={edges} positions={positions} visibleIds={visibleIds} />
    </>
  );
}

export default function GraphView() {
  const { modelGraph } = useStore();
  const [showAllNodes, setShowAllNodes] = useState(false);

  const nodes = modelGraph?.nodes ?? [];
  const edges = modelGraph?.edges ?? [];

  const positions = useMemo(
    () => (nodes.length ? buildLayout(nodes) : {}),
    [nodes]
  );

  const displayCount =
    nodes.length > NODE_LIMIT && !showAllNodes ? INITIAL_DISPLAY_COUNT : nodes.length;
  const hasMore = nodes.length > NODE_LIMIT && !showAllNodes;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: theme.bg }}>
      {!modelGraph && (
        <div
          className="graph-empty-state"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
          }}
        >
          <div
            style={{
              color: '#FFFFFF',
              fontFamily: theme.font,
              fontWeight: 200,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              fontSize: 22,
              marginBottom: 12,
            }}
          >
            STRATA
          </div>
          <div
            style={{
              color: 'rgba(255,255,255,0.7)',
              fontFamily: theme.font,
              fontSize: 12,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
            }}
          >
            Drop a .pt or .onnx model to begin.
          </div>
        </div>
      )}
      <Canvas
        camera={{ position: [0, 0, 60], fov: 75, near: 0.1, far: 5000 }}
        style={{ background: '#000000', width: '100%', height: '100%' }}
        gl={{ antialias: true }}
      >
        <BackgroundGrid />
        <Scene
          nodes={nodes}
          edges={edges}
          positions={positions}
          showAllNodes={showAllNodes}
        />
      </Canvas>
      {hasMore && (
        <button
          type="button"
          onClick={() => setShowAllNodes(true)}
          style={{
            position: 'absolute',
            bottom: 16,
            left: 16,
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
        >
          LOAD ALL NODES ({nodes.length})
        </button>
      )}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: hasMore ? '50%' : 16,
          transform: hasMore ? 'translateX(-50%)' : undefined,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: theme.secondary,
          fontSize: 10,
          letterSpacing: theme.tracking,
          textTransform: 'uppercase',
        }}
      >
        <span>{hasMore ? `SHOWING ${INITIAL_DISPLAY_COUNT} OF ${nodes.length} — LOAD MORE` : `Architecture graph — ${displayCount} nodes`}</span>
        <InfoIcon tooltip="This graph shows the structure of your model. Click any node to inspect its tensor data." />
      </div>
    </div>
  );
}
