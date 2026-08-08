import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import { API_BASE, authHeader } from '../App';

// ─── Estados posibles de una obra ────────────────────────────────────────────
const BOOK_STATUSES = {
  ongoing:   { label: 'En progreso', icon: '', color: '#4ade80' },
  paused:    { label: 'En pausa',    icon: '', color: '#facc15' },
  completed: { label: 'Terminada',   icon: '', color: '#60a5fa' },
  abandoned: { label: 'Abandonada',  icon: '', color: '#f87171' },
};

const AuthorBookDetails = ({ user, darkMode }) => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [book, setBook] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [stats, setStats] = useState({ reading: 0, pending: 0, completed: 0, dropped: 0 });
  const [loading, setLoading] = useState(true);

  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteBookModal, setShowDeleteBookModal] = useState(false);
  const [editData, setEditData] = useState({ title: '', description: '', tags: '' });
  const [newCover, setNewCover] = useState(null);
  const [deletingBook, setDeletingBook] = useState(false);
  const [deletingChapterId, setDeletingChapterId] = useState(null);

  // Estado de publicación de la obra
  const [bookStatus, setBookStatus]     = useState('ongoing');
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusMsg, setStatusMsg]       = useState('');

  // Contador del modal de eliminar — vive en el componente principal
  // (no en el modal) para que no se reinicie por culpa de remounts.
  const [deleteCountdown, setDeleteCountdown] = useState(10);

  // Reiniciar el contador cada vez que se abre el modal
  useEffect(() => {
    if (showDeleteBookModal) setDeleteCountdown(10);
  }, [showDeleteBookModal]);

  // Decrementar mientras el modal esté abierto y quede tiempo
  useEffect(() => {
    if (!showDeleteBookModal || deleteCountdown <= 0) return;
    const timer = setTimeout(() => setDeleteCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [showDeleteBookModal, deleteCountdown]);

  const theme = {
    bg: darkMode ? '#0a0b10' : '#f4f0ea',
    card: darkMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.7)',
    accent: darkMode ? '#d4af37' : '#b85b3f',
    textMain: darkMode ? '#e3e1db' : '#2b2824',
    textMuted: darkMode ? '#8a8782' : '#857f77',
    border: darkMode ? 'rgba(212, 175, 55, 0.15)' : 'rgba(184, 91, 63, 0.15)',
    input: darkMode ? '#11131a' : '#fff',
    danger: '#e74c3c',
    chartColors: [darkMode ? '#d4af37' : '#b85b3f', '#2ecc71', '#e74c3c', '#9b59b6'],
  };

  // ─── CARGA DE DATOS ───────────────────────────────────────────────────────
  const loadData = async () => {
    try {
      setLoading(true);
      const [resBook, resChapters, resStats] = await Promise.all([
        fetch(`${API_BASE}/api/books/${id}`),
        fetch(`${API_BASE}/api/books/${id}/chapters`),
        fetch(`${API_BASE}/api/books/${id}/library-stats`),
      ]);

      if (!resBook.ok) throw new Error('No se pudo cargar el libro');

      const bookData     = await resBook.json();
      const chaptersData = resChapters.ok ? await resChapters.json() : [];
      const statsData    = resStats.ok
        ? await resStats.json()
        : { reading: 0, pending: 0, completed: 0, dropped: 0 };

      setBook(bookData);
      setChapters(Array.isArray(chaptersData) ? chaptersData : []);
      setStats(statsData);
      setEditData({ title: bookData.title, description: bookData.description, tags: bookData.tags || '' });
      setBookStatus(bookData.book_status || 'ongoing'); // default: en progreso
    } catch (err) {
      console.error('Error cargando datos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [id]);

  // ─── EDITAR LIBRO ─────────────────────────────────────────────────────────
  const handleUpdateBook = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('title',       editData.title);
    formData.append('description', editData.description);
    formData.append('tags',        editData.tags);
    if (newCover) formData.append('cover', newCover);

    // FormData → solo el header Authorization, sin Content-Type
    const res = await fetch(`${API_BASE}/api/books/${id}/update`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${user?.session_token}` },
      body: formData,
    });

    if (res.ok) { setShowEditModal(false); loadData(); }
    else { alert('No se pudieron guardar los cambios.'); }
  };

  // ─── CAMBIAR ESTADO DE LA OBRA ────────────────────────────────────────────
  const handleStatusChange = async (newStatus) => {
    if (newStatus === bookStatus || statusSaving) return;
    setStatusSaving(true);
    setStatusMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/books/${id}/status`, {
        method: 'PATCH',
        headers: authHeader(user),
        body: JSON.stringify({ book_status: newStatus }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
      }
      setBookStatus(newStatus);
      setStatusMsg(`✓ ${BOOK_STATUSES[newStatus].label}`);
      setTimeout(() => setStatusMsg(''), 3000);
    } catch (err) {
      setStatusMsg(`Error: ${err.message}`);
      setTimeout(() => setStatusMsg(''), 4000);
    } finally {
      setStatusSaving(false);
    }
  };
  const handleDeleteChapter = async (chapterId, chapterTitle) => {
    const confirmed = window.confirm(
      `¿Eliminar el capítulo "${chapterTitle}"?\n\nEsta acción es irreversible y borrará todos los comentarios asociados.`
    );
    if (!confirmed) return;

    setDeletingChapterId(chapterId);
    try {
      const res = await fetch(`${API_BASE}/api/chapters/${chapterId}`, {
        method: 'DELETE',
        headers: authHeader(user),
      });

      if (res.ok) {
        // Actualizar la lista localmente sin recargar toda la página
        setChapters(prev => prev.filter(c => c.id !== chapterId));
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`No se pudo eliminar: ${err.error || res.status}`);
      }
    } catch (err) {
      alert('Error de conexión al intentar eliminar el capítulo.');
    } finally {
      setDeletingChapterId(null);
    }
  };

  // ─── ELIMINAR LIBRO COMPLETO ──────────────────────────────────────────────
  const handleDeleteBook = async () => {
    setDeletingBook(true);
    try {
      const res = await fetch(`${API_BASE}/api/books/${id}`, {
        method: 'DELETE',
        headers: authHeader(user),
      });

      if (res.ok) {
        // Redirigir al dashboard — el libro ya no existe
        navigate('/dashboard');
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`No se pudo eliminar: ${err.error || res.status}`);
        setDeletingBook(false);
        setShowDeleteBookModal(false);
      }
    } catch (err) {
      alert('Error de conexión al intentar eliminar el libro.');
      setDeletingBook(false);
      setShowDeleteBookModal(false);
    }
  };

  // ─── GÉNEROS SUGERIDOS (igual que PublishBook) ────────────────────────────
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
  "Slow Burn", "Dark", "Fluffy", "Mature",
];
  // ─── GÉNEROS SUGERIDOS — click para agregar, click de nuevo para quitar ───
  const handleGenreClick = (genre) => {
    const currentTags = editData.tags.split(',').map(t => t.trim()).filter(Boolean);
    const alreadySelected = currentTags.includes(genre);
    const newTags = alreadySelected
      ? currentTags.filter(t => t !== genre)        // ya estaba → lo quito
      : [...currentTags, genre];                     // no estaba → lo agrego
    setEditData(prev => ({ ...prev, tags: newTags.join(', ') }));
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ padding: '100px', textAlign: 'center', color: theme.accent, backgroundColor: theme.bg, minHeight: '100vh' }}>
      Analizando manuscrito...
    </div>
  );

  const chartData = chapters.map((cap, index) => ({
    name: `Cap ${index + 1}`,
    palabras: cap.word_count || 0,
    vistas: Math.round(book.views / (index + 1.2)),
  }));

  const pieData = [
    { name: 'Leyendo',    value: stats.reading },
    { name: 'Pendiente',  value: stats.pending },
    { name: 'Completado', value: stats.completed },
    { name: 'Abandonado', value: stats.dropped },
  ].filter(d => d.value > 0);

  const ratingChartData = [
    { name: '5 ★', votos: book?.rating_distribution?.[5] || 0 },
    { name: '4 ★', votos: book?.rating_distribution?.[4] || 0 },
    { name: '3 ★', votos: book?.rating_distribution?.[3] || 0 },
    { name: '2 ★', votos: book?.rating_distribution?.[2] || 0 },
    { name: '1 ★', votos: book?.rating_distribution?.[1] || 0 },
  ];

  const totalInLibrary = stats.reading + stats.pending + stats.completed + stats.dropped;

  // Preview de portada para el modal de edición
  const coverPreviewSrc = newCover
    ? URL.createObjectURL(newCover)
    : book?.author_note && book.author_note !== 'null'
      ? `${API_BASE}/static/covers/${book.author_note}`
      : `${API_BASE}/static/covers/default_cover.jpeg`;

  // Anillo de progreso del modal de eliminar
  const deleteLocked       = deleteCountdown > 0;
  const deleteDisabled     = deleteLocked || deletingBook;
  const deleteProgressPct  = ((10 - deleteCountdown) / 10) * 100;
  const ringRadius         = 18;
  const ringCircumference  = 2 * Math.PI * ringRadius;
  const ringDashOffset     = ringCircumference - (deleteProgressPct / 100) * ringCircumference;

  // Tags ya seleccionados, como array — para resaltar los botones de género
  const selectedTags = editData.tags.split(',').map(t => t.trim()).filter(Boolean);

  return (
    <div style={{ padding: '40px 0', color: theme.textMain, fontFamily: "'Inter', sans-serif", backgroundColor: theme.bg, minHeight: '100vh' }}>

      {/* ══ MODAL: EDITAR OBRA — JSX inline, NO es un componente aparte ══
          (definirlo como función dentro del render causaba que React
          desmonte y remonte todo el modal en cada tecla/click, perdiendo
          el foco y "saltando" el scroll hacia arriba) */}
      {showEditModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          backgroundColor: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
          overflowY: 'auto',
          padding: '40px 20px',
        }}>
          <div style={{
            width: '100%', maxWidth: '700px',
            backgroundColor: darkMode ? '#0a0b10' : '#f4f0ea',
            padding: '40px', borderRadius: '24px',
            border: `1px solid ${theme.border}`,
            backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
            color: theme.textMain,
            boxShadow: '0 30px 60px rgba(0,0,0,0.5)',
          }}>

            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <h2 style={{ fontFamily: "'Crimson Pro', serif", fontSize: '2.2rem', margin: 0, color: theme.accent }}>
                Editar Obra
              </h2>
              <p style={{ fontSize: '0.85rem', color: theme.textMuted, marginTop: '10px' }}>
                Modificá los detalles de <strong style={{ color: theme.textMain }}>{book?.title}</strong>
              </p>
            </div>

            <form onSubmit={handleUpdateBook}>

              <label style={modalLabelStyle(theme)}>TÍTULO DE LA OBRA</label>
              <input
                placeholder="Ej: La Leyenda del Norte"
                value={editData.title}
                onChange={e => setEditData({ ...editData, title: e.target.value })}
                style={modalInputStyle(theme, darkMode)}
                required
              />

              <label style={modalLabelStyle(theme)}>SINOPSIS / DESCRIPCIÓN</label>
              <textarea
                placeholder="Escribe una breve sinopsis para atraer a tus lectores..."
                value={editData.description}
                onChange={e => setEditData({ ...editData, description: e.target.value })}
                style={{ ...modalInputStyle(theme, darkMode), height: '120px', resize: 'none', fontFamily: 'inherit' }}
                required
              />

              <label style={modalLabelStyle(theme)}>GÉNEROS Y ETIQUETAS</label>
              <input
                placeholder="Terror, Suspenso, Cyberpunk..."
                value={editData.tags}
                onChange={e => setEditData({ ...editData, tags: e.target.value })}
                style={modalInputStyle(theme, darkMode)}
              />
              <div style={{ marginBottom: '30px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {suggestedGenres.map(genre => {
                  const isSelected = selectedTags.includes(genre);
                  return (
                    <button
                      key={genre}
                      type="button"
                      onClick={() => handleGenreClick(genre)}
                      style={{
                        padding: '6px 14px', borderRadius: '20px',
                        border: `1px solid ${isSelected ? theme.accent : theme.border}`,
                        backgroundColor: isSelected ? `${theme.accent}20` : 'transparent',
                        color: isSelected ? theme.accent : theme.textMuted,
                        fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600, transition: '0.2s',
                      }}
                    >
                      {isSelected ? '✓ ' : '+ '}{genre}
                    </button>
                  );
                })}
              </div>

              <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                <label style={{ ...modalLabelStyle(theme), display: 'block', textAlign: 'center' }}>
                  PORTADA
                </label>
                <div style={{
                  width: '150px', aspectRatio: '2/3',
                  backgroundColor: darkMode ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)',
                  borderRadius: '12px', border: `1px solid ${theme.border}`,
                  margin: '15px auto', overflow: 'hidden',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                }}>
                  <img
                    src={coverPreviewSrc}
                    alt="Preview"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={e => { e.target.src = `${API_BASE}/static/covers/default_cover.jpeg`; }}
                  />
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => setNewCover(e.target.files[0])}
                  style={{ fontSize: '0.8rem', color: theme.textMuted, cursor: 'pointer' }}
                />
                <p style={{ fontSize: '0.72rem', color: theme.textMuted, marginTop: '6px' }}>
                  Dejá vacío para mantener la portada actual
                </p>
              </div>

              <div style={{ display: 'flex', gap: '15px' }}>
                <button
                  type="submit"
                  style={{
                    flex: 1, padding: '16px', borderRadius: '50px', border: 'none',
                    backgroundColor: theme.accent,
                    color: darkMode ? '#000' : '#fff',
                    fontWeight: 800, fontSize: '1rem', cursor: 'pointer', transition: '0.3s',
                  }}
                >
                  Guardar Cambios
                </button>
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setNewCover(null); }}
                  style={{
                    flex: 1, padding: '16px', borderRadius: '50px',
                    border: `1px solid ${theme.border}`,
                    backgroundColor: 'transparent', color: theme.textMain,
                    fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ══ MODAL: ELIMINAR OBRA — también JSX inline por el mismo motivo ══ */}
      {showDeleteBookModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(8px)' }}>
          <div style={{ padding: '40px', borderRadius: '25px', width: '100%', maxWidth: '500px', backgroundColor: darkMode ? '#0f1117' : '#fcfaf7', border: `1px solid ${theme.danger}44`, color: theme.textMain, textAlign: 'center' }}>

            <div style={{ fontSize: '3rem', marginBottom: '20px' }}>⚠️</div>
            <h2 style={{ fontFamily: "'Crimson Pro', serif", color: theme.danger, marginTop: 0, fontSize: '1.8rem' }}>
              Eliminar "{book?.title}"
            </h2>
            <p style={{ color: theme.textMuted, lineHeight: '1.6', marginBottom: '10px' }}>
              Esta acción es <strong style={{ color: theme.textMain }}>permanente e irreversible</strong>.
            </p>
            <p style={{ color: theme.textMuted, fontSize: '0.9rem', marginBottom: '30px' }}>
              Se eliminarán <strong style={{ color: theme.textMain }}>{chapters.length} capítulos</strong>, todas las calificaciones, comentarios y registros de biblioteca de esta obra.
            </p>

            <div style={{ display: 'flex', gap: '15px' }}>
              <button
                onClick={!deleteDisabled ? handleDeleteBook : undefined}
                disabled={deleteDisabled}
                style={{
                  flex: 1, padding: '14px', borderRadius: '50px', border: 'none',
                  backgroundColor: deleteLocked ? `${theme.danger}40` : theme.danger,
                  color: deleteLocked ? `${theme.danger}99` : '#fff',
                  fontWeight: 700, fontSize: '0.9rem',
                  cursor: deleteDisabled ? 'not-allowed' : 'pointer',
                  transition: 'all 0.4s ease',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                }}
              >
                {deleteLocked && (
                  <svg width="40" height="40" viewBox="0 0 40 40" style={{ flexShrink: 0 }}>
                    <circle cx="20" cy="20" r={ringRadius} fill="none" stroke={`${theme.danger}30`} strokeWidth="3" />
                    <circle
                      cx="20" cy="20" r={ringRadius}
                      fill="none" stroke={theme.danger} strokeWidth="3" strokeLinecap="round"
                      strokeDasharray={ringCircumference}
                      strokeDashoffset={ringDashOffset}
                      transform="rotate(-90 20 20)"
                      style={{ transition: 'stroke-dashoffset 1s linear' }}
                    />
                    <text x="20" y="25" textAnchor="middle" fontSize="13" fontWeight="700" fill={theme.danger}>
                      {deleteCountdown}
                    </text>
                  </svg>
                )}
                <span>
                  {deletingBook ? 'Eliminando...' : deleteLocked ? 'Espera para confirmar' : 'Sí, eliminar para siempre'}
                </span>
              </button>

              <button
                onClick={() => setShowDeleteBookModal(false)}
                disabled={deletingBook}
                style={{ flex: 1, padding: '14px', borderRadius: '50px', border: `1px solid ${theme.border}`, backgroundColor: 'transparent', color: theme.textMain, cursor: deletingBook ? 'not-allowed' : 'pointer', fontWeight: 600 }}
              >
                Cancelar
              </button>
            </div>

          </div>
        </div>
      )}


      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>

        <button onClick={() => navigate('/dashboard')} style={{ background: 'none', border: 'none', color: theme.textMuted, cursor: 'pointer', marginBottom: '30px', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          ← VOLVER AL STUDIO
        </button>

        {/* HEADER */}
        <div style={{ display: 'flex', gap: '40px', marginBottom: '60px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <img
            src={`${API_BASE}/static/covers/${book.author_note}`}
            style={{ width: '180px', height: '270px', objectFit: 'cover', borderRadius: '12px', boxShadow: `0 20px 40px rgba(0,0,0,${darkMode ? '0.5' : '0.2'})`, border: `1px solid ${theme.border}` }}
            alt="Portada"
            onError={(e) => { e.target.src = 'https://placehold.jp/180x270.png?text=Sin+Portada'; }}
          />

          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: '3.5rem', fontFamily: "'Crimson Pro', serif", fontWeight: 400, lineHeight: 1 }}>
              {book.title}
            </h1>
            <p style={{ color: theme.textMuted, fontSize: '1.1rem', maxWidth: '700px', margin: '20px 0', lineHeight: '1.6' }}>
              {book.description}
            </p>

            {/* ── SELECTOR DE ESTADO ─────────────────────────────────────── */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 800, color: theme.textMuted, letterSpacing: '1.5px', display: 'block', marginBottom: '10px' }}>
                ESTADO DE LA OBRA
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                {Object.entries(BOOK_STATUSES).map(([key, info]) => {
                  const isActive = bookStatus === key;
                  return (
                    <button
                      key={key}
                      onClick={() => handleStatusChange(key)}
                      disabled={statusSaving}
                      title={info.label}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '50px',
                        border: `1.5px solid ${isActive ? info.color : theme.border}`,
                        backgroundColor: isActive ? `${info.color}20` : 'transparent',
                        color: isActive ? info.color : theme.textMuted,
                        fontWeight: isActive ? 700 : 500,
                        fontSize: '0.82rem',
                        cursor: statusSaving ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex', alignItems: 'center', gap: '6px',
                        opacity: statusSaving && !isActive ? 0.5 : 1,
                      }}
                      onMouseOver={e => { if (!statusSaving && !isActive) { e.currentTarget.style.borderColor = info.color; e.currentTarget.style.color = info.color; }}}
                      onMouseOut={e => { if (!isActive) { e.currentTarget.style.borderColor = theme.border; e.currentTarget.style.color = theme.textMuted; }}}
                    >
                      <span>{info.icon}</span>
                      <span>{info.label}</span>
                    </button>
                  );
                })}
                {/* Feedback de guardado */}
                {statusMsg && (
                  <span style={{
                    fontSize: '0.78rem', fontWeight: 600, marginLeft: '4px',
                    color: statusMsg.startsWith('Error') ? '#f87171' : '#4ade80',
                    transition: 'opacity 0.3s',
                  }}>
                    {statusMsg}
                  </span>
                )}
                {statusSaving && (
                  <span style={{ fontSize: '0.75rem', color: theme.textMuted }}>Guardando...</span>
                )}
              </div>
            </div>
            {/* ── FIN SELECTOR ───────────────────────────────────────────── */}

            <div style={{ display: 'flex', gap: '12px', marginTop: '30px', flexWrap: 'wrap' }}>
              <button onClick={() => navigate(`/add-chapter/${id}`)} style={{ padding: '14px 30px', borderRadius: '50px', border: 'none', backgroundColor: theme.accent, color: darkMode ? '#000' : '#fff', fontWeight: 700, cursor: 'pointer' }}>
                ✦ AÑADIR CAPÍTULO
              </button>
              <button onClick={() => setShowEditModal(true)} style={{ padding: '14px 30px', borderRadius: '50px', border: `1px solid ${theme.border}`, backgroundColor: 'transparent', color: theme.textMain, fontWeight: 600, cursor: 'pointer' }}>
                CONFIGURACIÓN
              </button>
              {/* BOTÓN ELIMINAR LIBRO */}
              <button
                onClick={() => setShowDeleteBookModal(true)}
                style={{ padding: '14px 30px', borderRadius: '50px', border: `1px solid ${theme.danger}55`, backgroundColor: 'transparent', color: theme.danger, fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem', opacity: 0.8, transition: 'opacity 0.2s' }}
                onMouseOver={e => e.currentTarget.style.opacity = '1'}
                onMouseOut={e => e.currentTarget.style.opacity = '0.8'}
              >
                ELIMINAR OBRA
              </button>
            </div>
          </div>
        </div>

        {/* MÉTRICAS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '40px' }}>
          {[
            { label: 'VISTAS TOTALES', value: book.views, color: theme.accent },
            { label: 'EN BIBLIOTECAS', value: totalInLibrary, color: theme.textMain },
            { label: 'PALABRAS', value: chapters.reduce((acc, cap) => acc + (cap.word_count || 0), 0).toLocaleString(), color: theme.textMain },
            { label: 'CAPÍTULOS', value: chapters.length, color: theme.textMain },
          ].map((stat, i) => (
            <div key={i} style={{ padding: '25px', borderRadius: '20px', backgroundColor: theme.card, border: `1px solid ${theme.border}`, textAlign: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: theme.textMuted, fontWeight: 800, letterSpacing: '1.5px' }}>{stat.label}</span>
              <h2 style={{ color: stat.color, fontSize: '2.2rem', margin: '10px 0 0 0', fontFamily: "'Crimson Pro', serif" }}>{stat.value}</h2>
            </div>
          ))}
        </div>

        {/* GRÁFICOS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '30px', marginBottom: '50px' }}>

          <div style={chartCard(theme)}>
            <h4 style={chartTitle(theme)}>EXTENSIÓN POR CAPÍTULO</h4>
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.border} vertical={false} />
                  <XAxis dataKey="name" stroke={theme.textMuted} fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke={theme.textMuted} fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: darkMode ? '#111' : '#fff', border: `1px solid ${theme.border}`, borderRadius: '10px' }} />
                  <Bar dataKey="palabras" fill={theme.accent} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={chartCard(theme)}>
            <h4 style={chartTitle(theme)}>RETENCIÓN DE LECTORES</h4>
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorVis" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={theme.accent} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={theme.accent} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.border} vertical={false} />
                  <XAxis dataKey="name" stroke={theme.textMuted} fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke={theme.textMuted} fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: theme.bg, border: `1px solid ${theme.border}`, borderRadius: '10px' }} />
                  <Area type="monotone" dataKey="vistas" stroke={theme.accent} strokeWidth={3} fillOpacity={1} fill="url(#colorVis)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={chartCard(theme)}>
            <h4 style={chartTitle(theme)}>ESTADO DE LA AUDIENCIA</h4>
            {totalInLibrary === 0 ? (
              <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', color: theme.textMuted, fontStyle: 'italic', fontSize: '0.9rem' }}>
                No hay lectores registrados aún.
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={theme.chartColors[index % theme.chartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: theme.bg, borderColor: theme.border, color: theme.textMain, borderRadius: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ paddingLeft: '20px' }}>
                  {pieData.map((entry, index) => (
                    <div key={index} style={{ fontSize: '0.8rem', marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: theme.chartColors[index] }}></div>
                      <span style={{ color: theme.textMuted }}>{entry.name}:</span>
                      <span style={{ fontWeight: 700 }}>{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={chartCard(theme)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
              <h4 style={{ ...chartTitle(theme), marginBottom: 0 }}>CALIFICACIONES</h4>
              <div style={{ textAlign: 'right' }}>
                <span style={{ display: 'block', fontSize: '1.2rem', fontWeight: 700, color: theme.accent, lineHeight: 1 }}>{Number(book.avg_rating).toFixed(1)} ★</span>
                <span style={{ fontSize: '0.7rem', color: theme.textMuted }}>{book.vote_count} votos</span>
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart layout="vertical" data={ratingChartData} margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" stroke={theme.textMuted} width={35} axisLine={false} tickLine={false} fontSize={12} />
                  <Tooltip cursor={{ fill: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }} contentStyle={{ backgroundColor: theme.bg, borderColor: theme.border, color: theme.textMain, borderRadius: '10px' }} />
                  <Bar dataKey="votos" fill={theme.accent} radius={[0, 4, 4, 0]} barSize={15} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* TABLA DE CAPÍTULOS */}
        <div style={{ backgroundColor: theme.card, borderRadius: '25px', overflow: 'hidden', border: `1px solid ${theme.border}` }}>
          <div style={{ padding: '25px 30px', borderBottom: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontFamily: "'Crimson Pro', serif", fontSize: '1.5rem' }}>Estructura de la Obra</h3>
            <span style={{ fontSize: '0.8rem', color: theme.textMuted }}>{chapters.length} Capítulos publicados</span>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', backgroundColor: 'rgba(0,0,0,0.02)' }}>
                <th style={thStyle}>ORDEN</th>
                <th style={thStyle}>TÍTULO DEL CAPÍTULO</th>
                <th style={thStyle}>PALABRAS</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>COMENTARIOS</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {chapters.map((cap, index) => {
                const isDeleting = deletingChapterId === cap.id;
                return (
                  <tr key={cap.id} style={{ borderBottom: `1px solid ${theme.border}`, opacity: isDeleting ? 0.4 : 1, transition: 'opacity 0.2s' }} className="table-row">
                    <td style={{ padding: '20px 30px', fontWeight: 700, opacity: 0.3, fontSize: '1.2rem', fontFamily: "'Crimson Pro', serif" }}>
                      {index + 1}
                    </td>
                    <td style={{ padding: '20px' }}>
                      <Link to={`/reader/${id}/${index}`} style={{ color: theme.textMain, textDecoration: 'none', fontWeight: 600, fontSize: '1.1rem' }}>
                        {cap.title}
                      </Link>
                    </td>
                    <td style={{ padding: '20px', color: theme.textMuted, fontSize: '0.9rem' }}>
                      {cap.word_count || 0} palabras
                    </td>
                    <td style={{ padding: '20px', textAlign: 'center', color: theme.textMuted, fontSize: '0.9rem' }}>
                      💬 {cap.comment_count || 0}
                    </td>
                    <td style={{ padding: '20px 30px', textAlign: 'right' }}>
                      <button
                        onClick={() => navigate(`/edit-chapter/${cap.id}`)}
                        disabled={isDeleting}
                        style={{ background: 'none', border: 'none', color: theme.accent, cursor: 'pointer', fontWeight: 700, marginRight: '20px', fontSize: '0.75rem', letterSpacing: '0.5px' }}
                      >
                        EDITAR
                      </button>
                      <button
                        onClick={() => handleDeleteChapter(cap.id, cap.title)}
                        disabled={isDeleting}
                        style={{ background: 'none', border: 'none', color: theme.danger, cursor: isDeleting ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.75rem', opacity: isDeleting ? 0.4 : 0.7, transition: 'opacity 0.2s' }}
                        onMouseOver={e => { if (!isDeleting) e.currentTarget.style.opacity = '1'; }}
                        onMouseOut={e => { if (!isDeleting) e.currentTarget.style.opacity = '0.7'; }}
                      >
                        {isDeleting ? 'ELIMINANDO...' : 'ELIMINAR'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {chapters.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: theme.textMuted, fontStyle: 'italic' }}>
                    No hay capítulos todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      <style>{`
        .table-row:hover { background: rgba(255,255,255,0.02); }
        input::placeholder, textarea::placeholder { color: #555; }
      `}</style>
    </div>
  );
};

// ─── ESTILOS AUXILIARES ───────────────────────────────────────────────────────
// Usados en la tabla y gráficos
const labelStyle      = (theme) => ({ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '8px', marginTop: '4px', color: theme.textMuted, letterSpacing: '1px' });
const inputStyleModal = (theme) => ({ width: '100%', padding: '12px', borderRadius: '10px', marginBottom: '20px', backgroundColor: theme.input, color: theme.textMain, border: `1px solid ${theme.border}`, outline: 'none', boxSizing: 'border-box', fontSize: '0.95rem' });
const chartCard       = (theme) => ({ padding: '30px', borderRadius: '25px', backgroundColor: theme.card, border: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column' });
const chartTitle      = (theme) => ({ marginBottom: '25px', color: theme.textMuted, fontSize: '0.8rem', fontWeight: 800, letterSpacing: '1px' });
const thStyle         = { padding: '20px 30px', fontSize: '0.7rem', color: '#8a8782', letterSpacing: '1px' };

// Usados en el EditModal — idénticos a PublishBook
const modalLabelStyle = (theme) => ({ display: 'block', marginBottom: '10px', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '1.5px', color: theme.accent, opacity: 0.8 });
const modalInputStyle = (theme, darkMode) => ({ width: '100%', padding: '15px', marginBottom: '25px', borderRadius: '12px', backgroundColor: darkMode ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)', color: theme.textMain, border: `1px solid ${theme.border}`, fontSize: '1rem', outline: 'none', boxSizing: 'border-box' });

export default AuthorBookDetails;