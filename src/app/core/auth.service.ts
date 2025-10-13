import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

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
export interface LoginReq {
  email: string;
  password: string;
  remember: boolean;
}
export interface LoginData {
  accessToken: string;
  refreshToken: string;
  userId: number;
  fullName: string;
  role: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  private _tokens = signal<Tokens | null>(null);
  private _user = signal<User | null>(null);

  private base = environment.apiBaseUrl;
  private refreshing?: Promise<string>;

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

  async login(p: { username: string; password: string; remember: boolean }) {
    // BE nhận email, UI đang nhập "username" -> map sang email
    const body: LoginReq = { email: p.username, password: p.password, remember: p.remember };

    // envelopeInterceptor đã unbox -> nhận thẳng LoginData
    const d = await firstValueFrom(this.http.post<LoginData>(`${this.base}/auth/login`, body));

    this.setSession(
      { accessToken: d.accessToken, refreshToken: d.refreshToken },
      { id: String(d.userId), name: d.fullName, role: d.role, email: body.email },
      p.remember
    );
  }

  refresh(): Promise<string> {
    if (this.refreshing) return this.refreshing;

    const rt = this._tokens()?.refreshToken;
    if (!rt) return Promise.reject(new Error('No refresh token'));

    this.refreshing = firstValueFrom(
      this.http.post<{ accessToken: string; refreshToken: string }>(`${this.base}/auth/refresh`, {
        refreshToken: rt,
      })
    )
      .then((res) => {
        const nextTokens: Tokens = {
          accessToken: res.accessToken,
          refreshToken: res.refreshToken,
        };
        this.setSession(nextTokens, this._user()!, true);
        return nextTokens.accessToken;
      })
      .catch((e) => {
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
