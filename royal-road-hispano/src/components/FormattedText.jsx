import React from 'react';

/**
 * FormattedText — Renderiza el texto de un capítulo con formato simple.
 *
 * Marcas soportadas:
 *   **texto**              → negrita
 *   *texto*                → cursiva
 *   [centro]...[/centro]   → párrafo centrado
 *   [derecha]...[/derecha] → párrafo alineado a la derecha
 *
 * SEGURIDAD: nunca usa dangerouslySetInnerHTML. El texto del usuario
 * se parte en pedazos y se renderiza como elementos de React, así que
 * es imposible inyectar HTML o scripts.
 */

// Convierte **negrita** y *cursiva* en elementos de React
function parseInline(text, keyPrefix) {
  const parts = [];
  // Divide el texto conservando los delimitadores
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  const chunks = text.split(regex);

  chunks.forEach((chunk, i) => {
    if (!chunk) return;
    const key = `${keyPrefix}-${i}`;

    if (chunk.startsWith('**') && chunk.endsWith('**') && chunk.length > 4) {
      parts.push(<strong key={key}>{chunk.slice(2, -2)}</strong>);
    } else if (chunk.startsWith('*') && chunk.endsWith('*') && chunk.length > 2) {
      parts.push(<em key={key}>{chunk.slice(1, -1)}</em>);
    } else {
      parts.push(chunk);
    }
  });

  return parts;
}

// Detecta la alineación de un párrafo y devuelve [textoLimpio, alineación]
function parseAlignment(paragraph) {
  const centro = paragraph.match(/^\[centro\]([\s\S]*)\[\/centro\]$/);
  if (centro) return [centro[1], 'center'];

  const derecha = paragraph.match(/^\[derecha\]([\s\S]*)\[\/derecha\]$/);
  if (derecha) return [derecha[1], 'right'];

  return [paragraph, 'left'];
}

const FormattedText = ({ text, paragraphStyle = {} }) => {
  if (!text) return null;

  // Separa en párrafos por saltos de línea
  const paragraphs = text.split(/\n+/).filter(p => p.trim());

  return (
    <>
      {paragraphs.map((para, i) => {
        const [clean, align] = parseAlignment(para.trim());
        return (
          <p key={`para-${i}`} style={{ ...paragraphStyle, textAlign: align }}>
            {parseInline(clean, `p${i}`)}
          </p>
        );
      })}
    </>
  );
};

export default FormattedText;