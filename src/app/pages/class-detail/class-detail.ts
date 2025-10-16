import { Component, signal, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpClient, HttpClientModule, HttpParams } from '@angular/common/http';
import { SectionTitleComponent } from '../../components/title/section-title.component';
import { ConfirmDialog } from '../../components/confirm/confirm-dialog';
import { ToastService } from '../../components/toast/toast.service';
import { ToastsContainer } from '../../components/toast/toasts.component';

type Status = 'Online' | 'Offline';
type Semester = 'HK1' | 'HK2' | 'HK He';

interface ScheduleItemVM {
  day: number; // 1..7
  start: string; // "08:00"
  end: string; // "10:00"
  room: string; // "P203" | "Online"
  link?: string;
}

interface IClassDetail {
  id: string; // classCode
  year: number;
  code: string;
  name: string;
  subject: string; // courseCode
  lecturer: { name: string; email?: string; phone?: string; dept?: string };
  semester: Semester;
  status: Status;
  capacity: number;
  enrolled: number;
  schedule: ScheduleItemVM[];
  description?: string;
  createdAt: string;
  updatedAt: string;
  locationNote?: string;
}

type StudentRowVM = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  maiger: string;
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
  imports: [CommonModule, RouterModule, SectionTitleComponent, ConfirmDialog, ToastsContainer],
  templateUrl: './class-detail.html',
  styleUrls: ['./class-detail.scss'],
})
export class ClassDetail {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private toast = inject(ToastService);

  private readonly API_BASE = 'http://localhost:8080/api/v1/classes';
  private readonly REPORTS_BASE = 'http://localhost:8080/api/v1/reports';

  classCode = signal<string>('');

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
  searchId = signal<string>(''); // MSSV
  searchName = signal<string>(''); // Họ tên
  searchPhone = signal<string>(''); // SĐT
  searchEmail = signal<string>(''); // Email
  searchMajor = signal<string>(''); // giữ cho tương thích UI

  // paging
  pageSize = signal<number>(5);
  pageIndex = signal<number>(1); // 1-based UI

  // snapshot
  private studentsPageSnapshot = signal<{
    items: StudentRowVM[];
    totalPages: number;
    totalElements: number;
  }>({ items: [], totalPages: 1, totalElements: 0 });

  studentsTotal = computed(() => this.studentsPageSnapshot().totalElements);
  studentsTotalPages = computed(() => Math.max(1, this.studentsPageSnapshot().totalPages));
  studentsPaged = computed(() => this.studentsPageSnapshot().items);
  // studentsPageNumbers = computed(() =>
  //   Array.from({ length: this.studentsTotalPages() }, (_, i) => i + 1)
  // );

  // ----- DELETE STATE (theo studentCode) -----
  showConfirmDeleteStudent = signal<boolean>(false);
  studentToDelete = signal<{ id: string; name: string } | null>(null); // id = studentCode
  deletingId = signal<string | null>(null); // đang xoá MSSV nào

  constructor() {
    effect(() => {
      this.pageSize();
      this.pageIndex.set(1);
    });
  }
  exportStudentsPDF() {
    const code = this.classCode();
    if (!code) {
      this.toast.warning('Chưa có mã lớp để xuất PDF.');
      return;
    }

    const url = `${this.REPORTS_BASE}/classes/${encodeURIComponent(code)}/students.pdf`;

    // Luôn gọi bằng HttpClient để kèm Authorization
    this.http
      .get(url, {
        observe: 'response',
        responseType: 'blob' as const,
      })
      .subscribe({
        next: (res) => {
          // Lấy filename nếu BE có set
          const dispo = res.headers.get('Content-Disposition') || '';
          const m = /filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i.exec(dispo);
          const filename = m ? decodeURIComponent(m[1]) : `${code}_students.pdf`;

          // Mở inline; nếu bị chặn thì tải xuống
          const blob = new Blob([res.body!], { type: 'application/pdf' });
          const previewUrl = URL.createObjectURL(blob);
          const win = window.open(previewUrl, '_blank');
          if (!win) {
            const a = document.createElement('a');
            a.href = previewUrl;
            a.download = filename;
            a.click();
          }
          setTimeout(() => URL.revokeObjectURL(previewUrl), 30000);
        },
        error: (err) => {
          // Nếu BE trả JSON lỗi, hiển thị message dễ hiểu
          const body = err?.error;
          if (body && body.type === 'application/json') {
            try {
              const reader = new FileReader();
              reader.onload = () => {
                try {
                  this.toast.danger(
                    JSON.parse(String(reader.result)).message || 'Xuất PDF thất bại.'
                  );
                } catch {
                  this.toast.danger('Xuất PDF thất bại.');
                }
              };
              reader.readAsText(body);
              return;
            } catch {}
          }
          this.toast.danger(
            err?.status === 403 ? 'Bạn không có quyền truy cập tệp PDF này.' : 'Xuất PDF thất bại.'
          );
        },
      });
  }

