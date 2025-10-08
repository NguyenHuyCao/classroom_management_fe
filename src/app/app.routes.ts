import { Routes, CanActivateFn } from '@angular/router';
import { Login } from './pages/login/login';
import { Home } from './pages/home/home';
import { inject } from '@angular/core';
import { AuthService } from './core/auth.service';
import { Shell } from './layout/shell';

const authGuard: CanActivateFn = () => inject(AuthService).isLoggedIn();

export const routes: Routes = [
  { path: 'login', component: Login },
  {
    path: '',
    component: Shell,
    children: [
      { path: 'home', component: Home },
      { path: '', pathMatch: 'full', redirectTo: 'home' },
    ],
  },
  { path: '**', redirectTo: '' },
];
