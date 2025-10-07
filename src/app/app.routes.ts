import { Routes, CanActivateFn } from '@angular/router';
import { Login } from './pages/login/login';
import { Home } from './pages/home/home';
import { inject } from '@angular/core';
import { AuthService } from './core/auth.service';

const authGuard: CanActivateFn = () => inject(AuthService).isLoggedIn();

export const routes: Routes = [
  { path: 'login', component: Login },
  { path: 'home', component: Home, canActivate: [authGuard] },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: '**', redirectTo: 'login' },
];
