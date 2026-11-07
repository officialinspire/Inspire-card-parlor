// A small decode queue: warm likely-next sprites without decoding the whole art library.
const pending = new Map<string, Promise<void>>();
const queue: (() => Promise<void>)[] = [];
let active = 0;
function pump(): void {
  while (active < 2 && queue.length) {
    active++;
    void queue.shift()!().finally(() => {
      active--;
      pump();
    });
  }
}

export function warmImage(url: string): Promise<void> {
  const existing = pending.get(url);
  if (existing) return existing;
  const result = new Promise<void>((resolve) => {
    queue.push(async () => {
      try {
        await new Promise<void>((resolve, reject) => {
          const image = new Image();
          image.decoding = 'async';
          image.fetchPriority = 'low';
          image.onload = async () => {
            await image.decode?.().catch(() => undefined);
            resolve();
          };
          image.onerror = () => reject(new Error('Image unavailable'));
          image.src = url;
        });
      } catch {
        // Offline/transient errors should retry next time, rather than poison the session.
        pending.delete(url);
      } finally {
        resolve();
      }
    });
  });
  pending.set(url, result);
  pump();
  return result;
}
