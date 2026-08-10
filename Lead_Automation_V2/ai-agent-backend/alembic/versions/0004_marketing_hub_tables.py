"""Marketing Hub Tables

Revision ID: 0004
Revises: 0003
Create Date: 2024-12-07 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import inspect as sa_inspect

# revision identifiers, used by Alembic.
revision = '0007'
down_revision = '0006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create ENUM types (IF NOT EXISTS pattern using DO block to avoid
    # DuplicateObjectError when schema.sql already ran these ENUMs)
    for stmt in [
        "CREATE TYPE channeltype AS ENUM ('whatsapp', 'email', 'sms', 'messenger', 'instagram', 'linkedin')",
        "CREATE TYPE campaignstatus AS ENUM ('draft', 'scheduled', 'queued', 'processing', 'completed', 'failed', 'paused', 'archived')",
        "CREATE TYPE broadcaststatus AS ENUM ('draft', 'scheduled', 'sending', 'sent', 'paused', 'failed')",
        "CREATE TYPE assettype AS ENUM ('image', 'video', 'audio', 'document', 'template', 'other')",
        "CREATE TYPE contenttype AS ENUM ('post', 'email', 'ad', 'blog', 'social', 'video', 'image')",
        "CREATE TYPE eventtype AS ENUM ('campaign', 'launch', 'deadline', 'meeting', 'content_creation', 'review', 'social_post')",
        "CREATE TYPE eventstatus AS ENUM ('draft', 'scheduled', 'active', 'completed', 'cancelled')",
        "CREATE TYPE reporttype AS ENUM ('campaign_performance', 'channel_analysis', 'audience_insights', 'roi_analysis', 'engagement_summary', 'conversion_funnel', 'comprehensive')",
        "CREATE TYPE reportstatus AS ENUM ('pending', 'processing', 'completed', 'failed')",
    ]:
        op.execute(f"""
