import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
} from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import { HelmetProvider, Helmet } from "react-helmet-async";
import { jwtDecode } from "jwt-decode";

// Componentes y Páginas
import BookReader from "./pages/BookReader";
import PublishBook from "./pages/PublishBook";
import AuthorDashboard from "./pages/AuthorDashboard";
import AddChapter from "./pages/AddChapter";
import BookDetail from "./pages/BookDetail";
import Rankings from "./pages/Rankings";
import AuthorBookDetails from "./pages/AuthorBookDetails";
import EditChapter from "./pages/EditChapter";
import MyLibrary from "./pages/MyLibrary";
import AdvancedSearch from "./pages/AdvancedSearch";

// ─────────────────────────────────────────────
// CAMBIO 1: URL base centralizada.
// En producción cambiá solo este valor (o usá una variable de entorno).
// ─────────────────────────────────────────────
// #12 — La URL de la API viene de la variable de entorno VITE_API_URL
// (definida en el archivo .env). Si no existe, usa localhost por defecto.
// En Vite, las variables deben empezar con "VITE_" para ser accesibles.
export const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:5001";

// ─────────────────────────────────────────────
// CAMBIO 2: Helper para construir el header de autenticación.
// Cualquier componente que importe authHeader(user) tiene todo listo.
// Uso: fetch(url, { headers: authHeader(user) })
// ─────────────────────────────────────────────
export const authHeader = (user) => ({
  "Content-Type": "application/json",
  ...(user?.session_token
    ? { Authorization: `Bearer ${user.session_token}` }
    : {}),
});

