import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class Api {
  private base = environment.apiBaseUrl;
  constructor(private http: HttpClient) {}

  get<T>(url: string, params?: Record<string, any>) {
    const p = new HttpParams({ fromObject: params || {} });
    return this.http.get<T>(`${this.base}${url}`, { params: p });
  }
  post<T>(url: string, body?: any) {
    return this.http.post<T>(`${this.base}${url}`, body);
  }
  put<T>(url: string, body?: any) {
    return this.http.put<T>(`${this.base}${url}`, body);
  }
  delete<T>(url: string) {
    return this.http.delete<T>(`${this.base}${url}`);
  }
}
