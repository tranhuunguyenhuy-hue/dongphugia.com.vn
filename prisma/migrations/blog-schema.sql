-- Blog System Schema for Đông Phú Gia
-- Phase 1: Core tables (4 tables)
-- Applied: 02/03/2026

-- 1. Blog Categories
CREATE TABLE blog_categories (
    id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    slug            VARCHAR(100) NOT NULL UNIQUE,
    description     TEXT,
    thumbnail_url   TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    seo_title       VARCHAR(200),
    seo_description VARCHAR(500),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Blog Posts
CREATE TABLE blog_posts (
    id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    -- Basic info
    title           VARCHAR(300) NOT NULL,
    slug            VARCHAR(300) NOT NULL UNIQUE,
    excerpt         TEXT,
    content         TEXT NOT NULL DEFAULT '',

    -- Classification
    category_id     INTEGER NOT NULL REFERENCES blog_categories(id) ON DELETE RESTRICT,

    -- Media
    thumbnail_url   TEXT,
    cover_image_url TEXT,

    -- SEO
    seo_title       VARCHAR(200),
    seo_description VARCHAR(500),
    seo_keywords    VARCHAR(500),

    -- Stats
    reading_time    INTEGER,
    view_count      INTEGER NOT NULL DEFAULT 0,

    -- Status
    status          VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'scheduled')),
    published_at    TIMESTAMPTZ,

    -- Author
    author_name     VARCHAR(100) NOT NULL DEFAULT 'Đông Phú Gia',
    author_avatar   TEXT,

    -- Flags
    is_featured     BOOLEAN NOT NULL DEFAULT FALSE,
    is_pinned       BOOLEAN NOT NULL DEFAULT FALSE,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Blog Tags
CREATE TABLE blog_tags (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        VARCHAR(50) NOT NULL,
    slug        VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    post_count  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Blog Post Tags (N-N junction)
CREATE TABLE blog_post_tags (
    post_id     INTEGER NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
    tag_id      INTEGER NOT NULL REFERENCES blog_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, tag_id)
);

-- Indexes
CREATE INDEX idx_blog_posts_category    ON blog_posts(category_id);
CREATE INDEX idx_blog_posts_status      ON blog_posts(status);
CREATE INDEX idx_blog_posts_published   ON blog_posts(published_at);
CREATE INDEX idx_blog_posts_featured    ON blog_posts(is_featured);
CREATE INDEX idx_blog_posts_slug        ON blog_posts(slug);
CREATE INDEX idx_blog_post_tags_post    ON blog_post_tags(post_id);
CREATE INDEX idx_blog_post_tags_tag     ON blog_post_tags(tag_id);
CREATE INDEX idx_blog_categories_slug   ON blog_categories(slug);
