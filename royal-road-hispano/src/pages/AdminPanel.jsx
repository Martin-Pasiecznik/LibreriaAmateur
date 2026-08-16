import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE, authHeader } from '../App';

const AdminPanel = ({ user, darkMode }) => {
  const navigate = useNavigate();
  // Estados: 'checking' (verificando), 'allowed' (es admin), 'denied' (no lo es)
  const [access, setAccess] = useState('checking');

  const theme = {
    bg: darkMode ? '#0a0b10' : '#f4f0ea',
    card: darkMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.7)',
    accent: darkMode ? '#d4af37' : '#b85b3f',
    textMain: darkMode ? '#e3e1db' : '#2b2824',
    textMuted: darkMode ? '#8a8782' : '#857f77',
    border: darkMode ? 'rgba(212, 175, 55, 0.2)' : 'rgba(184, 91, 63, 0.2)',
  };

  // Al cargar: preguntar al BACKEND si el usuario es admin.
  // No confiamos en el frontend — el backend es el que decide.
  useEffect(() => {
    if (!user?.session_token) {
      setAccess('denied');
      return;
    }
    fetch(`${API_BASE}/api/admin/check`, { headers: authHeader(user) })
      .then(res => res.json())
      .then(data => setAccess(data.is_admin ? 'allowed' : 'denied'))
      .catch(() => setAccess('denied'));
  }, [user]);

  // Mientras verifica
  if (access === 'checking') {
    return (
      <div style={{ textAlign: 'center', padding: '150px 20px', color: theme.accent, fontFamily: "'Crimson Pro', serif", fontSize: '1.2rem' }}>
        Verificando permisos...
      </div>
    );
  }

  // Acceso denegado
  if (access === 'denied') {
    return (
      <div style={{ textAlign: 'center', padding: '150px 20px', color: theme.textMain, fontFamily: "'Inter', sans-serif" }}>
        <h2 style={{ fontFamily: "'Crimson Pro', serif", fontSize: '2rem', color: theme.accent }}>Acceso Denegado</h2>
        <p style={{ opacity: 0.7, marginTop: '10px' }}>No tenés permisos para ver esta página.</p>
        <button
          onClick={() => navigate('/')}
          style={{ marginTop: '30px', padding: '12px 30px', borderRadius: '50px', border: `1px solid ${theme.accent}`, background: 'transparent', color: theme.accent, cursor: 'pointer', fontWeight: 700 }}
        >
          Volver al inicio
        </button>
      </div>
    );
  }

  // Acceso permitido — panel (por ahora, solo bienvenida)
  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '100px 20px 60px 20px', color: theme.textMain, fontFamily: "'Inter', sans-serif" }}>
      <header style={{ marginBottom: '50px', borderBottom: `1px solid ${theme.border}`, paddingBottom: '25px' }}>
        <h1 style={{ fontFamily: "'Crimson Pro', serif", fontSize: '2.5rem', margin: 0, color: theme.accent }}>
          Panel de Administración
        </h1>
        <p style={{ color: theme.textMuted, marginTop: '8px' }}>
          Bienvenido, {user?.name}. Desde acá vas a poder moderar la plataforma.
        </p>
      </header>

      <div style={{ padding: '40px', background: theme.card, borderRadius: '20px', border: `1px solid ${theme.border}`, textAlign: 'center' }}>
        <span style={{ fontSize: '2.5rem', color: theme.accent }}>✦</span>
        <p style={{ marginTop: '15px', color: theme.textMuted, fontStyle: 'italic' }}>
          Panel en construcción. Pronto vas a tener herramientas de moderación acá.
        </p>
      </div>
    </div>
  );
};

export default AdminPanel;