from flask import Flask, jsonify, request, send_from_directory, g
from flask_cors import CORS
import sqlite3
import os
import datetime
import json
import secrets
import functools
import time
from werkzeug.utils import secure_filename
import base64
from PIL import Image
import io

# #12 — Cargar variables de entorno desde el archivo .env (si existe).
# Requiere: pip install python-dotenv
# En producción, las variables las provee el servidor y este load_dotenv
# simplemente no encuentra archivo y no hace nada (no falla).
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # Si no está instalado, se usan los defaults del código

# Verificación de tokens de Google
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

app = Flask(__name__)

# #4 — Rate limiting: limita cuántas peticiones puede hacer una IP.
# Requiere: pip install flask-limiter
# Si no está instalado, se define un limiter "falso" que no hace nada,
# para que la app siga funcionando igual (los decoradores no rompen).
try:
    from flask_limiter import Limiter
    from flask_limiter.util import get_remote_address

    limiter = Limiter(
        key_func=get_remote_address,   # identifica al cliente por su IP
        app=app,
        default_limits=["300 per hour"],  # techo general por IP
        storage_uri="memory://",          # en memoria (suficiente para empezar)
    )
    RATE_LIMITING_ON = True
except ImportError:
    RATE_LIMITING_ON = False
    print("[RateLimit] flask-limiter no instalado — sin límites. "
          "Instalá con: pip install flask-limiter")

    # Limiter "dummy": .limit() devuelve un decorador que no hace nada
    class _DummyLimiter:
        def limit(self, *args, **kwargs):
            def decorator(f):
                return f
            return decorator
    limiter = _DummyLimiter()

# CORS — Los orígenes permitidos vienen de la variable CORS_ORIGINS
# (separados por coma). En local usa los defaults; en producción se setea
# con tu dominio real, ej: CORS_ORIGINS=https://tulibreria.com
_default_origins = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000"
_cors_origins = os.environ.get('CORS_ORIGINS', _default_origins).split(',')
CORS(app, resources={
    r"/api/*": {
        "origins": [o.strip() for o in _cors_origins if o.strip()]
    }
})

# --- CONFIGURACIÓN ---
GOOGLE_CLIENT_ID = os.environ.get(
    'GOOGLE_CLIENT_ID',
    "750793668642-7apu45i7te8b8gibnrelnhjgqj7vg512.apps.googleusercontent.com"
)
# #7/#12 — URL pública del servidor. En local usa el default; en producción
# se setea la variable de entorno SERVER_URL con el dominio real.
SERVER_URL = os.environ.get('SERVER_URL', 'http://127.0.0.1:5001')

# Rutas ABSOLUTAS calculadas desde la ubicación de este archivo.
# Así funcionan sin importar desde qué carpeta se ejecute la app
# (en local Flask corre desde server/, pero en producción el WSGI
# usa otro directorio de trabajo — con rutas relativas fallaba).
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'static', 'covers')
AVATARS_UPLOAD_FOLDER = os.path.join(BASE_DIR, 'static', 'avatars_uploaded')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 2 * 1024 * 1024  # 2MB
# Crear las carpetas si no existen (en la ubicación correcta)
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(AVATARS_UPLOAD_FOLDER, exist_ok=True)

DB_PATH = os.path.join(BASE_DIR, "database.db")

# #3 — Límites de longitud de texto (en caracteres). Evitan que alguien
# sature la base con textos gigantes. Ajustables según necesites.
MAX_CHAPTER_CHARS = 100_000   # ~20.000 palabras, un capítulo muy largo
MAX_TITLE_CHARS   = 300
MAX_DESC_CHARS    = 5_000
MAX_COMMENT_CHARS = 3_000
MAX_TAGS_CHARS    = 500
MAX_NICKNAME_CHARS = 100


# =============================================================================
# BASE DE DATOS
# =============================================================================

