import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE, authHeader } from '../App';

// Mismo objeto que BookDetail — fuente única de verdad de los estados
const BOOK_STATUS_DISPLAY = {
  ongoing:   { label: 'En progreso', color: '#4ade80', icon: '✍️' },
  completed: { label: 'Terminada',   color: '#60a5fa', icon: '✅' },
  paused:    { label: 'En pausa',    color: '#facc15', icon: '⏸️' },
  abandoned: { label: 'Abandonada',  color: '#f87171', icon: '🚫' },
};

const AuthorDashboard = ({ user, darkMode }) => {
  const [myBooks, setMyBooks] = useState([]);
  const navigate = useNavigate();

  const theme = {
    bg:       darkMode ? '#0a0b10' : '#f4f0ea',
    card:     darkMode ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.6)',
    accent:   darkMode ? '#d4af37' : '#b85b3f',
    textMain: darkMode ? '#e3e1db' : '#2b2824',
    textMuted: darkMode ? '#8a8782' : '#857f77',
    border:   darkMode ? 'rgba(212, 175, 55, 0.15)' : 'rgba(184, 91, 63, 0.15)',
  };

  useEffect(() => {
    if (!user) { navigate('/'); return; }
    if (!user.session_token) return;

    fetch(`${API_BASE}/api/my-books`, {
      headers: authHeader(user),
    })
      .then(res => {
        if (!res.ok) throw new Error('No autorizado');
        return res.json();
      })
      .then(data => setMyBooks(Array.isArray(data) ? data : []))
      .catch(err => console.error('Error cargando libros:', err));
  }, [user, navigate]);

  if (!user) return null;

  return (
    <div style={{ padding: '60px 0', minHeight: '100vh', color: theme.textMain, fontFamily: "'Inter', sans-serif" }}>

      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        marginBottom: '60px', borderBottom: `1px solid ${theme.border}`, paddingBottom: '30px',
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2.8rem', fontFamily: "'Crimson Pro', serif", fontWeight: 400 }}>
            Bienvenido a tu <span style={{ fontStyle: 'italic', color: theme.accent }}>Estudio</span>
          </h1>
        </div>
        <Link to="/publish" style={{
          background: theme.accent, color: darkMode ? '#0a0b10' : '#fff',
          padding: '12px 28px', borderRadius: '50px', textDecoration: 'none',
          fontWeight: 700, fontSize: '0.9rem', transition: 'transform 0.3s ease',
        }}
          onMouseOver={e => e.currentTarget.style.transform = 'translateY(-1px)'}
          onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          ✦ CREAR NUEVA OBRA
        </Link>
      </header>

      <h2 style={{ fontSize: '1.2rem', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '30px', color: theme.accent, fontWeight: 800 }}>
        Tus Historias
      </h2>

      {myBooks.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '80px', background: theme.card,
          borderRadius: '20px', border: `1px dashed ${theme.border}`, backdropFilter: 'blur(10px)',
        }}>
          <p style={{ fontSize: '1.2rem', color: theme.textMuted }}>Aún no tienes ninguna historia creada.</p>
          <Link to="/publish" style={{ color: theme.accent, fontWeight: 600, textDecoration: 'none', display: 'block', marginTop: '15px' }}>
            Escribe tu primera historia ahora →
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {myBooks.map(book => {
            const statusInfo = BOOK_STATUS_DISPLAY[book.book_status] || BOOK_STATUS_DISPLAY.ongoing;
            return (
              <div key={book.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '25px', background: theme.card, borderRadius: '20px',
                border: `1px solid ${theme.border}`, backdropFilter: 'blur(12px)', transition: 'all 0.3s ease',
              }}
                className="dashboard-card"
              >
                {/* Info del libro */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '25px' }}>

                  {/* Portada */}
                  <div style={{ width: '60px', height: '85px', backgroundColor: '#111', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 5px 15px rgba(0,0,0,0.2)', flexShrink: 0 }}>
                    <img
                      src={`${API_BASE}/static/covers/${book.author_note}`}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => e.target.src = 'https://placehold.jp/60x85.png?text=No+Cover'}
                    />
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <h3 style={{ margin: 0, fontFamily: "'Crimson Pro', serif", fontSize: '1.4rem', fontWeight: 600 }}>
                        {book.title}
                      </h3>
                      {/* Badge de estado */}
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                        padding: '3px 10px', borderRadius: '20px',
                        backgroundColor: `${statusInfo.color}18`,
                        border: `1px solid ${statusInfo.color}50`,
                        flexShrink: 0,
                      }}>
                        <span style={{ fontSize: '0.7rem' }}>{statusInfo.icon}</span>
                        <span style={{ color: statusInfo.color, fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.3px' }}>
                          {statusInfo.label}
                        </span>
                      </div>
                    </div>

                    <span style={{ fontSize: '0.8rem', color: theme.textMuted, fontWeight: 600 }}>
                      <span style={{ color: theme.accent }}>✦</span> {book.views} LECTURAS
                    </span>
                  </div>
                </div>

                {/* Botones */}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={() => navigate(`/dashboard/book/${book.id}`)}
                    style={{ border: `1px solid ${theme.border}`, background: 'transparent', color: theme.textMain, padding: '10px 20px', borderRadius: '50px', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', transition: 'all 0.3s ease' }}
                    onMouseOver={e => { e.currentTarget.style.borderColor = theme.accent; e.currentTarget.style.color = theme.accent; }}
                    onMouseOut={e => { e.currentTarget.style.borderColor = theme.border; e.currentTarget.style.color = theme.textMain; }}
                  >
                    ESTADÍSTICAS
                  </button>
                  <button
                    onClick={() => navigate(`/add-chapter/${book.id}`)}
                    style={{ border: 'none', background: darkMode ? 'rgba(212, 175, 55, 0.1)' : 'rgba(184, 91, 63, 0.1)', color: theme.accent, padding: '10px 20px', borderRadius: '50px', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', transition: 'all 0.3s ease' }}
                    onMouseOver={e => e.currentTarget.style.background = theme.accent + '30'}
                    onMouseOut={e => e.currentTarget.style.background = darkMode ? 'rgba(212, 175, 55, 0.1)' : 'rgba(184, 91, 63, 0.1)'}
                  >
                    + CAPÍTULOS
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .dashboard-card:hover { border-color: ${theme.accent} !important; }
      `}</style>
    </div>
  );
};

export default AuthorDashboard;