  // lifecycle
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
        const d = (res && 'data' in res ? (res as any).data : res) as any;
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
  }

  private reloadStudents() {
    const code = this.classCode();
    if (!code) return;

    this.studentsLoading.set(true);
    this.studentsError.set(null);

    let params = new HttpParams()
      .set('page', String(this.pageIndex() - 1)) // UI 1-based -> API 0-based
      .set('size', String(this.pageSize()));

    const codeFilter = this.searchId().trim();
    const nameFilter = this.searchName().trim();
    const phoneFilter = this.searchPhone().trim();
    const emailFilter = this.searchEmail().trim();

    if (codeFilter) params = params.set('code', codeFilter);
    if (nameFilter) params = params.set('name', nameFilter);
    if (phoneFilter) params = params.set('phone', phoneFilter);
    if (emailFilter) params = params.set('email', emailFilter);

    this.http
      .get<ApiResponse<PageResponse<any>>>(
        `${this.API_BASE}/${encodeURIComponent(code)}/students`,
        { params }
      )
      .subscribe({
        next: (res) => {
          const p = (res && 'data' in res ? res.data : (res as any)) as PageResponse<any>;

          const bePage0 = Number(p?.page ?? 0);
          const beSize = Number(p?.size ?? this.pageSize());
          const beTotalElements = Number(p?.totalElements ?? 0);
          const calcTotalPages = Math.max(1, Math.ceil(beTotalElements / Math.max(1, beSize)));
          const desiredUiPage = bePage0 + 1;

          // Nếu trang yêu cầu lớn hơn tổng trang thực -> lùi về trang cuối rồi stop để lần gọi sau lấy dữ liệu đúng
          if (desiredUiPage > calcTotalPages) {
            this.pageIndex.set(calcTotalPages);
            return;
          }

          // Đồng bộ lại pageIndex/pageSize theo BE (giống các trang khác)
          if (this.pageIndex() !== desiredUiPage) this.pageIndex.set(desiredUiPage);
          if (this.pageSize() !== beSize) this.pageSize.set(beSize);

          const items: StudentRowVM[] = (p?.items ?? []).map((s: any) => ({
            id: s.studentCode,
            name: s.fullName,
            phone: s.phone,
            email: s.email,
            maiger: s.majorName, // (giữ key như hiện tại)
          }));

          this.studentsPageSnapshot.set({
            items,
            totalPages: calcTotalPages,
            totalElements: beTotalElements,
          });
        },
        error: () => this.studentsError.set('Không tải được danh sách sinh viên.'),
        complete: () => this.studentsLoading.set(false),
      });
  }

  // ----- filters & paging handlers -----
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
  goStudentPage(i: number | '…') {
    if (i === '…') return; // bỏ qua nút dấu ba chấm
    const total = this.studentsTotalPages();
    if (i < 1 || i > total || i === this.pageIndex()) return; // không vượt biên / không set trùng
    this.pageIndex.set(i);
    this.reloadStudents();
  }

  // ----- helpers -----
  weekdayName(n: number): string {
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
    navigator.clipboard
      .writeText(code)
      .then(() => this.toast.success('Đã sao chép mã lớp: ' + code, 'Thành công'));
  }
  printPage() {
    window.print();
  }

  // ====== DELETE FLOW (theo studentCode/MSSV) ======
  askDeleteStudent(s: { id: string; name: string }) {
    if (!s.id) {
      this.toast.warning('Không tìm thấy MSSV — không thể xoá.');
      return;
    }
    this.studentToDelete.set({ id: s.id, name: s.name });
    this.showConfirmDeleteStudent.set(true);
  }

  confirmDeleteStudent() {
    const target = this.studentToDelete();
    const code = this.classCode();
    if (!target?.id) return;

    this.deletingId.set(target.id);
    this.showConfirmDeleteStudent.set(false);

    // DELETE /api/v1/classes/{classCode}/students/{studentCode}
    this.http
      .delete<ApiResponse<null>>(
        `${this.API_BASE}/${encodeURIComponent(code)}/students/${encodeURIComponent(target.id)}`
      )
      .subscribe({
        next: (res) => {
          // 2xx nhưng success=false
          if (res && res.success === false) {
            this.toast.danger(res.message || 'Xoá sinh viên thất bại.');
            return;
          }
          // Thành công
          this.removeStudentLocallyById(target.id);
          this.toast.success(`Đã xoá ${target.name} (MSSV ${target.id}) khỏi lớp.`);
        },
        error: (err) => {
          // Non-2xx
          const body = err?.error as Partial<ApiResponse<null>> | string | undefined;
          // Ưu tiên message từ API chuẩn
          if (body && typeof body === 'object' && 'message' in body && body.message) {
            this.toast.danger(String((body as any).message));
          } else if (typeof body === 'string' && body.trim()) {
            this.toast.danger(body);
          } else if (err?.statusText) {
            this.toast.danger(err.statusText);
          } else {
            this.toast.danger('Không xoá được sinh viên.');
          }
        },
        complete: () => this.deletingId.set(null),
      });
  }

  private removeStudentLocallyById(studentCode: string) {
    const current = this.studentsPaged();
    const next = current.filter((x) => x.id !== studentCode);
    const snap = this.studentsPageSnapshot();

    // Giảm enrolled trong detail
    const d = this.detail();
    if (d) this.detail.set({ ...d, enrolled: Math.max(0, (d.enrolled ?? 0) - 1) });

    // Tính lại tổng & trang
    const newTotal = Math.max(0, (snap.totalElements ?? 0) - 1);
    const pageSize = this.pageSize();
    const totalPagesAfter = Math.max(1, Math.ceil(newTotal / pageSize));

    if (this.pageIndex() > totalPagesAfter) {
      this.pageIndex.set(totalPagesAfter);
      this.reloadStudents();
      return;
    }

    this.studentsPageSnapshot.set({
      items: next,
      totalPages: totalPagesAfter,
      totalElements: newTotal,
    });
  }

  cancelDeleteStudent() {
    this.showConfirmDeleteStudent.set(false);
    this.studentToDelete.set(null);
  }

  private buildPageNumbers(total: number, cur: number, windowSize = 7): Array<number | '…'> {
    total = Math.max(1, Number(total) || 1);
    cur = Math.min(Math.max(1, Number(cur) || 1), total);

    const out: Array<number | '…'> = [];
    const push = (v: number | '…') => out.push(v);

    push(1);
    if (total <= windowSize) {
      for (let p = 2; p <= total; p++) push(p);
      return out;
    }

    const middle = windowSize - 2;
    let start = cur - Math.floor(middle / 2);
    let end = cur + Math.floor(middle / 2);

    if (start < 2) {
      end += 2 - start;
      start = 2;
    }
    if (end > total - 1) {
      const d = end - (total - 1);
      start = Math.max(2, start - d);
      end = total - 1;
    }

    if (start > 2) push('…');
    for (let p = start; p <= end; p++) push(p);
    if (end < total - 1) push('…');

    push(total);
    return out;
  }

  studentsPageNumbers = computed(() =>
    this.buildPageNumbers(this.studentsTotalPages(), this.pageIndex())
  );
}