DO $$ BEGIN
  {stmt};
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
""")

    # Guard: skip table creation if tables already exist (schema.sql may have created them)
    inspector = sa_inspect(op.get_bind())
    existing_tables = set(inspector.get_table_names())

    # Marketing Campaigns/Broadcasts (unified table)
    if 'mh_campaigns' not in existing_tables:
        op.create_table(
            'mh_campaigns',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=sa.text('gen_random_uuid()')),
            sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column('kind', sa.String(50), nullable=False, comment='campaign or broadcast'),
            sa.Column('name', sa.String(255), nullable=False),
            sa.Column('channel', postgresql.ENUM('whatsapp', 'email', 'sms', 'messenger', 'instagram', 'linkedin', name='channeltype', create_type=False), nullable=False),
            sa.Column('objective', sa.String(100), nullable=True),
            sa.Column('audience_id', postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column('message_body', sa.Text, nullable=True),
            sa.Column('budget_amount', sa.Numeric(12, 2), nullable=True),
            sa.Column('status', postgresql.ENUM('draft', 'scheduled', 'queued', 'processing', 'completed', 'failed', 'paused', 'archived', name='campaignstatus', create_type=False), default='draft'),
            sa.Column('scheduled_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('start_date', sa.Date, nullable=True),
            sa.Column('end_date', sa.Date, nullable=True),
            sa.Column('total_recipients', sa.Integer, default=0),
            sa.Column('sent_count', sa.Integer, default=0),
            sa.Column('delivered_count', sa.Integer, default=0),
            sa.Column('read_count', sa.Integer, default=0),
            sa.Column('replied_count', sa.Integer, default=0),
            sa.Column('failed_count', sa.Integer, default=0),
            sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now())
        )
        op.create_index('ix_mh_campaigns_org_id', 'mh_campaigns', ['organization_id'])
        op.create_index('ix_mh_campaigns_status', 'mh_campaigns', ['status'])
        op.create_index('ix_mh_campaigns_kind', 'mh_campaigns', ['kind'])
        op.create_index('ix_mh_campaigns_channel', 'mh_campaigns', ['channel'])

    # Marketing Audiences
    if 'mh_audiences' not in existing_tables:
        op.create_table(
            'mh_audiences',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=sa.text('gen_random_uuid()')),
            sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column('name', sa.String(255), nullable=False),
            sa.Column('source', sa.String(100), default='custom'),
            sa.Column('filter', postgresql.JSONB, default={}),
            sa.Column('size_cached', sa.Integer, nullable=True),
            sa.Column('size_computed_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('status', sa.String(50), default='active'),
            sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now())
        )
        op.create_index('ix_mh_audiences_org_id', 'mh_audiences', ['organization_id'])

    # Marketing Recipients (for tracking campaign/broadcast sends)
    if 'mh_recipients' not in existing_tables:
        op.create_table(
            'mh_recipients',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=sa.text('gen_random_uuid()')),
            sa.Column('campaign_id', postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column('contact_id', postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column('channel', sa.String(50), nullable=False),
            sa.Column('destination', sa.String(255), nullable=False, comment='phone/email/handle'),
            sa.Column('display_name', sa.String(255), nullable=True),
            sa.Column('rendered_message', sa.Text, nullable=True),
            sa.Column('status', sa.String(50), default='queued'),
            sa.Column('attempts', sa.Integer, default=0),
            sa.Column('error', sa.Text, nullable=True),
            sa.Column('job_id', sa.String(255), nullable=True),
            sa.Column('provider_message_id', sa.String(255), nullable=True),
            sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('delivered_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('replied_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now())
        )
        op.create_index('ix_mh_recipients_campaign_id', 'mh_recipients', ['campaign_id'])
        op.create_index('ix_mh_recipients_status', 'mh_recipients', ['status'])

    # Marketing Assets
    if 'marketing_assets' not in existing_tables:
        op.create_table(
            'marketing_assets',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=sa.text('gen_random_uuid()')),
            sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column('name', sa.String(255), nullable=False),
            sa.Column('filename', sa.String(255), nullable=False),
            sa.Column('file_path', sa.String(500), nullable=False),
            sa.Column('file_size', sa.Integer, nullable=False),
            sa.Column('mime_type', sa.String(100), nullable=False),
            sa.Column('asset_type', postgresql.ENUM('image', 'video', 'audio', 'document', 'template', 'other', name='assettype', create_type=False), nullable=False),
            sa.Column('file_hash', sa.String(64), nullable=False),
            sa.Column('tags', postgresql.ARRAY(sa.String), default=[]),
            sa.Column('metadata', postgresql.JSONB, default={}),
            sa.Column('is_public', sa.Boolean, default=False),
            sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now())
        )
        op.create_index('ix_marketing_assets_org_id', 'marketing_assets', ['organization_id'])
        op.create_index('ix_marketing_assets_type', 'marketing_assets', ['asset_type'])

    # Marketing Templates
    if 'marketing_templates' not in existing_tables:
        op.create_table(
            'marketing_templates',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=sa.text('gen_random_uuid()')),
            sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column('name', sa.String(255), nullable=False),
            sa.Column('category', sa.String(100), nullable=False),
            sa.Column('channel', postgresql.ENUM('whatsapp', 'email', 'sms', 'messenger', 'instagram', 'linkedin', name='channeltype', create_type=False), nullable=False),
            sa.Column('content', postgresql.JSONB, nullable=False),
            sa.Column('preview_data', postgresql.JSONB, nullable=True),
            sa.Column('is_public', sa.Boolean, default=False),
            sa.Column('tags', postgresql.ARRAY(sa.String), default=[]),
            sa.Column('usage_count', sa.Integer, default=0),
            sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now())
        )
        op.create_index('ix_marketing_templates_org_id', 'marketing_templates', ['organization_id'])
        op.create_index('ix_marketing_templates_channel', 'marketing_templates', ['channel'])

    # Marketing Content
    if 'marketing_content' not in existing_tables:
        op.create_table(
            'marketing_content',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=sa.text('gen_random_uuid()')),
            sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column('name', sa.String(255), nullable=False),
            sa.Column('content_type', postgresql.ENUM('post', 'email', 'ad', 'blog', 'social', 'video', 'image', name='contenttype', create_type=False), nullable=False),
            sa.Column('channel', postgresql.ENUM('whatsapp', 'email', 'sms', 'messenger', 'instagram', 'linkedin', name='channeltype', create_type=False), nullable=True),
            sa.Column('content', postgresql.JSONB, nullable=False),
            sa.Column('status', sa.String(50), default='draft'),
            sa.Column('scheduled_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('tags', postgresql.ARRAY(sa.String), default=[]),
            sa.Column('performance_data', postgresql.JSONB, default={}),
            sa.Column('ai_generated', sa.Boolean, default=False),
            sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now())
        )
        op.create_index('ix_marketing_content_org_id', 'marketing_content', ['organization_id'])

    # Marketing Calendar Events
    if 'marketing_calendar_events' not in existing_tables:
        op.create_table(
            'marketing_calendar_events',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=sa.text('gen_random_uuid()')),
            sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column('title', sa.String(255), nullable=False),
            sa.Column('description', sa.Text, nullable=True),
            sa.Column('event_type', postgresql.ENUM('campaign', 'launch', 'deadline', 'meeting', 'content_creation', 'review', 'social_post', name='eventtype', create_type=False), nullable=False),
            sa.Column('status', postgresql.ENUM('draft', 'scheduled', 'active', 'completed', 'cancelled', name='eventstatus', create_type=False), default='scheduled'),
            sa.Column('start_date', sa.DateTime(timezone=True), nullable=False),
            sa.Column('end_date', sa.DateTime(timezone=True), nullable=False),
            sa.Column('all_day', sa.Boolean, default=False),
            sa.Column('campaign_id', postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column('assignees', postgresql.ARRAY(sa.String), default=[]),
            sa.Column('tags', postgresql.ARRAY(sa.String), default=[]),
            sa.Column('metadata', postgresql.JSONB, default={}),
            sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now())
        )
        op.create_index('ix_marketing_calendar_org_id', 'marketing_calendar_events', ['organization_id'])

    # Marketing Reports
    if 'marketing_reports' not in existing_tables:
        op.create_table(
            'marketing_reports',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=sa.text('gen_random_uuid()')),
            sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column('name', sa.String(255), nullable=False),
            sa.Column('description', sa.Text, nullable=True),
            sa.Column('report_type', postgresql.ENUM('campaign_performance', 'channel_analysis', 'audience_insights', 'roi_analysis', 'engagement_summary', 'conversion_funnel', 'comprehensive', name='reporttype', create_type=False), nullable=False),
            sa.Column('start_date', sa.Date, nullable=False),
            sa.Column('end_date', sa.Date, nullable=False),
            sa.Column('filters', postgresql.JSONB, default={}),
            sa.Column('configuration', postgresql.JSONB, default={}),
            sa.Column('content', postgresql.JSONB, nullable=True),
            sa.Column('file_url', sa.String(500), nullable=True),
            sa.Column('status', postgresql.ENUM('pending', 'processing', 'completed', 'failed', name='reportstatus', create_type=False), default='pending'),
            sa.Column('recipients', postgresql.ARRAY(sa.String), default=[]),
            sa.Column('schedule', postgresql.JSONB, nullable=True),
            sa.Column('generated_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now())
        )
        op.create_index('ix_marketing_reports_org_id', 'marketing_reports', ['organization_id'])

    # Marketing Channels
    if 'marketing_channels' not in existing_tables:
        op.create_table(
            'marketing_channels',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=sa.text('gen_random_uuid()')),
            sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column('name', sa.String(255), nullable=False),
            sa.Column('channel_type', postgresql.ENUM('whatsapp', 'email', 'sms', 'messenger', 'instagram', 'linkedin', name='channeltype', create_type=False), nullable=False),
            sa.Column('status', sa.String(50), default='inactive'),
            sa.Column('configuration', postgresql.JSONB, default={}),
            sa.Column('credentials', postgresql.JSONB, default={}),
            sa.Column('last_sync_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('sync_status', sa.String(50), nullable=True),
            sa.Column('error_message', sa.Text, nullable=True),
            sa.Column('usage_stats', postgresql.JSONB, default={}),
            sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now())
        )
        op.create_index('ix_marketing_channels_org_id', 'marketing_channels', ['organization_id'])


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_table('marketing_channels')
    op.drop_table('marketing_reports')
    op.drop_table('marketing_calendar_events')
    op.drop_table('marketing_content')
    op.drop_table('marketing_templates')
    op.drop_table('marketing_assets')
    op.drop_table('mh_recipients')
    op.drop_table('mh_audiences')
    op.drop_table('mh_campaigns')
    
    # Drop ENUM types
    op.execute("DROP TYPE IF EXISTS reportstatus")
    op.execute("DROP TYPE IF EXISTS reporttype")
    op.execute("DROP TYPE IF EXISTS eventstatus")
    op.execute("DROP TYPE IF EXISTS eventtype")
    op.execute("DROP TYPE IF EXISTS contenttype")
    op.execute("DROP TYPE IF EXISTS assettype")
    op.execute("DROP TYPE IF EXISTS broadcaststatus")
    op.execute("DROP TYPE IF EXISTS campaignstatus")
    op.execute("DROP TYPE IF EXISTS channeltype")