import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError, from } from 'rxjs';

import { AuthService } from '../auth.service';
import { ToastService } from '../../components/toast/toast.service';
import { ApiError } from './envelope.interceptor';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastService);

  const token = auth.accessToken();
  const authReq = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authReq).pipe(
    catchError((err) => {
      const code = err instanceof ApiError ? err.code : err?.error?.code;
      const isTokenExpiredCode = code === 'TOKEN_EXPIRED';

      const shouldRefresh =
        (err?.status === 401 || isTokenExpiredCode) && !req.headers.has('X-Refresh-Attempt');

      if (shouldRefresh) {
        return from(auth.refresh()).pipe(
          switchMap((at) =>
            next(
              req.clone({
                setHeaders: {
                  Authorization: `Bearer ${at}`,
                  'X-Refresh-Attempt': '1',
                },
              })
            )
          ),
          catchError((refreshErr) => {
            auth.logout();
            try {
              toast.warning('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
            } catch {}
            router.navigate(['/login'], { queryParams: { sessionExpired: 1 } });
            return throwError(() => refreshErr);
          })
        );
      }

      return throwError(() => err);
    })
  );
};

