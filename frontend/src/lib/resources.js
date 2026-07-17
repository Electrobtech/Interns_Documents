import {
  Users, Megaphone, Bot, ShoppingCart, Star, MessageSquare,
  Plug, KeyRound, Webhook, Radio, UserCog, UsersRound, Inbox, Target,
} from 'lucide-react';

// Read-only conversation feed (inbox-service owns writes via reply/status/assign).
export const conversations = {
  path: '/conversations', title: 'Unified Inbox', icon: Inbox, readOnly: true,
  columns: [
    { key: 'contact_name', label: 'Contact' },
    { key: 'channel_type', label: 'Channel' },
    { key: 'status', label: 'Status', badge: true },
    { key: 'last_message_at', label: 'Last Message', type: 'datetime' },
  ],
  fields: [],
};

// Read-only leads pipeline (contact-service exposes /leads list + stage updates).
export const leads = {
  path: '/leads', title: 'Leads', icon: Target, readOnly: true,
  columns: [
    { key: 'name', label: 'Contact' },
    { key: 'stage', label: 'Stage', badge: true },
    { key: 'priority', label: 'Priority' },
    { key: 'score', label: 'Score' },
    { key: 'created_at', label: 'Created', type: 'datetime' },
  ],
  fields: [],
};

// One config per resource. `columns` drive the table, `fields` drive the form.
// Keys mirror the backend/database columns.

export const contacts = {
  path: '/contacts', title: 'Contacts', icon: Users,
  columns: [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'source', label: 'Source' },
    { key: 'created_at', label: 'Added', type: 'datetime' },
  ],
  fields: [
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'email', label: 'Email', type: 'text' },
    { key: 'phone', label: 'Phone', type: 'text' },
    { key: 'source', label: 'Source', type: 'select', options: ['whatsapp', 'instagram', 'webchat', 'messenger', 'email', 'referral'] },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ],
};

export const campaigns = {
  path: '/campaigns', title: 'Campaigns & Broadcasts', icon: Megaphone,
  columns: [
    { key: 'name', label: 'Name' },
    { key: 'channel_type', label: 'Channel' },
    { key: 'type', label: 'Type' },
    { key: 'media_type', label: 'Media' },
    { key: 'status', label: 'Status', badge: true },
    { key: 'scheduled_at', label: 'Scheduled', type: 'datetime' },
  ],
  fields: [
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'type', label: 'Type', type: 'select', options: ['broadcast', 'drip', 'transactional'] },
    { key: 'channel_type', label: 'Channel', type: 'select', options: ['whatsapp', 'instagram', 'messenger', 'sms', 'email'] },
    { key: 'message_body', label: 'Message', type: 'textarea' },
    { key: 'media_url', label: 'Image/Video URL (optional)', type: 'text' },
    { key: 'media_type', label: 'Media Type', type: 'select', options: ['image', 'video'] },
    { key: 'template_name', label: 'WhatsApp Template Name (optional)', type: 'text' },
    { key: 'scheduled_at', label: 'Schedule', type: 'datetime' },
    { key: 'status', label: 'Status', type: 'select', options: ['draft', 'scheduled', 'sent'] },
  ],
  // Extra per-row action button rendered by DataTable/CrudPage, in addition
  // to Edit/Delete — actually broadcasts the campaign to its audience.
  rowActions: [
    { key: 'send', label: 'Send', method: 'POST', path: (row) => `/campaigns/${row.id}/send`, confirm: 'Broadcast this campaign to its audience now?' },
  ],
};

export const aiAgents = {
  path: '/ai-agents', title: 'AI Agents & Automation', icon: Bot,
  columns: [
    { key: 'name', label: 'Name' },
    { key: 'type', label: 'Type' },
    { key: 'status', label: 'Status', badge: true },
    { key: 'config', label: 'Config' },
  ],
  fields: [
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'type', label: 'Type', type: 'select', options: ['support', 'sales', 'marketing', 'voice'] },
    { key: 'status', label: 'Status', type: 'select', options: ['active', 'paused'] },
    { key: 'config', label: 'Config (JSON)', type: 'textarea' },
  ],
};

export const orders = {
  path: '/orders', title: 'Orders', icon: ShoppingCart,
  columns: [
    { key: 'contact_name', label: 'Customer' },
    { key: 'amount', label: 'Amount' },
    { key: 'payment_type', label: 'Payment' },
    { key: 'status', label: 'Status', badge: true },
    { key: 'created_at', label: 'Date', type: 'datetime' },
  ],
  fields: [
    { key: 'contact_id', label: 'Contact ID', type: 'text' },
    { key: 'amount', label: 'Amount', type: 'number', required: true },
    { key: 'payment_type', label: 'Payment', type: 'select', options: ['cod', 'prepaid'] },
    { key: 'status', label: 'Status', type: 'select', options: ['pending', 'paid', 'completed', 'cancelled'] },
  ],
};

