// Static channel metadata (icon color/background, description, and whether
// bulk broadcasts are supported) for the Channels grid. Real per-channel
// campaign/broadcast counts and connection status come from the backend via
// useChannelStats()/useIntegrationsList() — this array is display-only.
export const channels = [
  { id: 'whatsapp', name: 'WhatsApp Business', description: 'Reach contacts directly with template and session messages.', color: '#25D366', bg: '#e7faf0', broadcastsSupported: true },
  { id: 'email', name: 'Email', description: 'Newsletters, drip sequences, and transactional campaigns.', color: '#6366f1', bg: '#eef2ff', broadcastsSupported: true },
  { id: 'sms', name: 'SMS', description: 'Short, high-open-rate text messages for time-sensitive offers.', color: '#f59e0b', bg: '#fffbeb', broadcastsSupported: true },
  { id: 'messenger', name: 'Facebook Messenger', description: 'Conversational campaigns through Messenger threads.', color: '#0084ff', bg: '#eaf5ff', broadcastsSupported: true },
  { id: 'instagram', name: 'Instagram', description: 'DMs and story replies; broadcast sends are rate-limited by Meta.', color: '#e1306c', bg: '#fdf0f4', broadcastsSupported: 'limited' },
  { id: 'linkedin', name: 'LinkedIn', description: 'Connection requests and InMail — one-to-one outreach only.', color: '#0a66c2', bg: '#eaf3fb', broadcastsSupported: false },
];

// Demo campaigns/broadcasts, keyed by platform/channel so MHChannels.jsx can
// derive non-zero per-channel counts as a fallback when useChannelStats()
// returns no real data yet (new orgs with no campaigns created).
export const campaigns = [
  { id: 'c1', name: 'Q3 Lead Gen Push', platform: 'whatsapp', status: 'running' },
  { id: 'c2', name: 'Newsletter Relaunch', platform: 'email', status: 'running' },
  { id: 'c3', name: 'Flash Sale SMS', platform: 'sms', status: 'scheduled' },
  { id: 'c4', name: 'Messenger Reactivation', platform: 'messenger', status: 'draft' },
  { id: 'c5', name: 'Instagram Story Ads', platform: 'instagram', status: 'running' },
  { id: 'c6', name: 'LinkedIn ABM Outreach', platform: 'linkedin', status: 'running' },
  { id: 'c7', name: 'Webinar Reminder Emails', platform: 'email', status: 'scheduled' },
];

export const broadcasts = [
  { id: 'b1', name: 'Order Confirmation Blast', channel: 'whatsapp', status: 'sent' },
  { id: 'b2', name: 'Weekly Digest', channel: 'email', status: 'sent' },
  { id: 'b3', name: 'Flash Sale Alert', channel: 'sms', status: 'sent' },
  { id: 'b4', name: 'Cart Abandonment Ping', channel: 'messenger', status: 'scheduled' },
  { id: 'b5', name: 'New Feature Announcement', channel: 'instagram', status: 'sent' },
];

