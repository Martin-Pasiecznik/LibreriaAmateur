import React from 'react';

/**
 * FormatToolbar — Botones de formato para el editor de capítulos.
 *
 * Envuelve el texto seleccionado del textarea con las marcas
 * correspondientes. Si no hay selección, inserta las marcas vacías
 * y deja el cursor en el medio.
 *
 * Props:
 *   textareaRef — ref al <textarea> que se va a modificar
 *   value       — el texto actual
 *   onChange    — función para actualizar el texto
 *   theme       — objeto de tema (colores)
 */
const FormatToolbar = ({ textareaRef, value, onChange, theme }) => {

  // Envuelve la selección con prefijo/sufijo
  const wrap = (prefix, suffix) => {
    const ta = textareaRef.current;
    if (!ta) return;

    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end);

    const nuevo =
      value.slice(0, start) + prefix + selected + suffix + value.slice(end);

    onChange(nuevo);

    // Devolver el foco y dejar el cursor donde corresponde
    setTimeout(() => {
      ta.focus();
      if (selected) {
        // Había selección: la dejamos seleccionada (ya envuelta)
        ta.setSelectionRange(start + prefix.length, end + prefix.length);
      } else {
        // No había: cursor en el medio de las marcas
        const pos = start + prefix.length;
        ta.setSelectionRange(pos, pos);
      }
    }, 0);
  };

  // Para alineación: aplica al párrafo completo donde está el cursor
  const alignParagraph = (tag) => {
    const ta = textareaRef.current;
    if (!ta) return;

    const start = ta.selectionStart;
    const end = ta.selectionEnd;

    // Buscar los límites del párrafo (hasta el salto de línea más cercano)
    let pStart = value.lastIndexOf('\n', start - 1) + 1;
    let pEnd = value.indexOf('\n', end);
    if (pEnd === -1) pEnd = value.length;

    let parrafo = value.slice(pStart, pEnd).trim();
    if (!parrafo) return;

    // Si ya tiene una alineación, se la quitamos primero
    parrafo = parrafo
      .replace(/^\[(centro|derecha)\]/, '')
      .replace(/\[\/(centro|derecha)\]$/, '');

    // Si el botón es el mismo que ya tenía, solo quitamos (toggle)
    const yaTenia = value.slice(pStart, pEnd).trim().startsWith(`[${tag}]`);
    const nuevoParrafo = yaTenia ? parrafo : `[${tag}]${parrafo}[/${tag}]`;

    const nuevo = value.slice(0, pStart) + nuevoParrafo + value.slice(pEnd);
    onChange(nuevo);

    setTimeout(() => {
      ta.focus();
      const pos = pStart + nuevoParrafo.length;
      ta.setSelectionRange(pos, pos);
    }, 0);
  };

  const btn = (extra = {}) => ({
    padding: '7px 14px',
    borderRadius: '8px',
    border: `1px solid ${theme.border}`,
    background: 'transparent',
    color: theme.textMain,
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
    transition: '0.2s',
    minWidth: '38px',
    ...extra,
  });

  return (
    <div style={{
      display: 'flex', gap: '6px', flexWrap: 'wrap',
      marginBottom: '10px', padding: '8px',
      borderRadius: '10px', border: `1px solid ${theme.border}`,
      background: theme.inputBg,
    }}>
      <button type="button" onClick={() => wrap('**', '**')}
        style={btn({ fontWeight: 800 })} title="Negrita">
        N
      </button>
      <button type="button" onClick={() => wrap('*', '*')}
        style={btn({ fontStyle: 'italic', fontFamily: 'serif' })} title="Cursiva">
        K
      </button>

      <div style={{ width: '1px', background: theme.border, margin: '2px 4px' }} />

      <button type="button" onClick={() => alignParagraph('centro')}
        style={btn()} title="Centrar párrafo">
        ≡ Centro
      </button>
      <button type="button" onClick={() => alignParagraph('derecha')}
        style={btn()} title="Alinear a la derecha">
        ≡ Derecha
      </button>

      <span style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: '0.7rem', color: theme.textMuted, paddingRight: '4px' }}>
        Seleccioná texto y elegí un formato
      </span>
    </div>
  );
};

export default FormatToolbar;