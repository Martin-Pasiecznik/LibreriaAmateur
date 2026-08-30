import React, { useState } from 'react';

/**
 * SpoilerText — Renderiza un texto que puede contener bloques de spoiler.
 *
 * Marca soportada:
 *   [spoiler]texto oculto[/spoiler]
 *
 * El contenido marcado aparece tapado con un botón "Mostrar spoiler".
 * Al tocarlo se revela y queda visible (se puede volver a ocultar).
 *
 * SEGURIDAD: no usa dangerouslySetInnerHTML. El texto se parte y se
 * arma con elementos de React, así que no se puede inyectar HTML.
 */

// Un bloque individual de spoiler, con su propio estado
const SpoilerBlock = ({ children, theme }) => {
  const [revelado, setRevelado] = useState(false);

  if (!revelado) {
    return (
      <button
        type="button"
        onClick={() => setRevelado(true)}
        style={{
          display: 'inline-block',
          padding: '4px 12px',
          margin: '2px 0',
          borderRadius: '6px',
          border: `1px dashed ${theme.border}`,
          background: theme.card,
          color: theme.textMuted,
          fontSize: '0.8rem',
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: "'Inter', sans-serif",
        }}
      >
        ⚠ Mostrar spoiler
      </button>
    );
  }

  return (
    <span
      onClick={() => setRevelado(false)}
      title="Clic para ocultar de nuevo"
      style={{
        background: `${theme.accent}15`,
        borderLeft: `3px solid ${theme.accent}`,
        padding: '2px 8px',
        borderRadius: '4px',
        cursor: 'pointer',
      }}
    >
      {children}
    </span>
  );
};

const SpoilerText = ({ text, theme, style = {} }) => {
  if (!text) return null;

  // Separa el texto en trozos normales y trozos de spoiler
  const partes = text.split(/(\[spoiler\][\s\S]*?\[\/spoiler\])/gi);

  return (
    <p style={{ overflowWrap: 'break-word', wordBreak: 'break-word', whiteSpace: 'pre-wrap', ...style }}>
      {partes.map((parte, i) => {
        const m = parte.match(/^\[spoiler\]([\s\S]*?)\[\/spoiler\]$/i);
        if (m) {
          return <SpoilerBlock key={`sp-${i}`} theme={theme}>{m[1]}</SpoilerBlock>;
        }
        return <span key={`tx-${i}`}>{parte}</span>;
      })}
    </p>
  );
};

export default SpoilerText;