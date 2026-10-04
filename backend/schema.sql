-- =================================================================
-- Omni Virtual Solutions — Database Schema
-- Compatible with: SQLite (local) and libSQL/Turso (cloud)
-- =================================================================
-- Run via: node backend/migrate.js
-- All tables use IF NOT EXISTS — safe to re-run without data loss.
-- =================================================================

PRAGMA foreign_keys = ON;

-- ─────────────────────────────────────────────────────────────────
-- 1. Company Profile & Contact Info
--    Drives the footer, contact section, and meta tags site-wide.
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS company_profile (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    company_name     TEXT NOT NULL,
    tagline          TEXT,
    phone            TEXT,
    email            TEXT,
    address_line1    TEXT,
    address_line2    TEXT,
    city_state_zip   TEXT,
    copyright_text   TEXT,
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────────
-- 2. Media & Image Asset Registry
--    Central catalog of every image used on the site.
--    category: 'logo' | 'book_cover' | 'team' | 'hero' | 'footer' | 'service'
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS media_assets (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_key   TEXT UNIQUE NOT NULL,
    file_path   TEXT NOT NULL,
    alt_text    TEXT,
    category    TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────────
-- 2b. Direct Database Media Storage (Turso Cloud BLOB Storage)
--     Stores optimized WebP image binaries with 100% original resolution
--     Zero local disk dependency — works in serverless/cloud environments
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS media_files (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_key   TEXT UNIQUE NOT NULL,
    filename    TEXT UNIQUE NOT NULL,
    mime_type   TEXT NOT NULL,
    data        BLOB NOT NULL,
    width       INTEGER,
    height      INTEGER,
    size_bytes  INTEGER,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_media_files_filename ON media_files(filename);
CREATE INDEX IF NOT EXISTS idx_media_files_key ON media_files(asset_key);

-- ─────────────────────────────────────────────────────────────────
-- 3. Hero Showcase Books (Swiper carousel on homepage)
--    8 book titles displayed in the hero section coverflow swiper.
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS showcase_books (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT NOT NULL,
    author          TEXT NOT NULL,
    image_asset_id  INTEGER,
    display_order   INTEGER DEFAULT 0,
    is_active       INTEGER DEFAULT 1,
    FOREIGN KEY (image_asset_id) REFERENCES media_assets(id)
);

-- ─────────────────────────────────────────────────────────────────
-- 4. Company Live Stats
--    Drives the animated counters: Clients, Projects, Hours, Workers
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS company_stats (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    stat_key      TEXT UNIQUE NOT NULL,
    stat_value    INTEGER NOT NULL,
    stat_label    TEXT NOT NULL,
    display_order INTEGER DEFAULT 0
);

-- ─────────────────────────────────────────────────────────────────
-- 5. Service Categories (top-level sidebar groups)
--    e.g. Publishing Packages, Evaluation Services, Editorial, Formats, Marketing
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS service_categories (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    slug          TEXT UNIQUE NOT NULL,
    title         TEXT NOT NULL,
    short_desc    TEXT,
    icon_class    TEXT,
    tagline       TEXT,
    display_order INTEGER DEFAULT 0
);

-- ─────────────────────────────────────────────────────────────────
-- 6. Service Subcategories (nested under each category)
--    e.g. "Publishing Options" under "Publishing Packages"
--         "Advanced Editorial Services" under "Editorial Services"
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS service_subcategories (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id   INTEGER NOT NULL,
    slug          TEXT UNIQUE NOT NULL,
    title         TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    FOREIGN KEY (category_id) REFERENCES service_categories(id) ON DELETE CASCADE
);

-- ─────────────────────────────────────────────────────────────────
-- 7. Services Master Table — All 131 individual service pages
--    price_cents: stored in cents (e.g. $899.00 = 89900)
--    price_cents NULL = custom quote / contact for pricing
--    price_display: the human-readable string shown on site
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS services (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    subcategory_id       INTEGER NOT NULL,
    slug                 TEXT UNIQUE NOT NULL,
    title                TEXT NOT NULL,
    price_cents          INTEGER,
    price_display        TEXT,
    lead_paragraph       TEXT,
    full_description     TEXT,
    cta_email            TEXT DEFAULT 'admin@omnivirtualsolution.com',
    is_featured          INTEGER DEFAULT 0,
    display_order        INTEGER DEFAULT 0,
    FOREIGN KEY (subcategory_id) REFERENCES service_subcategories(id) ON DELETE RESTRICT
);

-- ─────────────────────────────────────────────────────────────────
-- 8. Service Feature Bullet Points
--    Every <li> item from each service page's <ul> lists.
--    Linked to its parent service via service_id.
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS service_features (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id     INTEGER NOT NULL,
    feature_text   TEXT NOT NULL,
    display_order  INTEGER DEFAULT 0,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

-- ─────────────────────────────────────────────────────────────────
-- 9. Contact / Lead Submissions
--    Replaces the broken forms/contact.php.
--    status: 'new' | 'in_review' | 'contacted' | 'closed'
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_submissions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name           TEXT NOT NULL,
    email               TEXT NOT NULL,
    subject             TEXT,
    message             TEXT NOT NULL,
    service_interest_id INTEGER,
    status              TEXT DEFAULT 'new',
    ip_address          TEXT,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (service_interest_id) REFERENCES services(id)
);

-- ─────────────────────────────────────────────────────────────────
-- Indexes — Optimise the queries we actually run
-- ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_services_slug       ON services(slug);
CREATE INDEX IF NOT EXISTS idx_services_subcat     ON services(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_subcat_category     ON service_subcategories(category_id);
CREATE INDEX IF NOT EXISTS idx_books_order         ON showcase_books(display_order);
CREATE INDEX IF NOT EXISTS idx_contact_status      ON contact_submissions(status);
CREATE INDEX IF NOT EXISTS idx_contact_created     ON contact_submissions(created_at);
