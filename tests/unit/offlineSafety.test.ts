import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

describe('offline storage isolation', () => {
  it('activation deletes only old Card Parlor caches', async () => {
    const handlers: Record<string, (event: unknown) => void> = {};
    const remove = vi.fn(async () => true);
    const claim = vi.fn(async () => undefined);
    runInNewContext(readFileSync('public/sw.js', 'utf8'), {
      self: {
        addEventListener: (name: string, fn: (event: unknown) => void) => (handlers[name] = fn),
        clients: { claim },
      },
      caches: {
        keys: async () => ['icp-dev', 'icp-fonts', 'icp-1.0.0-old', 'blackjak-v1', 'icpother-v1'],
        delete: remove,
      },
    });
    let done: Promise<unknown> = Promise.resolve();
    handlers.activate!({ waitUntil: (p: Promise<unknown>) => (done = p) });
    await done;
    expect(remove.mock.calls).toEqual([['icp-1.0.0-old']]);
    expect(claim).toHaveBeenCalledOnce();
  });

  it.each(['/Inspire-card-parlor/', '/Inspire-card-parlor/index.html?fresh=1'])(
    'repair only unregisters the app scope at %s',
    async (path) => {
      const own = vi.fn(async () => true);
      const sibling = vi.fn(async () => true);
      const root = vi.fn(async () => true);
      const reload = vi.fn();
      const remove = vi.fn(async () => true);
      const w: { __icpRepair?: () => void } = {};
      const html = readFileSync('index.html', 'utf8');
      const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)![1]!;
      runInNewContext(script, {
        window: w,
        document: { getElementById: () => ({ addEventListener: vi.fn() }) },
        navigator: {
          serviceWorker: {
            getRegistrations: async () => [
              { scope: 'https://example.com/Inspire-card-parlor/', unregister: own },
              { scope: 'https://example.com/BlackJak/', unregister: sibling },
              { scope: 'https://example.com/', unregister: root },
            ],
          },
        },
        caches: { keys: async () => ['icp-fonts', 'icp-old', 'blackjak-v1', 'icpother'], delete: remove },
        location: { href: `https://example.com${path}`, pathname: path.split('?')[0], hash: '', replace: reload },
        URL,
        addEventListener: vi.fn(),
        setTimeout: vi.fn(),
      });
      // window.caches is feature-detected by the recovery script.
      Object.assign(w, { caches: {} });
      w.__icpRepair!();
      await vi.waitFor(() => expect(reload).toHaveBeenCalledOnce());
      expect(own).toHaveBeenCalledOnce();
      expect(sibling).not.toHaveBeenCalled();
      expect(root).not.toHaveBeenCalled();
      expect(remove.mock.calls).toEqual([['icp-fonts'], ['icp-old']]);
    },
  );
});

describe('release image cache', () => {
  it('serves a cached image without fetching it again', async () => {
    const handlers: Record<string, (event: any) => void> = {};
    const cached = new Response('image');
    const fetchImage = vi.fn();
    runInNewContext(readFileSync('public/sw.js', 'utf8'), {
      self: {
        location: { origin: 'https://example.com' },
        addEventListener: (name: string, fn: (event: any) => void) => (handlers[name] = fn),
      },
      caches: { open: async () => ({ match: async () => cached }) },
      fetch: fetchImage,
      URL,
    });
    let result!: Promise<Response>;
    let lifetime!: Promise<unknown>;
    handlers.fetch!({
      request: { url: 'https://example.com/assets/cards/classic/faces.webp', method: 'GET', headers: new Headers() },
      respondWith: (p: Promise<Response>) => {
        result = p;
      },
      waitUntil: (p: Promise<unknown>) => {
        lifetime = p;
      },
    });
    expect(await result).toBe(cached);
    await lifetime;
    expect(fetchImage).not.toHaveBeenCalled();
  });
});

it('fetches a fresh artwork copy when filling a new release cache', async () => {
  const handlers: Record<string, (event: any) => void> = {};
  const response = new Response('new artwork');
  const put = vi.fn(async () => undefined);
  const fetchImage = vi.fn(async () => response);
  runInNewContext(readFileSync('public/sw.js', 'utf8'), {
    self: {
      location: { origin: 'https://example.com' },
      addEventListener: (name: string, fn: (event: any) => void) => (handlers[name] = fn),
    },
    caches: { open: async () => ({ match: async () => undefined, put }) },
    fetch: fetchImage,
    URL,
    Response,
  });
  const request = {
    url: 'https://example.com/assets/cards/cannabis_nugs/faces.webp',
    method: 'GET',
    headers: new Headers(),
  };
  let result!: Promise<Response>;
  let lifetime!: Promise<unknown>;
  handlers.fetch!({
    request,
    respondWith: (p: Promise<Response>) => {
      result = p;
    },
    waitUntil: (p: Promise<unknown>) => {
      lifetime = p;
    },
  });
  expect(await result).toBe(response);
  await lifetime;
  expect(fetchImage).toHaveBeenCalledWith(request, { cache: 'reload' });
  expect(put).toHaveBeenCalledOnce();
});

