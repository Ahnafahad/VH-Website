// ─── Cloudflare R2 Client ─────────────────────────────────────────────────────
// Lazy-initialised S3-compatible client. Import is safe at build time.
// Functions throw a clear error if env vars are missing at call time.

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Readable } from 'stream';

// ─── Lazy client ──────────────────────────────────────────────────────────────

let _client: S3Client | null = null;

function getClient(): S3Client {
  if (_client) return _client;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'R2 env vars missing: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY must all be set.',
    );
  }

  _client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return _client;
}

function getBucket(): string {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) throw new Error('R2_BUCKET env var is not set.');
  return bucket;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Upload a stream (or Buffer / string) to R2.
 *
 * @param key         - Object key, e.g. 'recordings/42.mp4'
 * @param body        - Readable stream, Buffer, or string
 * @param contentType - MIME type, e.g. 'video/mp4'
 */
export async function r2PutStream(
  key: string,
  body: Readable | Buffer | string,
  contentType: string,
): Promise<void> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: body as never,
      ContentType: contentType,
    }),
  );
}

/**
 * Generate a pre-signed GET URL (default 2 h TTL).
 *
 * @param key            - Object key
 * @param expiresSeconds - TTL in seconds (default 7200 = 2 h)
 */
export async function r2PresignGet(
  key: string,
  expiresSeconds = 7200,
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: getBucket(), Key: key });
  return getSignedUrl(getClient(), command, { expiresIn: expiresSeconds });
}

/**
 * Generate a pre-signed PUT URL for client-side uploads (default 1 h TTL).
 *
 * @param key            - Object key
 * @param contentType    - MIME type the client must send
 * @param expiresSeconds - TTL in seconds (default 3600 = 1 h)
 */
export async function r2PresignPut(
  key: string,
  contentType: string,
  expiresSeconds = 3600,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(getClient(), command, { expiresIn: expiresSeconds });
}

/**
 * Delete an object from R2.
 *
 * @param key - Object key
 */
export async function r2Delete(key: string): Promise<void> {
  await getClient().send(
    new DeleteObjectCommand({ Bucket: getBucket(), Key: key }),
  );
}

/**
 * Resolve a stored file reference to a URL the browser can fetch.
 *
 * Convention:
 *   - Values starting with 'http' are external URLs (links, old Blob URLs) —
 *     returned unchanged.
 *   - Anything else is treated as an R2 object key and a presigned GET URL is
 *     generated with the specified TTL (default 2 h).
 *
 * Returns null when ref is null / empty.
 */
export async function resolveFileUrl(
  ref: string | null | undefined,
  expiresSeconds = 7200,
): Promise<string | null> {
  if (!ref) return null;
  if (ref.startsWith('http')) return ref;
  return r2PresignGet(ref, expiresSeconds);
}
