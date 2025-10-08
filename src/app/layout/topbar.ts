import { Component, Renderer2 } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './topbar.html',
})
export class Topbar {
  constructor(private r: Renderer2) {}
  toggleSidebar() {
    const has = document.body.classList.contains('sidebar-collapsed');
    if (has) this.r.removeClass(document.body, 'sidebar-collapsed');
    else this.r.addClass(document.body, 'sidebar-collapsed');
  }
}
