import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../App';

const AdvancedSearch = ({ darkMode }) => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  // #8 — Estado de scroll infinito
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef(null);      // elemento "centinela" al final de la lista
  const PER_PAGE = 20;
  
  // Estado inicial para poder resetear fácilmente
  const initialState = {
    q: '',
    tags: [],
    minRating: 0,
    sort: 'newest'
  };

  const [filters, setFilters] = useState(initialState);

  // Tags agrupados por categoría — permite mostrarlos en un acordeón
  // en vez de una lista plana interminable.
  const tagGroups = [
    {
      name: 'Géneros principales',
      tags: ["Fantasía", "Romance", "Terror", "Misterio", "Ciencia Ficción", "Aventura", "Drama", "Acción", "Comedia", "Thriller"],
    },
    {
      name: 'Subgéneros',
      tags: ["Isekai", "LitRPG", "Magia", "Mazmorra", "Reencarnación", "Regresión", "Sistema", "Cultivación", "Wuxia", "Xianxia"],
    },
    {
      name: 'Romance y Slice of Life',
      tags: ["Slice of Life", "Romance Moderno", "BL", "GL", "Harem", "Amor Prohibido"],
    },
    {
      name: 'Ambientación',
      tags: ["Mundo Apocalíptico", "Distopía", "Steampunk", "Cyberpunk", "Fantasía Oscura", "Alta Fantasía", "Fantasía Urbana", "Histórico", "Medieval"],
    },
    {
      name: 'Protagonista y Tono',
      tags: ["Protagonista Femenina", "Protagonista Masculino", "Anti-héroe", "Slow Burn", "Dark", "Fluffy", "Mature"],
    },
  ];

  // Qué categorías están desplegadas. Por defecto solo la primera,
  // así la sidebar no arranca ocupando toda la pantalla.
  const [expandedGroups, setExpandedGroups] = useState({ 'Géneros principales': true });
  const toggleGroup = (name) => setExpandedGroups(prev => ({ ...prev, [name]: !prev[name] }));

  // Buscador rápido dentro de las etiquetas
  const [tagSearch, setTagSearch] = useState('');

  const theme = {
    bg: darkMode ? '#0a0b10' : '#f4f0ea', 
    card: darkMode ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.5)',
    accent: darkMode ? '#d4af37' : '#b85b3f',
    textMain: darkMode ? '#e3e1db' : '#2b2824',
    textMuted: darkMode ? '#8a8782' : '#857f77',
    border: darkMode ? 'rgba(212, 175, 55, 0.15)' : 'rgba(184, 91, 63, 0.15)',
    star: darkMode ? '#d4af37' : '#b85b3f'
  };

  // Función para resetear todo
  const handleReset = () => {
    setFilters(initialState);
    setTagSearch('');
  };

  // Comprobar si hay algún filtro activo para mostrar el botón de reset
  const hasActiveFilters = filters.q !== '' || filters.tags.length > 0 || filters.minRating > 0 || filters.sort !== 'newest';

  // Grupos a mostrar — si hay texto de búsqueda, filtra los tags dentro
  // de cada grupo y oculta los grupos sin coincidencias.
  const normalizedSearch = tagSearch.trim().toLowerCase();
  const visibleGroups = tagGroups
    .map(group => ({
      ...group,
      tags: normalizedSearch
        ? group.tags.filter(t => t.toLowerCase().includes(normalizedSearch))
        : group.tags,
    }))
    .filter(group => group.tags.length > 0);

  // Arma los query params comunes a partir de los filtros actuales
  const buildParams = (pageNum) => new URLSearchParams({
    q: filters.q,
    tags: filters.tags.join(','),
    min_rating: filters.minRating,
    sort: filters.sort,
    page: pageNum,
    per_page: PER_PAGE,
  });

  // #8 — Cuando cambian los filtros: resetear a página 1 y recargar desde cero.
  // Se mantiene el debounce de 400ms para no disparar en cada tecla.
  useEffect(() => {
    const delay = setTimeout(() => {
      fetchFirstPage();
    }, 400);
    return () => clearTimeout(delay);
  }, [filters]);

  // Primera página (reemplaza los resultados)
  const fetchFirstPage = async () => {
    setLoading(true);
    setPage(1);
    try {
      const res = await fetch(`${API_BASE}/api/search/advanced?${buildParams(1)}`);
      const data = await res.json();
      // El backend paginado devuelve { books, has_more }
      const books = data.books || [];
      setResults(books);
      setHasMore(data.has_more ?? false);
    } catch (error) {
      console.error("Error buscando:", error);
      setResults([]);
      setHasMore(false);
    }
    setLoading(false);
  };

  // Páginas siguientes (acumula al final)
  const fetchNextPage = useCallback(async () => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const res = await fetch(`${API_BASE}/api/search/advanced?${buildParams(nextPage)}`);
      const data = await res.json();
      const books = data.books || [];
      setResults(prev => [...prev, ...books]);
      setHasMore(data.has_more ?? false);
      setPage(nextPage);
    } catch (error) {
      console.error("Error cargando más:", error);
      setHasMore(false);
    }
    setLoadingMore(false);
  }, [page, hasMore, loadingMore, loading, filters]);

  // #8 — Observer: cuando el centinela entra en pantalla, carga más.
  // Mismo patrón que usás en BookReader para contar vistas.
  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) fetchNextPage();
    }, { rootMargin: '200px' }); // carga un poco antes de llegar al fondo
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [fetchNextPage, hasMore]);

  const toggleTag = (tag) => {
    setFilters(prev => ({
      ...prev,
      tags: prev.tags.includes(tag) 
        ? prev.tags.filter(t => t !== tag) 
        : [...prev.tags, tag]
    }));
  };

  return (
    <div style={{ display: 'flex', gap: '30px', padding: '120px 20px 40px 20px', color: theme.textMain, minHeight: '100vh', backgroundColor: theme.bg, fontFamily: "'Inter', sans-serif" }}>
      
      {/* SIDEBAR EDITORIAL */}
      <aside style={{ 
        width: '280px', 
        backgroundColor: theme.card, 
        padding: '30px', 
        borderRadius: '20px', 
        height: 'fit-content', 
        border: `1px solid ${theme.border}`, 
        position: 'sticky', 
        top: '120px',
        backdropFilter: 'blur(16px)', 
        WebkitBackdropFilter: 'blur(16px)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
          <h3 style={{ fontSize: '1.4rem', fontWeight: 600, fontFamily: "'Crimson Pro', serif", margin: 0 }}>Opciones</h3>
          
          {/* BOTÓN DE RESET INTEGRADO */}
          {hasActiveFilters && (
            <button 
              onClick={handleReset}
              style={{
                background: 'none',
                border: 'none',
                color: theme.accent,
                fontSize: '0.7rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '1px',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '4px',
                backgroundColor: `${theme.accent}15`,
                transition: '0.3s'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = `${theme.accent}30`}
              onMouseOut={(e) => e.target.style.backgroundColor = `${theme.accent}15`}
            >
              Limpiar Todo
            </button>
          )}
        </div>
        
        {/* FILTRO ESTRELLAS */}
        <label style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '1px', color: theme.textMuted, textTransform: 'uppercase' }}>Calificación Mínima</label>
        <div style={{ display: 'flex', gap: '8px', margin: '15px 0 30px 0', alignItems: 'center' }}>
          {[1, 2, 3, 4, 5].map(star => (
            <span 
              key={star} 
              onClick={() => setFilters({...filters, minRating: star === filters.minRating ? 0 : star})}
              style={{ 
                cursor: 'pointer', 
                fontSize: '1.5rem', 
                color: star <= filters.minRating ? theme.star : theme.border,
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              ✦
            </span>
          ))}
        </div>

        {/* ORDENAR */}
        <label style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '1px', color: theme.textMuted, textTransform: 'uppercase' }}>Ordenar Por</label>
        <div style={{ position: 'relative', margin: '15px 0 30px 0' }}>
          <select value={filters.sort} onChange={e => setFilters({...filters, sort: e.target.value})} 
            style={{ 
              width: '100%', padding: '12px 15px', borderRadius: '12px', 
              backgroundColor: darkMode ? '#11131a' : '#ffffff', 
              color: theme.textMain, border: `1px solid ${theme.border}`,
              appearance: 'none', outline: 'none', cursor: 'pointer'
            }}>
            <option value="newest">Más recientes</option>
            <option value="rating">Mejor calificados</option>
            <option value="views">Más leídos</option>
          </select>
          <span style={{ position: 'absolute', right: '15px', top: '12px', color: theme.accent, pointerEvents: 'none' }}>▼</span>
        </div>

        {/* ETIQUETAS */}
        <label style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '1px', color: theme.textMuted, textTransform: 'uppercase' }}>
          Etiquetas <span style={{ color: theme.accent, fontWeight: 400 }}>({filters.tags.length})</span>
        </label>

        {/* Buscador rápido — escribís y filtra los tags de todas las categorías */}
        <input
          type="text"
          placeholder="Buscar etiqueta..."
          value={tagSearch}
          onChange={e => setTagSearch(e.target.value)}
          style={{
            width: '100%', padding: '9px 12px', marginTop: '12px', marginBottom: '12px',
            borderRadius: '10px', border: `1px solid ${theme.border}`,
            backgroundColor: darkMode ? '#11131a' : '#ffffff',
            color: theme.textMain, fontSize: '0.8rem', outline: 'none',
          }}
        />

        {/* Chips de tags ya seleccionados — visibles aunque la categoría esté cerrada */}
        {filters.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '15px' }}>
            {filters.tags.map(t => (
              <span
                key={t}
                onClick={() => toggleTag(t)}
                title="Quitar"
                style={{
                  padding: '5px 10px', fontSize: '0.72rem', borderRadius: '20px',
                  backgroundColor: theme.accent, color: darkMode ? '#0a0b10' : '#ffffff',
                  cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px',
                }}
              >
                {t} <span style={{ opacity: 0.7 }}>✕</span>
              </span>
            ))}
          </div>
        )}

        {/* Acordeón de categorías */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {visibleGroups.map(group => {
            // Mientras hay búsqueda activa, todas las categorías con resultados se muestran abiertas
            const isOpen = normalizedSearch ? true : !!expandedGroups[group.name];
            return (
              <div key={group.name} style={{ border: `1px solid ${theme.border}`, borderRadius: '12px', overflow: 'hidden' }}>
                <button
                  onClick={() => toggleGroup(group.name)}
                  style={{
                    width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 12px', border: 'none', cursor: 'pointer',
                    backgroundColor: isOpen ? `${theme.accent}10` : 'transparent',
                    color: theme.textMain,
                  }}
                >
                  <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>{group.name}</span>
                  <span style={{
                    fontSize: '0.65rem', color: theme.textMuted,
                    transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s',
                  }}>▼</span>
                </button>

                {isOpen && (
                  <div style={{
                    padding: '12px', display: 'flex', flexWrap: 'wrap', gap: '6px',
                    borderTop: `1px solid ${theme.border}`,
                  }}>
                    {group.tags.map(t => {
                      const isSelected = filters.tags.includes(t);
                      return (
                        <button key={t} onClick={() => toggleTag(t)}
                          style={{
                            padding: '6px 12px', fontSize: '0.75rem', borderRadius: '20px',
                            border: `1px solid ${isSelected ? theme.accent : theme.border}`,
                            backgroundColor: isSelected ? theme.accent : 'transparent',
                            color: isSelected ? (darkMode ? '#0a0b10' : '#ffffff') : theme.textMain,
                            cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s ease',
                          }}>
                          {isSelected ? '✦ ' : ''}{t}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Sin resultados en la búsqueda de tags */}
          {normalizedSearch && visibleGroups.length === 0 && (
            <p style={{ fontSize: '0.78rem', color: theme.textMuted, fontStyle: 'italic', textAlign: 'center', padding: '10px 0' }}>
              No se encontró ninguna etiqueta.
            </p>
          )}
        </div>
      </aside>

      {/* RESULTADOS */}
      <main style={{ flex: 1 }}>
        <div style={{ position: 'relative', marginBottom: '40px' }}>
          <input 
            type="text" 
            placeholder="Buscar por título, autor o palabra clave..." 
            value={filters.q}
            onChange={e => setFilters({...filters, q: e.target.value})}
            style={{ 
              width: '100%', padding: '20px 30px', borderRadius: '20px', 
              border: `1px solid ${theme.border}`, fontSize: '1.2rem', 
              backgroundColor: theme.card, color: theme.textMain, 
              boxShadow: `0 10px 30px rgba(0,0,0,${darkMode ? '0.3' : '0.05'})`,
              backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              outline: 'none', fontFamily: "'Crimson Pro', serif"
            }}
          />
          {loading && <span style={{ position: 'absolute', right: '30px', top: '22px', color: theme.accent, fontSize: '1.2rem', animation: 'pulse 1.5s infinite' }}>✦</span>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '30px' }}>
          {results.map(book => (
            <Link to={`/book/${book.id}`} key={book.id} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ 
                backgroundColor: theme.card, borderRadius: '16px', overflow: 'hidden', 
                border: `1px solid ${theme.border}`, transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)'
              }} className="search-card">
                <img src={book.author_note && book.author_note !== 'null' ? `${API_BASE}/static/covers/${book.author_note}` : "https://placehold.jp/24/333333/ffffff/220x330.png?text=No+Cover"} 
                     style={{ width: '100%', aspectRatio: '2/3', objectFit: 'cover', borderBottom: `1px solid ${theme.border}` }} 
                     alt={book.title} />
                <div style={{ padding: '20px 15px' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '1.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: "'Crimson Pro', serif", color: theme.textMain }}>{book.title}</h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ color: theme.star, fontWeight: 700, fontSize: '1.1rem' }}>{book.avg_rating?.toFixed(1) || '0.0'}</span>
                      <span style={{ color: theme.star, fontSize: '0.9rem' }}>✦</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                      <span style={{ fontSize: '0.75rem', color: theme.textMuted, fontWeight: 600 }}>{book.views || 0} VISTAS</span>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
        
        {!loading && results.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: '100px', color: theme.textMuted }}>
            <p style={{ fontSize: '3rem', color: theme.accent, opacity: 0.5, margin: '0 0 15px 0' }}>✧</p>
            <h3 style={{ fontFamily: "'Crimson Pro', serif", fontSize: '1.5rem', fontWeight: 400, color: theme.textMain, margin: '0 0 10px 0' }}>El estante está vacío</h3>
          </div>
        )}

        {/* #8 — Centinela invisible: cuando entra en pantalla, se cargan más libros */}
        {hasMore && results.length > 0 && (
          <div ref={sentinelRef} style={{ height: '60px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '30px' }}>
            {loadingMore && (
              <span style={{ color: theme.accent, fontSize: '1.5rem', animation: 'pulse 1.5s infinite' }}>✦</span>
            )}
          </div>
        )}

        {/* Mensaje de fin cuando ya no quedan más resultados */}
        {!hasMore && results.length > 0 && (
          <p style={{ textAlign: 'center', marginTop: '40px', color: theme.textMuted, fontSize: '0.85rem', fontStyle: 'italic' }}>
            Has llegado al final del catálogo.
          </p>
        )}
      </main>

      <style>{`
        .search-card:hover { transform: translateY(-8px); border-color: ${theme.accent} !important; }
        @keyframes pulse { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }
      `}</style>
    </div>
  );
};

export default AdvancedSearch;