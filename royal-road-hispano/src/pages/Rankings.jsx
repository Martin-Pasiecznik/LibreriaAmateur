import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../App';
import CoverImage from '../components/CoverImage';
import { MAIN_GENRES, GENRE_GROUPS } from '../genres';

const Rankings = ({ darkMode }) => {
  const [topBooks, setTopBooks] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);  // varios tags (AND)
  const [sortBy, setSortBy] = useState("views");     // 'views' (default) | 'rating'

  // #8 — Estado de scroll infinito
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef(null);
  const PER_PAGE = 20;

  // Géneros principales — siempre visibles como pills en la fila de arriba
  // Géneros desde la lista centralizada (genres.js)
  const mainGenres = MAIN_GENRES;
  const moreGenreGroups = GENRE_GROUPS.map(g => ({ name: g.title, tags: g.tags }));
  const moreGenreTags = moreGenreGroups.flatMap(g => g.tags);
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  // NUEVA PALETA: Sincronizada con el estilo Neo-Editorial
  const theme = {
    bg: darkMode ? '#0a0b10' : '#f4f0ea', 
    card: darkMode ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.5)',
    accent: darkMode ? '#d4af37' : '#b85b3f', // Oro / Terracota
    textMain: darkMode ? '#e3e1db' : '#2b2824',
    textMuted: darkMode ? '#8a8782' : '#857f77',
    border: darkMode ? 'rgba(212, 175, 55, 0.15)' : 'rgba(184, 91, 63, 0.15)',
    
    // Tonos de medallas adaptados a la nueva paleta
    gold: darkMode ? '#d4af37' : '#b85b3f',
    silver: darkMode ? '#9e9e9e' : '#8a8782',
    bronze: darkMode ? '#cd7f32' : '#a0522d',
    star: darkMode ? '#d4af37' : '#b85b3f'
  };

  // #8 — Al cambiar filtros u orden: reiniciar a página 1 y recargar desde cero
  useEffect(() => {
    fetchFirstPage();
  }, [selectedTags, sortBy]);

  const buildUrl = (pageNum) => {
    const params = new URLSearchParams({ page: pageNum, per_page: PER_PAGE });
    params.set('sort', sortBy);
    // Varios tags: se repite el parámetro (el backend los combina con AND)
    selectedTags.forEach(t => params.append('tag', t));
    return `${API_BASE}/api/rankings/top100?${params}`;
  };

  // Agregar / quitar un tag de la selección
  const toggleTag = (tag) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const clearTags = () => setSelectedTags([]);

  const fetchFirstPage = async () => {
    setPage(1);
    try {
      const res = await fetch(buildUrl(1));
      const data = await res.json();
      const books = data.books || [];
      setTopBooks(books);
      setHasMore(data.has_more ?? false);
    } catch (err) {
      console.error("Error cargando rankings:", err);
      setTopBooks([]);
      setHasMore(false);
    }
  };

  const fetchNextPage = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const res = await fetch(buildUrl(nextPage));
      const data = await res.json();
      const books = data.books || [];
      setTopBooks(prev => [...prev, ...books]);
      setHasMore(data.has_more ?? false);
      setPage(nextPage);
    } catch (err) {
      console.error("Error cargando más:", err);
      setHasMore(false);
    }
    setLoadingMore(false);
  }, [page, hasMore, loadingMore, selectedTags, sortBy]);

  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) fetchNextPage();
    }, { rootMargin: '200px' });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [fetchNextPage, hasMore]);

  const getRankColor = (index) => {
    if (index === 0) return theme.gold;
    if (index === 1) return theme.silver;
    if (index === 2) return theme.bronze;
    return theme.textMuted;
  };

  return (
    <div className="rank-container" style={{ padding: '40px 20px', maxWidth: '900px', margin: '0 auto', minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>
      <header style={{ textAlign: 'center', marginBottom: '60px', position: 'relative' }}>
        {/* Pequeño halo de luz para el título */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: '300px', height: '150px', background: `radial-gradient(circle, ${theme.accent}15 0%, transparent 70%)`,
          filter: 'blur(30px)', zIndex: -1, pointerEvents: 'none'
        }}></div>
        
        <h1 style={{ fontSize: '3.5rem', fontWeight: 400, margin: 0, color: theme.textMain, fontFamily: "'Crimson Pro', serif" }}>
          TOP <span style={{ color: theme.accent, fontStyle: 'italic' }}>100</span>
        </h1>
        <p style={{ color: theme.textMuted, fontWeight: 400, marginTop: '10px', fontSize: '1.1rem' }}>
          Las obras literarias más aclamadas por la comunidad.
        </p>
      </header>

      {/* SELECTOR DE ORDEN */}
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.8rem', color: theme.textMuted, alignSelf: 'center', marginRight: '4px' }}>Ordenar por:</span>
        {[['views', 'Más vistos'], ['rating', 'Mejor puntuados']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSortBy(key)}
            style={{
              padding: '7px 18px', borderRadius: '50px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700,
              border: `1px solid ${sortBy === key ? theme.accent : theme.border}`,
              background: sortBy === key ? theme.accent : 'transparent',
              color: sortBy === key ? (darkMode ? '#0a0b10' : '#ffffff') : theme.textMain,
              fontFamily: "'Inter', sans-serif", transition: 'all 0.3s ease',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* FILTROS ELEGANTES — selección múltiple de tags */}
      <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '20px', marginBottom: showMoreFilters ? '20px' : '20px', scrollbarWidth: 'none', justifyContent: 'center', flexWrap: 'wrap' }}>
        {mainGenres.map(tag => (
          <button 
            key={tag}
            onClick={() => toggleTag(tag)}
            style={{
              padding: '8px 22px', borderRadius: '50px', 
              border: `1px solid ${selectedTags.includes(tag) ? theme.accent : theme.border}`,
              background: selectedTags.includes(tag) ? theme.accent : 'transparent',
              color: selectedTags.includes(tag) ? (darkMode ? '#0a0b10' : '#ffffff') : theme.textMain,
              cursor: 'pointer', fontWeight: 600, transition: 'all 0.3s ease', whiteSpace: 'nowrap',
              boxShadow: selectedTags.includes(tag) ? `0 0 15px ${theme.accent}40` : 'none',
              fontFamily: "'Inter', sans-serif", fontSize: '0.9rem'
            }}
          >
            {tag}
          </button>
        ))}

        {/* Botón "Más filtros" */}
        <button
          onClick={() => setShowMoreFilters(prev => !prev)}
          style={{
            padding: '8px 22px', borderRadius: '50px',
            border: `1px solid ${showMoreFilters ? theme.accent : theme.border}`,
            background: 'transparent',
            color: theme.accent,
            cursor: 'pointer', fontWeight: 700, transition: 'all 0.3s ease', whiteSpace: 'nowrap',
            fontFamily: "'Inter', sans-serif", fontSize: '0.9rem',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}
        >
          Más filtros
          <span style={{ fontSize: '0.7rem', transform: showMoreFilters ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
        </button>
      </div>

      {/* Tags activos + botón limpiar */}
      {selectedTags.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', marginBottom: '30px' }}>
          <span style={{ fontSize: '0.8rem', color: theme.textMuted }}>
            Filtrando por {selectedTags.length} {selectedTags.length === 1 ? 'etiqueta' : 'etiquetas'}:
          </span>
          {selectedTags.map(tag => (
            <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '50px', background: `${theme.accent}20`, border: `1px solid ${theme.accent}`, color: theme.accent, fontSize: '0.8rem', fontWeight: 600 }}>
              {tag}
              <button onClick={() => toggleTag(tag)} style={{ background: 'none', border: 'none', color: theme.accent, cursor: 'pointer', padding: 0, fontSize: '1rem', lineHeight: 1 }}>×</button>
            </span>
          ))}
          <button
            onClick={clearTags}
            style={{ padding: '5px 16px', borderRadius: '50px', border: `1px solid ${theme.border}`, background: 'transparent', color: theme.textMuted, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, fontFamily: "'Inter', sans-serif" }}
          >
            Limpiar
          </button>
        </div>
      )}

      {/* PANEL DE CATEGORÍAS SECUNDARIAS — compacto, se despliega bajo la fila principal */}
      {showMoreFilters && (
        <div style={{
          background: theme.card, border: `1px solid ${theme.border}`, borderRadius: '20px',
          padding: '25px 30px', marginBottom: '40px',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '1px', color: theme.textMuted, textTransform: 'uppercase' }}>
              Más categorías
            </span>
            <button
              onClick={() => setShowMoreFilters(false)}
              style={{ background: 'none', border: 'none', color: theme.textMuted, cursor: 'pointer', fontSize: '0.9rem' }}
            >
              ✕
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {moreGenreGroups.map(group => (
              <div key={group.name}>
                <p style={{ margin: '0 0 8px 0', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.5px', color: theme.accent, opacity: 0.85 }}>
                  {group.name}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {group.tags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      style={{
                        padding: '6px 16px', borderRadius: '50px', fontSize: '0.8rem',
                        border: `1px solid ${selectedTags.includes(tag) ? theme.accent : theme.border}`,
                        background: selectedTags.includes(tag) ? theme.accent : 'transparent',
                        color: selectedTags.includes(tag) ? (darkMode ? '#0a0b10' : '#ffffff') : theme.textMain,
                        cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s ease', whiteSpace: 'nowrap',
                      }}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LISTA DE RANKING */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {topBooks.map((book, index) => (
          <Link key={book.id} to={`/book/${book.slug || book.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="rank-row" style={{
              display: 'flex', alignItems: 'center', padding: '20px 25px', 
              background: theme.card, borderRadius: '20px', 
              backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
              border: `1px solid ${index < 3 ? getRankColor(index) + '50' : theme.border}`,
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative', overflow: 'hidden'
            }} 
            onMouseOver={e => {
              e.currentTarget.style.transform = 'translateY(-5px) scale(1.01)';
              e.currentTarget.style.borderColor = index < 3 ? getRankColor(index) : theme.accent;
              e.currentTarget.style.boxShadow = `0 15px 30px rgba(0,0,0,${darkMode ? '0.4' : '0.1'})`;
            }}
            onMouseOut={e => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.borderColor = index < 3 ? getRankColor(index) + '50' : theme.border;
              e.currentTarget.style.boxShadow = 'none';
            }}>
              
              {/* NÚMERO EDITORIAL */}
              <span className="rank-number" style={{ 
                fontSize: index < 3 ? '3rem' : '1.8rem', 
                fontWeight: index < 3 ? 400 : 300, 
                width: '60px', color: getRankColor(index),
                opacity: index < 3 ? 1 : 0.5, 
                fontFamily: "'Crimson Pro', serif", fontStyle: 'italic',
                lineHeight: 1
              }}>
                {index + 1}
              </span>

              <div className="rank-cover" style={{ width: '65px', height: '95px', flexShrink: 0, marginRight: '20px', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 5px 15px rgba(0,0,0,0.2)' }}>
                <CoverImage
                  authorNote={book.author_note}
                  title={book.title}
                  theme={theme}
                  darkMode={darkMode}
                  titleSize="0.6rem"
                  thumb
                />
              </div>

              <div className="rank-info" style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 5px 0', fontSize: '1.25rem', fontWeight: 600, color: theme.textMain, fontFamily: "'Crimson Pro', serif" }}>{book.title}</h3>
                <p style={{ margin: 0, fontSize: '0.9rem', color: theme.accent, fontWeight: 400, fontStyle: 'italic' }}>por {book.author}</p>
              </div>

              {/* Estadísticas minimalistas */}
              <div className="rank-stats" style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '1.3rem', fontWeight: 600, color: theme.textMain }}>
                      {book.avg_rating ? book.avg_rating.toFixed(1) : "0.0"}
                    </span>
                    <span style={{ color: theme.star, fontSize: '1.1rem' }}>✦</span>
                  </div>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.65rem', letterSpacing: '1px', textTransform: 'uppercase', color: theme.textMuted, fontWeight: 600 }}>
                    {book.vote_count || 0} Votos
                  </p>
                </div>

                <div style={{ textAlign: 'center', minWidth: '70px', borderLeft: `1px solid ${theme.border}`, paddingLeft: '25px' }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: 400, color: theme.textMuted }}>
                    {book.views || 0}
                  </span>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.65rem', letterSpacing: '1px', textTransform: 'uppercase', color: theme.textMuted, fontWeight: 600 }}>Vistas</p>
                </div>
              </div>
            </div>
          </Link>
        ))}

        {/* #8 — Centinela de scroll infinito */}
        {hasMore && topBooks.length > 0 && (
          <div ref={sentinelRef} style={{ height: '50px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            {loadingMore && (
              <span style={{ color: theme.accent, fontSize: '1.5rem', animation: 'pulse 1.5s infinite' }}>✦</span>
            )}
          </div>
        )}

        {!hasMore && topBooks.length > 0 && (
          <p style={{ textAlign: 'center', marginTop: '30px', color: theme.textMuted, fontSize: '0.85rem', fontStyle: 'italic' }}>
            Fin del ranking.
          </p>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }

        /* Responsividad — solo disposición, sin tocar fuentes ni colores */
        @media (max-width: 640px) {
          .rank-container { padding: 30px 14px; }
          /* Cada fila: número + portada + título arriba, stats abajo */
          .rank-row {
            flex-wrap: wrap;
            padding: 16px !important;
            gap: 12px;
          }
          .rank-number {
            width: 36px !important;
            font-size: 1.6rem !important;
          }
          .rank-cover {
            width: 50px !important;
            height: 72px !important;
            margin-right: 12px !important;
          }
          .rank-info {
            flex: 1;
            min-width: 0;   /* permite que el título se recorte si es largo */
          }
          /* Las estadísticas pasan abajo, ocupando el ancho completo */
          .rank-stats {
            width: 100%;
            justify-content: space-around !important;
            gap: 0 !important;
            padding-top: 12px;
            border-top: 1px solid ${theme.border};
          }
        }
      `}</style>
    </div>
  );
};

export default Rankings;