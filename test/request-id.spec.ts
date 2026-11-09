import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { RequestIdInterceptor } from '../src/common/interceptors/request-id.interceptor';

describe('RequestIdInterceptor', () => {
  it('uses and returns a valid supplied request id', async () => {
    const headers: Record<string, string> = { 'x-request-id': 'frontend-test-1' };
    const responseHeaders: Record<string, string> = {};
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ headers }),
        getResponse: () => ({ setHeader: (name: string, value: string) => { responseHeaders[name] = value; } }),
      }),
    } as ExecutionContext;
    const handler: CallHandler = { handle: () => of(true) };

    await lastValueFrom(new RequestIdInterceptor().intercept(context, handler));
    expect(responseHeaders['x-request-id']).toBe('frontend-test-1');
  });
});
