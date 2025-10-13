import { Routes } from '@angular/router';
import { Shell } from './layout/shell';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/register/register').then((m) => m.Register),
  },

  {
    path: '',
    component: Shell,
    canActivateChild: [authGuard],
    children: [
      { path: 'home', loadComponent: () => import('./pages/home/home').then((m) => m.Home) },
      {
        path: 'change-password',
        loadComponent: () =>
          import('./pages/change-password/change-password').then((m) => m.ChangePassword),
      },
      {
        path: 'program',
        loadComponent: () => import('./pages/program/program').then((m) => m.Program),
      },
      {
        path: 'class-manager',
        loadComponent: () =>
          import('./pages/class-manager/class-manager').then((m) => m.ClassManager),
      },
      {
        path: 'class-catalog',
        loadComponent: () =>
          import('./pages/class-catalog/class-catalog').then((m) => m.ClassCatalog),
      },
      {
        path: 'class-detail/:id',
        loadComponent: () => import('./pages/class-detail/class-detail').then((m) => m.ClassDetail),
      },
      {
        path: 'people',
        loadComponent: () => import('./pages/list-people/list-people').then((m) => m.ListPeople),
      },
      { path: '', pathMatch: 'full', redirectTo: 'home' },
    ],
  },

  { path: '**', redirectTo: '' },
];
