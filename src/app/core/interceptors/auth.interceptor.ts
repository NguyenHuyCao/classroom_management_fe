import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../auth.service';
import { catchError, switchMap, throwError, from } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.accessToken();
  const authReq = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authReq).pipe(
    catchError((err) => {
      if (err.status === 401 && !req.headers.has('X-Refresh-Attempt')) {
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
          )
        );
      }
      return throwError(() => err);
    })
  );
};
