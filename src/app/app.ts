import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastsContainer } from './components/toast/toasts.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastsContainer],
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
})
export class App {
  protected readonly title = signal('classroom_management_fe');
}
