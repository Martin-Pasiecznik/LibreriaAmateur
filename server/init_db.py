import sqlite3
import os

# Apunta al mismo archivo que usa main.py
DB_PATH = os.path.join(os.path.dirname(__file__), "database.db")


def init_db():
    connection = sqlite3.connect(DB_PATH)
    cursor = connection.cursor()

    # ── 1. USUARIOS ────────────────────────────────────────────────────────────
    # Perfiles de usuarios autenticados con Google.
    # profile_pic guarda la URL de la foto (Google o avatar subido).
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        email       TEXT PRIMARY KEY,
        nickname    TEXT,
        profile_pic TEXT,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_admin    INTEGER DEFAULT 0,
        is_banned   INTEGER DEFAULT 0
    )''')

    # ── 2. LIBROS ──────────────────────────────────────────────────────────────
    # author_note guarda el filename de la portada (ej: "cover_1234.jpg").
    # book_status: 'ongoing' | 'completed' | 'paused' | 'abandoned'
    # created_at: fecha de creación del libro (para ordenar por "más nuevos").
    # is_adult: 1 si el contenido es para adultos (+18), 0 si no.
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS books (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        title        TEXT NOT NULL,
        author       TEXT NOT NULL,
        author_email TEXT,
        description  TEXT,
        author_note  TEXT,
        tags         TEXT,
        views        INTEGER DEFAULT 0,
        book_status  TEXT    DEFAULT 'ongoing',
        created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_adult     INTEGER DEFAULT 0,
        is_hidden    INTEGER DEFAULT 0
    )''')

    # ── 3. CAPÍTULOS ───────────────────────────────────────────────────────────
    # created_at permite mostrar "última actualización" en el detalle del libro.
    # updated_at registra cuándo se editó por última vez (NULL si nunca se editó).
    cursor.execute('''CREATE TABLE IF NOT EXISTS chapters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        book_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        word_count INTEGER DEFAULT 0,
        order_index INTEGER,
        created_at DATETIME,
        updated_at DATETIME,
        FOREIGN KEY (book_id) REFERENCES books (id))''')

    # ── 4. CALIFICACIONES ──────────────────────────────────────────────────────
    # Un usuario solo puede calificar una vez por libro (PRIMARY KEY compuesta).
    # CHECK impide valores fuera del rango 1-5.
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS ratings (
        book_id    INTEGER,
        user_email TEXT,
        score      INTEGER  CHECK(score >= 1 AND score <= 5),
        timestamp  DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (book_id, user_email),
        FOREIGN KEY (book_id) REFERENCES books (id)
    )''')

    # ── 5. COMENTARIOS ─────────────────────────────────────────────────────────
    # chapter_id NULL = comentario general del libro (reseña).
    # chapter_id con valor = nota en un capítulo específico.
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS comments (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        book_id    INTEGER,
        chapter_id INTEGER,
        user_name  TEXT,
        user_email TEXT,
        text       TEXT,
        timestamp  DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_hidden  INTEGER DEFAULT 0
    )''')

    # ── 6. LOGS DE VISTAS ──────────────────────────────────────────────────────
    # PRIMARY KEY compuesta evita contar dos veces la misma IP por capítulo.
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS view_logs (
        book_id       INTEGER,
        chapter_index INTEGER,
        ip_address    TEXT,
        timestamp     DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (book_id, chapter_index, ip_address)
    )''')

    # ── 7. BIBLIOTECA DEL USUARIO ──────────────────────────────────────────────
    # status: 'reading' | 'pending' | 'completed' | 'dropped'
    # last_chapter_id: el último capítulo que el usuario abrió
    # (Los capítulos leídos ya NO se guardan acá como JSON — ver tabla chapter_reads)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS user_library (
        user_email      TEXT,
        book_id         INTEGER,
        status          TEXT,
        last_chapter_id INTEGER,
        last_updated    DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_email, book_id),
        FOREIGN KEY (book_id)         REFERENCES books    (id),
        FOREIGN KEY (last_chapter_id) REFERENCES chapters (id)
    )''')

    # ── 7b. CAPÍTULOS LEÍDOS ───────────────────────────────────────────────────
    # #9 — Cada lectura es una fila (en vez de un JSON dentro de user_library).
    # La PRIMARY KEY compuesta evita duplicados: un usuario "lee" un capítulo
    # una sola vez. Marcar como leído = insertar una fila (rápido).
    # Consultar qué leyó = SELECT por usuario+libro (indexado).
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS chapter_reads (
        user_email TEXT,
        book_id    INTEGER,
        chapter_id INTEGER,
        read_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_email, chapter_id),
        FOREIGN KEY (book_id)    REFERENCES books    (id),
        FOREIGN KEY (chapter_id) REFERENCES chapters (id)
    )''')

    # ── 8. ROTACIÓN DE DESTACADOS ──────────────────────────────────────────────
    # Solo existe una fila (id = 1) con los IDs de libros destacados.
    # Se rota automáticamente cada hora desde main.py.
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS featured_rotation (
        id          INTEGER PRIMARY KEY CHECK (id = 1),
        last_update DATETIME,
        book_ids    TEXT
    )''')

    # ── 9. SESIONES DE AUTENTICACIÓN ───────────────────────────────────────────
    # Cuando el usuario se loguea con Google, main.py genera un token seguro
    # y lo guarda aquí con fecha de expiración (30 días).
    # Sin esta tabla el login no funciona.
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS sessions (
        token      TEXT PRIMARY KEY,
        user_email TEXT     NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL
    )''')

    # ══ ÍNDICES ════════════════════════════════════════════════════════════════
    # Aceleran las consultas más frecuentes de la app.
    # Sin índices, SQLite hace full-table scan en cada request.

    cursor.execute('CREATE INDEX IF NOT EXISTS idx_sessions_token   ON sessions    (token)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_sessions_email   ON sessions    (user_email)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_books_author     ON books       (author_email)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_books_status     ON books       (book_status)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_chapters_book    ON chapters    (book_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_ratings_book     ON ratings     (book_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_comments_book    ON comments    (book_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_comments_chapter ON comments    (chapter_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_library_user     ON user_library(user_email)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_library_book     ON user_library(book_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_reads_user_book  ON chapter_reads(user_email, book_id)')

    connection.commit()
    connection.close()
    print("✅ Base de datos inicializada correctamente.")
    print("   Tablas: users, books, chapters, ratings, comments,")
    print("   Tablas: users, books, chapters, ratings, comments,")
    print("           view_logs, user_library, chapter_reads,")
    print("           featured_rotation, sessions")
    print("   Índices: 10 índices de rendimiento creados.")


# ══ MIGRACIÓN PARA DB EXISTENTE ════════════════════════════════════════════════
# Si ya tenés una database.db con datos, esta función agrega solo lo que falta
# sin borrar nada. Correrla una vez después de actualizar el código.
def migrate_existing():
    conn = sqlite3.connect(DB_PATH)
    cur  = conn.cursor()
    migraciones = 0

    alteraciones = [
        ("books",    "book_status TEXT DEFAULT 'ongoing'"),
        ("chapters", "created_at DATETIME DEFAULT CURRENT_TIMESTAMP"),
    ]

    for tabla, columna_def in alteraciones:
        col_nombre = columna_def.split()[0]
        try:
            cur.execute(f"ALTER TABLE {tabla} ADD COLUMN {columna_def}")
            print(f"  ✅  {tabla}.{col_nombre} agregada")
            migraciones += 1
        except Exception:
            print(f"  ⏭️   {tabla}.{col_nombre} ya existe, omitida")

    conn.commit()
    conn.close()

    if migraciones:
        print(f"\n✅ Migración completa — {migraciones} columna(s) nueva(s).")
    else:
        print("\n✅ Base de datos ya estaba actualizada, sin cambios.")


if __name__ == '__main__':
    import sys
    if '--migrate' in sys.argv:
        # Usar cuando ya existe la DB y solo hay que agregar columnas nuevas:
        # python init_db.py --migrate
        print("Ejecutando migración sobre DB existente...")
        migrate_existing()
    else:
        # Uso normal: crea todas las tablas si no existen
        # python init_db.py
        init_db()