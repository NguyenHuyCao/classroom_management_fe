import { Component, signal, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { SectionTitleComponent } from '../../components/section-title.component';

type Status = 'Online' | 'Offline';
type Semester = 'HK1' | 'HK2' | 'HK He';

interface ScheduleItem {
  day: number; // 2..7
  start: string; // "08:00"
  end: string; // "10:00"
  room: string; // "P203" | "Online"
  link?: string; // optional
}

interface IClassDetail {
  id: string;
  year: number;
  code: string;
  name: string;
  subject: string;
  lecturer: {
    name: string;
    email?: string;
    phone?: string;
    dept?: string;
  };
  semester: Semester;
  status: Status;
  capacity: number; // Sĩ số tối đa
  students: { id: string; name: string; email?: string, phone: string, maiger: string }[];
  schedule: ScheduleItem[];
  description?: string; // mô tả
  createdAt: string; // ISO
  updatedAt: string;
  locationNote?: string;
}

@Component({
  selector: 'app-class-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, SectionTitleComponent],
  templateUrl: './class-detail.html',
  styleUrls: ['./class-detail.scss'],
})
export class ClassDetail {
  private route = inject(ActivatedRoute);

  private mockFetch = (id: string): Promise<IClassDetail> => {
    const sample: IClassDetail = {
      id,
      year: 2025,
      code: 'CS101-K40A',
      name: 'Nhập môn Khoa học Máy tính - K40A',
      subject: 'CS101',
      lecturer: {
        name: 'Nguyễn Văn A',
        email: 'nguyenvana@univ.edu',
        phone: '0901 234 567',
        dept: 'Khoa CNTT',
      },
      semester: 'HK1',
      status: 'Offline',
      capacity: 45,
      students: Array.from({ length: 43 }, (_, i) => ({
        id: 'SV' + String(1000 + i),
        name: `Sinh viên ${i + 1}`,
        email: `sv${1000 + i}@student.edu.vn`,
        phone: `0901 23${String(100 + i).padStart(3, '0')}`,
        maiger: i % 2 === 0 ? 'Công nghệ thông tin' : 'Khoa học máy tính',
      })),
      schedule: [
        { day: 2, start: '08:00', end: '10:00', room: 'P203' },
        { day: 5, start: '08:00', end: '10:00', room: 'P203' },
      ],
      description:
        'Lớp học phần dành cho sinh viên năm nhất. Yêu cầu mang laptop, cài sẵn VS Code.',
      createdAt: '2025-08-20T08:00:00.000Z',
      updatedAt: new Date().toISOString(),
      locationNote: 'Tầng 2, nhà P. Nếu học Online, link Zoom sẽ gửi trước 24h.',
    };
    return new Promise((resolve) => setTimeout(() => resolve(sample), 250));
  };

  loading = signal<boolean>(true);
  detail = signal<IClassDetail | null>(null);
  error = signal<string | null>(null);

  enrolledCount = computed(() => this.detail()?.students.length ?? 0);
  capacity = computed(() => this.detail()?.capacity ?? 0);
  progressPct = computed(() => {
    const cap = this.capacity() || 1;
    return Math.min(100, Math.round((this.enrolledCount() / cap) * 100));
  });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id') ?? 'unknown-id';
    this.loading.set(true);
    this.error.set(null);

    this.mockFetch(id)
      .then((d) => this.detail.set(d))
      .catch(() => this.error.set('Không tải được dữ liệu lớp học.'))
      .finally(() => this.loading.set(false));
  }

  copyCode() {
    const code = this.detail()?.code ?? '';
    navigator.clipboard.writeText(code).then(() => {
      alert('Đã sao chép mã lớp: ' + code);
    });
  }

  printPage() {
    window.print();
  }

  exportStudentsCSV() {
    const d = this.detail();
    if (!d) return;
    const cols = ['id', 'name', 'email'];
    const rows = d.students.map((s) => [s.id, s.name, s.email ?? '']);
    const csv = [
      cols.join(','),
      ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${d.code}_students.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
