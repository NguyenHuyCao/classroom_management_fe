import { Component, signal, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { SectionTitleComponent } from '../../components/title/section-title.component';
import { ConfirmDialog } from '../../components/confirm/confirm-dialog';

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
  lecturer: { name: string; email?: string; phone?: string; dept?: string };
  semester: Semester;
  status: Status;
  capacity: number;
  students: { id: string; name: string; email?: string; phone: string; maiger: string }[];
  schedule: ScheduleItem[];
  description?: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  locationNote?: string;
}

@Component({
  selector: 'app-class-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, SectionTitleComponent, ConfirmDialog],
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
    return new Promise((resolve) => setTimeout(() => resolve(sample), 200));
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

  searchId = signal<string>('');
  searchName = signal<string>('');
  searchPhone = signal<string>('');
  searchEmail = signal<string>('');
  searchMajor = signal<string>('');

  onSearchId(e: Event) {
    const value = (e.target as HTMLInputElement | null)?.value?.trim() ?? '';
    this.searchId.set(value);
    this.pageIndex.set(1);
  }

  onSearchName(e: Event) {
    const value = (e.target as HTMLInputElement | null)?.value?.trim() ?? '';
    this.searchName.set(value);
    this.pageIndex.set(1);
  }

  onSearchPhone(e: Event) {
    const value = (e.target as HTMLInputElement | null)?.value?.trim() ?? '';
    this.searchPhone.set(value);
    this.pageIndex.set(1);
  }

  onSearchEmail(e: Event) {
    const value = (e.target as HTMLInputElement | null)?.value?.trim() ?? '';
    this.searchEmail.set(value);
    this.pageIndex.set(1);
  }

  clearStudentFilters() {
    this.searchId.set('');
    this.searchName.set('');
    this.searchPhone.set('');
    this.searchEmail.set('');
    this.pageIndex.set(1);
  }

  studentsFiltered = computed(() => {
    const d = this.detail();
    if (!d) return [];
    const id = this.searchId().toLowerCase();
    const name = this.searchName().toLowerCase();
    const phone = this.searchPhone().toLowerCase();
    const email = this.searchEmail().toLowerCase();
    const major = this.searchMajor().toLowerCase();

    return d.students.filter((s) => {
      if (id && !s.id.toLowerCase().includes(id)) return false;
      if (name && !s.name.toLowerCase().includes(name)) return false;
      if (phone && !s.phone.toLowerCase().includes(phone)) return false;
      if (email && !(s.email ?? '').toLowerCase().includes(email)) return false;
      if (major && !s.maiger.toLowerCase().includes(major)) return false;
      return true;
    });
  });
  pageSize = signal<number>(10);
  pageIndex = signal<number>(1);

  studentsTotal = computed(() => this.studentsFiltered().length);
  studentsTotalPages = computed(() =>
    Math.max(1, Math.ceil(this.studentsTotal() / this.pageSize()))
  );
  studentsPaged = computed(() => {
    const data = this.studentsFiltered();
    const size = this.pageSize();
    const idx = this.pageIndex();
    const start = (idx - 1) * size;
    return data.slice(start, start + size);
  });
  studentsPageNumbers = computed(() =>
    Array.from({ length: this.studentsTotalPages() }, (_, i) => i + 1)
  );

  constructor() {
    effect(() => {
      this.detail();
      this.pageSize();
      this.pageIndex.set(1);
    });
  }

  onStudentsPageSizeChange(e: Event) {
    const v = Number((e.target as HTMLSelectElement | null)?.value ?? 10);
    this.pageSize.set(v);
    this.pageIndex.set(1);
  }

  goStudentPage(i: number) {
    const total = this.studentsTotalPages();
    if (i < 1 || i > total) return;
    this.pageIndex.set(i);
  }

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
    navigator.clipboard.writeText(code).then(() => alert('Đã sao chép mã lớp: ' + code));
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

  showConfirmDeleteStudent = signal<boolean>(false);
  studentToDelete = signal<{ id: string; name: string } | null>(null);

  askDeleteStudent(s: { id: string; name: string }) {
    this.studentToDelete.set({ id: s.id, name: s.name });
    this.showConfirmDeleteStudent.set(true);
  }
  confirmDeleteStudent() {
    const target = this.studentToDelete();
    if (!target) return;
    this.detail.update((d) => {
      if (!d) return d;
      const next = d.students.filter((x) => x.id !== target.id);
      return { ...d, students: next };
    });
    this.showConfirmDeleteStudent.set(false);
    this.studentToDelete.set(null);

    const totalPagesAfter = Math.max(1, Math.ceil(this.studentsTotal() / this.pageSize()));
    if (this.pageIndex() > totalPagesAfter) this.pageIndex.set(totalPagesAfter);
  }
  cancelDeleteStudent() {
    this.showConfirmDeleteStudent.set(false);
    this.studentToDelete.set(null);
  }
}
