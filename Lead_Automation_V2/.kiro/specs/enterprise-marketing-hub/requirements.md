# Enterprise Marketing Hub — Requirements

## Overview

Transform the existing Marketing Hub frontend (15 pages with placeholder buttons) into a fully functional enterprise marketing platform at the level of Meta Ads Manager, HubSpot Marketing Hub, Salesforce Marketing Cloud, and Adobe Experience Cloud.

## Scope

This project converts every button, modal, form, drawer, table action, filter, and menu across all 15 Marketing Hub pages into production-grade features with:
- Complete frontend interaction flows
- Real backend API contracts
- Enterprise database schemas
- Background processing workers
- Role-based access control
- Audit logging and activity timelines
- Real-time notifications
- Analytics tracking

## Module Requirements Files

Each module has its own detailed requirements file:

| # | Module | File | Status |
|---|--------|------|--------|
| 1 | Campaigns | [01-campaigns.md](./01-campaigns.md) | Defined |
| 2 | Broadcasts | [02-broadcasts.md](./02-broadcasts.md) | Defined |
| 3 | Audience | [03-audience.md](./03-audience.md) | Defined |
| 4 | Content Studio | [04-content-studio.md](./04-content-studio.md) | Defined |
| 5 | Templates | [05-templates.md](./05-templates.md) | Defined |
| 6 | Assets Library | [06-assets-library.md](./06-assets-library.md) | Defined |
| 7 | SEO | [07-seo.md](./07-seo.md) | Defined |
| 8 | AEO | [08-aeo.md](./08-aeo.md) | Defined |
| 9 | Competitor Analysis | [09-competitor-analysis.md](./09-competitor-analysis.md) | Defined |
| 10 | Marketing Calendar | [10-marketing-calendar.md](./10-marketing-calendar.md) | Defined |
| 11 | Analytics | [11-analytics.md](./11-analytics.md) | Defined |
| 12 | Reports | [12-reports.md](./12-reports.md) | Defined |
| 13 | Knowledge Base | [13-knowledge-base.md](./13-knowledge-base.md) | Defined |
| 14 | Settings | [14-settings.md](./14-settings.md) | Defined |
| 15 | Dashboard | [00-dashboard.md](./00-dashboard.md) | Defined |

## Cross-Cutting Requirements

### CCR-1: Universal Enterprise Table Features
Every data table across all modules MUST support:
- **REQ-CCR-1.1** Column-level search with debounce (300ms)
- **REQ-CCR-1.2** Advanced filter panel (multi-field, date ranges, select dropdowns, range sliders)
- **REQ-CCR-1.3** Saved filter views with names, shareable URLs
- **REQ-CCR-1.4** Bulk selection via checkbox (individual + select all on page + select all matching)
- **REQ-CCR-1.5** Bulk actions menu (edit, delete, archive, export, tag, assign, move)
- **REQ-CCR-1.6** Server-side pagination (10/25/50/100 rows per page)
- **REQ-CCR-1.7** Multi-column sort with visual indicators
- **REQ-CCR-1.8** Column visibility toggle (show/hide)
- **REQ-CCR-1.9** Column reordering via drag-and-drop
- **REQ-CCR-1.10** Column width persistence in localStorage
- **REQ-CCR-1.11** Row-level action menu (⋮) with contextual actions
- **REQ-CCR-1.12** Click row to open detail drawer (not navigate away)
- **REQ-CCR-1.13** Keyboard navigation (arrow keys, Enter to open, Escape to close)
- **REQ-CCR-1.14** Export selected rows or full filtered set (CSV, XLSX, JSON)
- **REQ-CCR-1.15** Empty state with contextual CTA when no data matches filters
- **REQ-CCR-1.16** Loading skeleton that mirrors table structure
- **REQ-CCR-1.17** Error state with retry button
- **REQ-CCR-1.18** Inline editing for key fields (click to edit, Enter to save, Escape to cancel)
- **REQ-CCR-1.19** Sticky header on scroll
- **REQ-CCR-1.20** Row count and selection count in footer

### CCR-2: Universal Drawer/Detail Panel
Every entity detail drawer MUST include:
- **REQ-CCR-2.1** Overview tab: all key fields, status, timestamps
- **REQ-CCR-2.2** Activity tab: chronological audit log with actor, action, diff
- **REQ-CCR-2.3** Comments tab: threaded comments with @mentions
- **REQ-CCR-2.4** History tab: version history with restore capability
- **REQ-CCR-2.5** Related tab: linked campaigns, audiences, assets, etc.
- **REQ-CCR-2.6** Edit mode toggle (view → edit → save/cancel)
- **REQ-CCR-2.7** Share link (copy permalink to entity)
- **REQ-CCR-2.8** Favorite/bookmark toggle
- **REQ-CCR-2.9** Tags editor (add/remove inline tags)
- **REQ-CCR-2.10** Quick status change dropdown
- **REQ-CCR-2.11** Full-screen expand button
- **REQ-CCR-2.12** Keyboard shortcut to close (Escape)

