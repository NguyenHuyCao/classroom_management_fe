import { HttpInterceptorFn } from '@angular/common/http';
export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(/* có thể map lỗi chung, toast, v.v. */);
