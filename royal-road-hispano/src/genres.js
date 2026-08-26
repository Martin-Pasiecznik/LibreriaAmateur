// ─────────────────────────────────────────────────────────────
// GÉNEROS OFICIALES — Librería Amateur
//
// Lista cerrada: son los únicos valores que pueden ir en el campo
// `tags` de un libro. Se usan para filtros, búsqueda y rankings.
// Las "etiquetas libres" del autor van en otro campo (free_tags)
// y NO participan de los filtros.
//
// IMPORTANTE: esta lista debe coincidir con VALID_GENRES en main.py.
// Si agregás un género acá, agregalo también allá.
// ─────────────────────────────────────────────────────────────

// Géneros principales — los más usados, se muestran primero
export const MAIN_GENRES = [
  'Acción',
  'Aventura',
  'Ciencia Ficción',
  'Comedia',
  'Drama',
  'Fantasía',
  'Misterio',
  'Romance',
  'Terror',
  'Thriller',
].sort((a, b) => a.localeCompare(b, 'es'));

// Géneros secundarios, agrupados por categoría (panel "Más géneros")
export const GENRE_GROUPS = [
  {
    title: 'Subgéneros de webnovela',
    tags: [
      'Cultivación',
      'LitRPG',
      'Magia',
      'Mazmorra',
      'Reencarnación',
      'Regresión',
      'Sistema',
      'Isekai',
      'Wuxia',
      'Xianxia',
    ].sort((a, b) => a.localeCompare(b, 'es')),
  },
  {
    title: 'Romance y vida cotidiana',
    tags: [
      'Amor Prohibido',
      'BL',
      'GL',
      'Harem',
      'Romance Moderno',
      'Slice of Life',
      'Slow Burn',
      'Triángulo Amoroso',
    ].sort((a, b) => a.localeCompare(b, 'es')),
  },
  {
    title: 'Ambientación',
    tags: [
      'Alta Fantasía',
      'Ciberpunk',
      'Distopía',
      'Fantasía Oscura',
      'Fantasía Urbana',
      'Histórico',
      'Medieval',
      'Mundo Apocalíptico',
      'Post-Apocalíptico',
      'Space Opera',
      'Steampunk',
      'Western',
    ].sort((a, b) => a.localeCompare(b, 'es')),
  },
  {
    title: 'Protagonista y tono',
    tags: [
      'Anti-héroe',
      'Dark',
      'Fluffy',
      'Guerra',
      'Narrador Poco Fiable',
      'Protagonista Femenina',
      'Protagonista Masculino',
      'Protagonista Múltiple',
      'Redención',
      'Venganza',
    ].sort((a, b) => a.localeCompare(b, 'es')),
  },
  {
    title: 'Otros',
    tags: [
      'Antología',
      'Biográfico',
      'Crimen',
      'Deportes',
      'Ensayo',
      'Filosófico',
      'Gastronomía',
      'Infantil',
      'Juvenil',
      'Musical',
      'Poesía',
      'Psicológico',
      'Realismo Mágico',
      'Sobrenatural',
      'Superhéroes',
      'Suspenso',
      'Tragedia',
    ].sort((a, b) => a.localeCompare(b, 'es')),
  },
];

// Todos los géneros válidos en una sola lista plana (para validar)
export const ALL_GENRES = [
  ...MAIN_GENRES,
  ...GENRE_GROUPS.flatMap(g => g.tags),
];

// Límites
export const MAX_GENRES = 8;
export const MAX_FREE_TAGS = 10;
export const MAX_FREE_TAG_LENGTH = 30;