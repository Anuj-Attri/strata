import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, RoundedBox, Text, Tube } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from './store';
import { theme } from './theme';

function buildLayout(nodes, edges) {
  const nodeMap = new Map(nodes.map((n) => [n.id, { ...n, depth: 0, children: [] }]));
  const inDegree = new Map(nodes.map((n) => [n.id, 0]));
  edges.forEach((e) => {
    const d = inDegree.get(e.to) ?? 0;
    inDegree.set(e.to, d + 1);
  });
  const roots = nodes.filter((n) => inDegree.get(n.id) === 0).map((n) => n.id);
  const queue = roots.map((id) => ({ id, depth: 0 }));
  const visited = new Set(roots);
  while (queue.length) {
    const { id, depth } = queue.shift();
    const node = nodeMap.get(id);
    if (node) node.depth = depth;
    edges.forEach((e) => {
      if (e.from !== id) return;
      if (!visited.has(e.to)) {
        visited.add(e.to);
        queue.push({ id: e.to, depth: depth + 1 });
      }
    });
  }
  const byDepth = new Map();
  nodeMap.forEach((node) => {
    const d = node.depth;
    if (!byDepth.has(d)) byDepth.set(d, []);
    byDepth.get(d).push(node.id);
  });
  const positions = {};
  const depthCounts = new Map();
  [...byDepth.keys()].sort((a, b) => a - b).forEach((depth) => {
    const ids = byDepth.get(depth);
    const n = ids.length;
    depthCounts.set(depth, n);
    const spacing = Math.max(2.5, n * 1.2);
    const startX = -((n - 1) * spacing) / 2;
    ids.forEach((id, i) => {
      let y = 0;
      const node = nodeMap.get(id);
      const childCount = edges.filter((e) => e.from === id).length;
      if (childCount > 1) y = (i - (n - 1) / 2) * 1.5;
      positions[id] = [
        startX + i * spacing,
        y,
        depth * -4,
      ];
    });
  });
  return { positions, nodeMap: Object.fromEntries(nodeMap) };
}

function Node({ id, name, typeName, position, selected, onSelect, hasFired, positions, controlsRef }) {
  const meshRef = useRef();
  const groupRef = useRef();
  const [hovered, setHovered] = useState(false);
  const [pulse, setPulse] = useState(0);
  const pulseRef = useRef(0);

  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.layer_id === id) {
        setPulse(1);
        pulseRef.current = 1;
      }
    };
    window.addEventListener('strata:layer-fired', handler);
    return () => window.removeEventListener('strata:layer-fired', handler);
  }, [id]);

  useFrame((_, delta) => {
    if (pulseRef.current > 0) {
      pulseRef.current -= delta / 0.4;
      if (pulseRef.current < 0) pulseRef.current = 0;
    }
    const s = 1 + (pulseRef.current > 0 ? pulseRef.current * 0.2 : 0) + (hovered ? 0.05 : 0);
    if (groupRef.current?.scale) groupRef.current.scale.setScalar(s);
  });

  const isSelected = selected === id;
  const filled = isSelected || hasFired;

  const label = name.length > 18 ? name.slice(0, 18) + '…' : name;

  const handleDoubleClick = () => {
    if (controlsRef?.current && positions?.[id]) {
      const [x, y, z] = positions[id];
      controlsRef.current.target.set(x, y, z);
    }
  };

  return (
    <group ref={groupRef} position={position} onDoubleClick={handleDoubleClick}>
      <RoundedBox
        args={[1.8, 0.8, 0.1]}
        radius={0}
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <meshBasicMaterial
          color={theme.primary}
          wireframe={!filled}
          transparent={hasFired && !isSelected}
          opacity={hasFired && !isSelected ? 0.9 : 1}
        />
      </RoundedBox>
      {hovered && (
        <pointLight position={[0, 0, 0.5]} intensity={2} color="#FFFFFF" distance={3} />
      )}
      <Text
        position={[0, 0.55, 0]}
        fontSize={0.12}
        color={isSelected ? '#000000' : theme.primary}
        anchorX="center"
        anchorY="middle"
        font="https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2"
        maxWidth={2}
      >
        {label}
      </Text>
      <Text
        position={[0, -0.45, 0]}
        fontSize={0.09}
        color={theme.secondary}
        anchorX="center"
        anchorY="middle"
        font="https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2"
      >
        {typeName}
      </Text>
    </group>
  );
}

