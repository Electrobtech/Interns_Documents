export const campaigns = [
  { id:'1', name:'AI Bootcamp Lead Gen Q3', platform:'Facebook', objective:'Lead Generation', status:'Active', budget:5000, spend:3240, ctr:4.2, cpm:8.4, cpc:2.1, reach:142000, impressions:385000, leads:1540, conversions:312, revenue:93600, roas:28.9, createdBy:'Priya Sharma', startDate:'2025-06-01', endDate:'2025-08-31', aiScore:94 },
  { id:'2', name:'SaaS Growth Campaign', platform:'LinkedIn', objective:'Website Traffic', status:'Active', budget:8000, spend:6120, ctr:3.1, cpm:12.6, cpc:4.1, reach:89000, impressions:486000, leads:890, conversions:198, revenue:59400, roas:9.7, createdBy:'Rahul Verma', startDate:'2025-05-15', endDate:'2025-09-30', aiScore:81 },
  { id:'3', name:'Webinar Registration Drive', platform:'Google Ads', objective:'Event Registration', status:'Scheduled', budget:3000, spend:0, ctr:0, cpm:0, cpc:0, reach:0, impressions:0, leads:0, conversions:0, revenue:0, roas:0, createdBy:'Ananya Iyer', startDate:'2025-08-10', endDate:'2025-08-20', aiScore:72 },
  { id:'4', name:'Brand Awareness Wave', platform:'Instagram', objective:'Brand Awareness', status:'Paused', budget:4500, spend:2100, ctr:1.8, cpm:6.2, cpc:3.4, reach:320000, impressions:338000, leads:0, conversions:45, revenue:0, roas:0, createdBy:'Vikram Singh', startDate:'2025-04-20', endDate:'2025-06-30', aiScore:56 },
  { id:'5', name:'WhatsApp Retargeting', platform:'WhatsApp', objective:'Remarketing', status:'Active', budget:1200, spend:940, ctr:6.7, cpm:4.1, cpc:0.6, reach:22000, impressions:229000, leads:1100, conversions:540, revenue:162000, roas:172.3, createdBy:'Priya Sharma', startDate:'2025-07-01', endDate:'2025-08-31', aiScore:97 },
  { id:'6', name:'Enterprise Sales Push', platform:'Email', objective:'Sales', status:'Draft', budget:500, spend:0, ctr:0, cpm:0, cpc:0, reach:0, impressions:0, leads:0, conversions:0, revenue:0, roas:0, createdBy:'Ananya Iyer', startDate:'2025-07-25', endDate:'2025-09-01', aiScore:68 },
  { id:'7', name:'Course Enrollment - Python', platform:'Facebook', objective:'Course Registration', status:'Active', budget:2500, spend:2100, ctr:5.4, cpm:7.8, cpc:1.4, reach:68000, impressions:269000, leads:1870, conversions:420, revenue:126000, roas:60.0, createdBy:'Rahul Verma', startDate:'2025-06-15', endDate:'2025-08-15', aiScore:91 },
  { id:'8', name:'Google Search - B2B', platform:'Google Ads', objective:'Lead Generation', status:'Active', budget:6000, spend:5400, ctr:8.2, cpm:22.1, cpc:2.7, reach:45000, impressions:244000, leads:2000, conversions:650, revenue:195000, roas:36.1, createdBy:'Vikram Singh', startDate:'2025-05-01', endDate:'2025-09-30', aiScore:88 },
];
export const broadcasts = [
  { id:'1', name:'Welcome Series - New Leads', channel:'WhatsApp', audience:'New Leads (2.4k)', status:'Sent', sent:2400, delivered:2280, opened:1920, clicked:864, responses:312, conversion:13.0, aiScore:91 },
  { id:'2', name:'Webinar Reminder - Tomorrow', channel:'Email', audience:'Registered Users (1.8k)', status:'Scheduled', sent:0, delivered:0, opened:0, clicked:0, responses:0, conversion:0, aiScore:78 },
  { id:'3', name:'Flash Sale - 48hrs', channel:'SMS', audience:'All Subscribers (12k)', status:'Sent', sent:12000, delivered:11640, opened:8400, clicked:2940, responses:0, conversion:24.5, aiScore:85 },
  { id:'4', name:'Monthly Newsletter - Aug', channel:'Email', audience:'Newsletter List (5.6k)', status:'Draft', sent:0, delivered:0, opened:0, clicked:0, responses:0, conversion:0, aiScore:65 },
  { id:'5', name:'Re-engagement - Cold Leads', channel:'WhatsApp', audience:'Inactive 60d (3.1k)', status:'Active', sent:3100, delivered:2945, opened:1770, clicked:531, responses:248, conversion:8.0, aiScore:73 },
];
// `platformKey`/`channelKey` match the `platform` field on `campaigns` rows and
// the `channel` field on `broadcasts` rows above — counts on the Channels page
// are derived by filtering those arrays, not hardcoded here.
export const channels = [
  { id:'whatsapp',   name:'WhatsApp Business',   platformKey:'WhatsApp',   color:'#25D366', bg:'#e8f9ef', status:'connected', broadcastsSupported:true,     description:'Send campaigns and broadcasts via WhatsApp Business API.' },
  { id:'email',      name:'Email',               platformKey:'Email',     color:'#3b82f6', bg:'#eff6ff', status:'connected', broadcastsSupported:true,     description:'Create email campaigns and send broadcast emails.' },
  { id:'sms',        name:'SMS',                 platformKey:'SMS',       color:'#f59e0b', bg:'#fffbeb', status:'connected', broadcastsSupported:true,     description:'Send SMS campaigns and bulk messages instantly.' },
  { id:'messenger',  name:'Facebook Messenger',  platformKey:'Messenger', color:'#0084ff', bg:'#eff6ff', status:'connected', broadcastsSupported:true,     description:'Engage your audience with Messenger campaigns and broadcasts.' },
  { id:'instagram',  name:'Instagram',           platformKey:'Instagram', color:'#e1306c', bg:'#fdf2f8', status:'limited',   broadcastsSupported:'limited', description:'Run campaigns and limited broadcasts via Instagram (DM automation).' },
  { id:'linkedin',   name:'LinkedIn',            platformKey:'LinkedIn',  color:'#0a66c2', bg:'#eff6ff', status:'connected', broadcastsSupported:false,    description:'Run LinkedIn campaigns to engage professionals and leads.' },
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
export const calendarEvents = [
  { id:'1',  title:'AI Bootcamp Campaign Launch',  type:'campaign',  date:'2025-08-05', color:'#6366f1' },
  { id:'2',  title:'Webinar - AI in Marketing',    type:'webinar',   date:'2025-08-07', color:'#f59e0b' },
  { id:'3',  title:'Flash Sale Broadcast',         type:'broadcast', date:'2025-08-10', color:'#10b981' },
  { id:'4',  title:'Monthly Report Review',        type:'meeting',   date:'2025-08-12', color:'#3b82f6' },
  { id:'5',  title:'LinkedIn Campaign Pause',      type:'campaign',  date:'2025-08-15', color:'#6366f1' },
  { id:'6',  title:'Independence Day Campaign',    type:'campaign',  date:'2025-08-15', color:'#ef4444' },
  { id:'7',  title:'Q3 Strategy Meeting',          type:'meeting',   date:'2025-08-18', color:'#3b82f6' },
  { id:'8',  title:'SEO Audit Deadline',           type:'reminder',  date:'2025-08-20', color:'#8b5cf6' },
  { id:'9',  title:'Back to School Campaign',      type:'campaign',  date:'2025-08-22', color:'#6366f1' },
  { id:'10', title:'Newsletter - August',          type:'broadcast', date:'2025-08-28', color:'#10b981' },
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
export const teamMembers = [
  { id:'1', name:'Priya Sharma',  email:'priya@acme.io',  role:'Marketing Manager',   status:'Active',  avatar:'PS' },
  { id:'2', name:'Rahul Verma',   email:'rahul@acme.io',  role:'Campaign Specialist', status:'Active',  avatar:'RV' },
  { id:'3', name:'Ananya Iyer',   email:'ananya@acme.io', role:'Content Strategist',  status:'Active',  avatar:'AI' },
  { id:'4', name:'Vikram Singh',  email:'vikram@acme.io', role:'SEO Analyst',         status:'Active',  avatar:'VS' },
  { id:'5', name:'Meera Nair',    email:'meera@acme.io',  role:'Designer',            status:'Invited', avatar:'MN' },
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