// --- COMPONENTE MODAL DE CONFIGURACIÓN --- (sin cambios)
const OnboardingModal = ({ user, onSave, darkMode, theme }) => {
  const [nickname, setNickname] = useState(user.name || "");
  const [selectedPhoto, setSelectedPhoto] = useState(user.picture);

  const localAvatars = [
    "1.png", "2.png", "3.png", "4.png",
    "5.png", "6.png", "7.png", "8.png",
  ];

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        alert("La imagen es muy pesada. Intenta con una de menos de 1MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setSelectedPhoto(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const modalStyle = {
    position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
    backgroundColor: "rgba(0,0,0,0.75)", display: "flex",
    justifyContent: "center", alignItems: "center",
    zIndex: 3000, backdropFilter: "blur(12px)",
  };

  const cardStyle = {
    backgroundColor: theme.bg, color: theme.textMain, padding: "40px",
    borderRadius: "28px", width: "90%", maxWidth: "420px", textAlign: "center",
    boxShadow: theme.shadow, border: `1px solid ${theme.border}`,
    maxHeight: "90vh", overflowY: "auto",
  };

  return (
    <div style={modalStyle}>
      <div style={cardStyle}>
        <h2 style={{ marginBottom: "8px", fontSize: "1.8rem", color: theme.accent }}>
          ¡Personaliza tu perfil!
        </h2>
        <p style={{ fontSize: "0.9rem", color: theme.textMuted, marginBottom: "25px" }}>
          ¿Cómo quieres que te vean los demás autores y lectores?
        </p>

        <div style={{ marginBottom: "25px", display: "flex", justifyContent: "center" }}>
          <img
            src={
              selectedPhoto?.startsWith("http") || selectedPhoto?.startsWith("data:image")
                ? selectedPhoto
                : `${API_BASE}/static/avatars_uploaded/${selectedPhoto}`
            }
            alt="Preview"
            referrerPolicy="no-referrer"
            style={{
              width: "100px", height: "100px", borderRadius: "50%",
              objectFit: "cover", border: `3px solid ${theme.accent}`,
              padding: "4px", backgroundColor: theme.card,
            }}
          />
        </div>

        <div style={{ textAlign: "left", marginBottom: "20px" }}>
          <label style={{
            fontSize: "0.7rem", fontWeight: 800, color: theme.accent,
            letterSpacing: "1px", display: "block", marginBottom: "8px",
          }}>
            TU NICKNAME
          </label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            style={{
              width: "100%", padding: "14px", borderRadius: "12px",
              border: `1px solid ${theme.border}`,
              backgroundColor: darkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)",
              color: theme.textMain, fontSize: "1rem", outline: "none", boxSizing: "border-box",
            }}
          />
        </div>

        <label style={{
          fontSize: "0.7rem", fontWeight: 800, color: theme.accent,
          letterSpacing: "1px", display: "block", marginBottom: "12px", textAlign: "left",
        }}>
          PUEDES ELEGIR UN AVATAR COMO IMAGEN
        </label>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px",
          marginBottom: "25px", padding: "12px",
          backgroundColor: darkMode ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.05)",
          borderRadius: "15px",
        }}>
          {localAvatars.map((file, i) => {
            const url = `${API_BASE}/static/avatars/${file}`;
            return (
              <img
                key={i}
                src={url}
                alt="avatar"
                onClick={() => setSelectedPhoto(url)}
                style={{
                  width: "100%", aspectRatio: "1/1", borderRadius: "10px",
                  cursor: "pointer",
                  border: selectedPhoto === url ? `3px solid ${theme.accent}` : "2px solid transparent",
                  transform: selectedPhoto === url ? "scale(1.1)" : "scale(1)",
                  transition: "all 0.2s ease",
                  backgroundColor: theme.card, objectFit: "cover",
                }}
              />
            );
          })}
        </div>

        <div style={{ textAlign: "left", marginBottom: "25px" }}>
          <label style={{
            fontSize: "0.7rem", fontWeight: 800, color: theme.textMuted,
            display: "block", marginBottom: "5px",
          }}>
            O SUBE TU PROPIA FOTO
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            style={{ fontSize: "0.8rem", color: theme.textMuted, width: "100%" }}
          />
        </div>

        <button
          onClick={() => onSave(nickname, selectedPhoto)}
          style={{
            backgroundColor: theme.accent, color: darkMode ? "#000" : "#fff",
            border: "none", padding: "16px", borderRadius: "14px", cursor: "pointer",
            fontWeight: 800, width: "100%", fontSize: "1rem",
            boxShadow: `0 4px 15px ${theme.accent}44`,
          }}
        >
          Guardar y Entrar
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// CAMBIO 3: AuthButton ahora hace dos cosas:
//   a) jwtDecode  → extrae nombre y foto para mostrar en la UI
//   b) fetch /api/auth/verify → obtiene el session_token real del servidor
//
// El objeto que llega a onSuccess ya tiene session_token incluido.
// El credential de Google NUNCA se guarda en localStorage.
// ─────────────────────────────────────────────
const AuthButton = ({ onSuccess, darkMode }) => {
  const handleGoogleSuccess = async (credentialResponse) => {
    const { credential } = credentialResponse;

    // a) Decodificar localmente solo para datos de display (nombre, foto).
    //    Esto es seguro: solo leemos campos públicos del JWT.
    const decoded = jwtDecode(credential);

    // b) Intercambiar el credential con nuestro servidor para obtener
    //    un session_token propio (el que usaremos en todos los requests).
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Verificación fallida");
      }

      const { session_token } = await res.json();

      // El objeto de usuario que circula por toda la app
      onSuccess({
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture,
        session_token, // ← token real, seguro, con expiración
      });
    } catch (err) {
      console.error("[Auth] Error verificando sesión con el servidor:", err.message);
      alert("No se pudo verificar tu sesión. Intenta de nuevo.");
    }
  };

  return (
    <div style={{ overflow: "hidden", borderRadius: "50px" }}>
      <GoogleLogin
        onSuccess={handleGoogleSuccess}
        onError={() => console.error("El inicio de sesión con Google falló")}
        useOneTap
        theme={darkMode ? "filled_black" : "outline"}
        shape="pill"
        text="continue_with"
      />
    </div>
  );
};

const ForceScrollToTop = () => {
  const { pathname } = useLocation();
  useLayoutEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
};

