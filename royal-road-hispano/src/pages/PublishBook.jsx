import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../App';

const PublishBook = ({ user, darkMode, refreshBooks }) => {
  const [title, setTitle] = useState('');
  const [authorName, setAuthorName] = useState(user?.name || '');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
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

  const suggestedGenres = [
  // Géneros principales
  "Fantasía", "Romance", "Terror", "Misterio", "Ciencia Ficción", "Aventura",
  "Drama", "Acción", "Comedia", "Thriller",

  // Subgéneros populares en webnovelas
  "Isekai", "LitRPG", "Magia", "Mazmorra", "Reencarnación", "Regresión",
  "Sistema", "Cultivación", "Wuxia", "Xianxia",

  // Romance y slice of life
  "Slice of Life", "Romance Moderno", "BL", "GL", "Harem", "Amor Prohibido",

  // Ambientación
  "Mundo Apocalíptico", "Distopía", "Steampunk", "Cyberpunk", "Fantasía Oscura",
  "Alta Fantasía", "Fantasía Urbana", "Histórico", "Medieval",

  // Protagonista y tono
  "Protagonista Femenina", "Protagonista Masculino", "Anti-héroe",
  "Slow Burn", "Dark", "Fluffy", "Mature", "Guerra",
];

  const handleGenreClick = (genre) => {
    if (!tags.includes(genre)) {
      setTags(tags === "" ? genre : `${tags}, ${genre}`);
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
    // author_email ya no se usa: el backend lo toma del token
    formData.append('tags', tags);
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
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '120px 20px 60px 20px', color: theme.textMain, fontFamily: "'Inter', sans-serif" }}>
      <div style={{ backgroundColor: theme.card, padding: '40px', borderRadius: '24px', border: `1px solid ${theme.border}`, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>

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
            required
          />
          <p style={{ fontSize: '0.75rem', color: theme.textMuted, marginTop: '-18px', marginBottom: '25px' }}>
            Por defecto es tu nombre de cuenta, pero podés cambiarlo por un pseudónimo. Así figurará en la obra.
          </p>

          <label style={labelStyle(theme)}>TÍTULO DE LA OBRA</label>
          <input
            placeholder="Ej: La Leyenda del Norte"
            value={title}
            onChange={e => setTitle(e.target.value)}
            style={inputStyle(theme)}
            required
          />

          <label style={labelStyle(theme)}>SINOPSIS / DESCRIPCIÓN</label>
          <textarea
            placeholder="Escribe una breve sinopsis para atraer a tus lectores..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            style={{ ...inputStyle(theme), height: '120px', resize: 'none' }}
            required
          />

          <label style={labelStyle(theme)}>GÉNEROS Y ETIQUETAS</label>
          <input
            placeholder="Terror, Suspenso, Cyberpunk..."
            value={tags}
            onChange={e => setTags(e.target.value)}
            style={inputStyle(theme)}
          />

          <div style={{ marginBottom: '30px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {suggestedGenres.map(genre => (
              <button key={genre} type="button" onClick={() => handleGenreClick(genre)} style={genreBtnStyle(theme)}>
                + {genre}
              </button>
            ))}
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
          </div>

          <button type="submit" disabled={submitting} style={{ ...submitBtnStyle(theme), opacity: submitting ? 0.6 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}>
            {submitting ? 'Publicando...' : 'Confirmar y Publicar'}
          </button>
        </form>
      </div>
    </div>
  );
};

const labelStyle = (theme) => ({ display: 'block', marginBottom: '10px', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '1.5px', color: theme.accent, opacity: 0.8 });
const inputStyle = (theme) => ({ width: '100%', padding: '15px', marginBottom: '25px', borderRadius: '12px', backgroundColor: theme.inputBg, color: theme.textMain, border: `1px solid ${theme.border}`, fontSize: '1rem', outline: 'none', boxSizing: 'border-box' });
const genreBtnStyle = (theme) => ({ padding: '6px 14px', borderRadius: '20px', border: `1px solid ${theme.border}`, backgroundColor: 'transparent', color: theme.textMuted, fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600, transition: '0.3s' });
const submitBtnStyle = (theme) => ({ width: '100%', padding: '16px', backgroundColor: theme.accent, color: theme.bg === '#0a0b10' ? '#000' : '#fff', border: 'none', borderRadius: '50px', cursor: 'pointer', fontWeight: 800, fontSize: '1rem', transition: '0.3s' });

export default PublishBook;