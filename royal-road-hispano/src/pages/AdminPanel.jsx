import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { API_BASE, authHeader } from '../App';

const AdminPanel = ({ user, darkMode }) => {
  const navigate = useNavigate();
  const [access, setAccess] = useState('checking'); // checking | allowed | denied
  const [tab, setTab] = useState('stats');          // stats | books | comments | users

  const [stats, setStats] = useState(null);
  const [books, setBooks] = useState([]);
  const [comments, setComments] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const theme = {
    bg: darkMode ? '#0a0b10' : '#f4f0ea',
    card: darkMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.7)',
    accent: darkMode ? '#d4af37' : '#b85b3f',
    textMain: darkMode ? '#e3e1db' : '#2b2824',
    textMuted: darkMode ? '#8a8782' : '#857f77',
    border: darkMode ? 'rgba(212, 175, 55, 0.2)' : 'rgba(184, 91, 63, 0.2)',
  };

  useEffect(() => {
    if (!user?.session_token) { setAccess('denied'); return; }
    fetch(`${API_BASE}/api/admin/check`, { headers: authHeader(user) })
      .then(res => res.json())
      .then(data => setAccess(data.is_admin ? 'allowed' : 'denied'))
      .catch(() => setAccess('denied'));
  }, [user]);

  useEffect(() => {
    if (access !== 'allowed') return;
    loadData();
  }, [access, tab]);

  const loadData = () => {
    setLoading(true);
    const endpoint = tab === 'stats' ? 'stats' : tab === 'books' ? 'books' : tab === 'comments' ? 'comments' : 'users';
    fetch(`${API_BASE}/api/admin/${endpoint}`, { headers: authHeader(user) })
      .then(res => res.json())
      .then(data => {
        if (tab === 'stats') setStats(data);
        else if (tab === 'books') setBooks(Array.isArray(data) ? data : []);
        else if (tab === 'comments') setComments(Array.isArray(data) ? data : []);
        else setUsers(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const toggleBan = async (email, currentlyBanned) => {
    try {
      await fetch(`${API_BASE}/api/admin/users/ban`, {
        method: 'POST', headers: authHeader(user),
        body: JSON.stringify({ email, banned: !currentlyBanned }),
      });
      setUsers(users.map(u => u.email === email ? { ...u, is_banned: currentlyBanned ? 0 : 1 } : u));
    } catch (err) { console.error('Error al banear:', err); }
  };

  const toggleAdmin = async (email, currentlyAdmin) => {
    try {
      await fetch(`${API_BASE}/api/admin/users/admin`, {
        method: 'POST', headers: authHeader(user),
        body: JSON.stringify({ email, is_admin: !currentlyAdmin }),
      });
      setUsers(users.map(u => u.email === email ? { ...u, is_admin: currentlyAdmin ? 0 : 1 } : u));
    } catch (err) { console.error('Error al cambiar admin:', err); }
  };

  const toggleBook = async (bookId, currentlyHidden) => {
    try {
      await fetch(`${API_BASE}/api/admin/books/${bookId}/hide`, {
        method: 'POST',
        headers: authHeader(user),
        body: JSON.stringify({ hidden: !currentlyHidden }),
      });
      setBooks(books.map(b => b.id === bookId ? { ...b, is_hidden: currentlyHidden ? 0 : 1 } : b));
    } catch (err) {
      console.error('Error al ocultar libro:', err);
    }
  };

  const toggleComment = async (commentId, currentlyHidden) => {
    try {
      await fetch(`${API_BASE}/api/admin/comments/${commentId}/hide`, {
        method: 'POST',
        headers: authHeader(user),
        body: JSON.stringify({ hidden: !currentlyHidden }),
      });
      setComments(comments.map(c => c.id === commentId ? { ...c, is_hidden: currentlyHidden ? 0 : 1 } : c));
    } catch (err) {
      console.error('Error al ocultar comentario:', err);
    }
  };

  if (access === 'checking') {
    return <div style={{ textAlign: 'center', padding: '150px 20px', color: theme.accent, fontFamily: "'Crimson Pro', serif", fontSize: '1.2rem' }}>Verificando permisos...</div>;
  }

  if (access === 'denied') {
    return (
      <div style={{ textAlign: 'center', padding: '150px 20px', color: theme.textMain, fontFamily: "'Inter', sans-serif" }}>
        <h2 style={{ fontFamily: "'Crimson Pro', serif", fontSize: '2rem', color: theme.accent }}>Acceso Denegado</h2>
        <p style={{ opacity: 0.7, marginTop: '10px' }}>No tenes permisos para ver esta pagina.</p>
        <button onClick={() => navigate('/')} style={{ marginTop: '30px', padding: '12px 30px', borderRadius: '50px', border: `1px solid ${theme.accent}`, background: 'transparent', color: theme.accent, cursor: 'pointer', fontWeight: 700 }}>
          Volver al inicio
        </button>
      </div>
    );
  }

  return (
    <div className="admin-container" style={{ maxWidth: '1100px', margin: '0 auto', padding: '100px 20px 60px 20px', color: theme.textMain, fontFamily: "'Inter', sans-serif" }}>
      <header style={{ marginBottom: '35px', borderBottom: `1px solid ${theme.border}`, paddingBottom: '25px' }}>
        <h1 style={{ fontFamily: "'Crimson Pro', serif", fontSize: '2.5rem', margin: 0, color: theme.accent }}>Panel de Administracion</h1>
        <p style={{ color: theme.textMuted, marginTop: '8px' }}>Bienvenido, {user?.name}. Modera el contenido de la plataforma.</p>
      </header>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '30px', flexWrap: 'wrap' }}>
        {[['stats', 'Resumen'], ['books', 'Libros'], ['comments', 'Comentarios'], ['users', 'Usuarios']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: '10px 24px', borderRadius: '50px', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem',
              border: `1px solid ${tab === key ? theme.accent : theme.border}`,
              backgroundColor: tab === key ? theme.accent : 'transparent',
              color: tab === key ? (darkMode ? '#0a0b10' : '#fff') : theme.textMain,
              transition: '0.3s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <p style={{ color: theme.textMuted, textAlign: 'center', padding: '40px' }}>Cargando...</p>}

      {/* ── RESUMEN / ESTADÍSTICAS ── */}
      {!loading && tab === 'stats' && stats && (
        <div>
          {/* Tarjetas de totales */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '14px', marginBottom: '35px' }}>
            {[
              ['Usuarios', stats.totals.users],
              ['Libros', stats.totals.books],
              ['Capítulos', stats.totals.chapters],
              ['Comentarios', stats.totals.comments],
              ['Vistas totales', stats.totals.views],
              ['Libros +18', stats.totals.adult_books],
              ['Libros ocultos', stats.totals.hidden_books],
              ['Usuarios baneados', stats.totals.banned_users],
            ].map(([label, value]) => (
              <div key={label} style={{ padding: '20px', borderRadius: '14px', background: theme.card, border: `1px solid ${theme.border}`, textAlign: 'center' }}>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: theme.accent, fontFamily: "'Crimson Pro', serif" }}>{value}</div>
                <div style={{ fontSize: '0.75rem', color: theme.textMuted, marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Gráfico de libros por mes */}
          {stats.by_month && stats.by_month.length > 0 && (
            <div style={{ padding: '24px', borderRadius: '18px', background: theme.card, border: `1px solid ${theme.border}`, marginBottom: '30px' }}>
              <h3 style={{ fontFamily: "'Crimson Pro', serif", fontSize: '1.3rem', color: theme.textMain, marginTop: 0, marginBottom: '20px' }}>Libros creados por mes</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.by_month}>
                  <XAxis dataKey="month" stroke={theme.textMuted} fontSize={12} />
                  <YAxis stroke={theme.textMuted} fontSize={12} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: '8px', color: theme.textMain }} />
                  <Bar dataKey="count" fill={theme.accent} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Top 5 más vistos */}
          {stats.top_viewed && stats.top_viewed.length > 0 && (
            <div style={{ padding: '24px', borderRadius: '18px', background: theme.card, border: `1px solid ${theme.border}` }}>
              <h3 style={{ fontFamily: "'Crimson Pro', serif", fontSize: '1.3rem', color: theme.textMain, marginTop: 0, marginBottom: '18px' }}>Más vistos</h3>
              {stats.top_viewed.map((b, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < stats.top_viewed.length - 1 ? `1px solid ${theme.border}` : 'none' }}>
                  <span style={{ color: theme.textMain, fontWeight: 600 }}>
                    <span style={{ color: theme.accent, marginRight: '10px', fontWeight: 800 }}>{i + 1}</span>
                    {b.title} <span style={{ color: theme.textMuted, fontSize: '0.85rem', fontStyle: 'italic' }}>· {b.author}</span>
                  </span>
                  <span style={{ color: theme.accent, fontWeight: 700 }}>{b.views} vistas</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!loading && tab === 'books' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {books.length === 0 && <p style={{ color: theme.textMuted, textAlign: 'center', padding: '40px' }}>No hay libros.</p>}
          {books.map(book => (
            <div key={book.id} className="admin-row" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '15px',
              padding: '16px 20px', borderRadius: '14px', background: theme.card,
              border: `1px solid ${book.is_hidden ? '#e05252' : theme.border}`,
              opacity: book.is_hidden ? 0.6 : 1,
            }}>
              <div className="admin-row-info" style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {book.title}
                  {book.is_hidden ? <span style={{ fontSize: '0.65rem', color: '#e05252', border: '1px solid #e05252', padding: '2px 8px', borderRadius: '6px', fontWeight: 800 }}>OCULTO</span> : null}
                  {book.is_adult ? <span style={{ fontSize: '0.65rem', color: '#e05252', fontWeight: 800 }}>+18</span> : null}
                </div>
                <div style={{ fontSize: '0.8rem', color: theme.textMuted, marginTop: '3px' }}>
                  por {book.author} - {book.chapter_count} cap. - {book.author_email}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <button onClick={() => navigate(`/book/${book.id}`)} style={secondaryBtn(theme)}>Ver</button>
                <button onClick={() => toggleBook(book.id, book.is_hidden)} style={book.is_hidden ? restoreBtn() : hideBtn()}>
                  {book.is_hidden ? 'Mostrar' : 'Ocultar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && tab === 'comments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {comments.length === 0 && <p style={{ color: theme.textMuted, textAlign: 'center', padding: '40px' }}>No hay comentarios.</p>}
          {comments.map(c => (
            <div key={c.id} className="admin-row" style={{
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '15px',
              padding: '16px 20px', borderRadius: '14px', background: theme.card,
              border: `1px solid ${c.is_hidden ? '#e05252' : theme.border}`,
              opacity: c.is_hidden ? 0.6 : 1,
            }}>
              <div className="admin-row-info" style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.8rem', color: theme.accent, fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {c.user_name}
                  {c.is_hidden ? <span style={{ fontSize: '0.65rem', color: '#e05252', border: '1px solid #e05252', padding: '2px 8px', borderRadius: '6px', fontWeight: 800 }}>OCULTO</span> : null}
                </div>
                <div style={{ fontSize: '0.9rem', color: theme.textMain, lineHeight: 1.5, wordBreak: 'break-word' }}>{c.text}</div>
                <div style={{ fontSize: '0.75rem', color: theme.textMuted, marginTop: '5px' }}>
                  en "{c.book_title || 'libro eliminado'}" - {new Date(c.timestamp).toLocaleDateString()}
                </div>
              </div>
              <button onClick={() => toggleComment(c.id, c.is_hidden)} style={c.is_hidden ? restoreBtn() : hideBtn()}>
                {c.is_hidden ? 'Mostrar' : 'Ocultar'}
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading && tab === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {users.length === 0 && <p style={{ color: theme.textMuted, textAlign: 'center', padding: '40px' }}>No hay usuarios.</p>}
          {users.map(u => (
            <div key={u.email} className="admin-row" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '15px',
              padding: '16px 20px', borderRadius: '14px', background: theme.card,
              border: `1px solid ${u.is_banned ? '#e05252' : theme.border}`,
              opacity: u.is_banned ? 0.6 : 1,
            }}>
              <div className="admin-row-info" style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {u.nickname || u.email}
                  {u.is_admin ? <span style={{ fontSize: '0.65rem', color: theme.accent, border: `1px solid ${theme.accent}`, padding: '2px 8px', borderRadius: '6px', fontWeight: 800 }}>ADMIN</span> : null}
                  {u.is_factory_admin ? <span style={{ fontSize: '0.65rem', color: theme.textMuted }}>(principal)</span> : null}
                  {u.is_banned ? <span style={{ fontSize: '0.65rem', color: '#e05252', border: '1px solid #e05252', padding: '2px 8px', borderRadius: '6px', fontWeight: 800 }}>BANEADO</span> : null}
                </div>
                <div style={{ fontSize: '0.8rem', color: theme.textMuted, marginTop: '3px' }}>
                  {u.email} - {u.book_count} libros
                </div>
              </div>
              {/* Los admins de fábrica no se pueden tocar */}
              {!u.is_factory_admin && (
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
                  <button onClick={() => toggleAdmin(u.email, u.is_admin)} style={secondaryBtn(theme)}>
                    {u.is_admin ? 'Quitar admin' : 'Hacer admin'}
                  </button>
                  <button onClick={() => toggleBan(u.email, u.is_banned)} style={u.is_banned ? restoreBtn() : hideBtn()}>
                    {u.is_banned ? 'Desbanear' : 'Banear'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <style>{`
        @media (max-width: 600px) {
          .admin-container { padding: 90px 14px 40px 14px; }
          .admin-row { flex-direction: column; align-items: stretch !important; }
        }
      `}</style>
    </div>
  );
};

const secondaryBtn = (theme) => ({ padding: '7px 16px', borderRadius: '8px', border: `1px solid ${theme.border}`, background: 'transparent', color: theme.textMuted, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 });
const hideBtn = () => ({ padding: '7px 16px', borderRadius: '8px', border: '1px solid #e05252', background: 'transparent', color: '#e05252', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 });
const restoreBtn = () => ({ padding: '7px 16px', borderRadius: '8px', border: '1px solid #6b8e6b', background: 'transparent', color: '#6b8e6b', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 });

export default AdminPanel;