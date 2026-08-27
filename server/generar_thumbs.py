"""
generar_thumbs.py — Crea las miniaturas de las portadas ya subidas.

Las portadas nuevas generan su miniatura automáticamente. Este script
es para las que ya estaban antes de que existiera esa función.

USO (en la carpeta server/, con el venv activado):
    python generar_thumbs.py

Es seguro correrlo varias veces: saltea las que ya tienen miniatura.
"""
import os
from PIL import Image

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
COVERS_DIR = os.path.join(BASE_DIR, 'static', 'covers')
THUMB_SIZE = (200, 300)


def main():
    if not os.path.isdir(COVERS_DIR):
        print(f"No existe la carpeta {COVERS_DIR}")
        return

    archivos = [
        f for f in os.listdir(COVERS_DIR)
        if f.lower().endswith(('.jpg', '.jpeg', '.png'))
        and '_thumb' not in f          # no procesar miniaturas existentes
    ]

    if not archivos:
        print("No hay portadas para procesar.")
        return

    creadas = salteadas = fallidas = 0

    for nombre in archivos:
        base, ext = os.path.splitext(nombre)
        thumb = f"{base}_thumb{ext}"
        ruta_thumb = os.path.join(COVERS_DIR, thumb)

        if os.path.exists(ruta_thumb):
            salteadas += 1
            continue

        try:
            img = Image.open(os.path.join(COVERS_DIR, nombre))
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            img.thumbnail(THUMB_SIZE)
            img.save(ruta_thumb, "JPEG", quality=80, optimize=True)
            creadas += 1
            print(f"  ✓ {thumb}")
        except Exception as e:
            fallidas += 1
            print(f"  ✗ {nombre}: {e}")

    print()
    print(f"Miniaturas creadas : {creadas}")
    print(f"Ya existían        : {salteadas}")
    if fallidas:
        print(f"Fallidas           : {fallidas}")


if __name__ == '__main__':
    main()