### CCR-3: Universal Modal/Wizard Standards
All creation/edit modals MUST:
- **REQ-CCR-3.1** Auto-save draft to localStorage every 30 seconds
- **REQ-CCR-3.2** Warn before closing if unsaved changes exist
- **REQ-CCR-3.3** Show validation errors inline below each field
- **REQ-CCR-3.4** Disable submit button until all required fields are valid
- **REQ-CCR-3.5** Show character count for text fields with limits
- **REQ-CCR-3.6** Show loading spinner on submit button during API call
- **REQ-CCR-3.7** Show success toast and close modal on success
- **REQ-CCR-3.8** Show error toast and keep modal open on failure
- **REQ-CCR-3.9** Support Tab/Shift+Tab navigation between fields
- **REQ-CCR-3.10** For multi-step wizards: show step progress bar, allow back navigation, validate each step before advancing

### CCR-4: Role-Based Access Control
- **REQ-CCR-4.1** Roles: Super Admin, Admin, Marketing Manager, Campaign Specialist, Content Creator, Analyst, Viewer
- **REQ-CCR-4.2** All create/edit/delete actions check permissions before rendering buttons
- **REQ-CCR-4.3** API returns 403 for unauthorized actions
- **REQ-CCR-4.4** UI hides buttons user doesn't have permission to click
- **REQ-CCR-4.5** Permission check format: `{module}.{resource}.{action}` e.g. `marketing.campaigns.create`

### CCR-5: Audit Logging
Every state-changing action MUST write an audit log entry with:
- **REQ-CCR-5.1** actor_id (user who performed action)
- **REQ-CCR-5.2** action (CREATE, UPDATE, DELETE, ARCHIVE, PUBLISH, etc.)
- **REQ-CCR-5.3** resource_type (campaign, audience, broadcast, etc.)
- **REQ-CCR-5.4** resource_id
- **REQ-CCR-5.5** before_state (JSON snapshot)
- **REQ-CCR-5.6** after_state (JSON snapshot)
- **REQ-CCR-5.7** ip_address
- **REQ-CCR-5.8** user_agent
- **REQ-CCR-5.9** timestamp
- **REQ-CCR-5.10** workspace_id / org_id

### CCR-6: Notification System
- **REQ-CCR-6.1** In-app notification bell with unread count badge
- **REQ-CCR-6.2** Notification types: info, success, warning, error, approval_request
- **REQ-CCR-6.3** Each notification links to relevant entity
- **REQ-CCR-6.4** Batch notifications for bulk operations
- **REQ-CCR-6.5** Email notifications for critical events (campaign failures, approval requests, budget alerts)
- **REQ-CCR-6.6** Per-user notification preferences

### CCR-7: Real-Time Updates
- **REQ-CCR-7.1** WebSocket or SSE connection for live metric updates
- **REQ-CCR-7.2** Campaign status changes broadcast to all connected clients
- **REQ-CCR-7.3** New comments/mentions trigger real-time notifications
- **REQ-CCR-7.4** Optimistic UI updates with rollback on failure
- **REQ-CCR-7.5** Connection indicator (green/red dot) in header

### CCR-8: Performance Standards
- **REQ-CCR-8.1** Initial page load < 2 seconds
- **REQ-CCR-8.2** Table data fetch < 500ms for up to 10,000 records
- **REQ-CCR-8.3** API response time < 200ms for read operations, < 500ms for writes
- **REQ-CCR-8.4** Infinite scroll or pagination for lists > 50 items
- **REQ-CCR-8.5** Virtualized table rows for 1000+ item lists
- **REQ-CCR-8.6** Images lazy-loaded with blur placeholder
- **REQ-CCR-8.7** API responses cached with stale-while-revalidate pattern

## Global Database Requirements

### Tenancy Model
All tables include:
- `org_id` UUID NOT NULL — Organization isolation
- `workspace_id` UUID NOT NULL — Sub-org workspace isolation

### Soft Delete
All entity tables include:
- `deleted_at` TIMESTAMPTZ — NULL means active, non-NULL means soft-deleted
- `deleted_by` UUID FK users — Who deleted it

### Audit Columns
All tables include:
- `created_at` TIMESTAMPTZ DEFAULT NOW()
- `updated_at` TIMESTAMPTZ DEFAULT NOW()
- `created_by` UUID FK users
- `updated_by` UUID FK users
- `version` INTEGER DEFAULT 1 — Optimistic concurrency

### Standard Indexes
All tables include:
- Primary key on `id` (UUID)
- Index on `org_id, workspace_id`
- Index on `deleted_at` (partial: WHERE deleted_at IS NULL)
- Index on `created_at`
- Index on foreign key columns

## Technology Stack Constraints

### Frontend
- React with hooks (existing stack — do NOT replace)
- Tailwind CSS or existing CSS variables (match existing patterns)
- Lucide React icons (existing — do NOT change icon library)
- Recharts (existing — do NOT change chart library)
- React Query or SWR for server state
- Zustand for client state management
- React Hook Form + Zod for form validation

### Backend
- Python FastAPI (existing ai-agent-backend stack)
- PostgreSQL with SQLAlchemy ORM
- Alembic for migrations
- Redis for caching and job queues
- Celery for background task processing
- JWT authentication (existing)

### Infrastructure
- RESTful API design with versioning (/api/v1/)
- OpenAPI/Swagger documentation
- Rate limiting per workspace/user
- Structured logging (JSON)
- Health check endpoints
