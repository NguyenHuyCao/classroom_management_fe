import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { map } from 'rxjs/operators';

export class ApiError extends Error {
  constructor(public code?: string | null, message?: string | null, public status?: number) {
    super(message || 'Request failed');
  }
}

export const envelopeInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    map((event) => {
      if (event instanceof HttpResponse) {
        const body = event.body;
        if (body && typeof body === 'object' && 'success' in body) {
          const env = body as {
            success: boolean;
            code?: string | null;
            message?: string | null;
            data: any;
          };
          if (!env.success) {
            throw new ApiError(env.code ?? null, env.message ?? 'Request failed', event.status);
          }
          return event.clone({ body: env.data });
        }
      }
      return event;
    })
  );