function Edge({ fromPos, toPos }) {
  const curve = useMemo(() => {
    const mid1 = new THREE.Vector3().lerpVectors(
      new THREE.Vector3(...fromPos),
      new THREE.Vector3(...toPos),
      0.33
    );
    const mid2 = new THREE.Vector3().lerpVectors(
      new THREE.Vector3(...fromPos),
      new THREE.Vector3(...toPos),
      0.66
    );
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(...fromPos),
      mid1,
      mid2,
      new THREE.Vector3(...toPos),
    ]);
  }, [fromPos, toPos]);
  return (
    <Tube args={[curve, 20, 0.015, 8, false]}>
      <meshBasicMaterial color={theme.primary} />
    </Tube>
  );
}

function Scene({ nodes, edges, positions, selected, onSelect, layerOrder, controlsRef }) {
  const firedSet = useMemo(() => new Set(layerOrder), [layerOrder]);

  return (
    <>
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.05}
        minDistance={5}
        maxDistance={120}
      />
      {nodes.map((n) => (
        <Node
          key={n.id}
          id={n.id}
          name={n.name || n.id}
          typeName={n.type || 'Layer'}
          position={positions[n.id] || [0, 0, 0]}
          selected={selected}
          onSelect={onSelect}
          hasFired={firedSet.has(n.id)}
          positions={positions}
          controlsRef={controlsRef}
        />
      ))}
      {edges.map((e) => {
        const fromPos = positions[e.from] || [0, 0, 0];
        const toPos = positions[e.to] || [0, 0, 0];
        return <Edge key={`${e.from}-${e.to}`} fromPos={fromPos} toPos={toPos} />;
      })}
    </>
  );
}

export default function GraphView() {
  const { modelGraph, selectedLayerId, setSelectedLayer, layerOrder } = useStore();
  const controlsRef = useRef(null);
  const nodes = modelGraph?.nodes ?? [];
  const edges = modelGraph?.edges ?? [];
  const { positions } = useMemo(
    () => (nodes.length ? buildLayout(nodes, edges) : { positions: {} }),
    [nodes, edges]
  );

  const resetView = () => {
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.object.position.set(0, 0, 40);
      controlsRef.current.update();
    }
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: theme.bg }}>
      <Canvas
        camera={{ position: [0, 0, 40], fov: 50 }}
        gl={{ antialias: true }}
        style={{ background: '#000000' }}
        onCreated={({ gl }) => {
          gl.setClearColor('#000000');
        }}
      >
        <Scene
          nodes={nodes}
          edges={edges}
          positions={positions}
          selected={selectedLayerId}
          onSelect={setSelectedLayer}
          layerOrder={layerOrder}
          controlsRef={controlsRef}
        />
      </Canvas>
      <button
        type="button"
        onClick={resetView}
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
        onMouseEnter={(e) => {
          e.currentTarget.style.background = theme.hover;
          e.currentTarget.style.borderColor = theme.primary;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = theme.bg;
          e.currentTarget.style.borderColor = theme.border;
        }}
      >
        Reset view
      </button>
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: theme.secondary,
          fontSize: 10,
          letterSpacing: theme.tracking,
          textTransform: 'uppercase',
        }}
      >
        <span>Architecture graph</span>
        <span
          title="This graph shows the structure of your model. Data flows through each layer (node) in sequence. Click any node to inspect its tensor data."
          style={{ cursor: 'help', opacity: 0.8 }}
        >
          (i)
        </span>
      </div>
    </div>
  );
}
