import { Component, signal, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpClient, HttpClientModule, HttpParams } from '@angular/common/http';
import { SectionTitleComponent } from '../../components/title/section-title.component';
import { ConfirmDialog } from '../../components/confirm/confirm-dialog';

type Status = 'Online' | 'Offline';
type Semester = 'HK1' | 'HK2' | 'HK He';

interface ScheduleItemVM {
  day: number; // 1..7
  start: string; // "08:00"
  end: string; // "10:00"
  room: string; // "P203" | "Online"
  link?: string; // optional
}

interface IClassDetail {
  id: string; // dùng classCode cho tiện
  year: number; // academicYear
  code: string; // classCode
  name: string; // className
  subject: string; // courseCode
  lecturer: { name: string; email?: string; phone?: string; dept?: string };
  semester: Semester; // map từ HK1/HK2/HKHE -> HK1/HK2/HK He
  status: Status; // map từ ONLINE/OFFLINE
  capacity: number;
  enrolled: number; // từ API
  schedule: ScheduleItemVM[];
  description?: string; // note
  createdAt: string; // ISO
  updatedAt: string; // ISO
  locationNote?: string;
}

type StudentRowVM = {
  id: string; // studentCode
  name: string; // fullName
  phone: string;
  email?: string;
  maiger: string; // giữ đúng tên cũ để không phải sửa template (majorName)
};

type ApiResponse<T> = { success: boolean; code?: string | null; message?: string | null; data: T };
type PageResponse<T> = {
  page: number;
  size: number;
  totalPages: number;
  totalElements: number;
  items: T[];
};

