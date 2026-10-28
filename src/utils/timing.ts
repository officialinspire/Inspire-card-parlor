export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): (...args: A) => void {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
