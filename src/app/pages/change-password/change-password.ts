import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { NgIf, NgClass } from '@angular/common';
import { Router } from '@angular/router';

import { SectionTitleComponent } from '../../components/title/section-title.component';
import { ConfirmDialog } from '../../components/confirm/confirm-dialog';
import { AuthService } from '../../core/auth.service';
import { ApiError } from '../../core/interceptors/envelope.interceptor';
import { ToastService } from '../../components/toast/toast.service';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [SectionTitleComponent, ReactiveFormsModule, NgIf, NgClass, ConfirmDialog],
  templateUrl: './change-password.html',
})
export class ChangePassword {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);

  loading = signal(false);
  showConfirmPostChange = signal(false);
  err = signal<string | null>(null);
  ok = signal<string | null>(null);
  showOld = signal(false);
  showNew = signal(false);
  showCf = signal(false);

  form = this.fb.nonNullable.group({
    currentPassword: ['', [Validators.required, Validators.minLength(6)]],
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required, Validators.minLength(6)]],
  });

  get f() {
    return this.form.controls;
  }

  async onSubmit() {
    this.err.set(null);
    this.ok.set(null);

    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.f.newPassword.value !== this.f.confirmPassword.value) {
      this.err.set('Mật khẩu mới không khớp nhau!');
      return;
    }

    this.loading.set(true);
    try {
      await this.auth.changePassword({
        currentPassword: this.f.currentPassword.value,
        newPassword: this.f.newPassword.value,
      });

      this.ok.set('Đổi mật khẩu thành công.');
      this.toast.success('Đổi mật khẩu thành công');
      this.showConfirmPostChange.set(true);

      this.form.reset();
    } catch (e: any) {
      const msg =
        e instanceof ApiError
          ? e.message || 'Đổi mật khẩu thất bại.'
          : e?.message || 'Đổi mật khẩu thất bại.';
      this.err.set(msg);
      this.toast.danger(msg);
    } finally {
      this.loading.set(false);
    }
  }

  confirmLogoutAfterChange() {
    this.showConfirmPostChange.set(false);
    this.auth.logout();
    this.router.navigate(['/login']);
  }
  cancelPostChange() {
    this.showConfirmPostChange.set(false);
  }
}
