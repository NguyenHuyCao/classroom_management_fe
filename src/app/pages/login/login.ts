import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink, RouterLinkActive } from '@angular/router';
import { NgClass, NgIf } from '@angular/common';
import { AuthService } from '../../core/auth.service';
import { ApiError } from '../../core/interceptors/envelope.interceptor';
import { ToastService } from '../../components/toast/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, NgIf, NgClass, RouterLink, RouterLinkActive],
  templateUrl: './login.html',
})
export class Login {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);

  loading = signal(false);
  showPwd = signal(false);
  err = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    username: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    remember: [true],
  });

  get f() {
    return this.form.controls;
  }

  async submit() {
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);
    this.err.set(null);
    try {
      await this.auth.login(this.form.getRawValue());
      this.toast.success('Đăng nhập thành công');
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/home';
      this.router.navigateByUrl(returnUrl);
    } catch (e: any) {
      const msg =
        e instanceof ApiError
          ? e.message || 'Đăng nhập thất bại.'
          : e?.message || 'Đăng nhập thất bại.';
      this.err.set(msg);
      this.toast.danger(msg); // <<< toast lỗi
    } finally {
      this.loading.set(false);
    }
  }
}
