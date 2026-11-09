import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { defer, Observable } from 'rxjs';
import { runWithRequestId } from '../request-context';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined>; requestId?: string }>();
    const response = context.switchToHttp().getResponse<{ setHeader: (name: string, value: string) => void }>();
    const headerValue = request.headers['x-request-id'];
    const suppliedRequestId = typeof headerValue === 'string' ? headerValue.trim() : undefined;
    const requestId = suppliedRequestId && suppliedRequestId.length <= 100
      ? suppliedRequestId
      : randomUUID();

    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);
    return defer(() => runWithRequestId(requestId, () => next.handle()));
  }
}
