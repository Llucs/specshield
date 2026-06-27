import { watch } from 'fs';
import type { FSWatcher } from 'fs';

export function createWatcher(
  specPath: string,
  onChange: () => void,
  intervalMs: number = 2000
): { close: () => void } {
  let lastMtime = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  let fsWatcher: FSWatcher | null = null;

  try {
    fsWatcher = watch(specPath, (eventType) => {
      if (eventType === 'change') {
        onChange();
      }
    });
  } catch {
    timer = setInterval(async () => {
      try {
        const { stat } = await import('fs/promises');
        const stats = await stat(specPath);
        const mtime = stats.mtimeMs;
        if (lastMtime > 0 && mtime > lastMtime) {
          onChange();
        }
        lastMtime = mtime;
      } catch {
      }
    }, intervalMs);
  }

  return {
    close: () => {
      if (fsWatcher) {
        fsWatcher.close();
      }
      if (timer) {
        clearInterval(timer);
      }
    },
  };
}
