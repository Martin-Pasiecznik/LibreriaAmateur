import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { API_BASE, authHeader } from '../App';

// ─── HELPER: tiempo relativo ─────────────────────────────────────────────────
const timeAgo = (dateStr) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date)) return null;
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60)           return 'hace unos segundos';
  if (diff < 3600)         return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400)        return `hace ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 7)   return `hace ${Math.floor(diff / 86400)} días`;
  if (diff < 86400 * 30)  return `hace ${Math.floor(diff / (86400 * 7))} semanas`;
  if (diff < 86400 * 365) return `hace ${Math.floor(diff / (86400 * 30))} meses`;
  return `hace ${Math.floor(diff / (86400 * 365))} años`;
};

// ─── Estado del libro — definido por el autor ─────────────────────────────────
// La fecha del último capítulo es información extra para el lector,
// pero el estado oficial lo pone el autor.
const BOOK_STATUS_DISPLAY = {
  ongoing:   { label: 'En progreso', color: '#4ade80', icon: '', desc: 'El autor está publicando activamente.' },
  completed: { label: 'Terminada',   color: '#60a5fa', icon: '', desc: 'Historia completa.' },
  paused:    { label: 'En pausa',    color: '#facc15', icon: '', desc: 'El autor tomó un descanso temporal.' },
  abandoned: { label: 'Abandonada',  color: '#f87171', icon: '', desc: 'El autor dejó de publicar esta obra.' },
};

// Fallback cuando el autor aún no configuró el estado:
// usa la antigüedad del último capítulo para inferirlo.
const inferStatusFromDate = (dateStr, darkMode) => {
  if (!dateStr) return { label: 'Sin estado', color: '#8a8782', icon: '○', desc: 'El autor no configuró el estado.' };
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 86400));
  if (days <= 14)  return { label: 'Activo',    color: darkMode ? '#4ade80' : '#27ae60', icon: '●', desc: 'Actualizado recientemente.' };
  if (days <= 60)  return { label: 'Reciente',  color: darkMode ? '#d4af37' : '#b85b3f', icon: '●', desc: 'Última actualización hace poco.' };
  if (days <= 180) return { label: 'Pausado?',  color: '#e67e22',                        icon: '◐', desc: 'Sin actualizaciones en varios meses.' };
  return             { label: 'Inactivo?',      color: '#8a8782',                        icon: '○', desc: 'Sin actualizaciones hace mucho tiempo.' };
};

// ─── HELPER: foto de avatar con fallback ─────────────────────────────────────
const getAvatarSrc = (display_photo, user_email) => {
  if (display_photo) return display_photo;
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user_email || 'anon')}`;
};

