import { AsyncLocalStorage } from 'async_hooks';

const requestContext = new AsyncLocalStorage<string>();

export function runWithRequestId<T>(requestId: string, callback: () => T): T {
  return requestContext.run(requestId, callback);
}

export function getRequestId(): string {
  return requestContext.getStore() ?? 'system';
}