def init_db_internal():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute('''CREATE TABLE IF NOT EXISTS users (
        email TEXT PRIMARY KEY,
        nickname TEXT,
        profile_pic TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP)''')

    cursor.execute('''CREATE TABLE IF NOT EXISTS books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        author_email TEXT,
        description TEXT,
        author_note TEXT,
        tags TEXT,
        views INTEGER DEFAULT 0,
        book_status TEXT DEFAULT 'ongoing')''')

    cursor.execute('''CREATE TABLE IF NOT EXISTS chapters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        book_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        word_count INTEGER DEFAULT 0,
        order_index INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (book_id) REFERENCES books (id))''')

    cursor.execute('''CREATE TABLE IF NOT EXISTS ratings (
        book_id INTEGER,
        user_email TEXT,
        score INTEGER CHECK(score >= 1 AND score <= 5),
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (book_id, user_email),
        FOREIGN KEY (book_id) REFERENCES books (id))''')

    cursor.execute('''CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        book_id INTEGER,
        chapter_id INTEGER,
        user_name TEXT,
        user_email TEXT,
        text TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)''')

    cursor.execute('''CREATE TABLE IF NOT EXISTS view_logs (
        book_id INTEGER,
        chapter_index INTEGER,
        ip_address TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (book_id, chapter_index, ip_address))''')

    cursor.execute('''CREATE TABLE IF NOT EXISTS user_library (
        user_email TEXT,
        book_id INTEGER,
        status TEXT,
        last_chapter_id INTEGER,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_email, book_id),
        FOREIGN KEY (book_id) REFERENCES books (id),
        FOREIGN KEY (last_chapter_id) REFERENCES chapters (id))''')

    # #9 — Capítulos leídos: una fila por lectura (ver init_db.py)
    cursor.execute('''CREATE TABLE IF NOT EXISTS chapter_reads (
        user_email TEXT,
        book_id INTEGER,
        chapter_id INTEGER,
        read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_email, chapter_id),
        FOREIGN KEY (book_id) REFERENCES books (id),
        FOREIGN KEY (chapter_id) REFERENCES chapters (id))''')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_reads_user_book ON chapter_reads(user_email, book_id)')

    cursor.execute('''CREATE TABLE IF NOT EXISTS featured_rotation (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        last_update DATETIME,
        book_ids TEXT)''')

    # NUEVA: Tabla de sesiones propias (token seguro con expiración)
    cursor.execute('''CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_email TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL)''')

    # Índices para rendimiento
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_sessions_email ON sessions(user_email)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_books_author ON books(author_email)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_chapters_book ON chapters(book_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_ratings_book ON ratings(book_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_comments_book ON comments(book_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_library_user ON user_library(user_email)')

    conn.commit()
    conn.close()


def get_db_connection():
    # timeout=10 → si la base está momentáneamente ocupada, espera hasta
    # 10s antes de fallar (en vez de tirar error al instante).
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    # Modo WAL: permite que lectores y escritores no se bloqueen entre sí.
    # Mejora mucho el manejo de usuarios simultáneos. Es persistente:
    # una vez seteado en la base, queda activo para siempre, pero no
    # cuesta nada re-afirmarlo en cada conexión.
    conn.execute('PRAGMA journal_mode=WAL')
    # synchronous=NORMAL: buen equilibrio entre velocidad y seguridad de datos
    # (recomendado junto con WAL).
    conn.execute('PRAGMA synchronous=NORMAL')
    return conn


# #3 — Helper de validación de longitud. Retorna un mensaje de error
# si el texto excede el máximo, o None si está bien.
def check_length(value, max_chars, field_name):
    if value and len(value) > max_chars:
        return f"El campo '{field_name}' supera el máximo de {max_chars} caracteres."
    return None


# #8 — Helper de paginación. Lee ?page= y ?per_page= de la request.
# Devuelve (limit, offset, page, per_page) con valores seguros.
# per_page tiene un tope para que nadie pida 100.000 de una.
PAGINATION_DEFAULT_PER_PAGE = 20
PAGINATION_MAX_PER_PAGE = 50

def get_pagination_params():
    try:
        page = max(1, int(request.args.get('page', 1)))
    except (ValueError, TypeError):
        page = 1
    try:
        per_page = int(request.args.get('per_page', PAGINATION_DEFAULT_PER_PAGE))
    except (ValueError, TypeError):
        per_page = PAGINATION_DEFAULT_PER_PAGE
    per_page = max(1, min(per_page, PAGINATION_MAX_PER_PAGE))
    offset = (page - 1) * per_page
    return per_page, offset, page, per_page


# =============================================================================
# SISTEMA DE AUTENTICACIÓN
# =============================================================================

def verify_google_token(credential: str):
    """
    Verifica un credential JWT de Google OAuth2.
    Retorna el email del usuario si es válido, None si no lo es.
    """
    try:
        info = id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            GOOGLE_CLIENT_ID
        )
        return info.get('email')
    except Exception as e:
        print(f"[Auth] Token de Google inválido: {e}")
        return None


def get_session_email(token: str):
    """
    Valida un session token propio contra la base de datos.
    Retorna el email asociado o None si la sesión no existe o expiró.
    """
    conn = get_db_connection()
    row = conn.execute(
        "SELECT user_email FROM sessions WHERE token = ? AND expires_at > datetime('now')",
        (token,)
    ).fetchone()
    conn.close()
    return row['user_email'] if row else None


def get_current_user_email():
    """
    Lee el header Authorization: Bearer <token> y retorna el email del usuario.
    Retorna None si no hay token o si es inválido/expirado.
    """
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return None
    token = auth_header[7:]
    return get_session_email(token)


def require_auth(f):
    """
    Decorador que protege un endpoint: rechaza con 401 si no hay
    sesión válida. El email verificado queda en g.current_user_email.
    """
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        email = get_current_user_email()
        if not email:
            return jsonify({"error": "No autorizado. Debes iniciar sesión."}), 401
        g.current_user_email = email
        return f(*args, **kwargs)
    return decorated


# Helpers de propiedad

def get_book_author_email(book_id: int):
    """Retorna el author_email del libro, o None si no existe."""
    conn = get_db_connection()
    row = conn.execute('SELECT author_email FROM books WHERE id = ?', (book_id,)).fetchone()
    conn.close()
    return row['author_email'] if row else None


# =============================================================================
# ENDPOINTS DE AUTENTICACIÓN
# =============================================================================

@app.route('/api/auth/verify', methods=['POST'])
@limiter.limit("10 per minute")  # #4 — login: máx 10 intentos/min por IP
def auth_verify():
    """
    Intercambia el credential de Google por un session token propio.
    El frontend llama este endpoint una vez al hacer login con Google,
    guarda el session_token recibido, y lo envía en futuros requests.
    """
    data = request.get_json()
    if not data or 'credential' not in data:
        return jsonify({"error": "credential requerido"}), 400

    email = verify_google_token(data['credential'])
    if not email:
        return jsonify({"error": "Token de Google inválido o expirado"}), 401

    # Generar session token seguro (64 chars hex = 256 bits de entropía)
    session_token = secrets.token_hex(32)
    # #6 — UTC para consistencia: SQLite usa datetime('now') que es UTC,
    # así que las expiraciones deben calcularse en UTC también.
    expires_at = datetime.datetime.utcnow() + datetime.timedelta(days=30)

    conn = get_db_connection()
    # Limpiar sesiones anteriores del mismo usuario para no acumular
    conn.execute('DELETE FROM sessions WHERE user_email = ?', (email,))
    conn.execute(
        'INSERT INTO sessions (token, user_email, expires_at) VALUES (?, ?, ?)',
        (session_token, email, expires_at.isoformat())
    )
    conn.commit()
    conn.close()

    return jsonify({
        "session_token": session_token,
        "email": email,
        "expires_at": expires_at.isoformat()
    }), 200


@app.route('/api/auth/logout', methods=['POST'])
@require_auth
def auth_logout():
    """Invalida el session token actual en la base de datos."""
    token = request.headers.get('Authorization', '')[7:]
    conn = get_db_connection()
    conn.execute('DELETE FROM sessions WHERE token = ?', (token,))
    conn.commit()
    conn.close()
    return jsonify({"status": "logged_out"}), 200


# =============================================================================
# LIBROS (PÚBLICO — lectura libre, escritura protegida)
# =============================================================================

@app.route('/api/books/recently-updated', methods=['GET'])
def get_recently_updated():
    # Cuántos libros mostrar en la home. Ajustable (ej. 50 si querés más).
    conn = get_db_connection()
    # Ordena por la fecha del ÚLTIMO capítulo publicado de cada libro.
    # Así, cuando un autor sube un capítulo nuevo, su obra sube al tope
    # sin importar cuándo se creó el libro (es "recientemente actualizado",
    # no "recientemente creado").
    # Los libros SIN capítulos quedan al final (last_chapter_date = NULL).
    books = conn.execute('''
        SELECT
            b.*,
            AVG(r.score) as avg_rating,
            COUNT(DISTINCT r.rowid) as vote_count,
            MAX(ch.created_at) as last_chapter_date
        FROM books b
        LEFT JOIN ratings r  ON b.id = r.book_id
        LEFT JOIN chapters ch ON b.id = ch.book_id
        GROUP BY b.id
        HAVING last_chapter_date IS NOT NULL
        ORDER BY last_chapter_date DESC
        LIMIT 20
    ''').fetchall()
    conn.close()
    return jsonify([dict(b) for b in books])


def get_featured_ids():
    conn = get_db_connection()
    now = datetime.datetime.utcnow()  # #6 — UTC consistente con SQLite
    row = conn.execute(
        'SELECT last_update, book_ids FROM featured_rotation WHERE id = 1'
    ).fetchone()

    should_update = False
    if not row:
        should_update = True
    else:
        try:
            last_update = datetime.datetime.strptime(row['last_update'], '%Y-%m-%d %H:%M:%S.%f')
            if (now - last_update).total_seconds() > 3600:  # 1 hora
                should_update = True
        except ValueError:
            should_update = True

    if should_update:
        random_books = conn.execute('SELECT id FROM books ORDER BY RANDOM() LIMIT 5').fetchall()
        new_ids = [r['id'] for r in random_books]
        if new_ids:
            conn.execute(
                'INSERT OR REPLACE INTO featured_rotation (id, last_update, book_ids) VALUES (1, ?, ?)',
                (now.strftime('%Y-%m-%d %H:%M:%S.%f'), json.dumps(new_ids))
            )
            conn.commit()
        conn.close()
        return new_ids

    conn.close()
    try:
        return json.loads(row['book_ids'])
    except Exception:
        return []


@app.route('/api/books/featured-random', methods=['GET'])
def get_featured_books():
    ids = get_featured_ids()
    if not ids:
        return jsonify([])
    conn = get_db_connection()
    placeholders = ', '.join(['?'] * len(ids))
    books = conn.execute(f'''
        SELECT b.*, AVG(r.score) as avg_rating, COUNT(r.score) as vote_count
        FROM books b
        LEFT JOIN ratings r ON b.id = r.book_id
        WHERE b.id IN ({placeholders})
        GROUP BY b.id
    ''', ids).fetchall()
    conn.close()
    return jsonify([dict(b) for b in books])


@app.route('/api/books', methods=['GET', 'POST'])
@limiter.limit("20 per minute")  # #4 — evita creación masiva de libros
def handle_books():
    if request.method == 'POST':
        # Crear libro — requiere sesión válida
        email = get_current_user_email()
        if not email:
            return jsonify({"error": "No autorizado"}), 401

        title = request.form.get('title')
        if not title:
            return jsonify({"error": "El título es obligatorio"}), 400

        # #3 — Validar longitudes antes de guardar
        description = request.form.get('description')
        tags = request.form.get('tags')
        for value, limit, name in [
            (title, MAX_TITLE_CHARS, 'título'),
            (description, MAX_DESC_CHARS, 'descripción'),
            (tags, MAX_TAGS_CHARS, 'etiquetas'),
        ]:
            err = check_length(value, limit, name)
            if err:
                return jsonify({"error": err}), 400

        filename = "default_cover.jpeg"
        file = request.files.get('cover')
        if file and file.filename != '':
            try:
                img = Image.open(file)
                if img.mode in ("RGBA", "P"):
                    img = img.convert("RGB")
                img.thumbnail((600, 900))
                filename = secure_filename(f"cover_{int(time.time())}.jpg")
                img.save(
                    os.path.join(app.config['UPLOAD_FOLDER'], filename),
                    "JPEG", quality=82, optimize=True
                )
            except Exception as e:
                print(f"[Cover] Error procesando imagen: {e}")
                filename = "default_cover.jpeg"

        conn = get_db_connection()
        conn.execute('''
            INSERT INTO books (title, author, author_email, description, author_note, tags)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            title,
            request.form.get('author'),
            email,  # Email verificado — nunca del form
            description,
            filename,
            tags
        ))
        conn.commit()
        conn.close()
        return jsonify({"status": "created"}), 201

    # GET — público
    conn = get_db_connection()

    # #8 — Paginación OPCIONAL y retrocompatible:
    # · Si NO viene ?page= → devuelve el array plano de siempre (nada se rompe).
    # · Si viene ?page= → devuelve { books, page, per_page, total, has_more }.
    if 'page' in request.args:
        limit, offset, page, per_page = get_pagination_params()

        total = conn.execute('SELECT COUNT(*) AS c FROM books').fetchone()['c']
        books = conn.execute('''
            SELECT b.*, AVG(r.score) as avg_rating, COUNT(r.score) as vote_count
            FROM books b
            LEFT JOIN ratings r ON b.id = r.book_id
            GROUP BY b.id
            ORDER BY b.id DESC
            LIMIT ? OFFSET ?
        ''', (limit, offset)).fetchall()
        conn.close()

        return jsonify({
            "books": [dict(b) for b in books],
            "page": page,
            "per_page": per_page,
            "total": total,
            "has_more": offset + len(books) < total,
        })

    # Sin ?page= → comportamiento original (array plano)
    books = conn.execute('''
        SELECT b.*, AVG(r.score) as avg_rating, COUNT(r.score) as vote_count
        FROM books b
        LEFT JOIN ratings r ON b.id = r.book_id
        GROUP BY b.id
        ORDER BY b.id DESC
    ''').fetchall()
    conn.close()
    return jsonify([dict(b) for b in books])


@app.route('/api/books/<int:book_id>', methods=['GET'])
def get_single_book(book_id):
    conn = get_db_connection()
    book = conn.execute('SELECT * FROM books WHERE id = ?', (book_id,)).fetchone()
    if not book:
        conn.close()
        return jsonify({"error": "Libro no encontrado"}), 404

    stats = conn.execute(
        'SELECT AVG(score) as avg, COUNT(*) as count FROM ratings WHERE book_id = ?',
        (book_id,)
    ).fetchone()

    distribution = conn.execute(
        'SELECT score, COUNT(*) as count FROM ratings WHERE book_id = ? GROUP BY score',
        (book_id,)
    ).fetchall()
    conn.close()

    dist_dict = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    for row in distribution:
        dist_dict[row['score']] = row['count']

    res = dict(book)
    res['avg_rating'] = stats['avg'] or 0
    res['vote_count'] = stats['count'] or 0
    res['rating_distribution'] = dist_dict
    return jsonify(res)

@app.route('/api/books/<int:book_id>', methods=['DELETE'])
@require_auth
def delete_book(book_id):
    """
    Elimina un libro completo con todo su contenido en cascada.
    Solo el autor del libro puede ejecutar esta acción.
    """
    # Verificar que el libro existe y que el solicitante es el autor
    book_author = get_book_author_email(book_id)
    if book_author is None:
        return jsonify({"error": "Libro no encontrado"}), 404
    if book_author != g.current_user_email:
        return jsonify({"error": "No tienes permiso para eliminar este libro"}), 403
 
    conn = get_db_connection()
    try:
        # Borrado en cascada manual (SQLite no tiene ON DELETE CASCADE por defecto)
        conn.execute('DELETE FROM comments      WHERE book_id = ?', (book_id,))
        conn.execute('DELETE FROM ratings       WHERE book_id = ?', (book_id,))
        conn.execute('DELETE FROM user_library  WHERE book_id = ?', (book_id,))
        conn.execute('DELETE FROM chapter_reads WHERE book_id = ?', (book_id,))  # #9
        conn.execute('DELETE FROM view_logs     WHERE book_id = ?', (book_id,))
        conn.execute('DELETE FROM chapters      WHERE book_id = ?', (book_id,))
        conn.execute('DELETE FROM books         WHERE id = ?',      (book_id,))
        conn.commit()
        return jsonify({"status": "deleted"}), 200
    except Exception as e:
        conn.rollback()
        print(f"[DeleteBook] Error: {e}")
        return jsonify({"error": "Error al eliminar el libro"}), 500
    finally:
        conn.close()


@app.route('/api/books/<int:book_id>/update', methods=['POST'])
@require_auth
def update_book_details(book_id):
    # Verificar que el solicitante es el autor del libro
    book_author = get_book_author_email(book_id)
    if book_author is None:
        return jsonify({"error": "Libro no encontrado"}), 404
    if book_author != g.current_user_email:
        return jsonify({"error": "No tienes permiso para modificar este libro"}), 403

    title = request.form.get('title')
    description = request.form.get('description')
    tags = request.form.get('tags')
    file = request.files.get('cover')

    # #3 — Validar longitudes
    for value, limit, name in [
        (title, MAX_TITLE_CHARS, 'título'),
        (description, MAX_DESC_CHARS, 'descripción'),
        (tags, MAX_TAGS_CHARS, 'etiquetas'),
    ]:
        err = check_length(value, limit, name)
        if err:
            return jsonify({"error": err}), 400

    conn = get_db_connection()
    if file and file.filename != '':
        try:
            img = Image.open(file)
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            img.thumbnail((600, 900))
            filename = secure_filename(f"cover_{book_id}_{int(time.time())}.jpg")
            img.save(
                os.path.join(app.config['UPLOAD_FOLDER'], filename),
                "JPEG", quality=82, optimize=True
            )
            conn.execute(
                'UPDATE books SET title = ?, description = ?, tags = ?, author_note = ? WHERE id = ?',
                (title, description, tags, filename, book_id)
            )
        except Exception as e:
            print(f"[Cover] Error procesando imagen: {e}")
            conn.execute(
                'UPDATE books SET title = ?, description = ?, tags = ? WHERE id = ?',
                (title, description, tags, book_id)
            )
    else:
        conn.execute(
            'UPDATE books SET title = ?, description = ?, tags = ? WHERE id = ?',
            (title, description, tags, book_id)
        )

    conn.commit()
    conn.close()
    return jsonify({"status": "book_updated"}), 200

VALID_BOOK_STATUSES = {'ongoing', 'completed', 'paused', 'abandoned'}
 
@app.route('/api/books/<int:book_id>/status', methods=['PATCH'])
@require_auth
def update_book_status(book_id):
    """
    Actualiza el estado de publicación de un libro.
    Solo el autor puede llamar este endpoint.
    Valores: 'ongoing' | 'completed' | 'paused' | 'abandoned'
    """
    book_author = get_book_author_email(book_id)
    if book_author is None:
        return jsonify({"error": "Libro no encontrado"}), 404
    if book_author != g.current_user_email:
        return jsonify({"error": "No tienes permiso para modificar este libro"}), 403
 
    data = request.get_json()
    new_status = data.get('book_status')
 
    if new_status not in VALID_BOOK_STATUSES:
        return jsonify({
            "error": f"Estado inválido. Valores: {', '.join(VALID_BOOK_STATUSES)}"
        }), 400
 
    conn = get_db_connection()
    conn.execute(
        'UPDATE books SET book_status = ? WHERE id = ?',
        (new_status, book_id)
    )
    conn.commit()
    conn.close()
    return jsonify({"status": "updated", "book_status": new_status}), 200


# =============================================================================
# CAPÍTULOS
# =============================================================================

@app.route('/api/books/<int:book_id>/chapters', methods=['GET'])
def get_chapters(book_id):
    conn = get_db_connection()
    # Usar el JOIN correcto para obtener comment_count
    chapters = conn.execute('''
        SELECT ch.*, COUNT(co.id) as comment_count
        FROM chapters ch
        LEFT JOIN comments co ON ch.id = co.chapter_id
        WHERE ch.book_id = ?
        GROUP BY ch.id
        ORDER BY ch.id ASC
    ''', (book_id,)).fetchall()
    conn.close()
    return jsonify([dict(c) for c in chapters])


@app.route('/api/chapters', methods=['POST'])
@limiter.limit("30 per minute")  # #4 — evita spam de capítulos
@require_auth
def add_chapter():
    data = request.get_json()
    book_id = data.get('book_id')

    if not book_id:
        return jsonify({"error": "book_id requerido"}), 400

    # Verificar que el libro le pertenece al usuario autenticado
    book_author = get_book_author_email(book_id)
    if book_author is None:
        return jsonify({"error": "Libro no encontrado"}), 404
    if book_author != g.current_user_email:
        return jsonify({"error": "No puedes agregar capítulos a un libro que no es tuyo"}), 403

    content = data.get('content', '')
    title = data.get('title', '').strip()
    if not title:
        return jsonify({"error": "El título del capítulo es obligatorio"}), 400

    # #3 — Validar longitudes
    err = check_length(title, MAX_TITLE_CHARS, 'título') or \
          check_length(content, MAX_CHAPTER_CHARS, 'contenido del capítulo')
    if err:
        return jsonify({"error": err}), 400

    conn = get_db_connection()
    conn.execute(
        'INSERT INTO chapters (book_id, title, content, word_count, created_at) VALUES (?, ?, ?, ?, datetime("now"))',
        (book_id, title, content, len(content.split()))
    )
    conn.commit()
    conn.close()
    return jsonify({"message": "Capítulo agregado"}), 201


@app.route('/api/chapters/<int:chapter_id>', methods=['GET', 'PUT', 'DELETE'])
def handle_single_chapter(chapter_id):
    conn = get_db_connection()

    if request.method == 'GET':
        chapter = conn.execute('SELECT * FROM chapters WHERE id = ?', (chapter_id,)).fetchone()
        conn.close()
        if chapter:
            return jsonify(dict(chapter))
        return jsonify({"error": "Capítulo no encontrado"}), 404

    # PUT y DELETE requieren sesión y propiedad
    email = get_current_user_email()
    if not email:
        conn.close()
        return jsonify({"error": "No autorizado"}), 401

    chapter = conn.execute('SELECT book_id FROM chapters WHERE id = ?', (chapter_id,)).fetchone()
    if not chapter:
        conn.close()
        return jsonify({"error": "Capítulo no encontrado"}), 404

    book_author = get_book_author_email(chapter['book_id'])
    if book_author != email:
        conn.close()
        return jsonify({"error": "No tienes permiso para modificar este capítulo"}), 403

    if request.method == 'PUT':
        data = request.get_json()
        title = data.get('title')
        content = data.get('content', '')
        # #3 — Validar longitudes
        err = check_length(title, MAX_TITLE_CHARS, 'título') or \
              check_length(content, MAX_CHAPTER_CHARS, 'contenido del capítulo')
        if err:
            conn.close()
            return jsonify({"error": err}), 400
        word_count = len(content.split()) if content else 0
        conn.execute(
            'UPDATE chapters SET title = ?, content = ?, word_count = ? WHERE id = ?',
            (title, content, word_count, chapter_id)
        )
        conn.commit()
        conn.close()
        return jsonify({"status": "updated"}), 200

    if request.method == 'DELETE':
        # #9 — limpiar también las lecturas y comentarios de ese capítulo
        conn.execute('DELETE FROM chapter_reads WHERE chapter_id = ?', (chapter_id,))
        conn.execute('DELETE FROM comments WHERE chapter_id = ?', (chapter_id,))
        conn.execute('DELETE FROM chapters WHERE id = ?', (chapter_id,))
        conn.commit()
        conn.close()
        return jsonify({"status": "deleted"}), 200


# =============================================================================
# COMENTARIOS Y RATINGS
# =============================================================================

@app.route('/api/books/<int:book_id>/comments', methods=['GET', 'POST'])
@limiter.limit("20 per minute")  # #4 — evita spam de comentarios
def handle_comments(book_id):
    conn = get_db_connection()
    chapter_id = request.args.get('chapter_id')

    if request.method == 'POST':
        email = get_current_user_email()
        if not email:
            conn.close()
            return jsonify({"error": "No autorizado. Inicia sesión para comentar."}), 401

        data = request.get_json()
        c_id = data.get('chapter_id')

        # #3 — Validar longitud del comentario
        err = check_length(data.get('text'), MAX_COMMENT_CHARS, 'comentario')
        if err:
            conn.close()
            return jsonify({"error": err}), 400

        if c_id is None or c_id == 'null':
            existing = conn.execute(
                'SELECT id FROM comments WHERE book_id = ? AND user_email = ? AND chapter_id IS NULL',
                (book_id, email)
            ).fetchone()
            if existing:
                conn.execute(
                    'UPDATE comments SET text = ?, timestamp = CURRENT_TIMESTAMP WHERE id = ?',
                    (data['text'], existing['id'])
                )
            else:
                conn.execute(
                    'INSERT INTO comments (book_id, chapter_id, user_name, user_email, text) VALUES (?, NULL, ?, ?, ?)',
                    (book_id, data['user_name'], email, data['text'])
                )
        else:
            conn.execute(
                'INSERT INTO comments (book_id, chapter_id, user_name, user_email, text) VALUES (?, ?, ?, ?, ?)',
                (book_id, c_id, data['user_name'], email, data['text'])
            )
        conn.commit()

    query = '''
        SELECT c.*, COALESCE(u.nickname, c.user_name) as display_name,
               u.profile_pic as display_photo, r.score as user_rating
        FROM comments c
        LEFT JOIN users u ON c.user_email = u.email
        LEFT JOIN ratings r ON c.user_email = r.user_email AND c.book_id = r.book_id
        WHERE c.book_id = ?
    '''
    params = [book_id]
    if chapter_id == 'null':
        query += ' AND c.chapter_id IS NULL'
    elif chapter_id:
        query += ' AND c.chapter_id = ?'
        params.append(chapter_id)

    comments = conn.execute(query + ' ORDER BY c.timestamp DESC', params).fetchall()
    conn.close()
    return jsonify([dict(c) for c in comments])


@app.route('/api/books/<int:book_id>/rate', methods=['POST'])
@require_auth
def rate_book(book_id):
    data = request.get_json()
    score = data.get('score')
    if not score:
        return jsonify({"error": "Score requerido"}), 400

    email = g.current_user_email  # Siempre del token verificado, nunca del body

    conn = get_db_connection()
    # #2 — ON CONFLICT DO UPDATE en vez de INSERT OR REPLACE.
    # REPLACE borraba la fila entera (perdiendo el timestamp original);
    # esto solo actualiza el score y conserva cuándo se calificó por primera vez.
    conn.execute(
        '''INSERT INTO ratings (book_id, user_email, score) VALUES (?, ?, ?)
           ON CONFLICT(book_id, user_email) DO UPDATE SET score = excluded.score''',
        (book_id, email, score)
    )
    conn.commit()
    stats = conn.execute(
        'SELECT AVG(score) as avg, COUNT(*) as count FROM ratings WHERE book_id = ?',
        (book_id,)
    ).fetchone()
    conn.close()
    return jsonify({"status": "rated", "average": stats['avg'] or 0, "total_votes": stats['count']}), 200


@app.route('/api/books/<int:book_id>/rating-status/<string:email>', methods=['GET'])
def get_rating_status(book_id, email):
    conn = get_db_connection()
    user_rate = conn.execute(
        'SELECT score FROM ratings WHERE book_id = ? AND user_email = ?',
        (book_id, email)
    ).fetchone()
    stats = conn.execute(
        'SELECT AVG(score) as avg, COUNT(*) as count FROM ratings WHERE book_id = ?',
        (book_id,)
    ).fetchone()
    conn.close()
    return jsonify({
        "user_score": user_rate['score'] if user_rate else 0,
        "average": stats['avg'] or 0,
        "total_votes": stats['count']
    })


# =============================================================================
# BIBLIOTECA Y PROGRESO
# =============================================================================

@app.route('/api/library', methods=['GET'])
@require_auth
def get_library():
    email = g.current_user_email
    conn = get_db_connection()
    library_books = conn.execute('''
        SELECT b.*, ul.status, ul.last_updated
        FROM books b
        JOIN user_library ul ON b.id = ul.book_id
        WHERE ul.user_email = ?
        ORDER BY ul.last_updated DESC
    ''', (email,)).fetchall()
    conn.close()
    return jsonify([dict(b) for b in library_books])


@app.route('/api/library/update', methods=['POST'])
@require_auth
def update_library():
    data = request.get_json()
    email = g.current_user_email  # Nunca del body
    book_id = data.get('book_id')
    status = data.get('status')

    if not book_id:
        return jsonify({"error": "book_id requerido"}), 400

    conn = get_db_connection()
    if status == 'remove':
        conn.execute(
            'DELETE FROM user_library WHERE user_email = ? AND book_id = ?',
            (email, book_id)
        )
    else:
        conn.execute('''
            INSERT INTO user_library (user_email, book_id, status, last_updated)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_email, book_id) DO UPDATE SET
                status = excluded.status,
                last_updated = excluded.last_updated
        ''', (email, book_id, status))
    conn.commit()
    conn.close()
    return jsonify({"status": "updated"}), 200


@app.route('/api/progress/<string:email>/<int:book_id>', methods=['GET'])
@require_auth
def get_progress(email, book_id):
    # El usuario solo puede consultar su propio progreso
    if email != g.current_user_email:
        return jsonify({"error": "No autorizado"}), 403

    conn = get_db_connection()

    # last_chapter_id sigue en user_library
    row = conn.execute('''
        SELECT last_chapter_id
        FROM user_library
        WHERE user_email = ? AND book_id = ?
    ''', (email, book_id)).fetchone()

    # #9 — Los capítulos leídos ahora salen de chapter_reads (una fila c/u)
    reads = conn.execute('''
        SELECT chapter_id FROM chapter_reads
        WHERE user_email = ? AND book_id = ?
    ''', (email, book_id)).fetchall()
    conn.close()

    read_chapters_list = [r['chapter_id'] for r in reads]

    return jsonify({
        "last_chapter_id": row['last_chapter_id'] if row else None,
        "read_chapters": read_chapters_list
    })


@app.route('/api/progress/update', methods=['POST'])
@require_auth
def update_progress():
    data = request.get_json()
    email = g.current_user_email  # Nunca del body
    book_id = data.get('book_id')
    chapter_id = data.get('chapter_id')

    if not book_id or not chapter_id:
        return jsonify({"error": "Datos incompletos"}), 400

    conn = get_db_connection()

    # #9 — Marcar el capítulo como leído = insertar una fila en chapter_reads.
    # INSERT OR IGNORE: si ya estaba leído, no hace nada (la PK evita duplicados).
    conn.execute('''
        INSERT OR IGNORE INTO chapter_reads (user_email, book_id, chapter_id)
        VALUES (?, ?, ?)
    ''', (email, book_id, chapter_id))

    # Actualizar el último capítulo leído en user_library.
    # UPSERT: si el libro no estaba en la biblioteca del usuario, crea la fila;
    # si estaba, solo actualiza. (Antes el UPDATE fallaba si la fila no existía.)
    conn.execute('''
        INSERT INTO user_library (user_email, book_id, last_chapter_id, last_updated)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_email, book_id)
        DO UPDATE SET last_chapter_id = excluded.last_chapter_id,
                      last_updated = CURRENT_TIMESTAMP
    ''', (email, book_id, chapter_id))

    conn.commit()
    conn.close()
    return jsonify({"status": "progress_updated"}), 200


# =============================================================================
# DASHBOARD DE AUTOR
# =============================================================================

@app.route('/api/my-books', methods=['GET'])
@require_auth
def get_author_books():
    email = g.current_user_email
    conn = get_db_connection()
    books = conn.execute('''
        SELECT b.*, AVG(r.score) as avg_rating, COUNT(DISTINCT r.user_email) as vote_count
        FROM books b
        LEFT JOIN ratings r ON b.id = r.book_id
        WHERE b.author_email = ?
        GROUP BY b.id
        ORDER BY b.id DESC
    ''', (email,)).fetchall()
    conn.close()
    return jsonify([dict(b) for b in books])


# =============================================================================
# PERFIL DE USUARIO
# =============================================================================

@app.route('/api/update-profile', methods=['POST'])
@require_auth
def update_profile():
    data = request.get_json()
    email = data.get('email')
    nickname = data.get('nickname')
    picture_data = data.get('picture')

    if not email:
        return jsonify({"error": "Email requerido"}), 400

    # #3 — Validar longitud del nickname
    err = check_length(nickname, MAX_NICKNAME_CHARS, 'nickname')
    if err:
        return jsonify({"error": err}), 400

    # Un usuario solo puede editar su propio perfil
    if email != g.current_user_email:
        return jsonify({"error": "No puedes modificar el perfil de otro usuario"}), 403

    final_picture_path = picture_data

    if picture_data and picture_data.startswith('data:image'):
        try:
            header, encoded = picture_data.split(",", 1)
            image_bytes = base64.b64decode(encoded)
            img = Image.open(io.BytesIO(image_bytes))
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            img.thumbnail((400, 400))
            clean_email = email.replace('@', '_').replace('.', '_')
            filename = f"profile_{clean_email}.jpg"
            profile_folder = AVATARS_UPLOAD_FOLDER
            os.makedirs(profile_folder, exist_ok=True)
            filepath = os.path.join(profile_folder, filename)
            img.save(filepath, "JPEG", quality=85, optimize=True)
            # #7 — usar SERVER_URL configurable en vez de 127.0.0.1 hardcodeado.
            # Así, al publicar, las fotos apuntan al dominio real automáticamente.
            final_picture_path = f"{SERVER_URL}/static/avatars_uploaded/{filename}"
        except Exception as e:
            print(f"[Profile] Error procesando imagen: {e}")

    try:
        conn = get_db_connection()
        conn.execute('''
            INSERT INTO users (email, nickname, profile_pic) VALUES (?, ?, ?)
            ON CONFLICT(email) DO UPDATE SET
                nickname = excluded.nickname,
                profile_pic = excluded.profile_pic
        ''', (email, nickname, final_picture_path))
        conn.commit()
        conn.close()
        return jsonify({"message": "Perfil actualizado", "picture": final_picture_path}), 200
    except Exception as e:
        print(f"[Profile] Error de base de datos: {e}")
        return jsonify({"error": "Error al guardar en DB"}), 500


# =============================================================================
# RANKINGS Y BÚSQUEDA (PÚBLICOS)
# =============================================================================

@app.route('/api/rankings/top100', methods=['GET'])
def get_top_rankings():
    tag = request.args.get('tag')
    conn = get_db_connection()
    query = '''
        SELECT b.*, AVG(r.score) as avg_rating, COUNT(r.score) as vote_count
        FROM books b LEFT JOIN ratings r ON b.id = r.book_id
    '''
    params = []
    if tag:
        query += ' WHERE b.tags LIKE ?'
        params.append(f'%{tag}%')
    query += ' GROUP BY b.id ORDER BY avg_rating DESC, vote_count DESC'

    # #8 — Paginación opcional dentro del top 100.
    # El ranking sigue teniendo un tope conceptual de 100 libros:
    # la paginación solo sirve para traerlos de a tandas (scroll infinito).
    if 'page' in request.args:
        limit, offset, page, per_page = get_pagination_params()
        # No dejar pasar del puesto 100
        if offset >= 100:
            conn.close()
            return jsonify({"books": [], "page": page, "per_page": per_page, "has_more": False})
        # Ajustar el limit para no superar el puesto 100
        limit = min(limit, 100 - offset)
        query += ' LIMIT ? OFFSET ?'
        books = conn.execute(query, params + [limit, offset]).fetchall()
        conn.close()
        result = [dict(b) for b in books]
        return jsonify({
            "books": result,
            "page": page,
            "per_page": per_page,
            "has_more": (offset + len(result)) < 100 and len(result) == limit,
        })

    query += ' LIMIT 100'
    books = conn.execute(query, params).fetchall()
    conn.close()
    return jsonify([dict(b) for b in books])


@app.route('/api/search/advanced', methods=['GET'])
def advanced_search():
    query_text = request.args.get('q', '')
    tags_param = request.args.get('tags', '')
    min_rating = request.args.get('min_rating', 0, type=float)
    sort_by = request.args.get('sort', 'id')

    conn = get_db_connection()
    sql = '''
        SELECT b.*, AVG(r.score) as avg_rating, COUNT(r.score) as vote_count
        FROM books b
        LEFT JOIN ratings r ON b.id = r.book_id
        WHERE (b.title LIKE ? OR b.author LIKE ?)
    '''
    params = [f'%{query_text}%', f'%{query_text}%']

    if tags_param:
        for tag in tags_param.split(','):
            tag = tag.strip()
            if tag:
                sql += ' AND b.tags LIKE ?'
                params.append(f'%{tag}%')

    sql += ' GROUP BY b.id'

    if min_rating > 0:
        # #5 — filtro exacto. Antes restaba 0.3 en silencio (pedías 4, veías 3.7).
        # Ahora si el usuario pide rating >= 4, ve libros con rating >= 4.
        sql += ' HAVING avg_rating >= ?'
        params.append(min_rating)

    if sort_by == 'rating':
        sql += ' ORDER BY avg_rating DESC'
    elif sort_by == 'views':
        sql += ' ORDER BY b.views DESC'
    else:
        sql += ' ORDER BY b.id DESC'

    # #8 — Paginación opcional y retrocompatible (igual criterio que /api/books)
    if 'page' in request.args:
        limit, offset, page, per_page = get_pagination_params()
        sql += ' LIMIT ? OFFSET ?'
        params_paged = params + [limit, offset]
        results = conn.execute(sql, params_paged).fetchall()
        conn.close()
        books = [dict(r) for r in results]
        return jsonify({
            "books": books,
            "page": page,
            "per_page": per_page,
            # En búsqueda, si trajo menos que per_page ya no hay más páginas.
            "has_more": len(books) == per_page,
        })

    results = conn.execute(sql, params).fetchall()
    conn.close()
    return jsonify([dict(r) for r in results])


@app.route('/api/books/<int:book_id>/library-stats', methods=['GET'])
def get_library_stats(book_id):
    try:
        conn = get_db_connection()
        stats = conn.execute(
            'SELECT status, COUNT(*) as count FROM user_library WHERE book_id = ? GROUP BY status',
            (book_id,)
        ).fetchall()
        conn.close()
        result = {"reading": 0, "pending": 0, "completed": 0, "dropped": 0}
        for row in stats:
            if row['status'].lower() in result:
                result[row['status'].lower()] = row['count']
        return jsonify(result), 200
    except Exception as e:
        print(f"[Stats] Error: {e}")
        return jsonify({"error": str(e)}), 500


# =============================================================================
# VISTAS (sin autenticación — se trackea por IP)
# =============================================================================

@app.route('/api/books/<int:book_id>/view', methods=['POST'])
@limiter.limit("60 per minute")  # #4 — evita inflar vistas artificialmente
def register_view(book_id):
    data = request.get_json() or {}
    chapter_index = data.get('chapter_index', 0)
    ip = request.headers.get('X-Forwarded-For', request.remote_addr)
    conn = get_db_connection()
    try:
        conn.execute(
            'INSERT INTO view_logs (book_id, chapter_index, ip_address) VALUES (?, ?, ?)',
            (book_id, chapter_index, ip)
        )
        conn.execute('UPDATE books SET views = views + 1 WHERE id = ?', (book_id,))
        conn.commit()
        return jsonify({"status": "view_counted"}), 200
    except sqlite3.IntegrityError:
        return jsonify({"status": "already_counted"}), 200
    finally:
        conn.close()


# =============================================================================
# ARCHIVOS ESTÁTICOS
# =============================================================================

@app.route('/static/covers/<path:filename>')
def serve_covers(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


@app.route('/static/avatars_uploaded/<path:filename>')
def serve_user_avatars(filename):
    return send_from_directory(AVATARS_UPLOAD_FOLDER, filename)


@app.route('/static/<path:path>')
def send_static(path):
    return send_from_directory('static', path)


# =============================================================================
# ARRANQUE
# =============================================================================

# #4 — Respuesta amigable cuando alguien supera el límite de peticiones.
# En vez de una página HTML de error, devuelve JSON claro.
@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({
        "error": "Demasiadas peticiones. Esperá un momento antes de reintentar.",
        "detail": str(e.description)
    }), 429


if __name__ == '__main__':
    init_db_internal()
    # #1 — debug NUNCA hardcodeado en True. Se activa solo si la variable
    # de entorno FLASK_DEBUG está en "1". En producción, al no estar seteada,
    # queda en False (seguro). Para desarrollo local: set FLASK_DEBUG=1
    debug_mode = os.environ.get('FLASK_DEBUG', '0') == '1'
    port = int(os.environ.get('PORT', 5001))
    app.run(debug=debug_mode, host='0.0.0.0', port=port)