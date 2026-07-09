import { apiCall } from './api';

/**
 * Upload an image using the correct presign + S3 POST flow.
 * Supports guests and users.
 * Returns the publicUrl.
 */
export async function uploadImage(localUri: string, fileName?: string): Promise<string> {
  const name = fileName || `upload-${Date.now()}.jpg`;
  const contentType = 'image/jpeg';

  // 1. Get presigned POST from backend
  const presign = await apiCall('/api/upload/presign', {
    method: 'POST',
    body: JSON.stringify({
      fileName: name,
      contentType,
      // fileSize optional
    }),
  });

  if (!presign || !presign.url || !presign.fields || !presign.publicUrl) {
    throw new Error(presign?.message || 'Failed to get upload URL');
  }

  // 2. Build form for S3 (fields first, then file last)
  const formData = new FormData();
  Object.keys(presign.fields).forEach((key) => {
    formData.append(key, presign.fields[key]);
  });

  // RN special file object
  formData.append('file', {
    uri: localUri,
    name,
    type: contentType,
  } as any);

  // 3. Upload directly to S3
  const uploadResponse = await fetch(presign.url, {
    method: 'POST',
    body: formData,
    headers: {
      // Let fetch set multipart boundary
    },
  });

  if (!uploadResponse.ok) {
    const text = await uploadResponse.text().catch(() => '');
    throw new Error(`S3 upload failed: ${uploadResponse.status} ${text}`);
  }

  return presign.publicUrl;
}
