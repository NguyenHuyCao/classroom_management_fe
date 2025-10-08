import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Topbar } from './topbar';
import { Sidenav } from './sidenav';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, Topbar, Sidenav],
  template: `
    <app-topbar />
    <div class="app-shell">
      <app-sidenav />
      <main class="app-main">
        <router-outlet />
      </main>
    </div>
  `,
})
export class Shell {}
