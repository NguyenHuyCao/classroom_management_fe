import { Component, computed, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
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
  catalogLoading = signal(false);
  catalogError = signal<string | null>(null);

  // --- UI filters (Catalog) ---
  catUiSemester = signal<Semester | 'ALL'>('ALL');
  catUiSubjectText = signal<string>('');

  // Applied filters (for API)
  catSemester = signal<Semester | 'ALL'>('ALL');
  catSubjectText = signal<string>('');

  // Search pressed?
  catApplied = signal<boolean>(false);

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
        // BE: classCode @NotBlank, @Size(max=30)
        // FE: ràng thêm minLength + pattern uppercase/digits/hyphen (ổn, không trái BE)
        code: this.fb.control<string>('', {
          nonNullable: true,
          validators: [
            Validators.required,
            Validators.minLength(3),
            Validators.maxLength(30),
            this.patternValidator(/^[A-Z0-9-]+$/),
          ],
        }),

        // BE: className @NotBlank, @Size(max=200)
        name: this.fb.control<string>('', {
          nonNullable: true,
          validators: [Validators.required, Validators.minLength(3), Validators.maxLength(200)],
        }),

        // BE: courseCode @NotBlank, @Size(max=20)
        subject: this.fb.control<string>('', {
          nonNullable: true,
          validators: [
            Validators.required,
            Validators.maxLength(20),
            this.mustInList(() => this.subjectsRef),
          ],
        }),

        // BE: semesterCode pattern HK1|HK2|HK He
        semester: this.fb.control<Semester>('HK1', {
          nonNullable: true,
          validators: [Validators.required],
        }),

        // BE: deliveryMode pattern ONLINE|OFFLINE -> FE chọn Online/Offline
        status: this.fb.control<Status>('Offline', {
          nonNullable: true,
          validators: [Validators.required],
        }),

        // BE: capacity @NotNull @Min(1) @Max(500)
        size: this.fb.control<number>(40, {
          nonNullable: true,
          validators: [Validators.required, Validators.min(1), Validators.max(500)],
        }),

        // BE: academicYear @NotNull @Min(2000)
        year: this.fb.control<number>(new Date().getFullYear(), {
          nonNullable: true,
          validators: [Validators.required, Validators.min(2000)],
        }),

        // BE: startDate @NotBlank (yyyy-MM-dd)
        startDate: this.fb.control<string>('', {
          nonNullable: true,
          validators: [Validators.required, this.dateStringValidator()],
        }),

        // BE: locationNote @Size(max=255)
        locationNote: this.fb.control<string>('', {
          nonNullable: true,
          validators: [Validators.maxLength(255)],
        }),

        // BE: note free
        note: this.fb.control<string>('', { nonNullable: true }),

        // BE: schedules @Size(min=1)
        //  each: weekdayNo [1..7], start/end NotBlank(HH:mm), roomCode NotBlank <=50
        schedule: this.fb.array<FormGroup<any>>([], {
          validators: [this.schedulesNoOverlapValidator()],
        }),
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
      const _ = [
        this.catPageIndex(),
        this.catPageSize(),
        this.catSemester(),
        this.catSubjectText(),
      ];
      if (this.role() === 'STUDENT' && this.catApplied()) {
        this.loadCatalog();
      }
    });
  }

  // ------------------------ VALIDATORS ------------------------

  private patternValidator(regex: RegExp): ValidatorFn {
    return (c: AbstractControl): ValidationErrors | null => {
      const v = String(c.value || '');
      return !v ? null : regex.test(v) ? null : { pattern: true };
    };
  }

  private mustInList(list: () => string[]): ValidatorFn {
    return (c: AbstractControl): ValidationErrors | null => {
      const v = String(c.value || '').trim();
      if (!v) return null;
      return list().includes(v) ? null : { notInList: true };
    };
  }

  private dateStringValidator(): ValidatorFn {
    return (c: AbstractControl): ValidationErrors | null => {
      const v = String(c.value || '').trim();
      if (!v) return null;
      const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) return { invalidDate: true };
      const d = new Date(v);
      return isNaN(d.getTime()) ? { invalidDate: true } : null;
    };
  }

  private timeStringValidator(): ValidatorFn {
    return (c: AbstractControl): ValidationErrors | null => {
      const v = String(c.value || '').trim();
      if (!v) return null;
      return /^\d{2}:\d{2}$/.test(v) ? null : { invalidTime: true };
    };
  }

  /** start < end cho từng schedule group */
  private timeOrderValidator(): ValidatorFn {
    return (group: AbstractControl): ValidationErrors | null => {
      const g = group as FormGroup;
      const s = String(g.get('start')?.value || '');
      const e = String(g.get('end')?.value || '');
      if (!s || !e) return null;
      const toMin = (t: string) => {
        const [hh, mm] = t.split(':').map((x) => Number(x));
        return hh * 60 + mm;
      };
      return toMin(s) < toMin(e) ? null : { timeOrder: true };
    };
  }

  /** Không cho 2 lịch cùng ngày bị trùng/đè nhau */
  private schedulesNoOverlapValidator(): ValidatorFn {
    return (arr: AbstractControl): ValidationErrors | null => {
      const a = (arr as FormArray).controls as FormGroup[];
      const slots: { day: number; start: number; end: number; idx: number }[] = [];
      const toMin = (t: string) => {
        const [hh, mm] = (t || '').split(':');
        const h = Number(hh);
        const m = Number(mm);
        return isFinite(h) && isFinite(m) ? h * 60 + m : NaN;
      };
      a.forEach((g, idx) => {
        const day = Number(g.get('day')?.value);
        const s = toMin(String(g.get('start')?.value || ''));
        const e = toMin(String(g.get('end')?.value || ''));
        if (!isNaN(day) && !isNaN(s) && !isNaN(e)) {
          slots.push({ day, start: s, end: e, idx });
        }
      });
      const byDay: Record<number, { start: number; end: number; idx: number }[]> = {};
      for (const it of slots) {
        byDay[it.day] = byDay[it.day] || [];
        byDay[it.day].push({ start: it.start, end: it.end, idx: it.idx });
      }
      for (const d of Object.keys(byDay)) {
        const list = byDay[+d].sort((x, y) => x.start - y.start);
        for (let i = 1; i < list.length; i++) {
          const prev = list[i - 1];
          const cur = list[i];
          if (cur.start < prev.end) {
            (a[prev.idx] as FormGroup).setErrors({ ...(a[prev.idx].errors || {}), overlap: true });
            (a[cur.idx] as FormGroup).setErrors({ ...(a[cur.idx].errors || {}), overlap: true });
            return { schedulesOverlap: true };
          }
        }
      }
      return null;
    };
  }

  private yearMatchesStartDateValidator(): ValidatorFn {
    return (group: AbstractControl): ValidationErrors | null => {
      const g = group as FormGroup;
      const y = Number(g.get('year')?.value);
      const sd = String(g.get('startDate')?.value || '');
      if (!y || !sd) return null;
      const dt = new Date(sd);
      return dt.getFullYear() === y ? null : { yearMismatch: true };
    };
  }

  // ------------------------ Utils: errors (dành cho HTML nếu cần hiển thị) ------------------------
  isInvalid(path: string): boolean {
    const c = this.form.get(path);
    return !!c && c.touched && c.invalid;
  }
  errOf(path: string): ValidationErrors | null {
    const c = this.form.get(path);
    return (c && c.touched && c.errors) || null;
  }
  schErr(i: number, field?: string): ValidationErrors | null {
    const g = this.scheduleArray.at(i) as FormGroup;
    if (!g) return null;
    if (!field) return (g.touched && g.errors) || null;
    const c = g.get(field);
    return (c && c.touched && c.errors) || null;
  }
  markAllTouched() {
    this.form.markAllAsTouched();
    this.scheduleArray.controls.forEach((g) => g.markAllAsTouched());
  }

  private extractPage<T>(res: any): PageResponse<T> {
    const inner = res?.data ?? res;
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
  private mapMyRow(row: any): ClassItem {
    const semCodeRaw = String(row.semesterCode || '')
      .trim()
      .toUpperCase();
    const sem: Semester =
      semCodeRaw === 'HK1' || semCodeRaw === 'HK2'
        ? (semCodeRaw as Semester)
        : semCodeRaw === 'HKHE' || semCodeRaw === 'HK HE'
        ? 'HK He'
        : 'HK1';

    const mode = String(row.deliveryMode || '')
      .trim()
      .toUpperCase();
    const st: Status = mode === 'ONLINE' ? 'Online' : 'Offline';

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

    const sem = this.catSemester();
    if (sem !== 'ALL') params = params.set('semester', sem);

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

    // Chuẩn hóa gửi đúng theo BE:
    // - semesterCode: 'HK1' | 'HK2' | 'HK He'
    // - roomCode: luôn có (BE yêu cầu @NotBlank) -> nếu Online gửi 'Online' làm roomCode, link = room (URL/text)
    const semesterCode: string = raw.semester === 'HK He' ? 'HK He' : raw.semester; // bỏ 'HKHE'

    return {
      classCode: String(raw.code || '').trim(),
      className: String(raw.name || '').trim(),
      courseCode: String(raw.subject || '').trim(),
      semesterCode,
      academicYear: Number(raw.year),
      deliveryMode: isOnline ? 'ONLINE' : 'OFFLINE',
      capacity: Number(raw.size),
      startDate: String(raw.startDate),
      locationNote: raw.locationNote ? String(raw.locationNote).trim() : null,
      note: raw.note ? String(raw.note).trim() : null,
      schedules: (raw.schedule as ScheduleItem[]).map((s) => ({
        weekdayNo: s.day as any, // server accept Short/Number
        startTime: s.start,
        endTime: s.end,
        roomCode: isOnline ? 'Online' : (s.room || '').slice(0, 50), // ≤ 50
        link: isOnline ? s.room : '',
      })),
    };
  }

  createClass() {
    if (this.role() !== 'TEACHER') return;

    if (this.form.invalid) {
      this.markAllTouched();
      if (this.form.errors?.['yearMismatch']) {
        this.toast.danger('Năm học phải trùng với năm của Ngày bắt đầu');
      } else if (this.form.errors?.['schedulesOverlap']) {
        this.toast.danger('Lịch học bị trùng/đè thời gian trong cùng một ngày');
      } else {
        this.toast.danger('Vui lòng kiểm tra thông tin chưa hợp lệ');
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
      this.markAllTouched();
      if (this.form.errors?.['yearMismatch']) {
        this.toast.danger('Năm học phải trùng với năm của Ngày bắt đầu');
      } else if (this.form.errors?.['schedulesOverlap']) {
        this.toast.danger('Lịch học bị trùng/đè thời gian trong cùng một ngày');
      } else {
        this.toast.danger('Vui lòng kiểm tra thông tin chưa hợp lệ');
      }
      return;
    }

    const editingKey = this.editingId();
    if (!editingKey) return;

    const body = this.buildPayload();
    const updateBody: any = {
      className: body.className,
      semesterCode: body.semesterCode, // 'HK1' | 'HK2' | 'HK He'
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
    if (v) this.catUiSemester.set(v);
  }
  onCatSubjectInput(e: Event) {
    this.catUiSubjectText.set(((e.target as HTMLInputElement)?.value || '').trim());
  }
  applyCatalogFilters() {
    this.catSemester.set(this.catUiSemester());
    this.catSubjectText.set(this.catUiSubjectText().trim());
    this.catPageIndex.set(1);
    this.catApplied.set(true);
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

        // chấp nhận HKHE/HK He từ server; FE set 'HK He' cho case hè
        const semCodeRaw = String(d.semesterCode || '')
          .trim()
          .toUpperCase();
        const sem: Semester =
          semCodeRaw === 'HK1' || semCodeRaw === 'HK2'
            ? (semCodeRaw as Semester)
            : semCodeRaw === 'HKHE' || semCodeRaw === 'HK HE'
            ? 'HK He'
            : 'HK1';

        this.form.patchValue({
          code: d.classCode,
          name: d.className,
          subject: d.courseCode,
          semester: sem,
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
    const g = this.fb.group(
      {
        // FE đang support Thứ 2..7 -> min 2 max 7 (BE cho 1..7 vẫn ok vì FE không gửi 1)
        day: this.fb.control<number>(2, {
          nonNullable: true,
          validators: [Validators.required, Validators.min(2), Validators.max(7)],
        }),
        start: this.fb.control<string>('08:00', {
          nonNullable: true,
          validators: [Validators.required, this.timeStringValidator()],
        }),
        end: this.fb.control<string>('10:00', {
          nonNullable: true,
          validators: [Validators.required, this.timeStringValidator()],
        }),
        // BE: roomCode ≤ 50
        room: this.fb.control<string>('P203', {
          nonNullable: true,
          validators: [Validators.required, Validators.maxLength(50)],
        }),
      },
      { validators: [this.timeOrderValidator()] }
    );
    this.scheduleArray.push(g);
  }

  removeSchedule(idx: number) {
    if (this.scheduleArray.length <= 1) return;
    this.scheduleArray.removeAt(idx);
    this.scheduleArray.updateValueAndValidity({ onlySelf: false, emitEvent: true });
  }

  setSchedules(items: ScheduleItem[]) {
    this.clearFormArray(this.scheduleArray);
    items.forEach((it) =>
      this.scheduleArray.push(
        this.fb.group(
          {
            day: this.fb.control<number>(it.day, {
              nonNullable: true,
              validators: [Validators.required, Validators.min(2), Validators.max(7)],
            }),
            start: this.fb.control<string>(it.start, {
              nonNullable: true,
              validators: [Validators.required, this.timeStringValidator()],
            }),
            end: this.fb.control<string>(it.end, {
              nonNullable: true,
              validators: [Validators.required, this.timeStringValidator()],
            }),
            // BE: roomCode ≤ 50
            room: this.fb.control<string>(it.room, {
              nonNullable: true,
              validators: [Validators.required, Validators.maxLength(50)],
            }),
          },
          { validators: [this.timeOrderValidator()] }
        )
      )
    );
    if (this.scheduleArray.length === 0) this.addSchedule();
    this.scheduleArray.updateValueAndValidity({ onlySelf: false, emitEvent: true });
  }

  private clearFormArray(arr: FormArray) {
    while (arr.length) arr.removeAt(0);
  }
}
