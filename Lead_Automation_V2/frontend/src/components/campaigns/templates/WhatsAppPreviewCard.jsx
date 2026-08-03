'use client';
import { Image as ImageIcon, FileText as DocIcon, Video as VideoIcon, Reply } from 'lucide-react';

// Fills {{1}}, {{2}}… in body text with the example values collected on the
// Body step, falling back to the raw placeholder so an unfilled variable is
// still visible rather than silently vanishing.
function renderBody(body, variables = {}) {
  if (!body) return '';
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) =>
    (variables[key] != null && variables[key] !== '') ? variables[key] : match
  );
}

function HeaderMedia({ headerType, headerMediaUrl }) {
  if (headerType === 'IMAGE') {
    return headerMediaUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={headerMediaUrl} alt="Template header" className="w-full h-40 object-cover" />
    ) : (
      <div className="w-full h-40 bg-slate-100 flex items-center justify-center text-slate-300">
        <ImageIcon size={28} />
      </div>
    );
  }
  if (headerType === 'VIDEO') {
    return (
      <div className="w-full h-40 bg-slate-800 flex items-center justify-center text-white/70">
        <VideoIcon size={28} />
      </div>
    );
  }
  if (headerType === 'DOCUMENT') {
    return (
      <div className="w-full h-16 bg-slate-50 border-b border-slate-100 flex items-center gap-2 px-4 text-slate-500">
        <DocIcon size={16} /> <span className="text-xs font-medium">Document attached</span>
      </div>
    );
  }
  return null;
}

/**
 * Mobile chat card styled like WhatsApp — used live while editing a
 * template (TemplateEditor) and read-only in the Template Detail Modal.
 */
export default function WhatsAppPreviewCard({ template }) {
  const t = template || {};
  const buttons = Array.isArray(t.buttons) ? t.buttons : [];

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-card bg-[repeating-linear-gradient(135deg,#f8fafc_0_2px,#f1f5f9_2px_4px)]">
      <div className="p-5 flex justify-center">
        <div className="w-full max-w-[280px] bg-white rounded-2xl shadow-card-lg overflow-hidden">
          <HeaderMedia headerType={t.header_type} headerMediaUrl={t.header_media_url} />

          <div className="p-3">
            {t.header_type === 'TEXT' && t.header_text && (
              <p className="text-[13px] font-bold text-slate-800 mb-1 whitespace-pre-wrap">{t.header_text}</p>
            )}

            <p className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
              {renderBody(t.body, t.body_variables) || (
                <span className="text-slate-300 italic">Your message body will appear here…</span>
              )}
            </p>

            {t.footer && (
              <p className="text-[11px] text-slate-400 mt-2">{t.footer}</p>
            )}

            <p className="text-[10px] text-slate-300 text-right mt-1.5">12:00 PM</p>
          </div>

          {buttons.length > 0 && (
            <div className="border-t border-slate-100">
              {buttons.map((b, i) => (
                <div
                  key={i}
                  className="flex items-center justify-center gap-1.5 py-2.5 text-[13px] font-medium text-sky-600 border-t border-slate-100 first:border-t-0"
                >
                  <Reply size={13} className="rotate-180" />
                  {b.text || 'Button'}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
