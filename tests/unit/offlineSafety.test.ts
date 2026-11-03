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
