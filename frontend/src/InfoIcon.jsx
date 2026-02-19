import React, { useState } from 'react';

export default function InfoIcon({ tooltip }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-block', marginLeft: 6 }}>
      <span
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 16,
          height: 16,
          borderRadius: '50%',
          border: '1px solid #888888',
          color: '#888888',
          fontSize: 10,
          fontWeight: 400,
          cursor: 'default',
          fontStyle: 'italic',
          userSelect: 'none',
        }}
      >
        i
      </span>
      {show && (
        <span
          style={{
            position: 'absolute',
            bottom: '120%',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#111111',
            border: '1px solid #333333',
            color: '#FFFFFF',
            fontSize: 11,
            padding: '6px 10px',
            whiteSpace: 'nowrap',
            zIndex: 999,
            pointerEvents: 'none',
            lineHeight: 1.5,
            maxWidth: 260,
            whiteSpace: 'normal',
          }}
        >
          {tooltip}
        </span>
      )}
    </span>
  );
}
