import React, { useState, useEffect } from 'react';
import { theme } from './theme';
import InfoIcon from './InfoIcon';

const STORAGE_KEY = 'strata_onboarded';

const steps = [
  {
    heading: 'LOAD YOUR MODEL',
    body: 'Drag a .pt or .onnx file into Strata, or click to browse your filesystem. Strata supports PyTorch and ONNX formats.',
    tooltip: 'PyTorch (.pt) and ONNX (.onnx) are the two most common formats for saving trained AI models.',
  },
  {
    heading: 'PROVIDE INPUT',
    body: 'Give your model something to process — an image, a sentence, or raw numbers. Strata will run it through the model and capture the output of every single layer.',
    tooltip: 'Input is the data your model was designed to process. Vision models expect images. Language models expect text.',
  },
  {
    heading: 'EXPLORE THE STRATA',
    body: "Click any node in the 3D graph to inspect its complete tensor data, parameters, and shapes. Nothing is hidden. Nothing is truncated.",
    tooltip: "Each node in the graph is one layer of your model — a mathematical operation that transforms your data as it passes through.",
  },
];

export default function OnboardingFlow() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    setVisible(!done);
  }, []);

  const finish = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setVisible(false);
  };

  if (!visible) return null;

  const s = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.9)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9998,
        fontFamily: theme.font,
      }}
    >
      <button
        type="button"
        onClick={finish}
        style={{
          position: 'absolute',
          top: 24,
          right: 24,
          background: 'transparent',
          border: 'none',
          color: theme.secondary,
          fontSize: 11,
          letterSpacing: theme.tracking,
          textTransform: 'uppercase',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = theme.primary;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = theme.secondary;
        }}
      >
        Skip
      </button>

      <div style={{ maxWidth: 480, textAlign: 'center', padding: 24 }}>
        <h2
          style={{
            fontFamily: theme.font,
            fontWeight: 100,
            letterSpacing: theme.tracking,
            textTransform: 'uppercase',
            color: theme.primary,
            fontSize: 24,
            marginBottom: 20,
          }}
        >
          {s.heading}
        </h2>
        <p
          style={{
            color: theme.primary,
            fontSize: 15,
            lineHeight: 1.6,
            marginBottom: 16,
          }}
        >
          {s.body}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 32 }}>
          <InfoIcon tooltip={s.tooltip} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 40 }}>
          {steps.map((_, i) => (
            <span
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: i === step ? theme.primary : '#444444',
              }}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={isLast ? finish : () => setStep((prev) => prev + 1)}
          style={{
            padding: '12px 28px',
            background: theme.primary,
            color: theme.bg,
            border: 'none',
            fontFamily: theme.font,
            fontSize: 11,
            letterSpacing: theme.tracking,
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = theme.hover;
            e.currentTarget.style.border = `1px solid ${theme.primary}`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = theme.primary;
            e.currentTarget.style.border = 'none';
          }}
        >
          {isLast ? 'Begin' : 'Next'}
        </button>
      </div>
    </div>
  );
}
