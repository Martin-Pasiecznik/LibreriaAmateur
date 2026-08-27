import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../App';
import { MAIN_GENRES, GENRE_GROUPS, MAX_GENRES, MAX_FREE_TAGS, MAX_FREE_TAG_LENGTH } from '../genres';

const PublishBook = ({ user, darkMode, refreshBooks }) => {
  const [title, setTitle] = useState('');
  const [authorName, setAuthorName] = useState(user?.name || '');
  const [description, setDescription] = useState('');
  const [bookNote, setBookNote] = useState('');
  const [selectedGenres, setSelectedGenres] = useState([]);  // lista cerrada
  const [freeTags, setFreeTags] = useState([]);              // libres del autor
  const [freeTagInput, setFreeTagInput] = useState('');
  const [showMoreGenres, setShowMoreGenres] = useState(false);
  const [isAdult, setIsAdult] = useState(false);
  const [cover, setCover] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const theme = {
    bg: darkMode ? '#0a0b10' : '#f4f0ea',
    card: darkMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.7)',
    accent: darkMode ? '#d4af37' : '#b85b3f',
    textMain: darkMode ? '#e3e1db' : '#2b2824',
    textMuted: darkMode ? '#8a8782' : '#857f77',
    border: darkMode ? 'rgba(212, 175, 55, 0.2)' : 'rgba(184, 91, 63, 0.2)',
    inputBg: darkMode ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)',
  };

  // Agregar / quitar un género (tope: MAX_GENRES)
  const toggleGenre = (genre) => {
    setSelectedGenres(prev => {
      if (prev.includes(genre)) return prev.filter(g => g !== genre);
      if (prev.length >= MAX_GENRES) return prev;   // no supera el tope
      return [...prev, genre];
    });
  };

  // Confirmar una etiqueta libre (Enter o coma)
  const addFreeTag = () => {
    const t = freeTagInput.trim().replace(/,/g, '');
    if (!t) return;
    if (t.length > MAX_FREE_TAG_LENGTH) return;
    if (freeTags.length >= MAX_FREE_TAGS) return;
    // Sin duplicados (ignorando mayúsculas)
    if (freeTags.some(x => x.toLowerCase() === t.toLowerCase())) {
      setFreeTagInput('');
      return;
    }
    setFreeTags(prev => [...prev, t]);
    setFreeTagInput('');
  };

  const removeFreeTag = (tag) => setFreeTags(prev => prev.filter(t => t !== tag));

  const handleFreeTagKey = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addFreeTag();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("La imagen es demasiado pesada. El límite es 2MB.");
        e.target.value = "";
        setCover(null);
        return;
      }
      setCover(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user?.session_token) {
      alert("Debes iniciar sesión para publicar.");
      return;
    }

    setSubmitting(true);

    const formData = new FormData();
    formData.append('title', title);
    formData.append('author', authorName.trim() || user.name);
    formData.append('description', description);
    formData.append('book_note', bookNote.trim());
    formData.append('is_adult', isAdult ? '1' : '0');
    // author_email ya no se usa: el backend lo toma del token
    formData.append('tags', selectedGenres.join(', '));
    formData.append('free_tags', freeTags.join(', '));
    if (cover) formData.append('cover', cover);

    try {
      // IMPORTANTE: Con FormData NO se pone Content-Type manual.
      // El navegador lo setea automáticamente con el boundary correcto.
      // Solo agregamos el Authorization header.
      const res = await fetch(`${API_BASE}/api/books`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.session_token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
      }

      if (refreshBooks) refreshBooks();
      navigate('/dashboard');
    } catch (err) {
      console.error("Error publicando libro:", err);
      alert(`No se pudo publicar: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '150px 20px', color: theme.textMain }}>
        <h2 style={{ fontFamily: "'Crimson Pro', serif", fontSize: '2rem' }}>Acceso Denegado</h2>
        <p style={{ opacity: 0.7, marginTop: '10px' }}>Debes iniciar sesión para publicar una obra.</p>
      </div>
    );
  }

  return (
    <div className="pub-container" style={{ maxWidth: '700px', margin: '0 auto', padding: '120px 20px 60px 20px', color: theme.textMain, fontFamily: "'Inter', sans-serif" }}>
      <div className="pub-card" style={{ backgroundColor: theme.card, padding: '40px', borderRadius: '24px', border: `1px solid ${theme.border}`, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>

        <header style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h2 style={{ fontFamily: "'Crimson Pro', serif", fontSize: '2.2rem', margin: 0, color: theme.accent }}>
            Publicar Nueva Historia
          </h2>
        </header>

        <form onSubmit={handleSubmit}>
          <label style={labelStyle(theme)}>NOMBRE DEL AUTOR</label>
          <input
            placeholder="Tu nombre o pseudónimo..."
            value={authorName}
            onChange={e => setAuthorName(e.target.value)}
            style={inputStyle(theme)}
            maxLength={50}
            required
          />
          <p style={{ fontSize: '0.75rem', color: theme.textMuted, marginTop: '-18px', marginBottom: '25px' }}>
            Por defecto es tu nombre de cuenta, pero puedes cambiarlo por un pseudónimo. Así figurará en la obra.
          </p>

          <label style={labelStyle(theme)}>TÍTULO DE LA OBRA</label>
          <input
            placeholder="Ej: La Leyenda del Norte"
            value={title}
            onChange={e => setTitle(e.target.value)}
            style={inputStyle(theme)}
            maxLength={100}
            required
          />

          <label style={labelStyle(theme)}>SINOPSIS / DESCRIPCIÓN</label>
          <textarea
            placeholder="Escribe una breve sinopsis para atraer a tus lectores..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            style={{ ...inputStyle(theme), height: '120px', resize: 'none', marginBottom: '6px' }}
            maxLength={2000}
            required
          />
          <div style={{ fontSize: '0.7rem', color: theme.textMuted, textAlign: 'right', marginBottom: '25px' }}>
            {description.length} / 2000
          </div>

          <label style={labelStyle(theme)}>NOTA DEL AUTOR (OPCIONAL)</label>
          <textarea
            placeholder="Un mensaje para tus lectores. Aparece bajo la sinopsis, solo si escribís algo."
            value={bookNote}
            onChange={e => setBookNote(e.target.value)}
            style={{ ...inputStyle(theme), height: '90px', resize: 'none' }}
            maxLength={2000}
          />

          {/* ── GÉNEROS (lista cerrada) ── */}
          <label style={labelStyle(theme)}>
            GÉNEROS ({selectedGenres.length}/{MAX_GENRES})
          </label>
          <p style={{ fontSize: '0.75rem', color: theme.textMuted, marginTop: '-4px', marginBottom: '14px' }}>
            Elegí los géneros que definen tu obra. Son los que usan los lectores para filtrar y buscar.
          </p>

          {/* Géneros seleccionados */}
          {selectedGenres.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
              {selectedGenres.map(g => (
                <span key={g} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '6px 14px', borderRadius: '20px', background: theme.accent, color: darkMode ? '#0a0b10' : '#fff', fontSize: '0.8rem', fontWeight: 700 }}>
                  {g}
                  <button type="button" onClick={() => toggleGenre(g)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, fontSize: '1rem', lineHeight: 1 }}>×</button>
                </span>
              ))}
            </div>
          )}

          {/* Principales */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
            {MAIN_GENRES.map(genre => {
              const sel = selectedGenres.includes(genre);
              const full = !sel && selectedGenres.length >= MAX_GENRES;
              return (
                <button
                  key={genre} type="button" onClick={() => toggleGenre(genre)} disabled={full}
                  style={{
                    ...genreBtnStyle(theme),
                    border: `1px solid ${sel ? theme.accent : theme.border}`,
                    background: sel ? `${theme.accent}20` : 'transparent',
                    color: sel ? theme.accent : theme.textMuted,
                    opacity: full ? 0.35 : 1,
                    cursor: full ? 'not-allowed' : 'pointer',
                    fontWeight: sel ? 700 : 600,
                  }}
                >
                  {sel ? '✓ ' : '+ '}{genre}
                </button>
              );
            })}
            <button
              type="button" onClick={() => setShowMoreGenres(v => !v)}
              style={{ ...genreBtnStyle(theme), color: theme.accent, borderColor: showMoreGenres ? theme.accent : theme.border, fontWeight: 700 }}
            >
              Más géneros {showMoreGenres ? '▴' : '▾'}
            </button>
          </div>

          {/* Panel de géneros secundarios */}
          {showMoreGenres && (
            <div style={{ marginBottom: '16px', padding: '18px', borderRadius: '14px', border: `1px solid ${theme.border}`, background: theme.inputBg }}>
              {GENRE_GROUPS.map(group => (
                <div key={group.title} style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: theme.accent, letterSpacing: '1px', marginBottom: '10px', opacity: 0.75 }}>
                    {group.title.toUpperCase()}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                    {group.tags.map(genre => {
                      const sel = selectedGenres.includes(genre);
                      const full = !sel && selectedGenres.length >= MAX_GENRES;
                      return (
                        <button
                          key={genre} type="button" onClick={() => toggleGenre(genre)} disabled={full}
                          style={{
                            ...genreBtnStyle(theme),
                            fontSize: '0.72rem',
                            border: `1px solid ${sel ? theme.accent : theme.border}`,
                            background: sel ? `${theme.accent}20` : 'transparent',
                            color: sel ? theme.accent : theme.textMuted,
                            opacity: full ? 0.35 : 1,
                            cursor: full ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {sel ? '✓ ' : ''}{genre}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── ETIQUETAS LIBRES ── */}
          <label style={labelStyle(theme)}>
            ETIQUETAS LIBRES ({freeTags.length}/{MAX_FREE_TAGS}) — OPCIONAL
          </label>
          <p style={{ fontSize: '0.75rem', color: theme.textMuted, marginTop: '-4px', marginBottom: '12px' }}>
            Palabras tuyas para describir la obra. Se muestran en la ficha, pero no se usan para filtrar.
          </p>

          {freeTags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
              {freeTags.map(t => (
                <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '5px 12px', borderRadius: '20px', border: `1px dashed ${theme.border}`, color: theme.textMuted, fontSize: '0.78rem' }}>
                  {t}
                  <button type="button" onClick={() => removeFreeTag(t)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, fontSize: '0.95rem', lineHeight: 1 }}>×</button>
                </span>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', marginBottom: '30px' }}>
            <input
              placeholder={freeTags.length >= MAX_FREE_TAGS ? 'Llegaste al máximo de etiquetas' : 'Escribí y presioná Enter...'}
              value={freeTagInput}
              onChange={e => setFreeTagInput(e.target.value)}
              onKeyDown={handleFreeTagKey}
              disabled={freeTags.length >= MAX_FREE_TAGS}
              maxLength={MAX_FREE_TAG_LENGTH}
              style={{ ...inputStyle(theme), marginBottom: 0, flex: 1 }}
            />
            <button
              type="button" onClick={addFreeTag}
              disabled={!freeTagInput.trim() || freeTags.length >= MAX_FREE_TAGS}
              style={{ padding: '0 22px', borderRadius: '12px', border: `1px solid ${theme.border}`, background: 'transparent', color: theme.accent, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', opacity: freeTagInput.trim() ? 1 : 0.4 }}
            >
              Agregar
            </button>
          </div>

          {/* +18 — contenido adulto */}
          <div
            onClick={() => setIsAdult(!isAdult)}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer',
              padding: '15px 18px', marginBottom: '30px', borderRadius: '12px',
              border: `1px solid ${isAdult ? '#e05252' : theme.border}`,
              backgroundColor: isAdult ? 'rgba(224,82,82,0.08)' : 'transparent',
              transition: '0.2s',
            }}
          >
            <div style={{
              width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0,
              border: `2px solid ${isAdult ? '#e05252' : theme.textMuted}`,
              backgroundColor: isAdult ? '#e05252' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: '0.8rem', fontWeight: 800,
            }}>
              {isAdult && '✓'}
            </div>
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: theme.textMain }}>
                Contenido para adultos (+18)
              </div>
              <div style={{ fontSize: '0.75rem', color: theme.textMuted, marginTop: '2px' }}>
                Marcá esta casilla si tu obra contiene material explícito o no apto para menores.
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <label style={{ ...labelStyle(theme), textAlign: 'center' }}>VISTA PREVIA DE PORTADA</label>
            <div style={{ width: '150px', aspectRatio: '2/3', backgroundColor: theme.inputBg, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${theme.border}`, margin: '15px auto', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
              <img
                src={cover ? URL.createObjectURL(cover) : `${API_BASE}/static/covers/default_cover.jpeg`}
                alt="Preview"
                style={{ width: '100%', height: '100%', objectFit: 'fit' }}
              />
            </div>
            <input type="file" accept="image/*" onChange={handleFileChange} style={{ fontSize: '0.8rem', color: theme.textMuted, cursor: 'pointer' }} />
            <p style={{ fontSize: '0.72rem', color: theme.textMuted, marginTop: '12px', lineHeight: 1.6, maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
              <strong style={{ color: theme.accent }}>Tamaño recomendado: 600 × 900 px</strong> (proporción 2:3, como una portada de libro).<br />
              Formatos JPG o PNG · Peso máximo 2 MB.<br />
              Las imágenes cuadradas o apaisadas se mostrarán con bordes.
            </p>
          </div>

          <button type="submit" disabled={submitting} style={{ ...submitBtnStyle(theme), opacity: submitting ? 0.6 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}>
            {submitting ? 'Publicando...' : 'Confirmar y Publicar'}
          </button>
        </form>
      </div>

      <style>{`
        /* Responsividad — solo disposición, sin tocar fuentes ni colores */
        @media (max-width: 600px) {
          .pub-container {
            padding: 90px 14px 40px 14px;
          }
          .pub-card {
            padding: 24px 18px;   /* menos padding para ganar ancho útil */
          }
        }
      `}</style>
    </div>
  );
};

const labelStyle = (theme) => ({ display: 'block', marginBottom: '10px', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '1.5px', color: theme.accent, opacity: 0.8 });
const inputStyle = (theme) => ({ width: '100%', padding: '15px', marginBottom: '25px', borderRadius: '12px', backgroundColor: theme.inputBg, color: theme.textMain, border: `1px solid ${theme.border}`, fontSize: '1rem', outline: 'none', boxSizing: 'border-box' });
const genreBtnStyle = (theme) => ({ padding: '6px 14px', borderRadius: '20px', border: `1px solid ${theme.border}`, backgroundColor: 'transparent', color: theme.textMuted, fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600, transition: '0.3s' });
const submitBtnStyle = (theme) => ({ width: '100%', padding: '16px', backgroundColor: theme.accent, color: theme.bg === '#0a0b10' ? '#000' : '#fff', border: 'none', borderRadius: '50px', cursor: 'pointer', fontWeight: 800, fontSize: '1rem', transition: '0.3s' });

export default PublishBook;