const BookDetail = ({ user, darkMode }) => {
  const { id } = useParams();
  const [book, setBook]         = useState(null);
  const [chapters, setChapters] = useState([]);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [rating, setRating]               = useState({ average: 0, total: 0, userScore: 0 });
  const [hover, setHover]                 = useState(0);
  const [readingStatus, setReadingStatus] = useState("");
  const [libraryStatus, setLibraryStatus] = useState(null);
  const [isUpdatingLib, setIsUpdatingLib] = useState(false);
  const [notif, setNotif]                 = useState("");
  const [progress, setProgress]           = useState({ lastChapterIndex: -1, readChapters: [] });
  const [isStatusOpen, setIsStatusOpen]   = useState(false);

  const theme = {
    accent:    darkMode ? '#d4af37' : '#b85b3f',
    textMain:  darkMode ? '#e3e1db' : '#2c2926',
    textMuted: darkMode ? '#8a8782' : '#7a746e',
    card:      darkMode ? 'rgba(255, 255, 255, 0.03)' : '#ffffff',
    border:    darkMode ? 'rgba(212, 175, 55, 0.2)'   : 'rgba(184, 91, 63, 0.15)',
    error:     '#e74c3c',
    success:   darkMode ? '#82e0aa' : '#27ae60',
    star:      darkMode ? '#d4af37' : '#b85b3f',
    bgLight:   darkMode ? 'rgba(212, 175, 55, 0.05)' : '#fcfaf7',
    readColor: darkMode ? 'rgba(130, 224, 170, 0.05)' : '#f0f9f4',
    readText:  darkMode ? '#82e0aa' : '#1e7e44',
  };

  const defaultCoverStyle = {
    width: '280px', aspectRatio: '2/3', borderRadius: '12px',
    backgroundColor: darkMode ? '#1a1a1a' : '#eee',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: theme.textMuted, fontWeight: 800, fontSize: '1rem',
    border: `1px solid ${theme.border}`, textAlign: 'center',
    boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
  };

  const userReview = comments.find(c => c.user_email === user?.email);

  // Capítulo más reciente
  const lastChapter   = chapters.length > 0 ? chapters.reduce((a, b) => (a.id > b.id ? a : b)) : null;
  const lastUpdateTxt = timeAgo(lastChapter?.created_at);

  // ── Badge de estado ──────────────────────────────────────────────────────
  // Prioridad 1: estado configurado por el autor (book_status)
  // Prioridad 2: inferido de la fecha del último capítulo
  const bookStatusInfo = book?.book_status && BOOK_STATUS_DISPLAY[book.book_status]
    ? BOOK_STATUS_DISPLAY[book.book_status]
    : inferStatusFromDate(lastChapter?.created_at, darkMode);

  const isAuthorStatus = !!(book?.book_status && BOOK_STATUS_DISPLAY[book.book_status]);

  useEffect(() => {
    fetch(`${API_BASE}/api/books/${id}`).then(r => r.json()).then(setBook);
    fetch(`${API_BASE}/api/books/${id}/chapters`).then(r => r.json()).then(d => setChapters(Array.isArray(d) ? d : []));
    fetchComments();

    if (user?.session_token) {
      fetch(`${API_BASE}/api/books/${id}/rating-status/${user.email}`)
        .then(r => r.json())
        .then(d => setRating({ average: d.average, total: d.total_votes, userScore: d.user_score }));

      fetch(`${API_BASE}/api/library`, { headers: authHeader(user) })
        .then(r => { if (!r.ok) throw new Error(); return r.json(); })
        .then(d => {
          const found = Array.isArray(d) && d.find(b => b.id === parseInt(id));
          if (found) setLibraryStatus(found.status);
        }).catch(() => {});

      fetch(`${API_BASE}/api/progress/${user.email}/${id}`, { headers: authHeader(user) })
        .then(r => { if (!r.ok) throw new Error(); return r.json(); })
        .then(d => { if (d) setProgress({ lastChapterIndex: d.last_chapter_id, readChapters: d.read_chapters || [] }); })
        .catch(() => {});
    }
  }, [id, user]);

  useEffect(() => {
    if (userReview) {
      const m = userReview.text.match(/^\[Estado: (.*?)\]/);
      if (m) setReadingStatus(m[1]);
      setNewComment(userReview.text.replace(/^\[Estado: (.*?)\]\s*/, ''));
    }
  }, [userReview]);

  const fetchComments = () => {
    fetch(`${API_BASE}/api/books/${id}/comments?chapter_id=null`)
      .then(r => r.json())
      .then(d => setComments(Array.isArray(d) ? d : []));
  };

  const handleRate = (score) => {
    if (!user?.session_token) return setErrorMsg("Debes iniciar sesión para puntuar.");
    fetch(`${API_BASE}/api/books/${id}/rate`, { method: 'POST', headers: authHeader(user), body: JSON.stringify({ score }) })
      .then(r => r.json())
      .then(d => { setRating(p => ({ ...p, average: d.average, total: d.total_votes, userScore: score })); setErrorMsg(""); fetchComments(); });
  };

  const updateLibrary = (status) => {
    if (!user?.session_token) return setErrorMsg("Debes iniciar sesión para guardar en tu biblioteca.");
    setIsUpdatingLib(true);
    fetch(`${API_BASE}/api/library/update`, { method: 'POST', headers: authHeader(user), body: JSON.stringify({ book_id: parseInt(id), status }) })
      .then(r => r.json())
      .then(() => {
        setLibraryStatus(status === 'remove' ? null : status);
        const lbl = { reading: 'Leyendo', completed: 'Leído', dropped: 'Abandonado', pending: 'Pendiente' };
        setNotif(status === 'remove' ? "Libro quitado de tu lista" : `Añadido como: ${lbl[status]}`);
        setTimeout(() => setNotif(""), 5000);
        setIsUpdatingLib(false);
      }).catch(() => setIsUpdatingLib(false));
  };

  const postComment = () => {
    if (!user?.session_token) return setErrorMsg("Debes iniciar sesión para dejar una reseña.");
    if (rating.userScore === 0) return setErrorMsg("Primero debes puntuar la obra con estrellas (arriba).");
    if (!readingStatus)         return setErrorMsg("Por favor, selecciona tu progreso de lectura.");
    if (!newComment.trim())     return setErrorMsg("El texto de la reseña es obligatorio.");
    const fullText = `[Estado: ${readingStatus}] ${newComment}`;
    fetch(`${API_BASE}/api/books/${id}/comments`, { method: 'POST', headers: authHeader(user), body: JSON.stringify({ user_name: user.name, text: fullText, chapter_id: null }) })
      .then(r => { if (r.ok) { setErrorMsg(""); fetchComments(); alert(userReview ? "Reseña actualizada" : "Reseña publicada"); } });
  };

  const renderStars = (count) => [...Array(5)].map((_, i) => (
    <span key={i} style={{ color: i < count ? theme.star : `${theme.textMuted}33`, fontSize: '1.1rem' }}>★</span>
  ));

  if (!book) return <div style={{ padding: '100px', textAlign: 'center', color: theme.textMain, fontFamily: 'serif' }}>Cargando obra...</div>;

  // La imagen OG se calcula acá afuera para no meter condicionales
  // dentro de <Helmet> (react-helmet-async falla con children condicionales)
  const ogImage = book.author_note && book.author_note !== 'null'
    ? `${API_BASE}/static/covers/${book.author_note}`
    : `${API_BASE}/static/covers/default_cover.jpeg`;

  return (
    <div style={{ padding: '60px 20px', maxWidth: '1100px', margin: '0 auto', color: theme.textMain, fontFamily: "'Inter', sans-serif" }}>

      {/* SEO dinámico — título y descripción según el libro que se está viendo.
          La sinopsis se recorta a ~160 caracteres, que es lo que Google muestra. */}
      <Helmet>
        <title>{`${book.title} — Librería Amateur`}</title>
        <meta name="description" content={(book.description || '').slice(0, 160)} />
        <meta property="og:title" content={`${book.title} — por ${book.author}`} />
        <meta property="og:description" content={(book.description || '').slice(0, 200)} />
        <meta property="og:type" content="book" />
        <meta property="og:image" content={ogImage} />
      </Helmet>

      {/* ── HEADER ── */}
      <div style={{ display: 'flex', gap: '60px', marginBottom: '80px', flexWrap: 'wrap' }}>

        <div style={{ flexShrink: 0 }}>
          {book.author_note && book.author_note !== 'null' ? (
            <img src={`${API_BASE}/static/covers/${book.author_note}`} style={{ width: '300px', borderRadius: '12px', boxShadow: '0 30px 60px rgba(0,0,0,0.5)', border: `1px solid ${theme.border}`, objectFit: 'cover' }} alt="Portada" />
          ) : (
            <div style={defaultCoverStyle}>SIN PORTADA</div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: '320px' }}>
          <h1 style={{ fontSize: '3.5rem', margin: '0 0 10px 0', fontFamily: "'Crimson Pro', serif", fontWeight: 400, letterSpacing: '-1px' }}>{book.title}</h1>
          <p style={{ color: theme.accent, fontSize: '1.3rem', marginBottom: '20px', fontWeight: 500, fontStyle: 'italic', fontFamily: "'Crimson Pro', serif" }}>Autor: {book.author}</p>

          {/* ══ ESTADO + FECHA ══════════════════════════════════════════════ */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px', marginBottom: '28px', flexWrap: 'wrap' }}>

            {/* Badge principal: estado del autor (o inferido) */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '6px 14px', borderRadius: '20px', backgroundColor: `${bookStatusInfo.color}18`, border: `1.5px solid ${bookStatusInfo.color}50`, flexShrink: 0 }}>
              <span style={{ fontSize: '0.85rem', lineHeight: 1 }}>{bookStatusInfo.icon}</span>
              <span style={{ color: bookStatusInfo.color, fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.5px' }}>
                {bookStatusInfo.label}
              </span>
              {/* Indicador de si es oficial del autor o inferido */}
              {!isAuthorStatus && (
                <span style={{ color: bookStatusInfo.color, fontSize: '0.6rem', opacity: 0.7 }}>?</span>
              )}
            </div>

            {/* Fecha del último capítulo + total */}
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: theme.textMuted, letterSpacing: '1px', textTransform: 'uppercase', display: 'block' }}>
                  Último capítulo
                </span>
{lastChapter?.created_at ? (
  <span style={{ fontSize: '0.88rem', color: theme.textMain, fontWeight: 500 }}>
    {new Date(lastChapter.created_at).toLocaleDateString('es-AR', {
      day: '2-digit', month: 'long', year: 'numeric'
    })}
    <span style={{ color: theme.textMuted, fontSize: '0.78rem', marginLeft: '6px' }}>
      — {lastChapter.title}
    </span>
  </span>
) : (
  <span style={{ fontSize: '0.85rem', color: theme.textMuted, fontStyle: 'italic' }}>Sin fecha registrada</span>
)}
              </div>

              <div>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: theme.textMuted, letterSpacing: '1px', textTransform: 'uppercase', display: 'block' }}>Capítulos</span>
                <span style={{ fontSize: '0.88rem', color: theme.textMain, fontWeight: 600 }}>{chapters.length}</span>
              </div>
            </div>

          </div>
          {/* ══ FIN ESTADO + FECHA ═════════════════════════════════════════ */}

          {/* ESTRELLAS */}
          <div style={{ marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ display: 'flex' }}>
              {[1,2,3,4,5].map(star => (
                <button key={star} onClick={() => handleRate(star)} onMouseEnter={() => setHover(star)} onMouseLeave={() => setHover(0)}
                  style={{ fontSize: '32px', cursor: 'pointer', background: 'none', border: 'none', padding: 0, color: star <= (hover || rating.userScore) ? theme.star : `${theme.textMuted}33`, transition: 'transform 0.2s' }}>★</button>
              ))}
            </div>
            <span style={{ fontSize: '2rem', fontWeight: 300, fontFamily: "'Crimson Pro', serif" }}>{rating.average.toFixed(1)}</span>
            <span style={{ color: theme.textMuted, fontSize: '0.8rem', marginTop: '8px' }}>({rating.total} reseñas)</span>
          </div>

          {/* BIBLIOTECA */}
          <div style={{ marginBottom: '40px' }}>
            <label style={{ fontSize: '0.7rem', fontWeight: 800, display: 'block', marginBottom: '12px', opacity: 0.6, letterSpacing: '2px' }}>MI BIBLIOTECA</label>
            <div style={{ display: 'flex', background: theme.bgLight, borderRadius: '50px', padding: '5px', gap: '5px', border: `1px solid ${theme.border}`, flexWrap: 'wrap' }}>
              {[{id:'reading',label:'Leyendo'},{id:'pending',label:'Pendiente'},{id:'completed',label:'Leído'},{id:'dropped',label:'Abandonado'}].map(item => (
                <button key={item.id} onClick={() => updateLibrary(item.id)} disabled={isUpdatingLib}
                  style={{ flex: 1, minWidth: '85px', padding: '8px 12px', border: 'none', borderRadius: '40px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, backgroundColor: libraryStatus === item.id ? theme.accent : 'transparent', color: libraryStatus === item.id ? (darkMode ? '#000' : '#fff') : theme.textMain, transition: '0.3s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {item.label.toUpperCase()}
                </button>
              ))}
              {libraryStatus && (
                <button onClick={() => updateLibrary('remove')} style={{ padding: '0 15px', background: 'transparent', border: 'none', color: theme.error, cursor: 'pointer', fontSize: '1.1rem' }} title="Quitar">✕</button>
              )}
            </div>
            
          </div>
          <p style={{ lineHeight: '1.8', fontSize: '1.1rem', color: theme.textMuted, marginBottom: '24px', maxWidth: '600px' }}>{book.description}</p>


          <label style={{ fontSize: '0.7rem', fontWeight: 800, display: 'block', marginBottom: '12px', opacity: 0.6, letterSpacing: '2px' }}>ETIQUETAS</label>
          {book.tags && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '40px' }}>
              {book.tags.split(',').map(t => t.trim()).filter(Boolean).map(tag => (
                <span key={tag} style={{
                  padding: '5px 14px', borderRadius: '20px',
                  fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.3px',
                  backgroundColor: `${theme.accent}15`, color: theme.accent,
                  border: `1px solid ${theme.accent}35`,
                }}>
                  {tag}
                </span>
              ))}
            </div>
          )}

        </div>
      </div>

      {/* ── ÍNDICE ── */}
      <div style={{ marginBottom: '80px' }}>
        <h3 style={{ fontSize: '1.8rem', fontFamily: "'Crimson Pro', serif", borderBottom: `1px solid ${theme.border}`, paddingBottom: '15px', marginBottom: '30px' }}>Índice de capítulos</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {chapters.map((ch, index) => {
            const isRead   = progress.readChapters.includes(ch.id);
            const isLast   = progress.lastChapterIndex === ch.id;
            const isNewest = lastChapter?.id === ch.id && chapters.length > 1;
            return (
              <Link key={ch.id} to={`/reader/${book.id}/${index}`}
                style={{ padding: '20px', background: isRead ? theme.readColor : theme.card, border: isLast ? `1px solid ${theme.accent}` : `1px solid ${theme.border}`, borderRadius: '12px', textDecoration: 'none', color: isRead ? theme.readText : theme.textMain, display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: '0.3s' }}
                onMouseOver={e => { e.currentTarget.style.borderColor = theme.accent; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseOut={e => { e.currentTarget.style.borderColor = isLast ? theme.accent : theme.border; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: theme.accent }}>{String(index + 1).padStart(2, '0')}</span>
                    {isNewest && (
                      <span style={{ background: bookStatusInfo.color, color: '#000', fontSize: '0.55rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 900, letterSpacing: '0.5px' }}>
                        NUEVO
                      </span>
                    )}
                  </div>
                  <span style={{ fontWeight: isLast ? 700 : 500, fontSize: '1.05rem' }}>{ch.title}</span>
                  {isLast && <span style={{ color: theme.accent, fontSize: '0.65rem', fontWeight: 800, display: 'block', marginTop: '4px' }}>📍 ÚLTIMA LECTURA</span>}
                  {ch.created_at && (
                    <span style={{ color: theme.textMuted, fontSize: '0.65rem', display: 'block', marginTop: '3px' }}>
                      {timeAgo(ch.created_at)}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: '0.75rem', opacity: 0.6, flexShrink: 0, marginLeft: '10px' }}>
                  {isRead ? 'VISTO' : `${ch.word_count} PAL.`}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── RESEÑAS ── */}
      <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: '60px' }}>
        <h3 style={{ fontSize: '2.2rem', fontFamily: "'Crimson Pro', serif", marginBottom: '40px' }}>Críticas de la comunidad</h3>

        <div style={{ background: theme.card, padding: '40px', borderRadius: '20px', border: userReview ? `1px solid ${theme.accent}` : `1px solid ${theme.border}`, marginBottom: '60px', position: 'relative' }}>
          {userReview && <div style={{ position: 'absolute', top: '-12px', right: '30px', background: theme.accent, color: darkMode ? '#000' : '#fff', padding: '4px 15px', borderRadius: '40px', fontSize: '0.65rem', fontWeight: 900, letterSpacing: '1px' }}>TU CRÍTICA</div>}

          <div style={{ display: 'flex', gap: '30px', marginBottom: '30px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 800, color: theme.textMuted, display: 'block', marginBottom: '10px', letterSpacing: '1px' }}>PROGRESO DE LECTURA</label>
              <div onClick={() => setIsStatusOpen(!isStatusOpen)} style={{ width: '100%', padding: '14px 20px', borderRadius: '12px', background: theme.bgLight, color: readingStatus ? theme.textMain : theme.textMuted, border: `1px solid ${isStatusOpen ? theme.accent : theme.border}`, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: '0.3s' }}>
                <span>{readingStatus || "Seleccionar progreso..."}</span>
                <span style={{ fontSize: '0.6rem', transform: isStatusOpen ? 'rotate(180deg)' : 'rotate(0)', transition: '0.3s', color: theme.accent }}>▼</span>
              </div>
              {isStatusOpen && (
                <>
                  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 }} onClick={() => setIsStatusOpen(false)} />
                  <div style={{ position: 'absolute', top: '105%', left: 0, right: 0, background: darkMode ? '#1e1e1e' : '#fff', border: `1px solid ${theme.accent}`, borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.3)', zIndex: 11, maxHeight: '250px', overflowY: 'auto' }}>
                    {["Obra completada","Leyendo actualmente","Abandonada",...chapters.map((_,i)=>`Capítulo ${i+1}`)].map(option => (
                      <div key={option} onClick={() => { setReadingStatus(option); setIsStatusOpen(false); }}
                        style={{ padding: '12px 20px', cursor: 'pointer', fontSize: '0.9rem', color: readingStatus === option ? theme.accent : theme.textMain, background: readingStatus === option ? (darkMode ? 'rgba(212,175,55,0.1)':'rgba(184,91,63,0.05)') : 'transparent', transition: '0.2s', borderBottom: `1px solid ${theme.border}33` }}
                        onMouseEnter={e => e.target.style.background = darkMode ? 'rgba(255,255,255,0.05)':'rgba(0,0,0,0.02)'}
                        onMouseLeave={e => e.target.style.background = readingStatus === option ? (darkMode ? 'rgba(212,175,55,0.1)':'rgba(184,91,63,0.05)') : 'transparent'}
                      >{option}</div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 800, color: theme.textMuted, display: 'block', marginBottom: '10px' }}>TU CALIFICACIÓN</label>
              <div style={{ padding: '8px 0' }}>{renderStars(rating.userScore)}</div>
            </div>
          </div>

          <textarea value={newComment} onChange={e => setNewComment(e.target.value)}
            style={{ width: '100%', height: '140px', padding: '20px', borderRadius: '12px', background: darkMode ? 'rgba(0,0,0,0.2)':'#fff', color: theme.textMain, border: `1px solid ${theme.border}`, marginBottom: '20px', outline: 'none', fontSize: '1rem', fontFamily: 'inherit', resize: 'none' }}
            placeholder={user ? "Escribe tu opinión aquí..." : "Inicia sesión para dejar una reseña."} disabled={!user}
          />
          {errorMsg && <div style={{ color: theme.error, marginBottom: '20px', fontSize: '0.85rem', fontWeight: 600 }}>{errorMsg}</div>}
          <button onClick={postComment} disabled={!user} style={{ padding: '14px 40px', background: userReview ? theme.success : theme.accent, color: darkMode ? '#000':'#fff', border: 'none', borderRadius: '50px', cursor: user ? 'pointer':'not-allowed', fontWeight: 800, fontSize: '0.85rem', opacity: user ? 1 : 0.5 }}>
            {userReview ? "ACTUALIZAR RESEÑA" : "PUBLICAR CRÍTICA"}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
          {comments.map(c => {
            const statusMatch = c.text.match(/^\[Estado: (.*?)\]/);
            const statusTag   = statusMatch ? statusMatch[1] : null;
            const cleanText   = c.text.replace(/^\[Estado: (.*?)\]\s*/, '');
            return (
              <div key={c.id} style={{ display: 'flex', gap: '25px', background: theme.card, padding: '30px', borderRadius: '15px', border: c.user_email === user?.email ? `1px solid ${theme.accent}` : `1px solid ${theme.border}` }}>
                <img
                  src={getAvatarSrc(c.display_photo, c.user_email)}
                  referrerPolicy="no-referrer"
                  onError={e => { e.target.onerror = null; e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(c.user_email||'anon')}`; }}
                  style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${theme.accent}`, padding: '2px', background: theme.bgLight, flexShrink: 0 }}
                  alt={c.display_name || c.user_name}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', alignItems: 'flex-start' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.1rem', fontFamily: "'Crimson Pro', serif" }}>{c.display_name || c.user_name}</h4>
                      {statusTag && <span style={{ fontSize: '0.65rem', color: theme.accent, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px' }}>{statusTag}</span>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ marginBottom: '4px' }}>{renderStars(c.user_rating || 0)}</div>
                      <small style={{ color: theme.textMuted, fontSize: '0.7rem' }}>{new Date(c.timestamp).toLocaleDateString()}</small>
                    </div>
                  </div>
                  <p style={{ margin: 0, opacity: 0.85, lineHeight: '1.6', fontSize: '0.95rem' }}>{cleanText}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {notif && (
        <div style={{ position: 'fixed', bottom: '30px', right: '30px', backgroundColor: '#1a1a1a', color: 'white', padding: '16px 30px', borderRadius: '50px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'center', gap: '15px', fontSize: '0.85rem', border: `1px solid ${theme.accent}`, animation: 'slideIn 0.5s ease-out' }}>
          <span style={{ color: theme.accent }}>✦</span> {notif}
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,700;1,400&family=Inter:wght@400;600;800&display=swap');
        @keyframes slideIn { from { transform: translateY(100px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  );
};

export default BookDetail;