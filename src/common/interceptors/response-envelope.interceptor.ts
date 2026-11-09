import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

interface ResponseWithMeta {
  data?: unknown;
  meta?: unknown;
}

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ method: string }>();

    return next.handle().pipe(
      map((result: unknown) => {
        const response = this.isResponseWithMeta(result) ? result : undefined;
        const data = response ? response.data : result;
        const meta = response?.meta;

        return {
          success: true,
          message: this.successMessage(request.method),
          data,
          ...(meta !== undefined ? { meta } : {}),
        };
      }),
    );
  }

  private isResponseWithMeta(value: unknown): value is ResponseWithMeta {
    return typeof value === 'object' && value !== null && ('data' in value || 'meta' in value);
  }

  private successMessage(method: string) {
    switch (method) {
      case 'POST':
        return 'Data berhasil dibuat';
      case 'PATCH':
      case 'PUT':
        return 'Data berhasil diperbarui';
      case 'DELETE':
        return 'Data berhasil dihapus';
      default:
        return 'Data berhasil diambil';
    }
  }
}
