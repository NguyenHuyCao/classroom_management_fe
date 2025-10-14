import { Component, computed, inject } from '@angular/core';
import { NgClass, NgFor, CommonModule } from '@angular/common';
import { ToastService, Toast } from './toast.service';

@Component({
  selector: 'app-toasts',
  standalone: true,
  imports: [NgFor, NgClass, CommonModule],
  template: `
    <div class="cm-toasts" aria-live="polite" aria-atomic="true">
      <div
        *ngFor="let t of list(); trackBy: trackById"
        class="cm-toast shadow-sm"
        [ngClass]="'cm-' + t.type"
      >
        <div class="cm-accent"></div>

        <div class="cm-body">
          <div class="cm-head">
            <div class="cm-title">
              <i class="bi" [ngClass]="icon(t.type)"></i>
              <strong>{{ titleOf(t.type) }}</strong>
            </div>
            <button
              type="button"
              class="btn-close"
              aria-label="Close"
              (click)="close(t.id)"
            ></button>
          </div>

          <div class="cm-message">{{ t.message }}</div>

          <div *ngIf="t.delay > 0" class="cm-progress" [style.animationDuration.ms]="t.delay"></div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./toasts.component.scss'],
})
export class ToastsContainer {
  private toast = inject(ToastService);
  list = computed(() => this.toast.toasts());
  trackById = (_: number, t: Toast) => t.id;

  close(id: number) {
    this.toast.remove(id);
  }

  titleOf(t: Toast['type']) {
    return t === 'success'
      ? 'Thành công'
      : t === 'warning'
      ? 'Cảnh báo'
      : t === 'danger'
      ? 'Lỗi'
      : 'Thông báo';
  }
  icon(t: Toast['type']) {
    return t === 'success'
      ? 'bi-check-circle-fill'
      : t === 'warning'
      ? 'bi-exclamation-triangle-fill'
      : t === 'danger'
      ? 'bi-x-circle-fill'
      : 'bi-info-circle-fill';
  }
}