describe('offline music and video', () => {
  const bytes = new Uint8Array(Array.from({ length: 100 }, (_, i) => i));
  const load = (saved: Response | undefined, fetchMedia = vi.fn(async (_req: unknown) => new Response('network'))) => {
    const handlers: Record<string, (event: any) => void> = {};
    const put = vi.fn(async () => undefined);
    const opened: string[] = [];
    runInNewContext(readFileSync('public/sw.js', 'utf8'), {
      self: {
        location: { origin: 'https://example.com', href: 'https://example.com/Inspire-card-parlor/sw.js' },
        addEventListener: (name: string, fn: (event: any) => void) => (handlers[name] = fn),
      },
      caches: {
        open: async (name: string) => {
          opened.push(name);
          return { match: async () => saved?.clone(), put };
        },
      },
      fetch: fetchMedia,
      URL,
      Response,
      Blob,
      AbortController,
      setTimeout,
      clearTimeout,
    });
    const request = (range?: string, path = 'assets/music/sanctum-pulse.mp3') => {
      let result!: Promise<Response>;
      const lifetime: Promise<unknown>[] = [];
      handlers.fetch!({
        request: {
          url: `https://example.com/Inspire-card-parlor/${path}`,
          method: 'GET',
          headers: new Headers(range ? { range } : {}),
        },
        respondWith: (p: Promise<Response>) => (result = p),
        waitUntil: (p: Promise<unknown>) => lifetime.push(p),
      });
      return { result, lifetime };
    };
    return { request, put, opened, fetchMedia };
  };
  const saved = () => new Response(bytes, { headers: { 'Content-Type': 'audio/mpeg' } });

  it('answers a player’s byte range from the saved track, with no network', async () => {
    const { request, fetchMedia, opened } = load(saved());
    const res = await request('bytes=10-19').result;
    expect(res.status).toBe(206);
    expect(res.headers.get('content-range')).toBe('bytes 10-19/100');
    expect(res.headers.get('content-type')).toBe('audio/mpeg');
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([...bytes.slice(10, 20)]);
    expect(fetchMedia).not.toHaveBeenCalled();
    expect(opened.every((name) => name === 'icp-media-dev')).toBe(true);
  });

  it.each([
    ['bytes=0-', 0, 99],
    ['bytes=90-500', 90, 99],
    ['bytes=-5', 95, 99],
  ])('serves %s as bytes %i-%i', async (range, start, end) => {
    const res = await load(saved()).request(range).result;
    expect(res.status).toBe(206);
    expect(res.headers.get('content-range')).toBe(`bytes ${start}-${end}/100`);
    expect(res.headers.get('content-length')).toBe(String(end - start + 1));
  });

  it('refuses a range past the end and serves whole files without a range', async () => {
    expect((await load(saved()).request('bytes=100-').result).status).toBe(416);
    const whole = await load(saved()).request().result;
    expect(whole.status).toBe(200);
    expect(whole.headers.get('accept-ranges')).toBe('bytes');
    expect((await whole.arrayBuffer()).byteLength).toBe(100);
  });

  it('plays the intro video from its saved copy', async () => {
    const video = new Response(bytes, { headers: { 'Content-Type': 'video/mp4' } });
    const res = await load(video).request('bytes=0-', 'assets/video/inspiresoftwareintro.mp4').result;
    expect(res.status).toBe(206);
    expect(res.headers.get('content-type')).toBe('video/mp4');
  });

  it('streams an unsaved track and keeps a full copy for offline play', async () => {
    const fetchMedia = vi.fn(async (req: any) =>
      typeof req === 'string'
        ? new Response(bytes, { headers: { 'Content-Type': 'audio/mpeg' } })
        : new Response('part'),
    );
    const { request, put } = load(undefined, fetchMedia);
    const { result, lifetime } = request('bytes=0-');
    expect(await (await result).text()).toBe('part');
    await Promise.all(lifetime);
    // The background copy is the whole file, fetched without the player's range.
    expect(fetchMedia).toHaveBeenCalledWith(
      'https://example.com/Inspire-card-parlor/assets/music/sanctum-pulse.mp3',
      expect.objectContaining({ cache: 'reload' }),
    );
    expect(put).toHaveBeenCalledOnce();
    const [key, copy] = put.mock.calls[0] as unknown as [string, Response];
    expect(key).toBe('https://example.com/Inspire-card-parlor/assets/music/sanctum-pulse.mp3');
    expect((await copy.arrayBuffer()).byteLength).toBe(100);
  });

  it('activation keeps the saved music library', async () => {
    const handlers: Record<string, (event: unknown) => void> = {};
    const remove = vi.fn(async () => true);
    runInNewContext(readFileSync('public/sw.js', 'utf8'), {
      self: {
        addEventListener: (name: string, fn: (event: unknown) => void) => (handlers[name] = fn),
        clients: { claim: async () => undefined },
      },
      caches: { keys: async () => ['icp-dev', 'icp-media-dev', 'icp-media-old', 'icp-fonts'], delete: remove },
    });
    let done: Promise<unknown> = Promise.resolve();
    handlers.activate!({ waitUntil: (p: Promise<unknown>) => (done = p) });
    await done;
    expect(remove.mock.calls).toEqual([['icp-media-old']]);
  });
});
