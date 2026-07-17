'use client';
import { useState } from 'react';
import { Facebook, Instagram, Image as ImageIcon, Video, Type, Send, CheckCircle2 } from 'lucide-react';
import { useApi } from '@/lib/useApi';

const PLATFORMS = [
  { key: 'facebook', label: 'Facebook Page', icon: Facebook },
  { key: 'instagram', label: 'Instagram', icon: Instagram },
];

// Instagram has no text-only post type — every IG post needs media.
const POST_TYPES = {
  facebook: [
    { key: 'text', label: 'Text', icon: Type },
    { key: 'image', label: 'Image', icon: ImageIcon },
    { key: 'video', label: 'Video', icon: Video },
  ],
  instagram: [
    { key: 'image', label: 'Image', icon: ImageIcon },
    { key: 'video', label: 'Video / Reel', icon: Video },
  ],
};

export default function SocialStudioPage() {
  const { call } = useApi();
  const [platform, setPlatform] = useState('facebook');
  const [postType, setPostType] = useState('text');
  const [caption, setCaption] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [isReel, setIsReel] = useState(true);
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState(null);

  function choosePlatform(p) {
    setPlatform(p);
    setPostType(POST_TYPES[p][0].key === 'text' ? 'text' : 'image');
    setResult(null);
    setErr('');
  }

  async function publish() {
    setErr('');
    setResult(null);
    if (postType !== 'text' && !mediaUrl.trim()) {
      setErr('A public image/video URL is required for this post type.');
      return;
    }
    if (postType === 'text' && !caption.trim()) {
      setErr('Write something to post.');
      return;
    }

    setPosting(true);
    try {
      let res;
      if (platform === 'facebook') {
        if (postType === 'text') res = await call('/facebook/publish', { method: 'POST', body: { message: caption } });
        else if (postType === 'image') res = await call('/facebook/publish-photo', { method: 'POST', body: { imageUrl: mediaUrl, caption } });
        else res = await call('/facebook/publish-video', { method: 'POST', body: { videoUrl: mediaUrl, description: caption } });
      } else {
        const body = postType === 'image' ? { imageUrl: mediaUrl, caption } : { videoUrl: mediaUrl, caption, isReel };
        res = await call('/instagram/publish', { method: 'POST', body });
      }
      setResult(res);
      setCaption('');
      setMediaUrl('');
    } catch (e) {
      setErr(e.message);
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl space-y-5">
      <div>
        <h2 className="text-lg font-bold">Social Studio</h2>
        <p className="text-sm text-slate-400">Publish an image, video, or text post directly to a connected Page or Instagram account.</p>
      </div>

      {/* Platform picker */}
      <div className="flex gap-2">
        {PLATFORMS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => choosePlatform(key)}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${
              platform === key ? 'border-brand bg-brand-light text-brand-dark' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        {/* Post type picker */}
        <div className="flex gap-2">
          {POST_TYPES[platform].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => { setPostType(key); setResult(null); setErr(''); }}
              className={`flex items-center gap-1.5 text-xs rounded-lg px-3 py-1.5 font-medium ${
                postType === key ? 'bg-brand text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {postType !== 'text' && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {postType === 'video' ? 'Video URL' : 'Image URL'} <span className="text-red-500">*</span>
            </label>
            <input value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="https://... (must be a public, direct file URL)"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none" />
          </div>
        )}

        {platform === 'instagram' && postType === 'video' && (
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" className="w-4 h-4 accent-brand" checked={isReel} onChange={(e) => setIsReel(e.target.checked)} />
            Publish as a Reel (uncheck to post as a regular feed video)
          </label>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            {postType === 'text' ? 'Message' : 'Caption'} {postType === 'text' && <span className="text-red-500">*</span>}
          </label>
          <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={4}
            placeholder="Write your post…" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none" />
        </div>

        {err && <p className="text-sm text-red-500">{err}</p>}
        {result && (
          <p className="text-sm text-emerald-600 flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
            <CheckCircle2 size={15} /> Published — id: {result.postId || result.photoId || result.videoId || result.mediaId}
          </p>
        )}

        <div className="flex justify-end">
          <button onClick={publish} disabled={posting}
            className="bg-brand text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-1.5 disabled:opacity-60">
            <Send size={15} /> {posting ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  );
}
