import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

type Tone = 'primary' | 'danger' | 'warning';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirm-dialog.html',
  styleUrls: ['./confirm-dialog.scss'],
})
export class ConfirmDialog {
  @Input() open = false;
  @Input() title = 'Xác nhận';
  @Input() message = 'Bạn có chắc chắn muốn thực hiện hành động này?';
  @Input() confirmText = 'Đồng ý';
  @Input() cancelText = 'Hủy';
  @Input() tone: Tone = 'primary'; // ảnh hưởng màu nút confirm
  @Input() closeOnBackdrop = true;

  @Output() confirmed = new EventEmitter<void>();
  @Output() canceled = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>(); // bất cứ cách đóng nào

  get confirmBtnClass() {
    return {
      'btn-primary': this.tone === 'primary',
      'btn-danger': this.tone === 'danger',
      'btn-warning': this.tone === 'warning',
    };
  }

  onBackdropClick(e: MouseEvent) {
    if (!this.closeOnBackdrop) return;
    const target = e.target as HTMLElement;
    if (target?.classList.contains('cdk-backdrop')) {
      this.close('cancel');
    }
  }

  confirm() {
    this.confirmed.emit();
    this.closed.emit();
  }
  cancel() {
    this.canceled.emit();
    this.closed.emit();
  }
  close(type: 'confirm' | 'cancel') {
    if (type === 'confirm') this.confirm();
    else this.cancel();
  }
}
