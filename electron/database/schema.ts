export const schema = `
-- Manga library entries
CREATE TABLE IF NOT EXISTS manga (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  source_manga_id TEXT NOT NULL,
  title TEXT NOT NULL,
  cover_url TEXT,
  author TEXT,
  artist TEXT,
  description TEXT,
  status TEXT,
  in_library INTEGER DEFAULT 0,
  added_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  UNIQUE(source_id, source_manga_id)
);

-- Chapters for each manga
CREATE TABLE IF NOT EXISTS chapter (
  id TEXT PRIMARY KEY,
  manga_id TEXT NOT NULL REFERENCES manga(id) ON DELETE CASCADE,
  source_chapter_id TEXT NOT NULL,
  title TEXT NOT NULL,
  chapter_number REAL,
  volume_number INTEGER,
  url TEXT NOT NULL,
  read_at INTEGER,
  page_count INTEGER,
  last_page_read INTEGER DEFAULT 0,
  added_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Reading history
CREATE TABLE IF NOT EXISTS history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  manga_id TEXT NOT NULL REFERENCES manga(id) ON DELETE CASCADE,
  chapter_id TEXT NOT NULL REFERENCES chapter(id) ON DELETE CASCADE,
  read_at INTEGER DEFAULT (strftime('%s', 'now')),
  page_number INTEGER
);

-- Tags for categorization
CREATE TABLE IF NOT EXISTS tag (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  color TEXT DEFAULT '#6366f1'
);

-- Manga-Tag relationship
CREATE TABLE IF NOT EXISTS manga_tag (
  manga_id TEXT NOT NULL REFERENCES manga(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
  PRIMARY KEY (manga_id, tag_id)
);

-- Extension metadata
CREATE TABLE IF NOT EXISTS extension (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  installed_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_manga_source ON manga(source_id, source_manga_id);
CREATE INDEX IF NOT EXISTS idx_chapter_manga ON chapter(manga_id);
CREATE INDEX IF NOT EXISTS idx_history_manga ON history(manga_id);
CREATE INDEX IF NOT EXISTS idx_history_read_at ON history(read_at DESC);
CREATE INDEX IF NOT EXISTS idx_manga_tag_manga ON manga_tag(manga_id);
CREATE INDEX IF NOT EXISTS idx_manga_tag_tag ON manga_tag(tag_id);
`;
