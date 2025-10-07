import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NgClass, NgIf } from '@angular/common';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, NgIf, NgClass],
  templateUrl: './login.html',
})
export class Login {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  loading = signal(false);
  showPwd = signal(false);
  err = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
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
      this.router.navigateByUrl('/home');
    } catch {
      this.err.set('Sai tài khoản hoặc mật khẩu.');
    } finally {
      this.loading.set(false);
    }
  }
}
