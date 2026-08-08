import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE, authHeader } from '../App';

const MyLibrary = ({ user, darkMode }) => {
  const [books, setBooks] = useState([]);
  const [filter, setFilter] = useState('all');
  const navigate = useNavigate();

  const theme = {
    bg: darkMode ? '#0a0b10' : '#f4f0ea',
    card: darkMode ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.5)',
    accent: darkMode ? '#d4af37' : '#b85b3f',
    textMain: darkMode ? '#e3e1db' : '#2b2824',
    textMuted: darkMode ? '#8a8782' : '#857f77',
    border: darkMode ? 'rgba(212, 175, 55, 0.15)' : 'rgba(184, 91, 63, 0.15)',
  };

  useEffect(() => {
    if (!user?.session_token) return;
    fetch(`${API_BASE}/api/library`, {
      headers: authHeader(user),
    })
      .then(res => {
        if (!res.ok) throw new Error('No autorizado');
        return res.json();
      })
      .then(data => setBooks(Array.isArray(data) ? data : []))
      .catch(err => console.error('Error cargando biblioteca:', err));
  }, [user]);

  const filteredBooks = filter === 'all' ? books : books.filter(b => b.status === filter);

  const statusLabels = {
    reading:   { text: 'Leyendo',     color: theme.accent },
    completed: { text: 'Leído',       color: darkMode ? '#4a5d4a' : '#6b8e6b' },
    pending:   { text: 'Pendiente',   color: theme.textMuted },
    dropped:   { text: 'Abandonado',  color: darkMode ? '#5c3d3d' : '#a67b7b' },
  };

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '150px 20px', color: theme.textMain }}>
        <h2 style={{ fontFamily: "'Crimson Pro', serif", fontSize: '2rem' }}>Acceso Denegado</h2>
        <p style={{ opacity: 0.7, marginTop: '10px' }}>Debes iniciar sesión para ver tu biblioteca.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '40px 20px', maxWidth: '1000px', margin: '0 auto', minHeight: '100vh', color: theme.textMain, fontFamily: "'Inter', sans-serif" }}>

      <header style={{ textAlign: 'center', marginBottom: '50px' }}>
        <h2 style={{ fontSize: '2.5rem', fontWeight: 400, fontFamily: "'Crimson Pro', serif", margin: 0 }}>
          Mi <span style={{ fontStyle: 'italic', color: theme.accent }}>Biblioteca</span>
        </h2>
        <div style={{ width: '40px', height: '2px', background: theme.accent, margin: '15px auto', opacity: 0.6 }}></div>
      </header>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '50px', flexWrap: 'wrap' }}>
        {['all', 'reading', 'pending', 'completed', 'dropped'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '8px 20px', borderRadius: '50px',
              border: `1px solid ${filter === f ? theme.accent : theme.border}`,
              cursor: 'pointer',
              backgroundColor: filter === f ? theme.accent : 'transparent',
              color: filter === f ? (darkMode ? '#0a0b10' : '#fff') : theme.textMain,
              fontWeight: 600, transition: 'all 0.3s ease', fontSize: '0.85rem',
            }}
          >
            {f === 'all' ? 'Todos' : statusLabels[f].text}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '35px' }}>
        {filteredBooks.map(book => (
          <div
            key={book.id}
            onClick={() => navigate(`/book/${book.id}`)}
            style={{ cursor: 'pointer', textAlign: 'left', transition: 'all 0.4s ease' }}
            className="library-card"
          >
            <div style={{
              height: '260px', backgroundColor: theme.card, borderRadius: '12px',
              marginBottom: '15px', overflow: 'hidden', position: 'relative',
              boxShadow: `0 10px 20px rgba(0,0,0,${darkMode ? '0.5' : '0.15'})`,
              border: `1px solid ${theme.border}`, backdropFilter: 'blur(10px)',
            }}>
              <img
                src={`${API_BASE}/static/covers/${book.author_note}`}
                alt={book.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s ease' }}
                className="cover-img"
                onError={(e) => { e.target.src = 'https://placehold.jp/24/333333/ffffff/180x260.png?text=Sin+Portada'; }}
              />
              <div style={{
                position: 'absolute', top: '12px', right: '12px',
                padding: '4px 10px', borderRadius: '4px',
                backgroundColor: 'rgba(0,0,0,0.7)', color: '#fff',
                fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase',
                letterSpacing: '1px', backdropFilter: 'blur(4px)',
                borderLeft: `3px solid ${statusLabels[book.status]?.color || theme.textMuted}`,
              }}>
                {statusLabels[book.status]?.text || book.status}
              </div>
            </div>
            <h4 style={{ margin: '0 0 5px 0', fontSize: '1.05rem', fontFamily: "'Crimson Pro', serif", fontWeight: 600, lineHeight: '1.2' }}>
              {book.title}
            </h4>
            <p style={{ fontSize: '0.85rem', color: theme.accent, fontStyle: 'italic', margin: 0 }}>
              {book.author}
            </p>
          </div>
        ))}
      </div>

      {filteredBooks.length === 0 && (
        <div style={{ textAlign: 'center', marginTop: '80px', opacity: 0.4 }}>
          <span style={{ fontSize: '2rem' }}>✧</span>
          <p style={{ fontStyle: 'italic', marginTop: '10px' }}>Tu colección está esperando nuevas historias.</p>
        </div>
      )}

      <style>{`
        .library-card:hover .cover-img { transform: scale(1.1); }
        .library-card:hover h4 { color: ${theme.accent}; }
        .library-card:hover { transform: translateY(-5px); }
      `}</style>
    </div>
  );
};

export default MyLibrary;
