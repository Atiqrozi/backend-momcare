import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { getRequestId } from '../request-context';

interface ExceptionResponse {
  message?: string | string[];
  error?: string;
  details?: unknown;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const httpException = exception instanceof HttpException ? exception : undefined;
    const statusCode = httpException?.getStatus() ?? HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = httpException?.getResponse() ?? 'Terjadi kesalahan internal';
    const details = this.getDetails(exceptionResponse);
    const message = this.getMessage(exceptionResponse);

    response.status(statusCode).json({
      success: false,
      message,
      statusCode,
      error: this.getError(exceptionResponse, statusCode),
      ...(details !== undefined ? { details } : {}),
      requestId: request.headers['x-request-id'] ?? getRequestId(),
    });
  }

  private getMessage(exceptionResponse: string | ExceptionResponse) {
    if (typeof exceptionResponse === 'string') return exceptionResponse;
    if (Array.isArray(exceptionResponse.message)) return 'Validasi gagal';
    return exceptionResponse.message ?? 'Terjadi kesalahan pada request';
  }

  private getDetails(exceptionResponse: string | ExceptionResponse) {
    if (typeof exceptionResponse === 'string') return undefined;
    if (exceptionResponse.details !== undefined) return exceptionResponse.details;
    return Array.isArray(exceptionResponse.message)
      ? exceptionResponse.message.map((message) => ({ messages: [message] }))
      : undefined;
  }

  private getError(exceptionResponse: string | ExceptionResponse, statusCode: number) {
    if (typeof exceptionResponse !== 'string' && exceptionResponse.error) {
      return exceptionResponse.error;
    }
    return HttpStatus[statusCode] ?? 'Http Error';
  }
}