function App() {
  const location = useLocation();
  const isReaderRoute = location.pathname.startsWith("/reader");

  const [darkMode, setDarkMode] = useState(true);
  const [featuredBooks, setFeaturedBooks] = useState([]);
  const [recentlyUpdated, setRecentlyUpdated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false); // menú hamburguesa en pantallas chicas

  // ─────────────────────────────────────────────
  // CAMBIO 4: Al leer el usuario de localStorage, verificar que tenga
  // session_token. Si es una sesión del formato viejo (sin token),
  // se descarta y se fuerza nuevo login.
  // ─────────────────────────────────────────────
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem("userSession");
      if (!savedUser) return null;
      const parsed = JSON.parse(savedUser);
      if (!parsed.session_token) {
        // Sesión vieja sin token — limpiar y pedir login de nuevo
        localStorage.removeItem("userSession");
        return null;
      }
      return parsed;
    } catch {
      localStorage.removeItem("userSession");
      return null;
    }
  });

  const theme = {
    bg: darkMode ? "#0a0b10" : "#f4f0ea",
    card: darkMode ? "rgba(255, 255, 255, 0.02)" : "rgba(255, 255, 255, 0.5)",
    accent: darkMode ? "#d4af37" : "#b85b3f",
    textMain: darkMode ? "#e3e1db" : "#2b2824",
    textMuted: darkMode ? "#8a8782" : "#857f77",
    border: darkMode ? "rgba(212, 175, 55, 0.15)" : "rgba(184, 91, 63, 0.15)",
    navBg: darkMode ? "rgba(10, 11, 16, 0.7)" : "rgba(244, 240, 234, 0.7)",
    shadow: darkMode
      ? "0 15px 35px rgba(0,0,0,0.5)"
      : "0 15px 35px rgba(133,127,119,0.15)",
  };

  useEffect(() => {
    document.body.style.backgroundColor = theme.bg;
  }, [theme.bg]);

  // Cerrar el menú móvil cada vez que cambia la ruta
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const refreshBooks = useCallback(() => {
    setLoading(true);
    // La home solo muestra Destacados y Recientes.
    // Ya no traemos /api/books (todos los libros) porque no se renderiza
    // en ningún lado — era una carga innecesaria que crecería con el catálogo.
    Promise.all([
      fetch(`${API_BASE}/api/books/featured-random`).then((r) => r.json()).catch(() => []),
      fetch(`${API_BASE}/api/books/recently-updated`).then((r) => r.json()).catch(() => []),
    ]).then(([feat, recent]) => {
      setFeaturedBooks(feat);
      setRecentlyUpdated(recent);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    refreshBooks();
  }, [refreshBooks]);

  // ─────────────────────────────────────────────
  // CAMBIO 5: handleLoginSuccess ahora recibe un usuario que ya trae
  // session_token (lo armó AuthButton tras verificar con el servidor).
  // Lo guardamos en localStorage de inmediato.
  // ─────────────────────────────────────────────
  const handleLoginSuccess = (userData) => {
    setUser(userData);
    localStorage.setItem("userSession", JSON.stringify(userData));
    setShowOnboarding(true);
  };

  // ─────────────────────────────────────────────
  // CAMBIO 6: handleSaveProfile envía el Authorization header.
  // Guarda en el estado la URL real devuelta por el servidor
  // (no el base64 crudo que podría saturar localStorage).
  // ─────────────────────────────────────────────
  const handleSaveProfile = async (newNick, newPhoto) => {
    try {
      const res = await fetch(`${API_BASE}/api/update-profile`, {
        method: "POST",
        headers: authHeader(user),
        body: JSON.stringify({
          email: user.email,
          nickname: newNick,
          picture: newPhoto,
        }),
      });

      if (!res.ok) throw new Error("Error al guardar perfil");

      const data = await res.json();

      // Usar la URL del servidor en lugar del base64 local
      const updatedUser = {
        ...user,
        name: newNick,
        picture: data.picture || newPhoto,
      };
      setUser(updatedUser);
      localStorage.setItem("userSession", JSON.stringify(updatedUser));
      setShowOnboarding(false);
    } catch (error) {
      console.error("[Profile] Error:", error);
      setShowOnboarding(false);
    }
  };

  // ─────────────────────────────────────────────
  // CAMBIO 7: handleLogout invalida el token en el servidor primero.
  // Si el servidor falla (red caída, etc.) igual limpia el estado local
  // para que el usuario pueda salir de todas formas.
  // ─────────────────────────────────────────────
  const handleLogout = async () => {
    if (user?.session_token) {
      try {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${user.session_token}` },
        });
      } catch (err) {
        // Si el servidor no responde, igual cerramos sesión localmente
        console.warn("[Auth] No se pudo invalidar la sesión en el servidor:", err);
      }
    }
    setUser(null);
    localStorage.removeItem("userSession");
  };

  const defaultCoverStyle = {
    width: "100%", aspectRatio: "2/3", borderRadius: "8px",
    backgroundColor: darkMode ? "#252a33" : "#efeae4",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: darkMode ? "#4a5568" : "#b2a89f", fontSize: "0.9rem",
  };

  return (
    <HelmetProvider>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || "750793668642-7apu45i7te8b8gibnrelnhjgqj7vg512.apps.googleusercontent.com"}>
      {/* SEO por defecto — se aplica a cualquier página que no defina el suyo.
          Las páginas de contenido (BookDetail, BookReader) lo sobrescriben. */}
      <Helmet>
        <html lang="es" />
        <title>Librería Amateur — Novelas por capítulos</title>
        <meta name="description" content="Comunidad literaria donde todo autor tiene visibilidad. Leé y publicá novelas por capítulos." />
        <meta property="og:title" content="Librería Amateur" />
        <meta property="og:description" content="Comunidad literaria donde todo autor tiene visibilidad." />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>

      <ForceScrollToTop />

      {showOnboarding && user && (
        <OnboardingModal
          user={user}
          onSave={handleSaveProfile}
          darkMode={darkMode}
          theme={theme}
        />
      )}

      <div style={{
        backgroundColor: theme.bg, color: theme.textMain,
        minHeight: "100vh", width: "100%", transition: "all 0.4s ease",
        fontFamily: "'Inter', sans-serif",
      }}>
        {!isReaderRoute && (
          <div style={{ position: "sticky", top: "20px", zIndex: 1000, padding: "0 20px" }}>
            <nav className="main-nav" style={{
              maxWidth: "1000px", margin: "0 auto",
              backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
              backgroundColor: theme.navBg, border: `1px solid ${theme.border}`,
              padding: "12px 25px", borderRadius: "50px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              boxShadow: theme.shadow,
            }}>
              <div style={{ display: "flex", gap: "30px", alignItems: "center" }}>
                <Link to="/" style={{
                  color: theme.textMain, textDecoration: "none", fontWeight: 800,
                  fontSize: "1.2rem", display: "flex", alignItems: "center",
                  gap: "8px", fontFamily: "'Crimson Pro', serif",
                }}>
                  <span style={{ color: theme.accent }}>✦</span> Libreria Amateur
                </Link>
                {/* Links de navegación — se ocultan en móvil (pasan al menú hamburguesa) */}
                <div className="nav-links-desktop" style={{ display: "flex", gap: "20px" }}>
                  <Link to="/rankings" style={{ color: theme.textMain, textDecoration: "none", fontSize: "0.85rem", fontWeight: 600, opacity: 0.7 }}>
                    Rankings
                  </Link>
                  <Link to="/search" style={{ color: theme.textMain, textDecoration: "none", fontSize: "0.85rem", fontWeight: 600, opacity: 0.7 }}>
                    Explorar
                  </Link>
                  {user && (
                    <>
                      <Link to="/library" style={{ color: theme.textMain, textDecoration: "none", fontSize: "0.85rem", fontWeight: 600, opacity: 0.7 }}>
                        Mi Biblioteca
                      </Link>
                      <Link to="/dashboard" style={{ color: theme.textMain, textDecoration: "none", fontSize: "0.85rem", fontWeight: 600, opacity: 0.7 }}>
                        Mi Studio
                      </Link>
                    </>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
                {/* Zona derecha — login/perfil, se oculta en móvil (pasa al menú) */}
                <div className="nav-right-desktop" style={{ display: "flex", gap: "15px", alignItems: "center" }}>
                  {!user ? (
                    <AuthButton onSuccess={handleLoginSuccess} darkMode={darkMode} />
                  ) : (
                    <div style={{
                      display: "flex", alignItems: "center", gap: "12px",
                      borderRight: `1px solid ${theme.border}`, paddingRight: "15px",
                    }}>
                      <img
                        src={
                          user.picture?.startsWith("http") || user.picture?.startsWith("data:image")
                            ? user.picture
                            : `${API_BASE}/static/avatars_uploaded/${user.picture}`
                        }
                        alt="profile"
                        referrerPolicy="no-referrer"
                        onClick={() => setShowOnboarding(true)}
                        style={{
                          width: "32px", height: "32px", borderRadius: "50%",
                          objectFit: "cover", cursor: "pointer",
                          transition: "transform 0.2s ease", display: "block",
                          border: `2px solid ${theme.accent}50`,
                        }}
                        onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.1)")}
                        onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
                      />
                      <button
                        onClick={handleLogout}
                        style={{
                          background: "none", border: "none", color: theme.textMuted,
                          cursor: "pointer", fontSize: "0.75rem", fontWeight: 600,
                        }}
                      >
                        Salir
                      </button>
                    </div>
                  )}
                </div>

                {/* Toggle de tema — siempre visible */}
                <button
                  className="mode-toggle"
                  onClick={() => setDarkMode(!darkMode)}
                  style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer" }}
                >
                  {darkMode ? "☀️" : "🌙"}
                </button>

                {/* Botón hamburguesa — solo visible en móvil */}
                <button
                  className="nav-hamburger"
                  onClick={() => setMobileMenuOpen(o => !o)}
                  aria-label="Abrir menú"
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    display: "none", flexDirection: "column", gap: "5px",
                    padding: "4px", width: "34px", height: "34px",
                    justifyContent: "center", alignItems: "center",
                  }}
                >
                  <span style={{ width: "22px", height: "2px", backgroundColor: theme.textMain, borderRadius: "2px", transition: "0.3s", transform: mobileMenuOpen ? "rotate(45deg) translate(5px, 5px)" : "none" }} />
                  <span style={{ width: "22px", height: "2px", backgroundColor: theme.textMain, borderRadius: "2px", transition: "0.3s", opacity: mobileMenuOpen ? 0 : 1 }} />
                  <span style={{ width: "22px", height: "2px", backgroundColor: theme.textMain, borderRadius: "2px", transition: "0.3s", transform: mobileMenuOpen ? "rotate(-45deg) translate(5px, -5px)" : "none" }} />
                </button>
              </div>
            </nav>

            {/* PANEL DESPLEGABLE MÓVIL — aparece bajo la barra al tocar la hamburguesa */}
            {mobileMenuOpen && (
              <div className="nav-mobile-panel" style={{
                maxWidth: "1000px", margin: "12px auto 0",
                backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
                backgroundColor: theme.navBg, border: `1px solid ${theme.border}`,
                borderRadius: "24px", padding: "20px 25px",
                boxShadow: theme.shadow,
                display: "flex", flexDirection: "column", gap: "18px",
              }}>
                <Link to="/rankings" style={{ color: theme.textMain, textDecoration: "none", fontSize: "1rem", fontWeight: 600 }}>
                  Rankings
                </Link>
                <Link to="/search" style={{ color: theme.textMain, textDecoration: "none", fontSize: "1rem", fontWeight: 600 }}>
                  Explorar
                </Link>
                {user && (
                  <>
                    <Link to="/library" style={{ color: theme.textMain, textDecoration: "none", fontSize: "1rem", fontWeight: 600 }}>
                      Mi Biblioteca
                    </Link>
                    <Link to="/dashboard" style={{ color: theme.textMain, textDecoration: "none", fontSize: "1rem", fontWeight: 600 }}>
                      Mi Studio
                    </Link>
                  </>
                )}

                <div style={{ height: "1px", backgroundColor: theme.border, margin: "2px 0" }} />

                {/* Login / perfil dentro del menú móvil */}
                {!user ? (
                  <AuthButton onSuccess={handleLoginSuccess} darkMode={darkMode} />
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <img
                      src={
                        user.picture?.startsWith("http") || user.picture?.startsWith("data:image")
                          ? user.picture
                          : `${API_BASE}/static/avatars_uploaded/${user.picture}`
                      }
                      alt="profile"
                      referrerPolicy="no-referrer"
                      onClick={() => setShowOnboarding(true)}
                      style={{
                        width: "38px", height: "38px", borderRadius: "50%",
                        objectFit: "cover", cursor: "pointer", display: "block",
                        border: `2px solid ${theme.accent}50`,
                      }}
                    />
                    <span style={{ flex: 1, color: theme.textMain, fontSize: "0.9rem", fontWeight: 600 }}>
                      {user.name}
                    </span>
                    <button
                      onClick={handleLogout}
                      style={{
                        background: "none", border: `1px solid ${theme.border}`,
                        borderRadius: "50px", color: theme.textMuted,
                        cursor: "pointer", fontSize: "0.8rem", fontWeight: 600,
                        padding: "8px 18px",
                      }}
                    >
                      Salir
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div style={{
          maxWidth: isReaderRoute ? "100%" : "1100px",
          margin: "0 auto",
          padding: isReaderRoute ? "0" : "0 20px",
        }}>
          <Routes>
            <Route
              path="/"
              element={
                <main style={{ paddingTop: "80px" }}>
                  <header style={{
                    marginBottom: "100px", textAlign: "center",
                    display: "flex", flexDirection: "column", alignItems: "center",
                  }}>
                    <p style={{
                      color: theme.accent, fontSize: "0.75rem", fontWeight: 600,
                      letterSpacing: "0.4em", textTransform: "uppercase", marginBottom: "24px",
                    }}>
                      Comunidad Literaria
                    </p>
                    <h1 style={{ fontSize: "clamp(2.2rem, 6vw, 4.2rem)", fontWeight: 300, color: theme.textMain, lineHeight: 1.2 }}>
                      El lugar donde{" "}
                      <span
                        className="hero-autor"
                        style={{
                          fontFamily: "'Marcellus', serif",
                          fontWeight: 400,
                          letterSpacing: "0.08em",
                          borderBottom: `2px solid ${theme.accent}66`,
                          paddingBottom: "2px",
                        }}
                      >
                        TODO AUTOR
                      </span>{" "}
                      <span className="hero-visibilidad">tiene visibilidad.</span>
                    </h1>
                  </header>

                  {/* DESTACADOS */}
                  <section style={{ marginBottom: "60px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                      <h2 style={{ fontSize: "1.1rem", fontWeight: 800, textTransform: "uppercase" }}>
                        Destacados
                      </h2>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "20px" }}>
                      {featuredBooks.map((book) => (
                        <Link key={`feat-${book.id}`} to={`/book/${book.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                          <div className="book-card-featured" style={{
                            backgroundColor: theme.card, padding: "15px",
                            borderRadius: "12px", border: `1px solid ${theme.border}`,
                          }}>
                            {book.author_note && book.author_note !== "null" ? (
                              <img
                                src={`${API_BASE}/static/covers/${book.author_note}`}
                                alt={book.title}
                                style={{ width: "100%", aspectRatio: "2/3", borderRadius: "8px", objectFit: "cover" }}
                              />
                            ) : (
                              <div style={defaultCoverStyle}>SIN IMAGEN</div>
                            )}
                            <h3 style={{ margin: "15px 0 0 0", fontSize: "0.9rem", fontWeight: 700, textAlign: "center" }}>
                              {book.title}
                            </h3>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </section>

                  {/* ACTUALIZADOS RECIENTEMENTE */}
                  <section style={{ marginBottom: "60px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                      <h2 style={{ fontSize: "1.1rem", fontWeight: 800, textTransform: "uppercase" }}>
                        Actualizados Recientemente
                      </h2>
                      <div style={{ flex: 1, height: "1px", backgroundColor: theme.border }}></div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px" }}>
                      {recentlyUpdated.map((book) => (
                        <Link key={`recent-${book.id}`} to={`/book/${book.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                          <div className="recent-item" style={{
                            display: "flex", gap: "15px", padding: "15px", borderRadius: "16px",
                            alignItems: "center", backgroundColor: theme.card, border: `1px solid ${theme.border}`,
                          }}>
                            <div style={{ width: "60px", height: "80px", flexShrink: 0 }}>
                              {book.author_note && book.author_note !== "null" ? (
                                <img
                                  src={`${API_BASE}/static/covers/${book.author_note}`}
                                  alt={book.title}
                                  style={{ width: "100%", height: "100%", borderRadius: "6px", objectFit: "cover" }}
                                />
                              ) : (
                                <div style={{ ...defaultCoverStyle, fontSize: "0.5rem" }}>SIN FOTO</div>
                              )}
                            </div>
                            <div style={{ overflow: "hidden" }}>
                              <h3 style={{
                                fontSize: "0.95rem", fontWeight: 700, margin: "0 0 4px 0",
                                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                              }}>
                                {book.title}
                              </h3>
                              <p style={{ fontSize: "0.8rem", color: theme.textMuted, margin: 0 }}>
                                Por {book.author || "Autor Anónimo"}
                              </p>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" }}>
                                <span style={{
                                  fontSize: "0.7rem", color: theme.accent,
                                  backgroundColor: `${theme.accent}15`, padding: "2px 8px",
                                  borderRadius: "4px", fontWeight: 700,
                                }}>
                                  {book.category || "General"}
                                </span>
                                <span style={{ fontSize: "0.7rem", color: theme.textMuted }}>
                                  ⭐ {book.avg_rating ? book.avg_rating.toFixed(1) : "0.0"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </section>
                </main>
              }
            />

            <Route path="/rankings" element={<Rankings darkMode={darkMode} />} />
            <Route path="/library" element={<MyLibrary user={user} darkMode={darkMode} />} />
            <Route path="/book/:id" element={<BookDetail user={user} darkMode={darkMode} />} />
            <Route
              path="/reader/:id/:chapterIndex"
              element={<BookReader user={user} darkMode={darkMode} setDarkMode={setDarkMode} />}
            />
            <Route
              path="/publish"
              element={<PublishBook user={user} darkMode={darkMode} refreshBooks={refreshBooks} />}
            />
            <Route path="/dashboard" element={<AuthorDashboard user={user} darkMode={darkMode} />} />
            <Route path="/add-chapter/:id" element={<AddChapter user={user} darkMode={darkMode} />} />
            <Route path="/dashboard/book/:id" element={<AuthorBookDetails user={user} darkMode={darkMode} />} />
            <Route path="/edit-chapter/:chapterId" element={<EditChapter darkMode={darkMode} user={user} />} />
            <Route path="/search" element={<AdvancedSearch darkMode={darkMode} />} />
          </Routes>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;700&family=Inter:wght@300;400;600&family=Cormorant+Garamond:ital,wght@1,600&family=Marcellus&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { -webkit-font-smoothing: antialiased; }
        .book-card, .book-card-featured, .recent-item {
          transition: all 0.3s ease;
          background-color: ${theme.card};
          border: 1px solid ${theme.border};
        }
        .book-card:hover, .book-card-featured:hover {
          border-color: ${theme.accent} !important;
          transform: translateY(-5px);
        }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: ${theme.border}; border-radius: 10px; }

        /* ── Animación del hero: "TODO AUTOR" vira de blanco a dorado
              mientras "visibilidad" hace fade-in, ambas al mismo ritmo ── */
        @keyframes heroAutorColor {
          from { color: ${darkMode ? "#ffffff" : "#ffffff"}; }
          to   { color: ${theme.accent}; }
        }
        @keyframes heroFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .hero-autor {
          color: ${theme.accent};
          animation: heroAutorColor 2.5s ease-out both;
        }
        .hero-visibilidad {
          display: inline-block;
          animation: heroFadeIn 4s ease-out 0.8s both;
        }

        ///Bloquea animaciones si usuario las tiene bloqueadas en su configuracion de SO. 
        @media (prefers-reduced-motion: reduce) {
        .hero-autor { animation: none; }
        .hero-visibilidad { animation: none; }
        }

        /* ── Responsividad del menú superior ── */
        /* En desktop: barra completa, hamburguesa oculta.
           A 630px o menos: los links y la zona derecha se ocultan y
           aparece la hamburguesa que despliega el panel vertical. */
        @media (max-width: 630px) {
          .nav-links-desktop { display: none !important; }
          .nav-right-desktop { display: none !important; }
          .nav-hamburger { display: flex !important; }
          .main-nav { padding: 10px 18px !important; }
        }
      `}</style>
    </GoogleOAuthProvider>
    </HelmetProvider>
  );
}

export default App;