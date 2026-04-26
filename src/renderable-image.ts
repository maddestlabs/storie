export type RenderableImageSource = ImageBitmap | HTMLImageElement;

type ResolveRenderableImageUrlOptions = {
  errorPrefix: string;
  untrustedContent?: boolean;
  allowedPrefix?: RegExp;
};

type LoadRenderableImageOptions = {
  errorPrefix: string;
  maxBytes: number;
};

export async function decodeRenderableImageFromBytes(bytes: Uint8Array, mime: string): Promise<RenderableImageSource | null> {
  const blob = new Blob([new Uint8Array(bytes)], { type: mime || 'application/octet-stream' });

  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob);
      return bitmap as RenderableImageSource;
    } catch {
      // Fall through to HTMLImageElement decoding for environments where
      // createImageBitmap rejects otherwise valid image blobs.
    }
  }

  if (typeof Image === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return null;
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {
          // Ignore URL cleanup failures.
        }
        reject(new Error('Image element failed to decode'));
      };
      element.src = objectUrl;
    });
    return image as RenderableImageSource;
  } catch (error) {
    try {
      URL.revokeObjectURL(objectUrl);
    } catch {
      // Ignore URL cleanup failures.
    }
    throw error;
  }
}

export function resolveRenderableImageUrl(rawUrl: string, options: ResolveRenderableImageUrlOptions): string {
  const trimmed = String(rawUrl ?? '').trim();
  if (!trimmed) {
    throw new Error(`${options.errorPrefix} Missing URL`);
  }

  if (options.untrustedContent) {
    const allowedPrefix = options.allowedPrefix ?? /^(?:\.\/)?assets\/img\//;
    if (!allowedPrefix.test(trimmed) || trimmed.includes('..') || trimmed.startsWith('/') || trimmed.startsWith('\\')) {
      throw new Error(`${options.errorPrefix} Untrusted mode allows only relative URLs under "assets/img/"`);
    }
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
      throw new Error(`${options.errorPrefix} Untrusted mode blocks URL schemes`);
    }
  }

  let resolved: URL;
  try {
    resolved = new URL(trimmed, globalThis.location?.href ?? 'http://localhost/');
  } catch (error: any) {
    throw new Error(`${options.errorPrefix} Invalid URL: ${String(error?.message ?? error)}`);
  }

  const protocol = resolved.protocol.toLowerCase();
  if (protocol === 'data:' || protocol === 'blob:' || protocol === 'javascript:' || protocol === 'file:') {
    throw new Error(`${options.errorPrefix} Unsupported URL scheme: ${protocol}`);
  }
  if (resolved.username || resolved.password) {
    throw new Error(`${options.errorPrefix} Credentials in URLs are not supported`);
  }

  const origin = globalThis.location?.origin;
  if (origin && origin !== 'null' && resolved.origin !== origin) {
    throw new Error(`${options.errorPrefix} Cross-origin images blocked: ${resolved.origin}`);
  }

  return resolved.toString();
}

export async function loadRenderableImageFromResolvedUrl(
  resolvedUrl: string,
  options: LoadRenderableImageOptions,
): Promise<RenderableImageSource | null> {
  try {
    const response = await fetch(resolvedUrl, {
      mode: 'same-origin',
      credentials: 'same-origin',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const contentLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > options.maxBytes) {
      throw new Error(`Refusing image larger than ${options.maxBytes} bytes (server reported ${contentLength})`);
    }

    const mime = String(response.headers.get('content-type') ?? '').split(';')[0].toLowerCase().trim();
    if (!mime.startsWith('image/')) {
      throw new Error(`Unsupported content type: ${mime || 'unknown'}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > options.maxBytes) {
      throw new Error(`Refusing image larger than ${options.maxBytes} bytes (downloaded ${arrayBuffer.byteLength})`);
    }

    return await decodeRenderableImageFromBytes(new Uint8Array(arrayBuffer), mime);
  } catch (error) {
    console.warn(`${options.errorPrefix} Failed to load image from "${resolvedUrl}":`, error);
    return null;
  }
}