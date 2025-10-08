import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { Home } from './pages/home/home';
import { Shell } from './layout/shell';
import { ChangePassword } from './pages/change-password/change-password';
import { Program } from './pages/program/program';
import { ClassManager } from './pages/class-manager/class-manager';
import { ClassCatalog } from './pages/class-catalog/class-catalog';

// const authGuard: CanActivateFn = () => inject(AuthService).isLoggedIn();

export const routes: Routes = [
  { path: 'login', component: Login },
  {
    path: '',
    component: Shell,
    children: [
      { path: 'home', component: Home },
      { path: 'change-password', component: ChangePassword },
      { path: 'program', component: Program },
      { path: 'class-manager', component: ClassManager },
      { path: 'class-catalog', component: ClassCatalog },
      { path: '', pathMatch: 'full', redirectTo: 'home' },
    ],
  },
  { path: '**', redirectTo: '' },
];
