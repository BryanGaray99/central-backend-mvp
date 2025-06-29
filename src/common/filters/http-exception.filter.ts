import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Log del error para debugging
    this.logger.error(exception);

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Error interno del servidor';
    let code = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse() as any;
      message = exceptionResponse.message || message;
      code = exceptionResponse.code || code;
    } else if (exception.code === 'EBUSY') {
      // Manejo específico para archivos bloqueados
      status = HttpStatus.CONFLICT;
      message =
        'Recurso ocupado o bloqueado. Por favor, cierre todos los archivos abiertos e intente nuevamente.';
      code = 'RESOURCE_BUSY';
    }

    const errorResponse = {
      success: false,
      path: request.url,
      timestamp: new Date().toISOString(),
      statusCode: status,
      error: {
        statusCode: status,
        message: message,
        code: code,
      },
    };

    this.logger.error(
      `${request.method} ${request.url} - Status ${status} - ${JSON.stringify(errorResponse)}`,
    );

    response.status(status).json(errorResponse);
  }
}
