/**
 * SSE client for React Native — fetch().body.getReader() is not reliable on RN.
 * Uses XMLHttpRequest onprogress to read incremental text/event-stream data.
 */

export type SSEHandler = (event: Record<string, unknown>) => void;

function parseBuffer(buffer: string, onEvent: SSEHandler): string {
  const parts = buffer.split('\n\n');
  const remainder = parts.pop() || '';

  for (const part of parts) {
    for (const line of part.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const jsonStr = line.slice(6).trim();
      if (!jsonStr) continue;
      try {
        onEvent(JSON.parse(jsonStr));
      } catch (e) {
        if (__DEV__) console.warn('[SSE] JSON parse error', jsonStr.slice(0, 80));
      }
    }
  }
  return remainder;
}

export interface SSEConnection {
  abort: () => void;
}

export function connectSSE(
  url: string,
  options: {
    method?: 'GET' | 'POST';
    body?: string;
    onEvent: SSEHandler;
    onError: (err: Error) => void;
    onDone?: () => void;
  }
): SSEConnection {
  const xhr = new XMLHttpRequest();
  let lastIndex = 0;
  let buffer = '';

  xhr.open(options.method || 'GET', url, true);
  xhr.setRequestHeader('Accept', 'text/event-stream');
  if (options.method === 'POST') {
    xhr.setRequestHeader('Content-Type', 'application/json');
  }

  xhr.onprogress = () => {
    const chunk = xhr.responseText.slice(lastIndex);
    lastIndex = xhr.responseText.length;
    if (!chunk) return;
    buffer += chunk;
    buffer = parseBuffer(buffer, (ev) => {
      if (__DEV__) {
        const t = ev.type as string;
        console.log(`[SSE] ${t}`, (ev.summary as string) || (ev.agent as string) || '');
      }
      options.onEvent(ev);
    });
  };

  xhr.onload = () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      buffer += xhr.responseText.slice(lastIndex);
      buffer = parseBuffer(buffer + '\n\n', options.onEvent);
      options.onDone?.();
    } else {
      options.onError(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
    }
  };

  xhr.onerror = () => {
    options.onError(new Error('Network error — check API URL and backend'));
  };

  xhr.ontimeout = () => {
    options.onError(new Error('Request timed out'));
  };

  xhr.send(options.body ?? null);

  return {
    abort: () => {
      try {
        xhr.abort();
      } catch {
        /* ignore */
      }
    },
  };
}
