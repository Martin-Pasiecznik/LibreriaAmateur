"""
generar_slugs.py — Crea los slugs de los libros que ya están cargados.

Los libros nuevos generan su slug automáticamente. Este script es para
los que se cargaron antes de que existiera esa función.

USO (en la carpeta server/, con el venv activado):
    python generar_slugs.py

Es seguro correrlo varias veces: saltea los que ya tienen slug.
"""
import os
import re
import sqlite3
import unicodedata

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'database.db')


def slugify(texto):
    """Misma lógica que en main.py — mantenerlas iguales."""
    if not texto:
        return 'libro'
    sin_tildes = texto.replace('ñ', 'n').replace('Ñ', 'N')
    normalizado = unicodedata.normalize('NFKD', sin_tildes)
    sin_tildes = ''.join(c for c in normalizado if not unicodedata.combining(c))
    s = sin_tildes.lower()
    s = re.sub(r'[^a-z0-9]+', '-', s)
    s = s.strip('-')
    s = s[:80].rstrip('-')
    return s or 'libro'


def main():
    if not os.path.exists(DB_PATH):
        print(f"No se encontró la base en {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    # Verificar que exista la columna
    columnas = [c[1] for c in conn.execute("PRAGMA table_info(books)")]
    if 'slug' not in columnas:
        print("ERROR: la columna 'slug' no existe todavía.")
        print("Corré primero la migración:")
        print("  sqlite3 database.db \"ALTER TABLE books ADD COLUMN slug TEXT;\"")
        conn.close()
        return

    libros = conn.execute(
        "SELECT id, title, slug FROM books ORDER BY id"
    ).fetchall()

    if not libros:
        print("No hay libros en la base.")
        conn.close()
        return

    usados = {l['slug'] for l in libros if l['slug']}
    creados = salteados = 0

    for libro in libros:
        if libro['slug']:
            salteados += 1
            continue

        base = slugify(libro['title'])
        candidato = base
        n = 2
        while candidato in usados:
            candidato = f'{base}-{n}'
            n += 1

        conn.execute(
            'UPDATE books SET slug = ? WHERE id = ?',
            (candidato, libro['id'])
        )
        usados.add(candidato)
        creados += 1
        print(f"  {libro['id']:3d}  {libro['title'][:40]:42s} → {candidato}")

    conn.commit()
    # Consolidar el WAL para que el cambio quede escrito de verdad
    conn.execute('PRAGMA wal_checkpoint(TRUNCATE)')
    conn.close()

    print()
    print(f"Slugs creados : {creados}")
    print(f"Ya tenían     : {salteados}")


if __name__ == '__main__':
    main()