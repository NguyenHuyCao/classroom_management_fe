import { HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { ApiError } from './envelope.interceptor';

export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((err) => {
      if (err instanceof ApiError) return throwError(() => err);
      const msg =
        err?.error?.message || err?.message || 'Không thể kết nối máy chủ. Vui lòng thử lại.';
      return throwError(() => new Error(msg));
    })
  );
