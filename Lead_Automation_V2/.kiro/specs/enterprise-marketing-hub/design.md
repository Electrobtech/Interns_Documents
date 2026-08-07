# Enterprise Marketing Hub — Design Document

## Overview

This design transforms the existing Marketing Hub frontend from a collection of 15 placeholder pages into a fully functional enterprise marketing platform comparable to Meta Ads Manager, HubSpot Marketing Hub, and Salesforce Marketing Cloud.

The transformation focuses on five priority modules:
1. **Campaigns** - Most complex module with full campaign lifecycle management
2. **Audience** - Advanced segmentation and targeting capabilities  
3. **Broadcasts** - Multi-channel messaging orchestration
4. **Content Studio** - AI-powered content generation and management
5. **Settings** - Role-based access control and platform configuration

## Architecture

### Frontend Architecture
- **React Component Structure**: Modular page-based architecture with shared UI components
- **State Management**: Zustand for client state, React Query for server state
- **UI Framework**: Tailwind CSS with existing design tokens, Lucide React icons
- **Form Handling**: React Hook Form with Zod validation
- **Real-time Updates**: WebSocket/SSE integration for live metrics
- **Routing**: Client-side routing within Marketing Hub shell

### Backend Architecture
- **API Layer**: FastAPI with RESTful endpoints (/api/v1/marketing/)
- **Authentication**: JWT-based auth with role-based permissions
- **Database**: PostgreSQL with multi-tenant support (org_id, workspace_id)
- **Background Processing**: Celery with Redis for async campaign operations
- **Audit System**: Comprehensive activity logging for compliance
- **Notification System**: Real-time notifications via WebSocket

### Data Flow
```
Frontend Components → React Query → REST APIs → FastAPI Services → Database
                                     ↓
Background Workers ← Celery Tasks ← Redis Queue ← API Triggers
```

## Components and Interfaces

### Core Frontend Components

#### Universal Table Component (`MHDataTable`)
Implements all cross-cutting table requirements (CCR-1):
- Server-side pagination, filtering, sorting
- Bulk selection and actions
- Column management (show/hide, reorder, resize)
- Export capabilities (CSV, XLSX, JSON)
- Keyboard navigation and accessibility

```typescript
interface MHDataTableProps<T> {
  columns: MHColumn<T>[];
  data: T[];
  loading: boolean;
  pagination: PaginationState;
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  onSort: (sort: SortState) => void;
  onRowClick: (item: T) => void;
  bulkActions: BulkAction<T>[];
  exportConfig: ExportConfig;
}
```

#### Universal Detail Drawer (`MHDetailDrawer`)
Implements cross-cutting drawer requirements (CCR-2):
- Multi-tab interface (Overview, Activity, Comments, History, Related)
- Edit mode toggle with form validation
- Activity timeline with audit trail
- Threaded comments with @mentions

```typescript
interface MHDetailDrawerProps<T> {
  entity: T;
  entityType: string;
  isOpen: boolean;
  onClose: () => void;
  tabs: DrawerTab[];
  permissions: EntityPermissions;
}
```

#### Universal Modal/Wizard (`MHModal`)
Implements cross-cutting modal requirements (CCR-3):
- Auto-save drafts to localStorage
- Step-by-step validation for wizards
- Unsaved changes warning
- Loading states and error handling

### Core Backend Services

#### Campaign Service (`CampaignService`)
Handles campaign lifecycle management:
- Campaign CRUD operations with status transitions
- Budget management and spending tracking
- Performance metrics calculation
- A/B test variant management
- Automated optimization triggers

```python
class CampaignService:
    async def create_campaign(
        self, 
        campaign_data: CampaignCreate, 
        user_id: UUID,
        workspace_id: UUID
    ) -> Campaign
    
    async def update_campaign_status(
        self,
        campaign_id: UUID,
        status: CampaignStatus,
        user_id: UUID
    ) -> Campaign
    
    async def calculate_metrics(
        self,
        campaign_id: UUID,
        date_range: DateRange
    ) -> CampaignMetrics
```

#### Audience Service (`AudienceService`)
Manages audience segmentation and targeting:
- Dynamic segment creation with SQL query generation
- Real-time audience size estimation
- Audience overlap analysis
- Export capabilities for external platforms

```python
class AudienceService:
    async def create_segment(
        self,
        criteria: SegmentCriteria,
        workspace_id: UUID
    ) -> AudienceSegment
    
    async def estimate_size(
        self,
        criteria: SegmentCriteria
    ) -> int
    
    async def calculate_overlap(
        self,
        segment_ids: List[UUID]
    ) -> OverlapAnalysis
```

