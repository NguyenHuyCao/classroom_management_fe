import { Component } from '@angular/core';
import { SectionTitleComponent } from '../../components/title/section-title.component';
import { FormsModule } from '@angular/forms';
import { NgClass, NgIf } from '@angular/common';
import { Router } from '@angular/router';

import { ConfirmDialog } from '../../components/confirm/confirm-dialog';

@Component({
  selector: 'app-change-password',
  templateUrl: './change-password.html',
  standalone: true,
  imports: [SectionTitleComponent, FormsModule, NgClass, NgIf, ConfirmDialog],
})
export class ChangePassword {
  oldPassword = '';
  newPassword = '';
  confirmPassword = '';
  errorMessage = '';
  successMessage = '';

  showConfirmPostChange = false;

  private readonly correctOldPassword = 'matkhaucu';

  constructor(private router: Router) {}

  onSubmit() {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.oldPassword || !this.newPassword || !this.confirmPassword) {
      this.errorMessage = 'Không được để trống dữ liệu!';
      return;
    }

    if (this.oldPassword !== this.correctOldPassword) {
      this.errorMessage = 'Mật khẩu cũ không chính xác!';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'Mật khẩu mới không khớp nhau!';
      return;
    }

    this.successMessage = 'Thay đổi mật khẩu thành công';
    this.showConfirmPostChange = true;
  }

  confirmLogoutAfterChange() {
    this.showConfirmPostChange = false;

    this.router.navigate(['/login']);
  }

  cancelPostChange() {
    this.showConfirmPostChange = false;
  }
}