export const carts = {
  path: '/carts', title: 'Abandoned Carts', icon: ShoppingCart,
  columns: [
    { key: 'contact_name', label: 'Customer' },
    { key: 'value', label: 'Value' },
    { key: 'recovered', label: 'Recovered', type: 'bool', badge: true },
    { key: 'created_at', label: 'Date', type: 'datetime' },
  ],
  fields: [
    { key: 'contact_id', label: 'Contact ID', type: 'text' },
    { key: 'value', label: 'Value', type: 'number' },
    { key: 'recovered', label: 'Recovered', type: 'checkbox' },
  ],
};

export const reviews = {
  path: '/reviews', title: 'Reviews', icon: Star,
  columns: [
    { key: 'author', label: 'Author' },
    { key: 'source', label: 'Source' },
    { key: 'rating', label: 'Rating' },
    { key: 'body', label: 'Review' },
    { key: 'reply', label: 'Reply' },
  ],
  fields: [
    { key: 'author', label: 'Author', type: 'text' },
    { key: 'source', label: 'Source', type: 'select', options: ['google', 'facebook', 'app_store'] },
    { key: 'rating', label: 'Rating', type: 'number' },
    { key: 'body', label: 'Review', type: 'textarea' },
    { key: 'reply', label: 'Reply', type: 'textarea' },
  ],
};

export const social = {
  path: '/social', title: 'Social Comments', icon: MessageSquare,
  columns: [
    { key: 'author', label: 'Author' },
    { key: 'source', label: 'Source' },
    { key: 'body', label: 'Comment' },
    { key: 'reply', label: 'Reply' },
  ],
  fields: [
    { key: 'author', label: 'Author', type: 'text' },
    { key: 'source', label: 'Source', type: 'select', options: ['facebook', 'instagram', 'linkedin'] },
    { key: 'body', label: 'Comment', type: 'textarea' },
    { key: 'reply', label: 'Reply', type: 'textarea' },
  ],
};

export const integrations = {
  path: '/integrations', title: 'Integrations', icon: Plug,
  columns: [
    { key: 'provider', label: 'Provider' },
    { key: 'status', label: 'Status', badge: true },
    { key: 'created_at', label: 'Added', type: 'datetime' },
  ],
  fields: [
    { key: 'provider', label: 'Provider', type: 'select', options: ['shopify', 'stripe', 'google_sheets', 'zapier', 'razorpay'] },
    { key: 'status', label: 'Status', type: 'select', options: ['connected', 'disconnected'] },
    { key: 'credentials', label: 'Credentials (JSON)', type: 'textarea' },
  ],
};

export const apiKeys = {
  path: '/api-keys', title: 'API Keys', icon: KeyRound,
  columns: [
    { key: 'label', label: 'Label' },
    { key: 'created_at', label: 'Created', type: 'datetime' },
  ],
  fields: [
    { key: 'label', label: 'Label', type: 'text', required: true },
  ],
};

export const webhooks = {
  path: '/webhooks', title: 'Webhooks', icon: Webhook,
  columns: [
    { key: 'url', label: 'URL' },
    { key: 'event', label: 'Event' },
    { key: 'active', label: 'Active', type: 'bool', badge: true },
  ],
  fields: [
    { key: 'url', label: 'URL', type: 'text', required: true },
    { key: 'event', label: 'Event', type: 'select', options: ['message.received', 'order.created', 'lead.created', 'review.created'] },
    { key: 'active', label: 'Active', type: 'checkbox' },
  ],
};

export const channels = {
  path: '/channels', title: 'Channels', icon: Radio,
  columns: [
    { key: 'type', label: 'Type' },
    { key: 'display_name', label: 'Name' },
    { key: 'status', label: 'Status', badge: true },
  ],
  fields: [
    { key: 'type', label: 'Type', type: 'select', options: ['whatsapp', 'instagram', 'messenger', 'sms', 'webchat', 'voice', 'email'] },
    { key: 'display_name', label: 'Display Name', type: 'text' },
    { key: 'status', label: 'Status', type: 'select', options: ['connected', 'disconnected'] },
  ],
};

export const users = {
  path: '/users', title: 'Team Members', icon: UserCog,
  columns: [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role', badge: true },
    { key: 'availability', label: 'Availability' },
  ],
  fields: [
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'email', label: 'Email', type: 'text', required: true },
    { key: 'password', label: 'Password', type: 'text', required: true },
    { key: 'role', label: 'Role', type: 'select', options: ['admin', 'manager', 'agent'] },
    { key: 'availability', label: 'Availability', type: 'select', options: ['online', 'away', 'offline'] },
  ],
};

export const teams = {
  path: '/teams', title: 'Teams', icon: UsersRound,
  columns: [
    { key: 'name', label: 'Name' },
    { key: 'created_at', label: 'Created', type: 'datetime' },
  ],
  fields: [
    { key: 'name', label: 'Name', type: 'text', required: true },
  ],
};
