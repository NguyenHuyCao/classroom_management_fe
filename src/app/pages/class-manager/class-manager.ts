import { Component, computed, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient, HttpClientModule, HttpParams } from '@angular/common/http';
import { SectionTitleComponent } from '../../components/title/section-title.component';
import { ConfirmDialog } from '../../components/confirm/confirm-dialog';
import { ToastService } from '../../components/toast/toast.service';

type Status = 'Online' | 'Offline';
type Semester = 'HK1' | 'HK2' | 'HK He';
type Role = 'TEACHER' | 'STUDENT';

interface ScheduleItem {
  day: number; // 2..7
  start: string;
  end: string;
  room: string;
}
interface ClassItem {
  id: string;
  code: string;
  name: string;
  subject: string;
  semester: Semester;
  status: Status;
  size: number;
  schedule: ScheduleItem[];
  createdAt: string; // ISO
  teacher?: string;
  canEnroll?: boolean;
  cannotReason?: string | null;
}

type PageResponse<T> = {
  page: number;
  size: number;
  totalPages: number;
  totalElements: number;
  items: T[];
};

@Component({
  selector: 'app-class-manager',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SectionTitleComponent, ConfirmDialog],
  templateUrl: './class-manager.html',
  styleUrls: ['./class-manager.scss'],
})
export class ClassManager {
  private readonly API = 'http://localhost:8080/api/v1/classes';

  // ---------------- Role ----------------
  role = signal<Role>('TEACHER');
  private readRoleFromStorage(): Role | null {
    try {
      const raw = localStorage.getItem('auth');
      if (!raw) return null;
      const r = String(JSON.parse(raw)?.user?.role ?? '').toUpperCase();
      return r === 'TEACHER' || r === 'STUDENT' ? (r as Role) : null;
    } catch {
      return null;
    }
  }

  // ---------------- State: My classes (server paging) ----------------
  pageIndex = signal(1);
  pageSize = signal(10);
  myLoading = signal(false);
  myError = signal<string | null>(null);
  private mySnapshot = signal<{ items: ClassItem[]; totalPages: number; totalElements: number }>({
    items: [],
    totalPages: 1,
    totalElements: 0,
  });
  paged = computed(() => this.mySnapshot().items);
  totalPages = computed(() => Math.max(1, this.mySnapshot().totalPages));
  myTotal = computed(() => this.mySnapshot().totalElements);
  submitting = signal(false);

  // ---------------- State: Catalog (student, server paging) ----------------
  catPageIndex = signal(1);
  catPageSize = signal(8);
  catSemester = signal<Semester | 'ALL'>('ALL');
  catSubjectText = signal<string>('');
  catalogLoading = signal(false);
  catalogError = signal<string | null>(null);
  private catalogSnapshot = signal<{
    items: ClassItem[];
    totalPages: number;
    totalElements: number;
  }>({ items: [], totalPages: 1, totalElements: 0 });
  catalogPaged = computed(() => this.catalogSnapshot().items);
  catalogTotalPages = computed(() => Math.max(1, this.catalogSnapshot().totalPages));

  // ---------------- Form (teacher) ----------------
  form: FormGroup;
  editingId = signal<string | null>(null);

  // Dialogs
  showConfirmDelete = signal(false);
  classToDelete = signal<ClassItem | null>(null);
  showConfirmDrop = signal(false);
  classToDrop = signal<ClassItem | null>(null);

  detailEnrolled = signal<number>(0);
  canChangeCourse = signal<boolean>(true);

