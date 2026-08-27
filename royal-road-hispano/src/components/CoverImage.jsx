import React, { useState } from 'react';
import { API_BASE } from '../App';

/**
 * CoverImage — Portada de libro con fallback elegante.
 *
 * Muestra la imagen de portada si existe y carga bien.
 * Si no hay portada, o si la imagen falla al cargar, muestra un
 * recuadro sólido con el título del libro (nunca colapsa ni deja
 * la tarjeta de otro tamaño).
 *
 * Props:
 *  - authorNote: el filename de la portada (book.author_note)
 *  - title: título del libro (se muestra si no hay imagen)
 *  - theme: objeto de tema (para colores)
 *  - darkMode: bool
 *  - style: estilos extra para el contenedor (border-radius, etc.)
 *  - titleSize: tamaño de fuente del título en el fallback (opcional)
 *  - thumb: si es true, pide la miniatura (200x300) en vez de la
 *           versión completa. Usalo en tarjetas y listados: se ve
 *           más nítido y la página carga mucho más rápido.
 */
const CoverImage = ({ authorNote, title, theme, darkMode, style = {}, titleSize = '0.95rem', thumb = false }) => {
  // ¿Hay una portada válida? (author_note no vacío ni el string "null")
  const hasCover = authorNote && authorNote !== 'null';
  // Si la imagen falla al cargar, cambiamos a modo fallback
  const [imgFailed, setImgFailed] = useState(false);

  const showFallback = !hasCover || imgFailed;

  // El contenedor SIEMPRE ocupa el 100% del espacio que le dé la tarjeta,
  // así el tamaño lo controla el padre y nunca colapsa.
  const containerStyle = {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    display: 'block',
    position: 'relative',
    ...style,
  };

  if (showFallback) {
    // Recuadro sólido con el título (estilo "portada tipográfica")
    return (
      <div style={{
        ...containerStyle,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px',
        textAlign: 'center',
        background: darkMode
          ? `linear-gradient(145deg, ${theme.accent}22, rgba(0,0,0,0.4))`
          : `linear-gradient(145deg, ${theme.accent}18, rgba(255,255,255,0.4))`,
        boxSizing: 'border-box',
      }}>
        <span style={{
          fontFamily: "'Crimson Pro', serif",
          fontSize: titleSize,
          fontWeight: 700,
          color: theme.textMain,
          lineHeight: 1.3,
          // Recorta títulos muy largos con "..." tras varias líneas
          display: '-webkit-box',
          WebkitLineClamp: 4,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {title}
        </span>
      </div>
    );
  }

  // Imagen normal
  // Si thumb=true, pide la versión chica (cover_123_thumb.jpg).
  // El backend sirve la grande como respaldo si la miniatura no existe.
  const archivo = thumb
    ? authorNote.replace(/(\.[^.]+)$/, '_thumb$1')
    : authorNote;

  return (
    <div style={{
      ...containerStyle,
      // Fondo suave para las franjas que puedan quedar (la imagen se
      // muestra completa, sin recortar, así que puede no llenar el
      // contenedor si su proporción difiere).
      background: darkMode ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.05)',
    }}>
      <img
        src={`${API_BASE}/static/covers/${archivo}`}
        alt={title}
        className="cover-img"
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', transition: 'transform 0.5s ease' }}
        onError={() => setImgFailed(true)}
      />
    </div>
  );
};

export default CoverImage;