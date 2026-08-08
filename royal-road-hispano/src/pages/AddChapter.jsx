import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_BASE, authHeader } from '../App';

const AddChapter = ({ user, darkMode }) => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingChapters, setExistingChapters] = useState([]);

  const theme = {
    bg: darkMode ? '#0a0b10' : '#f4f0ea',
    card: darkMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.7)',
    accent: darkMode ? '#d4af37' : '#b85b3f',
    textMain: darkMode ? '#e3e1db' : '#2b2824',
    textMuted: darkMode ? '#8a8782' : '#857f77',
    border: darkMode ? 'rgba(212, 175, 55, 0.2)' : 'rgba(184, 91, 63, 0.2)',
    inputBg: darkMode ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)',
  };

  // GET capítulos es público — no necesita token
  useEffect(() => {
    fetch(`${API_BASE}/api/books/${id}/chapters`)
      .then(res => res.json())
      .then(data => setExistingChapters(Array.isArray(data) ? data : []))
      .catch(err => console.error("Error cargando capítulos:", err));
  }, [id]);

  const countWords = (text) => {
    if (!text.trim()) return 0;
    return text.trim().split(/\s+/).length;
  };

  const wordCount = countWords(content);

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '150px 20px', color: theme.textMain }}>
        <h2 style={{ fontFamily: "'Crimson Pro', serif", fontSize: '2rem' }}>Acceso Denegado</h2>
        <p style={{ opacity: 0.7 }}>Debes iniciar sesión para escribir capítulos.</p>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user?.session_token) {
      alert("Sesión expirada. Volvé a iniciar sesión.");
      return;
    }
    setIsSubmitting(true);

    try {
      const res = await fetch(`${API_BASE}/api/chapters`, {
        method: 'POST',
        headers: authHeader(user), // incluye Authorization + Content-Type: application/json
        body: JSON.stringify({
          book_id: id,
          title: title.trim(),
          content: content,
          word_count: wordCount,
          // author_email eliminado: el backend lo toma del token
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
      }

      navigate(`/dashboard/book/${id}`);
    } catch (err) {
      console.error("Error publicando capítulo:", err);
      alert(`No se pudo publicar: ${err.message}`);
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: theme.bg, paddingTop: '80px', fontFamily: "'Inter', sans-serif" }}>

      {/* SIDEBAR */}
      <aside style={{ width: '300px', padding: '40px 20px', borderRight: `1px solid ${theme.border}`, position: 'sticky', top: '80px', height: 'calc(100vh - 80px)', overflowY: 'auto' }}>
        <h3 style={{ fontFamily: "'Crimson Pro', serif", color: theme.accent, fontSize: '1.4rem', marginBottom: '20px' }}>
          Índice Actual
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {existingChapters.length === 0 ? (
            <p style={{ color: theme.textMuted, fontSize: '0.9rem', fontStyle: 'italic' }}>Aún no hay capítulos publicados.</p>
          ) : (
            existingChapters.map((cap, index) => (
              <div key={cap.id} style={{ padding: '12px', borderRadius: '8px', backgroundColor: theme.card, border: `1px solid ${theme.border}`, fontSize: '0.9rem', color: theme.textMain }}>
                <span style={{ color: theme.accent, fontWeight: 'bold', marginRight: '8px' }}>{index + 1}.</span>
                {cap.title}
              </div>
            ))
          )}
        </div>
      </aside>

      {/* EDITOR */}
      <main style={{ flex: 1, padding: '40px 60px', maxWidth: '1000px' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: theme.textMuted, cursor: 'pointer', marginBottom: '30px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          ← Volver al libro
        </button>

        <div style={{ backgroundColor: theme.card, padding: '40px', borderRadius: '24px', border: `1px solid ${theme.border}`, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
          <header style={{ marginBottom: '30px' }}>
            <h2 style={{ fontFamily: "'Crimson Pro', serif", fontSize: '2.2rem', margin: 0, color: theme.accent }}>Escribir Capítulo</h2>
            <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
              <span style={badgeStyle(theme)}>📝 {wordCount} palabras</span>
              <span style={{ ...badgeStyle(theme), color: theme.accent, borderColor: theme.accent }}>📖 Lectura: {Math.ceil(wordCount / 200)} min</span>
            </div>
          </header>

          <form onSubmit={handleSubmit}>
            <input
              style={inputStyle(theme, true)}
              placeholder="Título del capítulo..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <textarea
              style={inputStyle(theme, false)}
              placeholder="Comienza a escribir tu historia aquí..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '30px' }}>
              <button type="submit" disabled={isSubmitting} style={{ padding: '16px 45px', backgroundColor: theme.accent, color: darkMode ? '#000' : '#fff', border: 'none', borderRadius: '50px', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: '1rem', transition: 'all 0.3s ease', opacity: isSubmitting ? 0.6 : 1 }}>
                {isSubmitting ? 'Publicando...' : 'Publicar Capítulo'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

const badgeStyle = (theme) => ({ padding: '6px 14px', backgroundColor: 'transparent', border: `1px solid ${theme.border}`, borderRadius: '20px', fontSize: '0.75rem', color: theme.textMuted, fontWeight: 700, letterSpacing: '0.5px' });
const inputStyle = (theme, isTitle) => ({ width: '100%', padding: '20px', marginBottom: '20px', borderRadius: '12px', border: `1px solid ${theme.border}`, backgroundColor: theme.inputBg, color: theme.textMain, fontSize: isTitle ? '1.5rem' : '1.2rem', fontWeight: isTitle ? '700' : '400', fontFamily: "'Crimson Pro', serif", lineHeight: '1.6', outline: 'none', boxSizing: 'border-box', height: isTitle ? 'auto' : '500px', resize: isTitle ? 'none' : 'vertical' });

export default AddChapter;
