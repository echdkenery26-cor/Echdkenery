import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** Réponse d'erreur uniforme : { statusCode, message, code?, details? } */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    const req = host.switchToHttp().getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: any = { message: 'Erreur interne du serveur.' };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const r = exception.getResponse();
      body = typeof r === 'string' ? { message: r } : { ...(r as object) };
      if (status === HttpStatus.TOO_MANY_REQUESTS) {
        body = { message: 'Trop de requêtes. Réessaie dans quelques instants.', code: 'TOO_MANY_REQUESTS' };
      } else if (Array.isArray(body.message)) {
        body.details = body.message;
        body.message = 'Données invalides.';
        body.code = body.code ?? 'VALIDATION_ERROR';
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          status = HttpStatus.CONFLICT;
          body = { message: 'Cet enregistrement existe déjà.', code: 'UNIQUE_VIOLATION', details: exception.meta };
          break;
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          body = { message: 'Élément introuvable.', code: 'NOT_FOUND' };
          break;
        case 'P2003':
          status = HttpStatus.CONFLICT;
          body = {
            message: 'Action impossible : cet élément est encore utilisé ailleurs.',
            code: 'IN_USE',
          };
          break;
        default:
          this.logger.error(`${req.method} ${req.url} — Prisma ${exception.code}: ${exception.message}`);
      }
    } else {
      this.logger.error(`${req.method} ${req.url}`, exception instanceof Error ? exception.stack : String(exception));
    }

    res.status(status).json({ statusCode: status, ...body });
  }
}
