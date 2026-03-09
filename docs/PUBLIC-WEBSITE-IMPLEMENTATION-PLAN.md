# Kufuor Scholars — Public Website Implementation Plan

## Overview

Add a **public brand website layer** on top of the existing application portal. The portal (`/applicant`, `/director`, auth) remains **unchanged**. New work is additive only.

---

## Current vs Target Structure

### Current (unchanged)
| Route | Purpose |
|-------|---------|
| `/` | Homepage (landing) |
| `/news` | News (static data) |
| `/news/[slug]` | Article detail |
| `/applicant` | Applicant dashboard |
| `/applicant/application` | Application form |
| `/applicant/messages` | Messages |
| `/applicant/news` | Applicant news |
| `/applicant/profile` | Profile |
| `/director/*` | Director dashboard |
| `/login`, `/register`, `/director-signup` | Auth |

### Target Public Website (new)
| Route | Purpose |
|-------|---------|
| `/` or `/home` | Enhanced homepage |
| `/about` | About the program |
| `/program` | Program details |
| `/scholars` | Scholar directory |
| `/scholars/[year]/[slug]` | Scholar profile |
| `/projects` | Scholar-led projects |
| `/projects/[slug]` | Project detail |
| `/alumni` | Alumni outcomes |
| `/news` | News (enhance existing) |
| `/news/[slug]` | Article (enhance existing) |
| `/events` | Upcoming events |
| `/events/[slug]` | Event detail |
| `/faq` | FAQ |
| `/apply` | Application prep page → links to `/register` |

### Portal (unchanged)
| Route | Purpose |
|-------|---------|
| `/applicant` | Dashboard |
| `/applicant/application` | Application form |
| `/director/*` | Director tools |

---

## Phase 1: Foundation & Data Model

### 1.1 Database Migrations

**New tables (Supabase):**

```
scholars
  - id, user_id (nullable), full_name, slug, cohort_year, university, field_of_study
  - bio, leadership_interests, projects_summary, achievements, linkedin_url
  - photo_url, is_featured, is_alumni, created_at, updated_at

projects
  - id, scholar_id, title, slug, description, impact_metrics (jsonb)
  - location, year, photo_urls (array), created_at

events
  - id, title, slug, description, event_date, event_time, location
  - photo_url, created_at

news_articles (or extend announcements)
  - id, title, slug, featured_image, author, published_at, tags (array), body
  - (May reuse/enhance announcements table)
```

### 1.2 Shared Layout & Nav

- **Public layout**: New `app/(public)/layout.js` with shared Navbar + Footer for `/`, `/about`, `/program`, `/scholars`, `/projects`, `/alumni`, `/news`, `/events`, `/faq`, `/apply`
- **Navbar**: Links to About, Program, Scholars, Projects, Alumni, News, Events, FAQ, Apply Now
- **Apply Now** → `/apply` (prep page) → `/register` (existing)

---

## Phase 2: Homepage Enhancement

### 2.1 Hero Section
- Large headline (leadership mission)
- Subtext (fellowship intro)
- CTAs: Apply Now | Meet Our Scholars

### 2.2 Program Highlights
- Leadership training, Mentorship, Community impact, Scholar network
- (Enhance existing `ProgramHighlights`)

### 2.3 Impact Metrics (animated counters)
- Total scholars trained
- Universities represented
- Community projects
- Youth impacted
- (Enhance existing `Stats` with animation)

### 2.4 Scholar Spotlight
- Rotating cards: photo, university, field, quote
- Pull from `scholars` where `is_featured = true`

### 2.5 Latest News
- Pull from `/news` or announcements
- (Enhance existing `News` section)

### 2.6 Events Section
- Upcoming events from `events` table

### 2.7 Application Status Banner
- Keep existing: Applications Open/Closed + countdown
- (Already implemented)

---

## Phase 3: Public Pages

### 3.1 `/about`
- Program story, mission, vision
- Leadership focus
- Static content + optional CMS

### 3.2 `/program`
- Program structure
- Leadership training, mentorship, network
- Eligibility overview

### 3.3 `/scholars`
- Grid of scholar cards
- Filters: cohort year, university
- Search by name

### 3.4 `/scholars/[year]/[slug]`
- Profile photo, university, field
- Bio, leadership interests, projects, achievements
- LinkedIn link

### 3.5 `/projects`
- Grid of project cards
- Filter by year, scholar

### 3.6 `/projects/[slug]`
- Title, scholar lead, description
- Impact metrics, photos, location, year

### 3.7 `/alumni`
- Alumni outcomes: entrepreneurs, researchers, leaders, innovators
- Directory + stories

### 3.8 `/events`
- Upcoming events list
- Leadership camps, summits, seminars

### 3.9 `/events/[slug]`
- Title, date, time, location
- Description, photos

### 3.10 `/faq`
- Who can apply? What does the program offer? How competitive? Timeline?
- Accordion or list

### 3.11 `/apply`
- Eligibility requirements
- Application timeline
- Tips for strong application
- Scholar testimonials
- CTA → `/register` (existing)

---

## Phase 4: News System Enhancement

- Migrate from `lib/news-data` to Supabase (or new `news_articles` table)
- Director can create articles
- Featured image, author, date, tags, share buttons
- Keep `/news` and `/news/[slug]` routes; swap data source

---

## Phase 5: Director Admin Extensions

**New director pages (additive, no changes to existing):**

- `/director/scholars` — Manage scholar directory entries
- `/director/projects` — Manage projects
- `/director/news` — Manage news articles (or extend announcements)
- `/director/events` — Manage events
- `/director/alumni` — Manage alumni profiles

---

## Phase 6: SEO & Polish

- Metadata: title, description, Open Graph per page
- Semantic headings (h1, h2, h3)
- Performance: image optimization, lazy loading
- Animations: subtle transitions, card hover states

---

## Implementation Order

| # | Task | Depends On |
|---|------|------------|
| 1 | DB migrations (scholars, projects, events) | — |
| 2 | Public layout + Navbar/Footer updates | — |
| 3 | `/about`, `/program` (static) | 2 |
| 4 | `/apply` prep page | 2 |
| 5 | Homepage enhancements | 2, 1 |
| 6 | `/scholars` + `/scholars/[year]/[slug]` | 1, 2 |
| 7 | `/projects` + `/projects/[slug]` | 1, 2 |
| 8 | `/alumni` | 1, 2 |
| 9 | `/events` + `/events/[slug]` | 1, 2 |
| 10 | `/faq` | 2 |
| 11 | News system (DB + director UI) | 1 |
| 12 | Director admin (scholars, projects, events, alumni) | 1 |
| 13 | SEO metadata | All pages |

---

## Constraints (Must Not Change)

- Multi-step application form
- Document uploads and storage
- Application status workflow
- Applicant dashboard
- Director dashboard (existing features)
- Interview scheduling
- Messaging system
- Application open/close controls
- Authentication system
- Middleware (protected routes)

---

## Apply Flow

```
Apply Now (navbar) → /apply (prep) → /register (existing) → /applicant/application
```

No changes to `/register` or `/applicant/application`.
