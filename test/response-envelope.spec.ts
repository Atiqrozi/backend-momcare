import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { ResponseEnvelopeInterceptor } from '../src/common/interceptors/response-envelope.interceptor';

describe('ResponseEnvelopeInterceptor', () => {
  it('wraps a detail response', async () => {
    const interceptor = new ResponseEnvelopeInterceptor();
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ method: 'GET' }) }),
    } as ExecutionContext;
    const handler: CallHandler = { handle: () => of({ id: '1' }) };

    await expect(lastValueFrom(interceptor.intercept(context, handler))).resolves.toEqual({
      success: true,
      message: 'Data berhasil diambil',
      data: { id: '1' },
    });
  });

  it('preserves pagination metadata', async () => {
    const interceptor = new ResponseEnvelopeInterceptor();
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ method: 'GET' }) }),
    } as ExecutionContext;
    const handler: CallHandler = { handle: () => of({ data: [], meta: { page: 1 } }) };

    await expect(lastValueFrom(interceptor.intercept(context, handler))).resolves.toEqual({
      success: true,
      message: 'Data berhasil diambil',
      data: [],
      meta: { page: 1 },
    });
  });
});
