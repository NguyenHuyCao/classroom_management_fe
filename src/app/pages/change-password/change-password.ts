import { Component } from '@angular/core';
import { SectionTitleComponent } from '../../components/section-title.component';
import { FormsModule } from '@angular/forms';
import { NgClass, NgIf } from '@angular/common';

@Component({
  selector: 'app-change-password',
  templateUrl: './change-password.html',
  standalone: true,
  imports: [SectionTitleComponent, FormsModule, NgClass, NgIf],
})
export class ChangePassword {
  oldPassword = '';
  newPassword = '';
  confirmPassword = '';
  errorMessage = '';
  successMessage = '';

  private readonly correctOldPassword = 'matkhaucu';

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
  }
}
