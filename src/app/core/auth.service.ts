import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}
export interface User {
  id: string;
  name: string;
  role?: string;
  email?: string;
}
export interface Envelope<T> {
  success: boolean;
  code: string | null;
  message: string | null;
  data: T;
}
export interface LoginData {
  accessToken: string;
  refreshToken: string;
  userId: number;
  fullName: string;
  role: string;
}
export interface LoginReq {
  email: string;
  password: string;
  remember: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  private _tokens = signal<Tokens | null>(null);
  private _user = signal<User | null>(null);

  private base = environment.apiBaseUrl; // vd: http://localhost:8080/api/v1
  private refreshing?: Promise<string>; // chống gọi refresh trùng

  constructor() {
    if (this.isBrowser) {
      const raw = localStorage.getItem('auth');
      if (raw) {
        try {
          const { tokens, user } = JSON.parse(raw);
          this._tokens.set(tokens);
          this._user.set(user);
        } catch {}
      }
    }
  }

  accessToken = () => this._tokens()?.accessToken ?? null;
  user = () => this._user();
  isLoggedIn = () => !!this._tokens()?.accessToken;

  /** Login theo BE: /auth/login trả Envelope<LoginData> */
  async login(p: { username: string; password: string; remember: boolean }) {
    const body: LoginReq = { email: p.username, password: p.password, remember: p.remember };
    const res = await firstValueFrom(
      this.http.post<Envelope<LoginData>>(`${this.base}/auth/login`, body)
    );
    const d = res.data;
    this.setSession(
      { accessToken: d.accessToken, refreshToken: d.refreshToken },
      { id: String(d.userId), name: d.fullName, role: d.role, email: body.email },
      p.remember
    );
  }

  /** Gọi BE /auth/refresh với refreshToken, trả về accessToken mới */
  refresh(): Promise<string> {
    if (this.refreshing) return this.refreshing;

    const rt = this._tokens()?.refreshToken;
    if (!rt) return Promise.reject(new Error('No refresh token'));

    this.refreshing = firstValueFrom(
      this.http.post<Envelope<{ accessToken: string; refreshToken: string }>>(
        `${this.base}/auth/refresh`,
        { refreshToken: rt }
      )
    )
      .then((res) => {
        const nextTokens: Tokens = {
          accessToken: res.data.accessToken,
          refreshToken: res.data.refreshToken,
        };
        // giữ nguyên user hiện tại
        this.setSession(nextTokens, this._user()!, true);
        return nextTokens.accessToken;
      })
      .catch((e) => {
        // refresh fail -> logout
        this.logout();
        throw e;
      })
      .finally(() => {
        this.refreshing = undefined;
      });

    return this.refreshing;
  }

  private setSession(tokens: Tokens, user: User, remember: boolean) {
    this._tokens.set(tokens);
    this._user.set(user);
    if (remember && this.isBrowser) {
      localStorage.setItem('auth', JSON.stringify({ tokens, user }));
    }
  }

  logout() {
    this._tokens.set(null);
    this._user.set(null);
    if (this.isBrowser) localStorage.removeItem('auth');
  }
}
