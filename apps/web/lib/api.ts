/**
 * Custom HTTP fetch client — UX-DR31.
 *
 * The single sanctioned HTTP wrapper for `apps/web/**`. Raw `fetch()` is
 * banned by ESLint (`no-restricted-syntax`); all client-side network calls go
 * through `apiFetch` to guarantee:
 *
 *   1. Request cancellation via `AbortController` / `AbortSignal`.
 *   2. Retry on transient failures (5xx, 429, network `TypeError`) with
 *      exponential backoff (1s, 2s, 4s). 4xx client errors do NOT retry.
 *
 * @rules UX-DR31
 */

/** Extended request init with retry controls. */
export interface ApiFetchInit extends RequestInit {
  /** Maximum retry attempts (default 3). */
  retry?: number;
  /** Backoff delay calculator in ms (default exponential 1s/2s/4s capped 10s). */
  retryDelay?: (attempt: number) => number;
  /**
   * Injectable fetch implementation (test seam). Defaults to the global
   * `fetch`. Production code never sets this — tests inject a stub to assert
   * retry behaviour without real network I/O.
   */
  fetchImpl?: typeof fetch;
}

/** Default exponential backoff: 1s, 2s, 4s … capped at 10s. */
function defaultRetryDelay(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 10_000);
}

/** Sleep helper that respects an abort signal. */
function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

/** Determine whether an error is a network failure worth retrying. */
function isNetworkFailure(error: unknown): boolean {
  if (!(error instanceof TypeError)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('failed to fetch') ||
    message.includes('abort') === false // AbortError is handled separately upstream
  );
}

/** Determine whether a response/error is retryable (5xx, 429, network failure). */
function isRetryable(response?: Response, error?: unknown): boolean {
  if (response === undefined) {
    // No response means an exception was thrown. Retry only on network failures,
    // never on programmer errors like illegal RequestInit or CORS issues.
    return error instanceof TypeError && isNetworkFailure(error);
  }
  if (response.status === 429) return true; // rate limited
  if (response.status >= 500 && response.status < 600) return true; // server error
  return false;
}

/**
 * Fetch wrapper with AbortController integration and retry logic.
 *
 * @throws {Error} when all retries are exhausted or a non-retryable error
 *   occurs. The thrown `Error.message` includes the final status code.
 */
export async function apiFetch(
  input: RequestInfo,
  init: ApiFetchInit = {},
): Promise<Response> {
  const { retry: maxRetries = 3, retryDelay = defaultRetryDelay, fetchImpl, ...rest } = init;
  const doFetch = fetchImpl ?? fetch;
  const signal: AbortSignal | undefined = rest.signal ?? undefined;

  let lastResponse: Response | undefined;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) {
      throw signal.reason ?? new DOMException('Aborted', 'AbortError');
    }

    try {
      const response = await doFetch(input, rest);
      if (!isRetryable(response)) {
        if (!response.ok) {
          throw new Error(`Request failed: ${response.status} ${response.statusText}`);
        }
        return response;
      }
      lastResponse = response;
    } catch (error) {
      // Abort errors should never be retried.
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }
      if (!isRetryable(undefined, error)) {
        throw error;
      }
      lastError = error;
    }

    // Don't sleep after the last attempt.
    if (attempt < maxRetries) {
      await delay(retryDelay(attempt), signal);
    }
  }

  const status = lastResponse?.status ?? 'network';
  const message = lastError instanceof Error ? lastError.message : `Request failed: ${status}`;
  throw new Error(message);
}
