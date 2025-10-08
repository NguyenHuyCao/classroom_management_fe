import { Component, OnDestroy, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NgIf } from '@angular/common';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-forgot',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, NgIf],
  templateUrl: './forgot.html',
})
export class ForgotPassword implements OnDestroy {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private auth = inject(AuthService);

  step = signal<1 | 2 | 3>(1);
  loading = signal(false);
  err = signal<string | null>(null);
  info = signal<string | null>(null);

  countdown = signal<number>(0);
  private timer?: any;

  emailForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  codeForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.minLength(4)]],
  });

  resetForm = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirm: ['', [Validators.required, Validators.minLength(6)]],
  });

  get ef() {
    return this.emailForm.controls;
  }
  get cf() {
    return this.codeForm.controls;
  }
  get rf() {
    return this.resetForm.controls;
  }

  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private startCountdown(sec = 60) {
    this.countdown.set(sec);
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      const s = this.countdown() - 1;
      this.countdown.set(Math.max(0, s));
      if (s <= 0) {
        clearInterval(this.timer);
        this.timer = null;
      }
    }, 1000);
  }

  async sendEmail() {
    if (this.emailForm.invalid || this.loading()) return;
    this.loading.set(true);
    this.err.set(null);
    this.info.set(null);
    const email = this.emailForm.value.email!;
    try {
      const svc = this.auth as any;
      if (typeof svc.requestPasswordReset === 'function') {
        await svc.requestPasswordReset({ email });
      } else {
        await new Promise((res) => setTimeout(res, 800));
      }
      this.info.set(`Đã gửi mã xác nhận tới ${email}.`);
      this.step.set(2);
      this.startCountdown(60);
    } catch {
      this.err.set('Không gửi được email. Vui lòng thử lại.');
    } finally {
      this.loading.set(false);
    }
  }

  async verifyCode() {
    if (this.codeForm.invalid || this.loading()) return;
    this.loading.set(true);
    this.err.set(null);
    const email = this.emailForm.value.email!;
    const code = this.codeForm.value.code!;
    try {
      const svc = this.auth as any;
      if (typeof svc.verifyResetCode === 'function') {
        await svc.verifyResetCode({ email, code });
      } else {
        await new Promise((res) => setTimeout(res, 500)); 
      }
      this.step.set(3);
    } catch {
      this.err.set('Mã xác nhận không hợp lệ.');
    } finally {
      this.loading.set(false);
    }
  }

  async updatePassword() {
    if (this.resetForm.invalid || this.loading()) return;
    if (this.resetForm.value.password !== this.resetForm.value.confirm) {
      this.err.set('Mật khẩu xác nhận không khớp.');
      return;
    }
    this.loading.set(true);
    this.err.set(null);
    const email = this.emailForm.value.email!;
    const code = this.codeForm.value.code!;
    const password = this.resetForm.value.password!;
    try {
      const svc = this.auth as any;
      if (typeof svc.updatePassword === 'function') {
        await svc.updatePassword({ email, code, password });
      } else {
        await new Promise((res) => setTimeout(res, 700)); 
      }
      this.router.navigateByUrl('/login');
    } catch {
      this.err.set('Cập nhật mật khẩu thất bại.');
    } finally {
      this.loading.set(false);
    }
  }

  async resend() {
    if (this.countdown() > 0) return;
    await this.sendEmail();
  }
}
