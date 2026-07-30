import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { randomUUID } from "node:crypto";

type ErrorBody = {
  code?: string;
  message?: string | string[];
};

@Catch()
export class PublicExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception instanceof HttpException ? exception.getResponse() : undefined;
    const normalized = typeof body === "object" && body !== null ? body as ErrorBody : {};
    const message = Array.isArray(normalized.message) ? normalized.message.join("; ") : normalized.message;

    response.status(status).json({
      code: normalized.code ?? (status === HttpStatus.INTERNAL_SERVER_ERROR ? "INTERNAL_ERROR" : "REQUEST_FAILED"),
      message: message ?? (exception instanceof Error ? exception.message : "Request failed."),
      traceId: randomUUID(),
    });
  }
}