@Component({
  selector: 'app-class-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, SectionTitleComponent, ConfirmDialog],
  templateUrl: './class-detail.html',
  styleUrls: ['./class-detail.scss'],
})
export class ClassDetail {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);

  private readonly API_BASE = 'http://localhost:8080/api/v1/classes';

  // route param là classCode (VD: CS102-K40A)
  classCode = signal<string>('');

  // ----- DETAIL -----
  loading = signal<boolean>(true);
  error = signal<string | null>(null);
  detail = signal<IClassDetail | null>(null);

  enrolledCount = computed(() => this.detail()?.enrolled ?? 0);
  capacity = computed(() => this.detail()?.capacity ?? 0);
  progressPct = computed(() => {
    const cap = this.capacity() || 1;
    return Math.min(100, Math.round((this.enrolledCount() / cap) * 100));
  });

  // ----- STUDENTS (server-side paging/filter) -----
  studentsLoading = signal<boolean>(false);
  studentsError = signal<string | null>(null);
  // filters
  searchId = signal<string>(''); // code
  searchName = signal<string>(''); // name
  searchPhone = signal<string>(''); // phone
  searchEmail = signal<string>(''); // email
  searchMajor = signal<string>(''); // (không có filter ở API, chỉ giữ cho tương thích giao diện – không dùng)

  // paging
  pageSize = signal<number>(10);
  pageIndex = signal<number>(1); // 1-based cho UI; API 0-based

  // page snapshot
  private studentsPageSnapshot = signal<{
    items: StudentRowVM[];
    totalPages: number;
    totalElements: number;
  }>({ items: [], totalPages: 1, totalElements: 0 });

  studentsTotal = computed(() => this.studentsPageSnapshot().totalElements);
  studentsTotalPages = computed(() => Math.max(1, this.studentsPageSnapshot().totalPages));
  studentsPaged = computed(() => this.studentsPageSnapshot().items);
  studentsPageNumbers = computed(() =>
    Array.from({ length: this.studentsTotalPages() }, (_, i) => i + 1)
  );

  constructor() {
    // Khi thay đổi size → về trang 1
    effect(() => {
      this.pageSize();
      this.pageIndex.set(1);
    });
  }

  // ----- UI handlers -----
  onSearchId(e: Event) {
    this.searchId.set(((e.target as HTMLInputElement | null)?.value ?? '').trim());
  }
  onSearchName(e: Event) {
    this.searchName.set(((e.target as HTMLInputElement | null)?.value ?? '').trim());
  }
  onSearchPhone(e: Event) {
    this.searchPhone.set(((e.target as HTMLInputElement | null)?.value ?? '').trim());
  }
  onSearchEmail(e: Event) {
    this.searchEmail.set(((e.target as HTMLInputElement | null)?.value ?? '').trim());
  }

  doSearchStudents() {
    this.pageIndex.set(1);
    this.reloadStudents();
  }

  clearStudentFilters() {
    this.searchId.set('');
    this.searchName.set('');
    this.searchPhone.set('');
    this.searchEmail.set('');
    this.searchMajor.set('');
    this.pageIndex.set(1);
    this.reloadStudents();
  }

  onStudentsPageSizeChange(e: Event) {
    const v = Number((e.target as HTMLSelectElement | null)?.value ?? 10);
    this.pageSize.set(v);
    this.pageIndex.set(1);
    this.reloadStudents();
  }

  goStudentPage(i: number) {
    const total = this.studentsTotalPages();
    if (i < 1 || i > total) return;
    this.pageIndex.set(i);
    this.reloadStudents();
  }

  // ----- lifecycle -----
  ngOnInit() {
    const code = this.route.snapshot.paramMap.get('id') ?? 'unknown-code';
    this.classCode.set(code);
    this.loadDetail(code);
    this.reloadStudents();
  }

  // ----- API calls -----
  private loadDetail(code: string) {
    this.loading.set(true);
    this.error.set(null);

    this.http.get<ApiResponse<any>>(`${this.API_BASE}/${encodeURIComponent(code)}`).subscribe({
      next: (res) => {
        const d = res.data;
        const vm: IClassDetail = {
          id: d.classCode,
          year: d.academicYear,
          code: d.classCode,
          name: d.className,
          subject: d.courseCode,
          lecturer: {
            name: d.teacherName,
            email: d.teacherEmail,
            phone: d.teacherPhone,
            dept: d.teacherDepartment,
          },
          semester: d.semesterCode === 'HKHE' ? 'HK He' : (d.semesterCode as Semester),
          status: (d.deliveryMode ?? '').toUpperCase() === 'ONLINE' ? 'Online' : 'Offline',
          capacity: d.capacity,
          enrolled: Number(d.enrolled ?? 0),
          schedule: (d.schedules ?? []).map((s: any) => ({
            day: Number(s.weekdayNo), // 1..7
            start: s.startTime,
            end: s.endTime,
            room: s.roomCode,
            link: s.link || undefined,
          })),
          description: d.note || undefined,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt ?? d.createdAt,
          locationNote: d.locationNote || undefined,
        };
        this.detail.set(vm);
      },
      error: () => this.error.set('Không tải được dữ liệu lớp học.'),
      complete: () => this.loading.set(false),
    });
  }

  private reloadStudents() {
    const code = this.classCode();
    if (!code) return;

    this.studentsLoading.set(true);
    this.studentsError.set(null);

    let params = new HttpParams()
      .set('page', String(this.pageIndex() - 1)) // API 0-based
      .set('size', String(this.pageSize()));

    const codeFilter = this.searchId();
    const nameFilter = this.searchName();
    const phoneFilter = this.searchPhone();
    const emailFilter = this.searchEmail();

    if (codeFilter) params = params.set('code', codeFilter);
    if (nameFilter) params = params.set('name', nameFilter);
    if (phoneFilter) params = params.set('phone', phoneFilter);
    if (emailFilter) params = params.set('email', emailFilter);

    // loadDetail
    this.http.get<any>(`${this.API_BASE}/${encodeURIComponent(code)}`).subscribe({
      next: (d) => {
        const vm: IClassDetail = {
          id: d.classCode,
          year: d.academicYear,
          code: d.classCode,
          name: d.className,
          subject: d.courseCode,
          lecturer: {
            name: d.teacherName,
            email: d.teacherEmail,
            phone: d.teacherPhone,
            dept: d.teacherDepartment,
          },
          semester: d.semesterCode === 'HKHE' ? 'HK He' : d.semesterCode,
          status: (d.deliveryMode ?? '').toUpperCase() === 'ONLINE' ? 'Online' : 'Offline',
          capacity: d.capacity,
          enrolled: Number(d.enrolled ?? 0),
          schedule: (d.schedules ?? []).map((s: any) => ({
            day: Number(s.weekdayNo),
            start: s.startTime,
            end: s.endTime,
            room: s.roomCode,
            link: s.link || undefined,
          })),
          description: d.note || undefined,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt ?? d.createdAt,
          locationNote: d.locationNote || undefined,
        };
        this.detail.set(vm);
      },
      error: () => this.error.set('Không tải được dữ liệu lớp học.'),
      complete: () => this.loading.set(false),
    });

    // reloadStudents
    this.http
      .get<PageResponse<any>>(`${this.API_BASE}/${encodeURIComponent(code)}/students`, { params })
      .subscribe({
        next: (p) => {
          const items: StudentRowVM[] = (p.items ?? []).map((s: any) => ({
            id: s.studentCode,
            name: s.fullName,
            phone: s.phone,
            email: s.email,
            maiger: s.majorName,
          }));
          this.studentsPageSnapshot.set({
            items,
            totalPages: p.totalPages ?? 1,
            totalElements: p.totalElements ?? items.length,
          });
        },
        error: () => this.studentsError.set('Không tải được danh sách sinh viên.'),
        complete: () => this.studentsLoading.set(false),
      });
  }

  // ----- helpers -----
  weekdayName(n: number): string {
    // 1..7 = Thứ 2..Thứ 7 / CN
    switch (n) {
      case 1:
        return 'Thứ 2';
      case 2:
        return 'Thứ 3';
      case 3:
        return 'Thứ 4';
      case 4:
        return 'Thứ 5';
      case 5:
        return 'Thứ 6';
      case 6:
        return 'Thứ 7';
      case 7:
        return 'CN';
      default:
        return `Thứ ${n}`;
    }
  }

  copyCode() {
    const code = this.detail()?.code ?? '';
    navigator.clipboard.writeText(code).then(() => alert('Đã sao chép mã lớp: ' + code));
  }

  printPage() {
    window.print();
  }

  exportStudentsCSV() {
    // xuất dữ liệu của TRANG HIỆN TẠI
    const items = this.studentsPaged();
    const cols = ['MSSV', 'Họ và tên', 'Email', 'SĐT', 'Ngành'];
    const rows = items.map((s) => [s.id, s.name, s.email ?? '', s.phone ?? '', s.maiger ?? '']);
    const csv = [
      cols.join(','),
      ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const fileCode = this.detail()?.code ?? 'class';
    a.href = url;
    a.download = `${fileCode}_students_page${this.pageIndex()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Xoá SV (local UI only). Back-end không có API xoá ở list này nên chỉ cập nhật UI hiện tại.
  showConfirmDeleteStudent = signal<boolean>(false);
  studentToDelete = signal<{ id: string; name: string } | null>(null);

  askDeleteStudent(s: { id: string; name: string }) {
    this.studentToDelete.set({ id: s.id, name: s.name });
    this.showConfirmDeleteStudent.set(true);
  }
  confirmDeleteStudent() {
    const target = this.studentToDelete();
    if (!target) return;
    const current = this.studentsPaged();
    const next = current.filter((x) => x.id !== target.id);
    const snap = this.studentsPageSnapshot();
    this.studentsPageSnapshot.set({
      items: next,
      totalPages: snap.totalPages,
      totalElements: Math.max(0, snap.totalElements - 1),
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