#### Broadcast Service (`BroadcastService`)
Orchestrates multi-channel message delivery:
- Template-based message creation
- Schedule management with timezone support
- Delivery tracking and analytics
- Channel-specific optimization

#### Audit Service (`AuditService`)
Provides comprehensive activity logging:
- All state changes tracked with before/after snapshots
- User action attribution
- Compliance reporting
- Activity timeline generation

### Database Schema

#### Core Entity Tables

**Campaigns Table**
```sql
CREATE TABLE marketing_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    workspace_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    type campaign_type NOT NULL,
    status campaign_status DEFAULT 'draft',
    objective campaign_objective NOT NULL,
    budget_total DECIMAL(15,2),
    budget_daily DECIMAL(15,2),
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    target_audience_id UUID REFERENCES audience_segments(id),
    settings JSONB DEFAULT '{}',
    metrics JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    updated_by UUID NOT NULL REFERENCES users(id),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES users(id),
    version INTEGER DEFAULT 1
);
```

**Audience Segments Table**
```sql
CREATE TABLE audience_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    workspace_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    criteria JSONB NOT NULL,
    estimated_size INTEGER,
    actual_size INTEGER,
    last_calculated_at TIMESTAMPTZ,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    is_dynamic BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    updated_by UUID NOT NULL REFERENCES users(id),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES users(id),
    version INTEGER DEFAULT 1
);
```

**Broadcasts Table**
```sql
CREATE TABLE marketing_broadcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    workspace_id UUID NOT NULL,
    campaign_id UUID REFERENCES marketing_campaigns(id),
    name VARCHAR(255) NOT NULL,
    type broadcast_type NOT NULL,
    channel broadcast_channel NOT NULL,
    status broadcast_status DEFAULT 'draft',
    template_id UUID REFERENCES content_templates(id),
    content JSONB NOT NULL,
    audience_segment_id UUID REFERENCES audience_segments(id),
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    metrics JSONB DEFAULT '{}',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    updated_by UUID NOT NULL REFERENCES users(id),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES users(id),
    version INTEGER DEFAULT 1
);
```

#### Audit Table
```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    workspace_id UUID NOT NULL,
    actor_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID NOT NULL,
    before_state JSONB,
    after_state JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### API Contracts

#### Campaign Management API

**Create Campaign**
```http
POST /api/v1/marketing/campaigns
Content-Type: application/json
Authorization: Bearer {jwt_token}

{
  "name": "Q4 AI Bootcamp Launch",
  "type": "awareness",
  "objective": "conversions",
  "budget_total": 50000.00,
  "budget_daily": 2000.00,
  "start_date": "2024-01-15T00:00:00Z",
  "end_date": "2024-01-31T23:59:59Z",
  "target_audience_id": "uuid",
  "settings": {
    "bidding_strategy": "maximize_conversions",
    "ad_scheduling": {...}
  }
}
```

**Response**
```http
HTTP/201 Created
{
  "id": "uuid",
  "name": "Q4 AI Bootcamp Launch",
  "status": "draft",
  "created_at": "2024-01-01T10:00:00Z",
  "metrics": {
    "impressions": 0,
    "clicks": 0,
    "conversions": 0,
    "spend": 0.00
  }
}
```

**List Campaigns with Filters**
```http
GET /api/v1/marketing/campaigns?status=active&type=awareness&page=1&limit=25&sort=created_at:desc
```

#### Audience Management API

**Create Audience Segment**
```http
POST /api/v1/marketing/audience-segments
{
  "name": "High-Intent Q4 Prospects",
  "description": "Users who visited pricing page in last 30 days",
  "criteria": {
    "rules": [
      {
        "field": "page_url",
        "operator": "contains",
        "value": "/pricing",
        "timeframe": {"days": 30}
      }
    ]
  },
  "is_dynamic": true
}
```

### Real-time Updates

#### WebSocket Events
- Campaign status changes
- Live metric updates (impressions, clicks, conversions)
- Budget alerts and notifications
- Comment mentions and activity

```javascript
const ws = new WebSocket('/ws/marketing');
ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  switch (update.type) {
    case 'campaign_status_change':
      updateCampaignInUI(update.campaign_id, update.status);
      break;
    case 'metric_update':
      updateMetrics(update.entity_id, update.metrics);
      break;
  }
};
```

## Data Models

### Campaign Data Model
```typescript
interface Campaign {
  id: string;
  name: string;
  type: 'awareness' | 'consideration' | 'conversion' | 'retention';
  status: 'draft' | 'pending' | 'active' | 'paused' | 'completed' | 'archived';
  objective: CampaignObjective;
  budget: {
    total: number;
    daily: number;
    spent: number;
    remaining: number;
  };
  dates: {
    start: Date;
    end: Date;
    created: Date;
    updated: Date;
  };
  targetAudience: AudienceSegment;
  metrics: CampaignMetrics;
  settings: CampaignSettings;
  createdBy: User;
  updatedBy: User;
}
```

### Audience Segment Data Model
```typescript
interface AudienceSegment {
  id: string;
  name: string;
  description: string;
  criteria: SegmentCriteria;
  size: {
    estimated: number;
    actual: number;
    lastCalculated: Date;
  };
  isDynamic: boolean;
  tags: string[];
  campaigns: Campaign[];
  createdBy: User;
  updatedBy: User;
}

