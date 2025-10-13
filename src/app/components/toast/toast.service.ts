import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type ToastType = 'success' | 'info' | 'warning' | 'danger';
export interface Toast {
  id: number;
  type: ToastType;
  title?: string;
  message: string;
  delay: number; 
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  // danh sách toast
  toasts = signal<Toast[]>([]);

  private push(t: Omit<Toast, 'id'>) {
    const id = Date.now() + Math.random();
    const toast: Toast = { id, ...t };
    this.toasts.update((list) => [...list, toast]);
    if (this.isBrowser && t.delay > 0) setTimeout(() => this.remove(id), t.delay);
  }

  remove(id: number) {
    this.toasts.update((list) => list.filter((x) => x.id !== id));
  }

  show(message: string, type: ToastType = 'info', title?: string, delay = 3500) {
    this.push({ type, title, message, delay });
  }
  success(message: string, title = 'Thành công', delay = 3000) {
    this.show(message, 'success', title, delay);
  }
  info(message: string, title = 'Thông báo', delay = 3500) {
    this.show(message, 'info', title, delay);
  }
  warning(message: string, title = 'Cảnh báo', delay = 4000) {
    this.show(message, 'warning', title, delay);
  }
  danger(message: string, title = 'Lỗi', delay = 4500) {
    this.show(message, 'danger', title, delay);
  }
}
