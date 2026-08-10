"""Marketing Hub Tables

Revision ID: 0004
Revises: 0003
Create Date: 2024-01-20 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade():
    # Create marketing hub core tables that are missing
    
    # Marketing Assets Table
    op.create_table(
        'marketing_assets',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String, nullable=False),
        sa.Column('filename', sa.String, nullable=False),
        sa.Column('file_path', sa.String, nullable=False),
        sa.Column('file_size', sa.Integer, nullable=False),
        sa.Column('mime_type', sa.String, nullable=False),
        sa.Column('asset_type', sa.Enum('image', 'video', 'audio', 'document', 'template', 'other', name='asset_type'), nullable=False),
        sa.Column('file_hash', sa.String, nullable=False),
        sa.Column('tags', postgresql.ARRAY(sa.String), default=[], nullable=True),
        sa.Column('metadata', postgresql.JSONB, default={}, nullable=True),
        sa.Column('is_public', sa.Boolean, default=False, nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    
    # Marketing Templates Table
    op.create_table(
        'marketing_templates',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String, nullable=False),
        sa.Column('category', sa.String, nullable=False),
        sa.Column('channel', sa.Enum('whatsapp', 'email', 'sms', 'messenger', 'instagram', 'linkedin', name='channel_type'), nullable=False),
        sa.Column('content', postgresql.JSONB, nullable=False),
        sa.Column('preview_data', postgresql.JSONB, nullable=True),
        sa.Column('is_public', sa.Boolean, default=False, nullable=False),
        sa.Column('tags', postgresql.ARRAY(sa.String), default=[], nullable=True),
        sa.Column('usage_count', sa.Integer, default=0, nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    
    # Marketing Content Studio Table
    op.create_table(
        'marketing_content',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String, nullable=False),
        sa.Column('content_type', sa.Enum('post', 'email', 'ad', 'blog', 'social', 'video', 'image', name='content_type'), nullable=False),
        sa.Column('channel', sa.Enum('whatsapp', 'email', 'sms', 'messenger', 'instagram', 'linkedin', name='channel_type'), nullable=True),
        sa.Column('content', postgresql.JSONB, nullable=False),
        sa.Column('status', sa.Enum('draft', 'review', 'approved', 'published', 'archived', name='content_status'), default='draft', nullable=False),
        sa.Column('scheduled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('tags', postgresql.ARRAY(sa.String), default=[], nullable=True),
        sa.Column('performance_data', postgresql.JSONB, default={}, nullable=True),
        sa.Column('ai_generated', sa.Boolean, default=False, nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    
    # Marketing Calendar Events Table
    op.create_table(
        'marketing_calendar_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String, nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('event_type', sa.Enum('campaign', 'launch', 'deadline', 'meeting', 'content_creation', 'review', 'social_post', name='event_type'), nullable=False),
        sa.Column('status', sa.Enum('draft', 'scheduled', 'active', 'completed', 'cancelled', name='event_status'), default='scheduled', nullable=False),
        sa.Column('start_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('end_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('all_day', sa.Boolean, default=False, nullable=False),
        sa.Column('campaign_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('mh_campaigns.id', ondelete='CASCADE'), nullable=True),
        sa.Column('assignees', postgresql.ARRAY(sa.String), default=[], nullable=True),
        sa.Column('tags', postgresql.ARRAY(sa.String), default=[], nullable=True),
        sa.Column('metadata', postgresql.JSONB, default={}, nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    
    # Marketing Reports Table
    op.create_table(
        'marketing_reports',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String, nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('report_type', sa.Enum('campaign_performance', 'channel_analysis', 'audience_insights', 'roi_analysis', 'engagement_summary', 'conversion_funnel', 'comprehensive', name='report_type'), nullable=False),
        sa.Column('start_date', sa.Date, nullable=False),
        sa.Column('end_date', sa.Date, nullable=False),
        sa.Column('filters', postgresql.JSONB, default={}, nullable=True),
        sa.Column('configuration', postgresql.JSONB, default={}, nullable=True),
        sa.Column('content', postgresql.JSONB, nullable=True),
        sa.Column('file_url', sa.String, nullable=True),
        sa.Column('status', sa.Enum('pending', 'processing', 'completed', 'failed', name='report_status'), default='pending', nullable=False),
        sa.Column('recipients', postgresql.ARRAY(sa.String), default=[], nullable=True),
        sa.Column('schedule', postgresql.JSONB, nullable=True),
        sa.Column('generated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    
    # Create indexes for better performance
    op.create_index('idx_marketing_assets_org_type', 'marketing_assets', ['organization_id', 'asset_type'])
    op.create_index('idx_marketing_templates_org_channel', 'marketing_templates', ['organization_id', 'channel'])
    op.create_index('idx_marketing_content_org_status', 'marketing_content', ['organization_id', 'status'])
    op.create_index('idx_marketing_calendar_org_date', 'marketing_calendar_events', ['organization_id', 'start_date'])
    op.create_index('idx_marketing_reports_org_type', 'marketing_reports', ['organization_id', 'report_type'])


def downgrade():
    # Drop indexes
    op.drop_index('idx_marketing_reports_org_type')
    op.drop_index('idx_marketing_calendar_org_date') 
    op.drop_index('idx_marketing_content_org_status')
    op.drop_index('idx_marketing_templates_org_channel')
    op.drop_index('idx_marketing_assets_org_type')
    
    # Drop tables
    op.drop_table('marketing_reports')
    op.drop_table('marketing_calendar_events')
    op.drop_table('marketing_content')
    op.drop_table('marketing_templates')
    op.drop_table('marketing_assets')
    
    # Drop enums
    sa.Enum(name='report_status').drop(op.get_bind())
    sa.Enum(name='report_type').drop(op.get_bind())
    sa.Enum(name='event_status').drop(op.get_bind())
    sa.Enum(name='event_type').drop(op.get_bind())
    sa.Enum(name='content_status').drop(op.get_bind())
    sa.Enum(name='content_type').drop(op.get_bind())
    sa.Enum(name='channel_type').drop(op.get_bind())
    sa.Enum(name='asset_type').drop(op.get_bind())