interface SegmentCriteria {
  rules: SegmentRule[];
  operator: 'AND' | 'OR';
}

interface SegmentRule {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  value: any;
  timeframe?: {
    days?: number;
    start?: Date;
    end?: Date;
  };
}
```

### Broadcast Data Model
```typescript
interface Broadcast {
  id: string;
  name: string;
  type: 'one_time' | 'recurring' | 'drip_sequence';
  channel: 'whatsapp' | 'email' | 'sms' | 'push';
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  content: BroadcastContent;
  audience: AudienceSegment;
  schedule: BroadcastSchedule;
  metrics: BroadcastMetrics;
  campaign?: Campaign;
  template?: ContentTemplate;
}
```

## Error Handling

### API Error Responses
Standardized error format across all endpoints:

```typescript
interface APIError {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    trace_id?: string;
  };
}
```

### Common Error Scenarios
- **Validation Errors**: 400 Bad Request with field-specific messages
- **Permission Errors**: 403 Forbidden with role requirements
- **Not Found Errors**: 404 Not Found with entity type and ID
- **Rate Limiting**: 429 Too Many Requests with retry-after header
- **Server Errors**: 500 Internal Server Error with trace ID for debugging

### Frontend Error Handling
- Toast notifications for user-facing errors
- Retry mechanisms for transient failures
- Graceful degradation when services unavailable
- Error boundaries for component isolation

## Testing Strategy

### Frontend Testing
- **Component Tests**: Jest + React Testing Library for UI components
- **Integration Tests**: Cypress for end-to-end workflow testing
- **Visual Tests**: Chromatic for design system regression testing

### Backend Testing
- **Unit Tests**: pytest for service logic and utilities
- **API Tests**: pytest with TestClient for endpoint testing
- **Database Tests**: pytest-postgresql for data layer testing
- **Load Tests**: Locust for performance validation

### Test Data Management
- **Factories**: Factory pattern for generating test data
- **Fixtures**: Common test scenarios and mock data
- **Isolation**: Database transactions for test isolation

## Security Considerations

### Authentication & Authorization
- JWT tokens with short expiry and refresh capability
- Role-based access control with granular permissions
- API key authentication for external integrations

### Data Protection
- Row-level security with org_id and workspace_id filtering
- Encryption at rest for sensitive campaign data
- GDPR compliance with data retention policies

### Input Validation
- Zod schemas for frontend validation
- Pydantic models for backend validation
- SQL injection prevention with parameterized queries

### Audit & Compliance
- Complete audit trail for all marketing activities
- Data export capabilities for compliance reporting
- User consent tracking for marketing communications

## Performance Optimization

### Frontend Performance
- Code splitting by module for faster load times
- Virtualized tables for large datasets (1000+ rows)
- Image optimization with lazy loading
- Service worker for offline capability

### Backend Performance
- Database indexes on frequently queried fields
- Redis caching for expensive calculations
- Connection pooling for database efficiency
- Background job processing for heavy operations

### API Performance
- Response pagination with cursor-based navigation
- Field selection to minimize payload size
- ETags for conditional requests
- Rate limiting to prevent abuse

## Deployment Strategy

### Infrastructure Requirements
- **Database**: PostgreSQL 14+ with pgvector extension
- **Cache**: Redis 6+ for session storage and job queue
- **Queue**: Celery with Redis broker for background tasks
- **Storage**: S3-compatible storage for assets and exports

### Monitoring & Observability
- Structured logging with correlation IDs
- APM integration (New Relic/DataDog) for performance monitoring
- Health checks for all services
- Error tracking with Sentry integration

### Scaling Considerations
- Horizontal scaling of API servers
- Database read replicas for reporting queries
- CDN for static asset delivery
- Queue workers scaling based on job backlog