export const audiences = [
  { id:'1', name:'High-Intent Leads Q3', size:4820, source:'Custom', score:92, lastUpdated:'2025-07-30', status:'Active' },
  { id:'2', name:'Website Visitors 30d', size:18400, source:'Pixel', score:74, lastUpdated:'2025-07-31', status:'Active' },
  { id:'3', name:'Lookalike - Top Buyers', size:2100000, source:'Lookalike', score:81, lastUpdated:'2025-07-25', status:'Active' },
  { id:'4', name:'Email List - Opted In', size:9650, source:'Import', score:88, lastUpdated:'2025-06-15', status:'Active' },
  { id:'5', name:'Webinar Registrants 2025', size:3240, source:'CRM', score:95, lastUpdated:'2025-07-28', status:'Active' },
];
export const kpiData = { totalCampaigns:48, runningCampaigns:14, scheduledCampaigns:6, draftCampaigns:9, leadsGenerated:28420, conversionRate:18.4, ctr:4.8, cpc:2.3, cpm:8.9, costPerLead:12.4, revenue:842000, roas:29.4, aiMarketingScore:87 };
export const performanceData = [
  { month:'Jan', impressions:1200000, clicks:48000, leads:8600, revenue:258000 },
  { month:'Feb', impressions:980000,  clicks:42000, leads:7200, revenue:216000 },
  { month:'Mar', impressions:1450000, clicks:65250, leads:9800, revenue:294000 },
  { month:'Apr', impressions:1680000, clicks:84000, leads:12400,revenue:372000 },
  { month:'May', impressions:2100000, clicks:100800,leads:15200,revenue:456000 },
  { month:'Jun', impressions:1950000, clicks:97500, leads:14100,revenue:423000 },
  { month:'Jul', impressions:2380000, clicks:119000,leads:18400,revenue:552000 },
];
export const platformData = [
  { name:'Facebook',   value:32, color:'#6366f1' },
  { name:'Google Ads', value:28, color:'#3b82f6' },
  { name:'LinkedIn',   value:18, color:'#0ea5e9' },
  { name:'Instagram',  value:12, color:'#f59e0b' },
  { name:'WhatsApp',   value:6,  color:'#10b981' },
  { name:'Email',      value:4,  color:'#8b5cf6' },
];
export const funnelData = [
  { stage:'Impressions', value:2380000, pct:100 },
  { stage:'Clicks',      value:119000,  pct:5.0 },
  { stage:'Leads',       value:18400,   pct:15.5 },
  { stage:'Qualified',   value:6440,    pct:35.0 },
  { stage:'Converted',   value:3384,    pct:52.5 },
];
export const channelPerformance = [
  { channel:'Facebook',   leads:8420,  cpl:9.2,  roas:32.1 },
  { channel:'Google Ads', leads:6810,  cpl:14.8, roas:36.1 },
  { channel:'LinkedIn',   leads:3240,  cpl:28.4, roas:9.7  },
  { channel:'Instagram',  leads:2840,  cpl:11.2, roas:18.6 },
  { channel:'WhatsApp',   leads:4200,  cpl:4.1,  roas:172.3},
  { channel:'Email',      leads:2910,  cpl:1.8,  roas:94.2 },
];
export const audienceGrowth = [
  { week:'W1', total:42000 },{ week:'W2', total:48400 },
  { week:'W3', total:52100 },{ week:'W4', total:58900 },
  { week:'W5', total:63400 },{ week:'W6', total:71200 },
  { week:'W7', total:78600 },{ week:'W8', total:84200 },
];
export const aiInsights = [
  { id:'1', type:'warning', title:'Campaign CTR Below Target',        campaign:'Brand Awareness Wave',      current:'1.8%',      expected:'3.5%',          recommendation:'Refresh creatives and test video format. Current images are 47 days old.',                                   confidence:91 },
  { id:'2', type:'success', title:'WhatsApp Retargeting Outperforming',campaign:'WhatsApp Retargeting',      current:'ROAS 172x', expected:'50x',            recommendation:'Increase budget by ₹800/day. Projected additional revenue: ₹42,000/week.',                                 confidence:96 },
  { id:'3', type:'info',    title:'Optimal Launch Window Detected',   campaign:'Webinar Registration Drive', current:'Scheduled', expected:'Tuesday 9–11 AM', recommendation:'Shift launch to Tuesday 9 AM IST for 23% higher open rate.',                                            confidence:84 },
  { id:'4', type:'warning', title:'Budget Depletion Risk',            campaign:'Google Search - B2B',        current:'90% spent', expected:'70% at midpoint', recommendation:'Pause low-performing ad sets. Reallocate ₹1,200 to top 3 performing keywords.',                          confidence:88 },
  { id:'5', type:'info',    title:'Competitor Keyword Gap Found',     campaign:'SEO',                        current:'42 gaps',   expected:'Covered',         recommendation:"Competitors rank for 42 high-volume keywords you don't target. Top: 'AI marketing tools'.",              confidence:79 },
];
export const competitors = [
  { id:'1', name:'HubSpot',       domain:'hubspot.com',         da:93, traffic:'18.4M', backlinks:'12.8M', opportunity:68, threat:82, engagement:4.2 },
  { id:'2', name:'Zoho CRM',      domain:'zoho.com',            da:89, traffic:'14.2M', backlinks:'8.1M',  opportunity:74, threat:71, engagement:3.8 },
  { id:'3', name:'Salesforce',    domain:'salesforce.com',      da:95, traffic:'42.6M', backlinks:'28.4M', opportunity:54, threat:91, engagement:3.1 },
  { id:'4', name:'ActiveCampaign',domain:'activecampaign.com',  da:79, traffic:'4.8M',  backlinks:'2.2M',  opportunity:88, threat:62, engagement:5.1 },
];
export const seoKeywords = [
  { keyword:'AI marketing automation',    volume:14400, difficulty:68, position:8,  change:3  },
  { keyword:'lead generation software',   volume:22000, difficulty:74, position:14, change:-2 },
  { keyword:'WhatsApp marketing tool',    volume:9900,  difficulty:52, position:4,  change:6  },
  { keyword:'marketing automation india', volume:6600,  difficulty:45, position:3,  change:1  },
  { keyword:'campaign management platform',volume:3600, difficulty:61, position:11, change:4  },
  { keyword:'CRM with WhatsApp',          volume:4400,  difficulty:49, position:6,  change:2  },
];
export const aeoScores = { visibility:78, chatgpt:82, gemini:71, claude:76, perplexity:68, entityCoverage:84, faqScore:79, answerQuality:73 };
export const assets = [
  { id:'1', name:'Brand Logo Primary.svg',      type:'Logos',                size:'42 KB',  modified:'2025-06-15', url:'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=200&h=200&fit=crop' },
  { id:'2', name:'AI Bootcamp Banner.jpg',      type:'Images',               size:'1.2 MB', modified:'2025-07-20', url:'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=300&h=200&fit=crop' },
  { id:'3', name:'Q3 Campaign Video.mp4',       type:'Videos',               size:'48 MB',  modified:'2025-07-15', url:'https://images.unsplash.com/photo-1574717024453-354056afd6fc?w=300&h=200&fit=crop' },
  { id:'4', name:'Product Brochure.pdf',        type:'PDFs',                 size:'3.4 MB', modified:'2025-05-10', url:'' },
  { id:'5', name:'WhatsApp Ad Creative.jpg',    type:'Images',               size:'840 KB', modified:'2025-07-28', url:'https://images.unsplash.com/photo-1611746872915-64382b5c76da?w=300&h=200&fit=crop' },
  { id:'6', name:'AI Generated - Headings.jpg', type:'AI Generated Images',  size:'2.1 MB', modified:'2025-07-30', url:'https://images.unsplash.com/photo-1686191128892-3b37add4c844?w=300&h=200&fit=crop' },
];
export const knowledgeDocs = [
  { id:'1', title:'Brand Voice Guidelines',      category:'Brand Guidelines', tags:['brand','tone','voice'],        updatedAt:'2025-07-10', size:'1.2 MB' },
  { id:'2', title:'Q2 2025 Campaign Report',     category:'Reports',          tags:['Q2','campaigns','analysis'],   updatedAt:'2025-07-05', size:'4.8 MB' },
  { id:'3', title:'AI Bootcamp Case Study',      category:'Case Studies',     tags:['case study','lead gen'],       updatedAt:'2025-06-28', size:'800 KB' },
  { id:'4', title:'Buyer Persona - SMB India',   category:'Marketing Docs',   tags:['persona','SMB','India'],       updatedAt:'2025-05-14', size:'640 KB' },
  { id:'5', title:'Email Sequence Templates',    category:'Templates',        tags:['email','sequences','nurture'], updatedAt:'2025-07-22', size:'320 KB' },
  { id:'6', title:'Competitor Analysis Archive', category:'Reports',          tags:['competitors','SEO','ads'],     updatedAt:'2025-07-18', size:'2.4 MB' },
];
export const revenueData = [
  { month:'Jan', revenue:258000, target:300000 },
  { month:'Feb', revenue:216000, target:280000 },
  { month:'Mar', revenue:294000, target:290000 },
  { month:'Apr', revenue:372000, target:350000 },
  { month:'May', revenue:456000, target:420000 },
  { month:'Jun', revenue:423000, target:450000 },
  { month:'Jul', revenue:552000, target:500000 },
];