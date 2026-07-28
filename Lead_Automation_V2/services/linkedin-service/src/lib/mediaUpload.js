import axios from 'axios';
import { linkedinClient, callLinkedIn } from './linkedinApi.js';

// LinkedIn's Images/Videos APIs are a separate 2-3 step handshake from the
// Posts API itself: register an upload slot, PUT the raw bytes to the URL
// LinkedIn hands back, then (video only) finalize with the part ETags. The
// resulting urn is what gets referenced in the post's content.media.id.

export async function uploadImage(accessToken, ownerUrn, buffer) {
  const client = linkedinClient(accessToken);

  const init = await callLinkedIn(() => client.post('/rest/images?action=initializeUpload', {
    initializeUploadRequest: { owner: ownerUrn },
  }));
  if (!init.ok) return { ok: false, status: init.status, body: init.body };

  const { uploadUrl, image } = init.data.value;
  console.log('[mediaUpload] image initializeUpload ok, uploading', buffer.length, 'bytes to', uploadUrl.split('?')[0]);
  try {
    await axios.put(uploadUrl, buffer, {
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/octet-stream' },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
  } catch (err) {
    console.error('[mediaUpload] image PUT failed:', err.response?.status, JSON.stringify(err.response?.data || {}), JSON.stringify(err.response?.headers || {}));
    return { ok: false, status: err.response?.status || 502, body: err.response?.data || { message: err.message } };
  }

  return { ok: true, urn: image, type: 'image' };
}

export async function uploadVideo(accessToken, ownerUrn, buffer) {
  const client = linkedinClient(accessToken);

  const init = await callLinkedIn(() => client.post('/rest/videos?action=initializeUpload', {
    initializeUploadRequest: {
      owner: ownerUrn,
      fileSizeBytes: buffer.length,
      uploadCaptions: false,
      uploadThumbnail: false,
    },
  }));
  if (!init.ok) return { ok: false, status: init.status, body: init.body };

  const { uploadInstructions, video, uploadToken } = init.data.value;
  const uploadedPartIds = [];

  try {
    for (const part of uploadInstructions) {
      const chunk = buffer.subarray(part.firstByte, part.lastByte + 1);
      const resp = await axios.put(part.uploadUrl, chunk, {
        headers: { Authorization: `Bearer ${accessToken}` },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });
      // LinkedIn requires each part's ETag back on finalize, in order.
      const etag = resp.headers?.etag || resp.headers?.ETag;
      uploadedPartIds.push(etag);
    }
  } catch (err) {
    return { ok: false, status: err.response?.status || 502, body: err.response?.data || { message: err.message } };
  }

  const finalize = await callLinkedIn(() => client.post('/rest/videos?action=finalizeUpload', {
    finalizeUploadRequest: { video, uploadToken: uploadToken || '', uploadedPartIds },
  }));
  if (!finalize.ok) return { ok: false, status: finalize.status, body: finalize.body };

  return { ok: true, urn: video, type: 'video' };
}
