import React from 'react';
import { theme } from './theme';

export default function FileSizeModal({ size, onConfirm, onCancel }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          width: 400,
          border: '1px solid #FFFFFF',
          borderRadius: 0,
          padding: 32,
          background: theme.bg,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            fontFamily: theme.font,
            fontSize: 12,
            letterSpacing: theme.tracking,
            textTransform: 'uppercase',
            color: theme.primary,
            marginBottom: 16,
            fontWeight: 300,
          }}
        >
          Export confirmation
        </div>
        <p style={{ color: theme.primary, fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
          This file will be approximately {size}.<br />
          Full tensor data — input and output — no truncation.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: '10px 18px',
              background: theme.primary,
              color: theme.bg,
              border: 'none',
              fontFamily: theme.font,
              fontSize: 10,
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
            Confirm export
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '10px 18px',
              background: 'transparent',
              color: theme.primary,
              border: `1px solid ${theme.primary}`,
              fontFamily: theme.font,
              fontSize: 10,
              letterSpacing: theme.tracking,
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = theme.hover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
