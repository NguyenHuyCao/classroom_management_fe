import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

type LoginPayload = { 
  username: string; 
  password: string; 
  remember: boolean 
};
type LoginResponse = {
  accessToken: string;
  refreshToken?: string;
  user: { id: number; name: string };
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _loggedIn = signal(false);
  isLoggedIn = () => this._loggedIn();

  constructor(private http: HttpClient) {}

  async loginMock(p: LoginPayload) {
    await new Promise((r) => setTimeout(r, 700));
    if (p.username.length >= 3 && p.password.length >= 6) {
      this._loggedIn.set(true);
      if (p.remember) localStorage.setItem('token', 'abcadđfadfasdf');
      return;
    }
    throw new Error('Invalid');
  }

  async login(p: LoginPayload) {
    return this.loginMock(p); 
  }

  setSession(res: LoginResponse, remember: boolean) {
  }

  logout() {
  }
}