  // Options
  semesters: { label: string; value: Semester }[] = [
    { label: 'Học kỳ 1', value: 'HK1' },
    { label: 'Học kỳ 2', value: 'HK2' },
    { label: 'Học kỳ Hè', value: 'HK He' },
  ];
  weekdays = [
    { label: 'Thứ 2', value: 2 },
    { label: 'Thứ 3', value: 3 },
    { label: 'Thứ 4', value: 4 },
    { label: 'Thứ 5', value: 5 },
    { label: 'Thứ 6', value: 6 },
    { label: 'Thứ 7', value: 7 },
  ];
  statuses: Status[] = ['Online', 'Offline'];
  subjectsRef = ['CS100', 'CS101', 'ML113', 'ML114', 'MA101', 'SE201'];

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router,
    private toast: ToastService
  ) {
    const r = this.readRoleFromStorage();
    if (r) this.role.set(r);

    this.form = this.fb.group(
      {
        code: ['', [Validators.required, Validators.maxLength(30)]],
        name: ['', [Validators.required, Validators.maxLength(120)]],
        subject: ['', Validators.required],
        semester: ['HK1', Validators.required],
        status: ['Offline', Validators.required],
        size: [40, [Validators.required, Validators.min(1), Validators.max(500)]],
        year: [new Date().getFullYear(), [Validators.required, Validators.min(2000)]],
        startDate: ['', Validators.required], // yyyy-MM-dd
        locationNote: [''],
        note: [''],
        schedule: this.fb.array<FormGroup<any>>([]),
      },
      { validators: [this.yearMatchesStartDateValidator()] }
    );
    if (this.scheduleArray.length === 0) this.addSchedule();

    effect(() => {
      this.pageIndex();
      this.pageSize();
      this.loadMyClasses();
    });
    effect(() => {
      this.catPageIndex();
      this.catPageSize();
      if (this.role() === 'STUDENT') this.loadCatalog();
    });
  }

  private yearMatchesStartDateValidator() {
    return (group: FormGroup) => {
      const y = Number(group.get('year')?.value);
      const sd = String(group.get('startDate')?.value || '');
      if (!y || !sd) return null;
      const dt = new Date(sd);
      return dt.getFullYear() === y ? null : { yearMismatch: true };
    };
  }
  private extractPage<T>(res: any): PageResponse<T> {
    const inner = res?.data ?? res; // hỗ trợ {data:{...}} hoặc {...}
    return inner?.items ? (inner as PageResponse<T>) : (inner?.page as PageResponse<T>);
  }

  ngOnInit() {
    this.loadMyClasses();
    if (this.role() === 'STUDENT') this.loadCatalog();
  }

  // ---------- helpers ----------
  get scheduleArray() {
    return this.form.get('schedule') as FormArray;
  }

  /** Parse "Thứ 2 • 08:00–10:00 • P203" */
  private parseScheduleLine(line: string): ScheduleItem {
    const [d, t, r] = (line || '').split('•').map((s) => s.trim());
    const m = d?.match(/(\d+)/);
    const day = m ? Number(m[1]) : 2;
    const [start, end] = (t || '').split('–').map((s) => s.trim());
    const room = (r || '').trim();
    return { day, start: start || '', end: end || '', room };
  }

  /** Map row từ API /me */
  /** Map row từ API /me */
  private mapMyRow(row: any): ClassItem {
    const semCode = String(row.semesterCode || '')
      .trim()
      .toUpperCase();
    const sem: Semester =
      semCode === 'HK1' || semCode === 'HK2'
        ? (semCode as Semester)
        : semCode === 'HKHE'
        ? 'HK He'
        : 'HK1'; // fallback

    const mode = String(row.deliveryMode || '')
      .trim()
      .toUpperCase();
    const st: Status = mode === 'ONLINE' ? 'Online' : 'Offline'; // fallback

    return {
      id: row.classCode,
      code: row.classCode,
      name: row.className,
      subject: row.courseCode,
      semester: sem,
      status: st,
      size: Number(row.capacity ?? 0),
      schedule: (row.schedules || []).map((s: string) => this.parseScheduleLine(s)),
      createdAt: typeof row.createdAt === 'string' ? row.createdAt : new Date().toISOString(),
    };
  }

  /** Map row từ API /catalog */
  private mapCatalogRow(row: any): ClassItem {
    return {
      ...this.mapMyRow(row),
      teacher: row.teacherName ?? '—',
      canEnroll: !!row.canEnroll,
      cannotReason: row.cannotReason ?? null,
    };
  }

  reasonText(reason?: string | null) {
    switch ((reason || '').toUpperCase()) {
      case 'STARTED':
        return 'Đã bắt đầu';
      case 'FULL':
        return 'Đã đủ chỗ';
      case 'ALREADY_ENROLLED':
        return 'Đã đăng ký';
      default:
        return 'Đăng ký';
    }
  }

  // ===================== API calls =====================

  // My classes (teacher/student)
  private loadMyClasses() {
    this.myLoading.set(true);
    this.myError.set(null);
    const params = new HttpParams()
      .set('page', String(this.pageIndex() - 1))
      .set('size', String(this.pageSize()));
    this.http.get<any>(`${this.API}/me`, { params }).subscribe({
      next: (res) => {
        const page = this.extractPage<any>(res);
        const items = (page?.items ?? []).map((r: any) => this.mapMyRow(r));
        this.mySnapshot.set({
          items,
          totalPages: page?.totalPages ?? 1,
          totalElements: page?.totalElements ?? items.length,
        });
      },
      error: (e) => this.myError.set(e?.message || 'Không tải được danh sách lớp của bạn.'),
      complete: () => this.myLoading.set(false),
    });
  }

  private loadCatalog() {
    this.catalogLoading.set(true);
    this.catalogError.set(null);
    let params = new HttpParams()
      .set('page', String(this.catPageIndex() - 1))
      .set('size', String(this.catPageSize()));
    if (this.catSemester() !== 'ALL') params = params.set('semester', this.catSemester());
    const subj = this.catSubjectText().trim();
    if (subj) params = params.set('course', subj);

    this.http.get<any>(`${this.API}/catalog`, { params }).subscribe({
      next: (res) => {
        const page = this.extractPage<any>(res);
        const items = (page?.items ?? []).map((r: any) => this.mapCatalogRow(r));
        this.catalogSnapshot.set({
          items,
          totalPages: page?.totalPages ?? 1,
          totalElements: page?.totalElements ?? items.length,
        });
      },
      error: (e) => this.catalogError.set(e?.message || 'Không tải được catalog.'),
      complete: () => this.catalogLoading.set(false),
    });
  }

  // ---------- Create & Update (teacher) ----------
  private buildPayload() {
    const raw = this.form.getRawValue();
    const isOnline = raw.status === 'Online';
    return {
      classCode: raw.code,
      className: raw.name,
      courseCode: raw.subject,
      semesterCode: raw.semester === 'HK He' ? 'HKHE' : raw.semester,
      academicYear: Number(raw.year),
      deliveryMode: isOnline ? 'ONLINE' : 'OFFLINE',
      capacity: Number(raw.size),
      startDate: String(raw.startDate),
      locationNote: raw.locationNote || null,
      note: raw.note || null,
      schedules: (raw.schedule as ScheduleItem[]).map((s) => ({
        weekdayNo: s.day,
        startTime: s.start,
        endTime: s.end,
        roomCode: isOnline ? 'Online' : s.room,
        link: isOnline ? s.room : '',
      })),
    };
  }

  createClass() {
    if (this.role() !== 'TEACHER') return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      if (this.form.errors?.['yearMismatch']) {
        this.toast.danger('Năm học phải trùng với năm của Ngày bắt đầu');
      }
      return;
    }
    const body = this.buildPayload();
    this.submitting.set(true);
    this.http.post(this.API, body).subscribe({
      next: () => {
        this.toast.success('Tạo lớp thành công');
        this.startCreate();
        this.loadMyClasses();
        if (this.role() === 'STUDENT') this.loadCatalog();
      },
      error: (e) => this.toast.danger(e?.error?.message || e?.message || 'Tạo lớp thất bại'),
      complete: () => this.submitting.set(false),
    });
  }

  updateClass() {
    if (this.role() !== 'TEACHER') return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      if (this.form.errors?.['yearMismatch']) {
        this.toast.danger('Năm học phải trùng với năm của Ngày bắt đầu');
      }
      return;
    }
    const editingKey = this.editingId();
    if (!editingKey) return;

    const body = this.buildPayload();
    const updateBody: any = {
      className: body.className,
      semesterCode: body.semesterCode,
      academicYear: body.academicYear,
      deliveryMode: body.deliveryMode,
      capacity: body.capacity,
      startDate: body.startDate,
      locationNote: body.locationNote,
      note: body.note,
      schedules: body.schedules,
    };
    if (this.canChangeCourse()) updateBody.courseCode = body.courseCode;

    this.submitting.set(true);
    this.http.put(`${this.API}/${encodeURIComponent(editingKey)}`, updateBody).subscribe({
      next: () => {
        this.toast.success('Cập nhật lớp thành công');
        this.startCreate();
        this.loadMyClasses();
        if (this.role() === 'STUDENT') this.loadCatalog();
      },
      error: (e) => this.toast.danger(e?.error?.message || e?.message || 'Cập nhật thất bại'),
      complete: () => this.submitting.set(false),
    });
  }

  // ---------- Delete / Enroll ----------
  askDelete(item: ClassItem) {
    if (this.role() !== 'TEACHER') return;
    this.classToDelete.set(item);
    this.showConfirmDelete.set(true);
  }
  confirmDelete() {
    const item = this.classToDelete();
    if (!item) return;
    this.http.delete(`${this.API}/${encodeURIComponent(item.code)}`).subscribe({
      next: () => {
        this.toast.success('Đã xoá lớp');
        this.showConfirmDelete.set(false);
        this.classToDelete.set(null);
        this.loadMyClasses();
      },
      error: (e) => this.toast.danger(e?.message || 'Xoá thất bại'),
    });
  }
  cancelDelete() {
    this.showConfirmDelete.set(false);
    this.classToDelete.set(null);
  }

  isEnrolled = (classId: string) => this.paged().some((c) => c.id === classId);

  register(item: ClassItem) {
    if (this.role() !== 'STUDENT') return;
    this.http.post(`${this.API}/${encodeURIComponent(item.code)}/enroll`, null).subscribe({
      next: () => {
        this.toast.success('Đăng ký thành công');
        this.loadMyClasses();
        this.loadCatalog();
      },
      error: (e) => this.toast.danger(e?.message || 'Đăng ký thất bại'),
    });
  }

  askDrop(item: ClassItem) {
    if (this.role() !== 'STUDENT') return;
    this.classToDrop.set(item);
    this.showConfirmDrop.set(true);
  }
  confirmDrop() {
    const item = this.classToDrop();
    if (!item) return;
    this.http.delete(`${this.API}/${encodeURIComponent(item.code)}/enroll`).subscribe({
      next: () => {
        this.toast.success('Đã hủy ghi danh');
        this.showConfirmDrop.set(false);
        this.classToDrop.set(null);
        this.loadMyClasses();
        this.loadCatalog();
      },
      error: (e) => this.toast.danger(e?.message || 'Hủy ghi danh thất bại'),
    });
  }
  cancelDrop() {
    this.showConfirmDrop.set(false);
    this.classToDrop.set(null);
  }

  // ---------- UI handlers ----------
  onCatSemesterChange(e: Event) {
    const v = (e.target as HTMLSelectElement | null)?.value as Semester | 'ALL' | undefined;
    if (v) this.catSemester.set(v);
  }
  onCatSubjectInput(e: Event) {
    this.catSubjectText.set(((e.target as HTMLInputElement)?.value || '').trim());
  }
  applyCatalogFilters() {
    this.catPageIndex.set(1);
    this.loadCatalog();
  }

  goPage(i: number) {
    const total = this.totalPages();
    if (i < 1 || i > total) return;
    this.pageIndex.set(i);
  }
  goCatalogPage(i: number) {
    const total = this.catalogTotalPages();
    if (i < 1 || i > total) return;
    this.catPageIndex.set(i);
  }

  goDetail(code: string) {
    this.router.navigate(['/class-detail', code]);
  }

  // ---------- form helpers ----------
  startCreate() {
    this.editingId.set(null);
    this.detailEnrolled.set(0);
    this.canChangeCourse.set(true);
    this.submitting.set(false);

    this.form.reset({
      code: '',
      name: '',
      subject: '',
      semester: 'HK1',
      status: 'Offline',
      size: 40,
      year: new Date().getFullYear(),
      startDate: '',
      locationNote: '',
      note: '',
    });

    this.form.get('code')?.enable();
    this.form.get('subject')?.enable();

    this.clearFormArray(this.scheduleArray);
    this.addSchedule();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  startEdit(item: ClassItem) {
    this.editingId.set(item.code);

    this.http.get<any>(`${this.API}/${encodeURIComponent(item.code)}`).subscribe({
      next: (d) => {
        this.detailEnrolled.set(Number(d.enrolled ?? 0));
        this.canChangeCourse.set((this.detailEnrolled() ?? 0) === 0);

        this.form.patchValue({
          code: d.classCode,
          name: d.className,
          subject: d.courseCode,
          semester: d.semesterCode === 'HKHE' ? 'HK He' : d.semesterCode,
          status: (String(d.deliveryMode || '').toUpperCase() === 'ONLINE'
            ? 'Online'
            : 'Offline') as Status,
          size: d.capacity,
          year: d.academicYear,
          startDate: d.startDate || '',
          locationNote: d.locationNote || '',
          note: d.note || '',
        });

        const schedules = (d.schedules || []).map((s: any) => ({
          day: Number(s.weekdayNo),
          start: s.startTime,
          end: s.endTime,
          room: s.roomCode || s.link || '',
        }));
        this.setSchedules(schedules);

        this.form.get('code')?.disable();
        if (!this.canChangeCourse()) this.form.get('subject')?.disable();

        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: () => {
        this.form.patchValue({
          code: item.code,
          name: item.name,
          subject: item.subject,
          semester: item.semester,
          status: item.status,
          size: item.size,
        });
        this.setSchedules(item.schedule);
        this.form.get('code')?.disable();
      },
    });
  }

  addSchedule() {
    const g = this.fb.group({
      day: this.fb.control<number>(2, { nonNullable: true, validators: [Validators.required] }),
      start: this.fb.control<string>('08:00', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      end: this.fb.control<string>('10:00', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      room: this.fb.control<string>('P203', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(200)],
      }),
    });
    this.scheduleArray.push(g);
  }
  removeSchedule(idx: number) {
    if (this.scheduleArray.length <= 1) return;
    this.scheduleArray.removeAt(idx);
  }
  setSchedules(items: ScheduleItem[]) {
    this.clearFormArray(this.scheduleArray);
    items.forEach((it) =>
      this.scheduleArray.push(
        this.fb.group({
          day: this.fb.control<number>(it.day, {
            nonNullable: true,
            validators: [Validators.required],
          }),
          start: this.fb.control<string>(it.start, {
            nonNullable: true,
            validators: [Validators.required],
          }),
          end: this.fb.control<string>(it.end, {
            nonNullable: true,
            validators: [Validators.required],
          }),
          room: this.fb.control<string>(it.room, {
            nonNullable: true,
            validators: [Validators.required, Validators.maxLength(200)],
          }),
        })
      )
    );
    if (this.scheduleArray.length === 0) this.addSchedule();
  }
  private clearFormArray(arr: FormArray) {
    while (arr.length) arr.removeAt(0);
  }
}
