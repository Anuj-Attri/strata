import React, { useState, useMemo } from 'react';
import { useStore } from './store';
import { theme } from './theme';
import InfoIcon from './InfoIcon';

const API_BASE = 'http://127.0.0.1:8000';

function detectInputType(nodes) {
  if (!nodes || !Array.isArray(nodes)) return 'tensor';
  const isVision = nodes.some(
    (n) =>
      n.type?.toLowerCase().includes('conv') ||
      n.name?.toLowerCase().includes('conv')
  );
  const isNLP = nodes.some(
    (n) =>
      n.type?.toLowerCase().includes('attention') ||
      n.type?.toLowerCase().includes('embed') ||
      n.name?.toLowerCase().includes('attention') ||
      n.name?.toLowerCase().includes('embed')
  );
  return isVision ? 'image' : isNLP ? 'text' : 'tensor';
}

export default function InputPanel() {
  const { modelGraph, isRunning, setRunning, clearCache, setLayerOrder } = useStore();
  const [imageB64, setImageB64] = useState('');
  const [textInput, setTextInput] = useState('');
  const [tensorInput, setTensorInput] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const inputType = useMemo(
    () => detectInputType(modelGraph?.nodes),
    [modelGraph?.nodes]
  );

  const canRun = modelGraph && !isRunning;

  const runInference = async () => {
    if (!canRun) return;
    let inputData = '';
    let inputHint = 'tensor';
    if (inputType === 'image') {
      inputData = imageB64.replace(/^data:[^;]+;base64,/, '');
      inputHint = 'image';
      if (!inputData) {
        alert('Please drop or select an image first.');
        return;
      }
    } else if (inputType === 'text') {
      inputData = textInput.trim();
      inputHint = 'text';
      if (!inputData) {
        alert('Please enter some text.');
        return;
      }
    } else {
      inputData = tensorInput.trim();
      inputHint = 'tensor';
      if (!inputData) {
        alert('Please enter comma-separated numbers.');
        return;
      }
    }
    setRunning(true);
    clearCache();
    try {
      const res = await fetch(`${API_BASE}/run-inference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input_data: inputData, input_hint: inputHint }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || res.statusText);
      }
      const data = await res.json();
      setLayerOrder(data.layer_ids || []);
    } catch (e) {
      console.error(e);
      alert(e.message || 'Inference failed');
    } finally {
      setRunning(false);
    }
  };

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => setImageB64(reader.result || '');
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    handleFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleFileInput = (e) => {
    const file = e.target?.files?.[0];
    handleFile(file);
  };

  return (
    <div
      style={{
        height: '100%',
        padding: '16px 24px',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 24,
        borderTop: `1px solid ${theme.border}`,
        background: 'linear-gradient(0deg, #0a0a0a 0%, #000000 100%)',
      }}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
        {inputType === 'image' && (
          <>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => document.getElementById('strata-file-input')?.click()}
              style={{
                border: `1px dashed ${theme.primary}`,
                borderRadius: 0,
                padding: 16,
                textAlign: 'center',
                cursor: 'pointer',
                background: dragOver ? theme.hover : theme.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
              }}
            >
              {imageB64 ? (
                <img
                  src={imageB64}
                  alt="Preview"
                  style={{ width: 40, height: 40, objectFit: 'cover' }}
                />
              ) : null}
              <span style={{ color: theme.primary, fontSize: 12 }}>
                {imageB64 ? 'Image loaded — click to change' : 'Drop image here or click to browse'}
              </span>
            </div>
            <input
              id="strata-file-input"
              type="file"
              accept=".jpg,.jpeg,.png,.bmp"
              style={{ display: 'none' }}
              onChange={handleFileInput}
            />
            <div style={{ fontSize: 10, color: theme.secondary, letterSpacing: theme.tracking, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
              DROP AN IMAGE — .jpg .png .bmp
              <InfoIcon tooltip="Your image will be resized to match the model's expected input size and normalized automatically." />
            </div>
          </>
        )}
        {inputType === 'text' && (
          <>
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Enter a sentence…"
              style={{
                width: '100%',
                padding: '10px 12px',
                background: theme.bg,
                border: `1px solid ${theme.border}`,
                color: theme.primary,
                fontFamily: theme.font,
                fontSize: 13,
              }}
            />
            <div style={{ fontSize: 10, color: theme.secondary, letterSpacing: theme.tracking, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
              ENTER TEXT
              <InfoIcon tooltip="Text is tokenized automatically using a BERT-compatible tokenizer." />
            </div>
          </>
        )}
        {inputType === 'tensor' && (
          <>
            <input
              type="text"
              value={tensorInput}
              onChange={(e) => setTensorInput(e.target.value)}
              placeholder="0.1, 0.5, -0.3, …"
              style={{
                width: '100%',
                padding: '10px 12px',
                background: theme.bg,
                border: `1px solid ${theme.border}`,
                color: theme.primary,
                fontFamily: theme.font,
                fontSize: 13,
              }}
            />
            <div style={{ fontSize: 10, color: theme.secondary, letterSpacing: theme.tracking, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
              RAW TENSOR INPUT
              <InfoIcon tooltip="Enter comma-separated float values. They will be shaped to match your model's expected input." />
            </div>
          </>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <button
          type="button"
          onClick={runInference}
          disabled={!canRun}
          style={{
            width: 200,
            height: 56,
            background: canRun ? theme.primary : theme.border,
            color: canRun ? theme.bg : '#444444',
            border: 'none',
            fontFamily: theme.font,
            fontSize: 11,
            letterSpacing: theme.tracking,
            textTransform: 'uppercase',
            cursor: canRun ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: isRunning ? 'pulse 1s ease-in-out infinite' : undefined,
          }}
          onMouseEnter={(e) => {
            if (canRun) {
              e.currentTarget.style.background = theme.hover;
              e.currentTarget.style.color = theme.primary;
              e.currentTarget.style.border = `1px solid ${theme.primary}`;
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = canRun ? theme.primary : theme.border;
            e.currentTarget.style.color = canRun ? theme.bg : '#444444';
            e.currentTarget.style.border = 'none';
          }}
        >
          {isRunning ? 'Running…' : 'Run inference'}
        </button>
        <InfoIcon tooltip="Runs your input through every layer of the model and captures the full tensor output at each stage." />
      </div>
    </div>
  );
}
