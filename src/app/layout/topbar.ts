import { Component, Renderer2, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ConfirmDialog } from '../components/confirm/confirm-dialog';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, ConfirmDialog],
  templateUrl: './topbar.html',
})
export class Topbar {
  private r = inject(Renderer2);
  private router = inject(Router);
  private auth = inject(AuthService);

  showConfirmLogout = false;
  user = computed(() => this.auth.user());

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
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  cancelLogout() {
    this.showConfirmLogout = false;
  }
}
