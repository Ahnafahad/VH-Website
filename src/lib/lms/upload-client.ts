/**
 * Client-safe R2 upload helper.
 *
 * Flow:
 *   1. POST `endpoint` with { fileName, contentType } → { key, uploadUrl }
 *   2. PUT file bytes directly to R2 via the presigned URL.
 *      XHR is used instead of fetch so that onProgress callbacks work.
 *
 * Returns the R2 key to store in the database (not a URL).
 */

export interface UploadOptions {
  file: File;
  /** API route that returns { key, uploadUrl } — e.g. '/api/lms/admin/materials/upload' */
  endpoint: string;
  /** Called with 0–100 as upload progresses */
  onProgress?: (pct: number) => void;
}

export async function uploadToR2({ file, endpoint, onProgress }: UploadOptions): Promise<{ key: string }> {
  // Step 1: get presigned PUT URL from our server
  const presignRes = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName: file.name, contentType: file.type }),
  });

  if (!presignRes.ok) {
    const err = await presignRes.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `Presign failed (${presignRes.status})`);
  }

  const { key, uploadUrl } = (await presignRes.json()) as { key: string; uploadUrl: string };

  // Step 2: PUT bytes directly to R2 (XHR for progress events)
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`R2 upload failed with status ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
    xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
  });

  return { key };
}
