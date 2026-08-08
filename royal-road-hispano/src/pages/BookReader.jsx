import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { API_BASE, authHeader } from '../App';

const BookReader = ({ user, darkMode, setDarkMode }) => {
  const { id, chapterIndex } = useParams();
  const navigate = useNavigate();

  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fontSize, setFontSize] = useState(20);

  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasCounted = useRef(false);
  const triggerRef = useRef(null);
  const timerRef = useRef(null);

  const theme = {
    accent: darkMode ? '#d4af37' : '#b85b3f',
    textMain: darkMode ? '#e3e1db' : '#2c2926',
    textMuted: darkMode ? '#8a8782' : '#7a746e',
    bg: darkMode ? '#121418' : '#fcfaf7',
    card: darkMode ? 'rgba(255, 255, 255, 0.03)' : '#ffffff',
    border: darkMode ? 'rgba(212, 175, 55, 0.15)' : 'rgba(184, 91, 63, 0.12)',
  };

  useEffect(() => {
    loadChapterData();
  }, [id]);

  useEffect(() => {
    if (chapters.length > 0) {
      const currentCap = chapters[parseInt(chapterIndex)];
      if (currentCap) {
        fetchComments(currentCap.id);
        if (user?.session_token) updateProgress(currentCap.id);
      }
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      hasCounted.current = false;
    }
  }, [chapterIndex, chapters, user]);

  // POST protegido — solo si hay sesión
  const updateProgress = (chapterId) => {
    fetch(`${API_BASE}/api/progress/update`, {
      method: 'POST',
      headers: authHeader(user),
      body: JSON.stringify({
        book_id: parseInt(id),
        chapter_id: chapterId,
        // email eliminado: el backend lo toma del token
      }),
    }).catch(err => console.error("Error actualizando progreso:", err));
  };

  // GET público
  const loadChapterData = () => {
    setLoading(true);
    fetch(`${API_BASE}/api/books/${id}/chapters`)
      .then(res => res.json())
      .then(data => { setChapters(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  // GET público
  const fetchComments = (chapterId) => {
    fetch(`${API_BASE}/api/books/${id}/comments?chapter_id=${chapterId}`)
      .then(res => res.json())
      .then(data => setComments(Array.isArray(data) ? data : []))
      .catch(err => console.error("Error al cargar comentarios:", err));
  };

  // POST protegido
  const handlePostComment = async (e) => {
    e.preventDefault();
    const currentCap = chapters[parseInt(chapterIndex)];
    if (!newComment.trim() || !currentCap) return;

    if (!user?.session_token) {
      alert("Debes iniciar sesión para comentar.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/books/${id}/comments`, {
        method: 'POST',
        headers: authHeader(user),
        body: JSON.stringify({
          user_name: user.name || "Lector",
          // user_email eliminado: el backend lo toma del token
          text: newComment,
          chapter_id: currentCap.id,
        }),
      });

      if (res.ok) {
        setNewComment("");
        fetchComments(currentCap.id);
      }
    } catch (err) {
      console.error("Error al comentar:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // POST público — se trackea por IP, no necesita sesión
  useEffect(() => {
    if (loading || !chapters.length || !triggerRef.current) return;
    const currentCap = chapters[parseInt(chapterIndex)];
    if (!currentCap) return;

    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (entry.isIntersecting && !hasCounted.current) {
        timerRef.current = setTimeout(() => {
          hasCounted.current = true;
          fetch(`${API_BASE}/api/books/${id}/view`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chapter_index: parseInt(chapterIndex) }),
          }).catch(err => console.error("Error al contabilizar:", err));
        }, 2000);
      } else {
        if (timerRef.current) clearTimeout(timerRef.current);
      }
    }, { threshold: 0.1 });

    observer.observe(triggerRef.current);
    return () => { observer.disconnect(); if (timerRef.current) clearTimeout(timerRef.current); };
  }, [loading, id, chapterIndex, chapters]);

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '100px', color: theme.accent, fontFamily: "'Crimson Pro', serif", fontSize: '1.2rem' }}>
      Abriendo manuscrito...
    </div>
  );

  const currentIndex = parseInt(chapterIndex) || 0;
  const currentChapter = chapters[currentIndex];
  if (!currentChapter) return <div style={{ textAlign: 'center', padding: '50px', color: theme.textMain }}>Capítulo no encontrado.</div>;

  const paragraphs = currentChapter.content.split(/\n+/);
  const midPointPara = Math.floor(paragraphs.length / 2);

  const readerTextStyle = { fontSize: `${fontSize}px`, fontFamily: "'Crimson Pro', serif", lineHeight: '1.85', maxWidth: '800px', margin: '0 auto', textAlign: 'justify', color: theme.textMain, padding: '0 30px', opacity: 0.95 };
  const paragraphStyle = { marginBottom: '1.6rem', display: 'block' };

  return (
    <div style={{ position: 'relative', backgroundColor: theme.bg, minHeight: '100vh', transition: '0.3s', fontFamily: "'Inter', sans-serif" }}>

      {/* SEO — el título de la pestaña muestra el capítulo actual */}
      <Helmet>
        <title>{`Cap. ${currentIndex + 1}: ${currentChapter.title} — Librería Amateur`}</title>
        <meta name="description" content={`Leé el capítulo ${currentIndex + 1}: ${currentChapter.title} en Librería Amateur.`} />
      </Helmet>

      <header className="reader-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 30px', position: 'sticky', top: '0', height: '70px', backgroundColor: theme.bg, borderBottom: `1px solid ${theme.border}`, zIndex: 1100, boxShadow: darkMode ? '0 4px 10px rgba(0,0,0,0.5)' : '0 4px 10px rgba(0,0,0,0.05)' }}>
        <div className="reader-header-left" style={{ display: 'flex', alignItems: 'center', gap: '25px' }}>
          <Link to="/" style={{ color: theme.textMain, textDecoration: 'none', fontWeight: 800, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: "'Crimson Pro', serif", transition: 'color 0.3s' }}
            onMouseOver={(e) => e.currentTarget.style.color = theme.accent}
            onMouseOut={(e) => e.currentTarget.style.color = theme.textMain}
          >
            <span style={{ color: theme.accent }}>✦</span> Libreria Amateur
          </Link>
          <div style={{ display: 'flex', gap: '10px', borderLeft: `1px solid ${theme.border}`, paddingLeft: '20px' }}>
            <button style={btnSmall(darkMode, theme)} onClick={() => setFontSize(f => Math.min(f + 2, 32))}>A<span style={{ fontSize: '0.6rem' }}>+</span></button>
            <button style={btnSmall(darkMode, theme)} onClick={() => setFontSize(f => Math.max(f - 2, 12))}>A<span style={{ fontSize: '0.6rem' }}>-</span></button>
          </div>
        </div>
        <div className="reader-header-right" style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <button style={{ ...btnSmall(darkMode, theme), border: 'none', fontWeight: 700, letterSpacing: '1px' }} onClick={() => navigate(`/book/${id}`)}>VOLVER AL ÍNDICE</button>
          <button style={{ ...btnSmall(darkMode, theme), borderRadius: '50%', width: '40px', height: '40px', padding: 0 }} onClick={() => setDarkMode(!darkMode)}>
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      <main style={{ paddingTop: '40px', paddingBottom: '20px' }}>
        <div style={{ textAlign: 'center', marginBottom: '60px', padding: '0 20px' }}>
          <span style={{ color: theme.accent, fontWeight: 800, fontSize: '0.8rem', letterSpacing: '3px' }}>CAPÍTULO {currentIndex + 1}</span>
          <h1 style={{ fontSize: '3.5rem', marginTop: '10px', color: theme.textMain, fontFamily: "'Crimson Pro', serif", fontWeight: 400 }}>{currentChapter.title}</h1>
          <div style={{ width: '40px', height: '2px', background: theme.accent, margin: '20px auto' }}></div>
        </div>

        <div className="reader-article" style={readerTextStyle}>
          {paragraphs.slice(0, midPointPara).map((para, i) => <p key={`p1-${i}`} style={paragraphStyle}>{para}</p>)}
          <div ref={triggerRef} style={{ height: '40px', margin: '20px 0', opacity: 0.1, textAlign: 'center' }}>✦</div>
          {paragraphs.slice(midPointPara).map((para, i) => <p key={`p2-${i}`} style={paragraphStyle}>{para}</p>)}
        </div>
      </main>

      <nav className="reader-nav" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '40px', padding: '60px 0', maxWidth: '800px', margin: '0 auto', borderTop: `1px solid ${theme.border}`, borderBottom: `1px solid ${theme.border}` }}>
        <button className="reader-nav-btn" style={{ ...navBtnStyle(theme), opacity: currentIndex === 0 ? 0.2 : 1 }} disabled={currentIndex === 0} onClick={() => navigate(`/reader/${id}/${currentIndex - 1}`)}>ANTERIOR</button>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontWeight: 800, color: theme.textMain, fontSize: '1rem', display: 'block' }}>{currentIndex + 1} / {chapters.length}</span>
          <span style={{ fontSize: '0.6rem', color: theme.accent, fontWeight: 800, letterSpacing: '1px' }}>CAPÍTULO</span>
          <button
            onClick={() => navigate(`/book/${id}`)}
            style={{
              display: 'block', margin: '10px auto 0', background: 'none', border: 'none',
              color: theme.textMuted, fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.5px',
              cursor: 'pointer',
            }}
          >
            VOLVER AL ÍNDICE
          </button>
        </div>
        <button className="reader-nav-btn" style={{ ...navBtnStyle(theme), opacity: currentIndex === chapters.length - 1 ? 0.2 : 1 }} disabled={currentIndex === chapters.length - 1} onClick={() => navigate(`/reader/${id}/${currentIndex + 1}`)}>SIGUIENTE</button>
      </nav>

      <section className="reader-comments-section" style={{ maxWidth: '800px', margin: '60px auto', padding: '0 30px' }}>
        <h3 style={{ color: theme.textMain, fontFamily: "'Crimson Pro', serif", fontSize: '1.8rem', paddingBottom: '20px', marginBottom: '40px' }}>
          Comentarios de los lectores ({comments.length})
        </h3>

        {user ? (
          <form onSubmit={handlePostComment} style={{ marginBottom: '50px' }}>
            <textarea
              style={{ width: '100%', padding: '20px', borderRadius: '15px', backgroundColor: theme.card, color: theme.textMain, border: `1px solid ${theme.border}`, outline: 'none', resize: 'vertical', minHeight: '120px', boxSizing: 'border-box', fontSize: '1rem', fontFamily: 'inherit', transition: '0.3s' }}
              placeholder="Comparte tus impresiones sobre este capítulo..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
            />
            <div style={{ textAlign: 'right', marginTop: '15px' }}>
              <button type="submit" disabled={isSubmitting} style={{ padding: '12px 35px', borderRadius: '50px', backgroundColor: theme.accent, color: darkMode ? '#000' : '#fff', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '0.8rem', opacity: isSubmitting ? 0.6 : 1 }}>
                {isSubmitting ? "ENVIANDO..." : "COMENTAR"}
              </button>
            </div>
          </form>
        ) : (
          <p style={{ color: theme.textMuted, fontStyle: 'italic', marginBottom: '40px' }}>Inicia sesión para dejar una nota.</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '80px' }}>
          {comments.map((c) => (
            <div key={c.id} style={{ padding: '25px', borderRadius: '15px', backgroundColor: theme.card, border: `1px solid ${theme.border}`, display: 'flex', gap: '20px' }}>

              {/* ── FOTO DE PERFIL: usa display_photo del backend, con fallback ── */}
              <img
                src={c.display_photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(c.user_email || c.user_name || 'anon')}`}
                referrerPolicy="no-referrer"
                onError={e => { e.target.onerror = null; e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(c.user_email || 'anon')}`; }}
                style={{ width: '45px', height: '45px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${theme.accent}`, flexShrink: 0 }}
                alt={c.display_name || c.user_name}
              />

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: theme.accent, fontSize: '0.9rem' }}>{c.display_name || c.user_name}</span>
                  <span style={{ fontSize: '0.7rem', color: theme.textMuted, fontWeight: 600 }}>{new Date(c.timestamp).toLocaleDateString()}</span>
                </div>
                <p style={{ margin: 0, color: theme.textMain, lineHeight: '1.6', fontSize: '0.95rem', opacity: 0.9 }}>{c.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,700;1,400&family=Inter:wght@400;700;800&display=swap');

        /* ── Responsividad — solo disposición (padding, gaps, wrap), sin tocar fuentes ni colores ── */
        @media (max-width: 640px) {
          .reader-header {
            flex-wrap: wrap !important;
            height: auto !important;
            min-height: 70px;
            padding: 12px 16px !important;
            row-gap: 10px;
            justify-content: center !important;
          }
          .reader-header-left,
          .reader-header-right {
            justify-content: center !important;
            flex-wrap: wrap;
          }
          .reader-nav {
            gap: 14px !important;
            padding: 30px 16px !important;
            flex-wrap: wrap !important;
          }
          .reader-nav-btn {
            padding: 10px 22px !important;
          }
        }

        @media (max-width: 480px) {
          .reader-article {
            padding: 0 16px !important;
          }
          .reader-comments-section {
            padding: 0 16px !important;
          }
        }
      `}</style>
    </div>
  );
};

const btnSmall = (darkMode, theme) => ({ padding: '8px 15px', cursor: 'pointer', borderRadius: '8px', border: `1px solid ${theme.border}`, backgroundColor: theme.card, color: theme.textMain, fontSize: '0.8rem', transition: '0.3s', display: 'flex', alignItems: 'center', justifyContent: 'center' });
const navBtnStyle = (theme) => ({ padding: '14px 40px', backgroundColor: 'transparent', color: theme.textMain, border: `1px solid ${theme.accent}`, borderRadius: '50px', cursor: 'pointer', fontWeight: 800, fontSize: '0.75rem', letterSpacing: '2px', transition: '0.3s' });

export default BookReader;