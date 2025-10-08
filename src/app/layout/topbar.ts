import { Component, Renderer2 } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ConfirmDialog } from '../components/confirm/confirm-dialog';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [RouterLink, ConfirmDialog],
  templateUrl: './topbar.html',
})
export class Topbar {
  showConfirmLogout = false;

  constructor(private r: Renderer2, private router: Router) {}

  toggleSidebar() {
    const has = document.body.classList.contains('sidebar-collapsed');
    if (has) this.r.removeClass(document.body, 'sidebar-collapsed');
    else this.r.addClass(document.body, 'sidebar-collapsed');
  }

  askLogout() {
    this.showConfirmLogout = true;
  }

  confirmLogout() {
    this.showConfirmLogout = false;

    this.router.navigate(['/login']);
  }

  cancelLogout() {
    this.showConfirmLogout = false;
  }
}
