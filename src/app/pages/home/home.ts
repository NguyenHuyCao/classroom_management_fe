import { Component, inject, signal } from '@angular/core';
import { CommonModule, NgIf } from '@angular/common';
import { firstValueFrom } from 'rxjs';

import { SectionTitleComponent } from '../../components/title/section-title.component';
import { Api } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../components/toast/toast.service';

type StudentMe = {
  userId: number;
  fullName: string;
  email: string;
  phone: string;
  studentCode: string;
  genderCode: 'MALE' | 'FEMALE';
  specializedClass: string;
  majorName: string;
  cohortName: string;
};

type TeacherMe = {
  userId: number;
  fullName: string;
  email: string;
  phone: string;
  lecturerCode: string;
  departmentName: string;
  academicRank: 'MSC' | 'DR' | 'ASSOC_PROF' | 'PROF' | string;
};

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, NgIf, SectionTitleComponent],
  templateUrl: './home.html',
  styleUrls: ['./home.scss'],
})
export class Home {
  private api = inject(Api);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  loading = signal(true);
  err = signal<string | null>(null);

  // tuỳ role sẽ có một trong hai biến này có dữ liệu
  student = signal<StudentMe | null>(null);
  teacher = signal<TeacherMe | null>(null);

  constructor() {
    this.load();
  }

  async load() {
    this.loading.set(true);
    this.err.set(null);
    this.student.set(null);
    this.teacher.set(null);

    try {
      const me = await firstValueFrom(this.api.get<StudentMe | TeacherMe>('/users/me'));

      if ((me as any)?.studentCode) {
        this.student.set(me as StudentMe);
        const u = this.auth.user();
        if (u && !u.code) {
          (u as any).code = (me as StudentMe).studentCode;
        }
      } else {
        this.teacher.set(me as TeacherMe);
        const u = this.auth.user();
        if (u && !u.code) {
          (u as any).code = (me as TeacherMe).lecturerCode;
        }
      }
    } catch (e: any) {
      this.err.set(e?.message || 'Không thể tải thông tin người dùng.');
      this.toast.danger(this.err()!);
    } finally {
      this.loading.set(false);
    }
  }

  genderVi(code: 'MALE' | 'FEMALE' | undefined) {
    if (!code) return '—';
    return code === 'MALE' ? 'Nam' : 'Nữ';
  }

  rankVi(code: string | undefined) {
    switch (code) {
      case 'MSC':
        return 'Thạc sĩ';
      case 'DR':
        return 'Tiến sĩ';
      case 'ASSOC_PROF':
        return 'Phó Giáo sư';
      case 'PROF':
        return 'Giáo sư';
      default:
        return code || '—';
    }
  }

  upper(s: string | undefined) {
    return (s || '').toUpperCase();
  }
}
