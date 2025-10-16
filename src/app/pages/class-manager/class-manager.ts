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
  day: number;
  start: string;
  end: string;
  room: string;
  link?: string;
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
  createdAt: string;
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

  catPageIndex = signal(1);
  catPageSize = signal(5);
  catalogLoading = signal(false);
  catalogError = signal<string | null>(null);

  catUiSemester = signal<Semester | 'ALL'>('ALL');
  catUiSubjectText = signal<string>('');

  catSemester = signal<Semester | 'ALL'>('ALL');
  catSubjectText = signal<string>('');

  catApplied = signal<boolean>(false);

  private catalogSnapshot = signal<{
    items: ClassItem[];
    totalPages: number;
    totalElements: number;
  }>({ items: [], totalPages: 1, totalElements: 0 });
  catalogPaged = computed(() => this.catalogSnapshot().items);
  catalogTotalPages = computed(() => Math.max(1, this.catalogSnapshot().totalPages));

  form: FormGroup;
  editingId = signal<string | null>(null);

  showConfirmDelete = signal(false);
  classToDelete = signal<ClassItem | null>(null);
  showConfirmDrop = signal(false);
  classToDrop = signal<ClassItem | null>(null);

  detailEnrolled = signal<number>(0);
  canChangeCourse = signal<boolean>(true);

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
        code: this.fb.control<string>('', {
          nonNullable: true,
          validators: [
            Validators.required,
            Validators.minLength(3),
            Validators.maxLength(30),
            this.patternValidator(/^[A-Z0-9-]+$/),
          ],
        }),
        name: this.fb.control<string>('', {
          nonNullable: true,
          validators: [Validators.required, Validators.minLength(3), Validators.maxLength(200)],
        }),
        subject: this.fb.control<string>('', {
          nonNullable: true,
          validators: [
            Validators.required,
            Validators.maxLength(20),
            this.mustInList(() => this.subjectsRef),
          ],
        }),
        semester: this.fb.control<Semester>('HK1', {
          nonNullable: true,
          validators: [Validators.required],
        }),
        status: this.fb.control<Status>('Offline', {
          nonNullable: true,
          validators: [Validators.required],
        }),
        size: this.fb.control<number>(40, {
          nonNullable: true,
          validators: [Validators.required, Validators.min(1), Validators.max(500)],
        }),
        year: this.fb.control<number>(new Date().getFullYear(), {
          nonNullable: true,
          validators: [Validators.required, Validators.min(2000)],
        }),
        startDate: this.fb.control<string>('', {
          nonNullable: true,
          validators: [Validators.required, this.dateStringValidator()],
        }),
        locationNote: this.fb.control<string>('', {
          nonNullable: true,
          validators: [Validators.maxLength(255)],
        }),
        note: this.fb.control<string>('', { nonNullable: true }),
        // FormArray schedules
        schedule: this.fb.array<FormGroup<any>>([], {
          validators: [this.schedulesNoOverlapValidator()],
        }),
      },
      { validators: [this.yearMatchesStartDateValidator(), this.startDateNotPastValidator()] }
    );

    if (this.scheduleArray.length === 0) this.addSchedule();

    this.form.get('status')!.valueChanges.subscribe(() => this.refreshScheduleValidators());

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
        this.role(),
      ];
      if (this.role() === 'STUDENT') {
        this.loadCatalog();
      }
    });
  }

  private isOnline(): boolean {
    return this.form.get('status')?.value === 'Online';
  }

  private normalizeDateForInput(val: any): string {
    if (val === null || val === undefined) return '';
    if (typeof val === 'number') {
      const n = val > 1e12 ? val : val * 1000;
      const d = new Date(n);
      if (isNaN(d.getTime())) return '';
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }

    const s = String(val).trim();
    if (!s) return '';

    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    const ymdSlash = s.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
    if (ymdSlash) return `${ymdSlash[1]}-${ymdSlash[2]}-${ymdSlash[3]}`;

    const dmy = s.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
    if (dmy) {
      const [_, dd, mm, yyyy] = dmy;
      return `${yyyy}-${mm}-${dd}`;
    }

    const dt = new Date(s);
    if (!isNaN(dt.getTime())) {
      const yyyy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const dd = String(dt.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }

    return '';
  }

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
  private schedulesNoOverlapValidator(): ValidatorFn {
    return (arr: AbstractControl): ValidationErrors | null => {
      const a = (arr as FormArray).controls as FormGroup[];

      for (const g of a) {
        const err = { ...(g.errors || {}) };
        if ('overlap' in err) {
          delete err['overlap'];
          g.setErrors(Object.keys(err).length ? err : null);
        }
      }

      const toMin = (t: string) => {
        const [hh, mm] = (t || '').split(':');
        const h = Number(hh),
          m = Number(mm);
        return isFinite(h) && isFinite(m) ? h * 60 + m : NaN;
      };

      const byDay: Record<number, { start: number; end: number; idx: number }[]> = {};
      a.forEach((g, idx) => {
        const day = Number(g.get('day')?.value);
        const s = toMin(String(g.get('start')?.value || ''));
        const e = toMin(String(g.get('end')?.value || ''));
        if (day >= 2 && day <= 7 && !isNaN(s) && !isNaN(e)) {
          (byDay[day] ||= []).push({ start: s, end: e, idx });
        }
      });

      let hasOverlap = false;
      for (const d of Object.keys(byDay)) {
        const list = byDay[+d].sort((x, y) => x.start - y.start);
        for (let i = 1; i < list.length; i++) {
          const prev = list[i - 1],
            cur = list[i];
          if (cur.start < prev.end) {
            hasOverlap = true;
            const g1 = a[prev.idx] as FormGroup;
            const g2 = a[cur.idx] as FormGroup;
            g1.setErrors({ ...(g1.errors || {}), overlap: true });
            g2.setErrors({ ...(g2.errors || {}), overlap: true });
          }
        }
      }

      return hasOverlap ? { schedulesOverlap: true } : null;
    };
  }

  private startDateNotPastValidator(): ValidatorFn {
    return (group: AbstractControl): ValidationErrors | null => {
      const g = group as FormGroup;
      const sd = String(g.get('startDate')?.value || '').trim();
      if (!sd) return null;

      const start = new Date(sd + 'T00:00:00');
      const today = new Date();
      const todayYMD = new Date(today.getFullYear(), today.getMonth(), today.getDate());

      return start >= todayYMD ? null : { startDatePast: true };
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

  get scheduleArray() {
    return this.form.get('schedule') as FormArray;
  }

  private refreshScheduleValidators() {
    const online = this.isOnline();
    this.scheduleArray.controls.forEach((g: AbstractControl) => {
      const fg = g as FormGroup;
      const roomCtrl = fg.get('room')!;
      const linkCtrl = fg.get('link')!;

      roomCtrl.setValidators([this.requiredWhen(() => !online), Validators.maxLength(50)]);
      linkCtrl.setValidators([
        this.requiredWhen(() => online),
        Validators.maxLength(255),
        this.urlValidator(),
      ]);

      if (online) {
        roomCtrl.setValue('Online');
      } else if (roomCtrl.value === 'Online') {
        roomCtrl.setValue('');
      }

      roomCtrl.updateValueAndValidity({ emitEvent: false });
      linkCtrl.updateValueAndValidity({ emitEvent: false });
    });
  }

  private requiredWhen(predicate: () => boolean): ValidatorFn {
    return (c: AbstractControl): ValidationErrors | null => {
      const need = predicate();
      const v = (c.value ?? '').toString().trim();
      return need && !v ? { required: true } : null;
    };
  }
  private urlValidator(): ValidatorFn {
    const urlRe = /^(https?:\/\/)[\w.-]+(?:\.[\w\.-]+)+(?:[\/\w\.\-~:%+?#=&]*)?$/i;
    return (c: AbstractControl): ValidationErrors | null => {
      const v = String(c.value || '').trim();
      if (!v) return null;
      return urlRe.test(v) ? null : { invalidUrl: true };
    };
  }

  private parseScheduleLine(line: string): ScheduleItem {
    const [d, t, r] = (line || '').split('•').map((s) => s.trim());
    const m = d?.match(/(\d+)/);
    const day = m ? Number(m[1]) : 2;
    const [start, end] = (t || '').split('–').map((s) => s.trim());
    const room = (r || '').trim();
    return { day, start: start || '', end: end || '', room, link: '' };
  }

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

  private loadMyClasses() {
    this.myLoading.set(true);
    this.myError.set(null);

    const params = new HttpParams()
      .set('page', String(this.pageIndex() - 1))
      .set('size', String(this.pageSize()));

    this.http.get<any>(`${this.API}/me`, { params }).subscribe({
      next: (res) => {
        const page = this.extractPage<any>(res);

        const bePage0 = Number(page?.page ?? 0);
        const beSize = Number(page?.size ?? this.pageSize());
        const beTotalElements = Number(page?.totalElements ?? 0);
        const calcTotalPages = Math.max(1, Math.ceil(beTotalElements / Math.max(1, beSize)));

        const desiredUiPage = bePage0 + 1;
        if (desiredUiPage > calcTotalPages) {
          this.pageIndex.set(calcTotalPages);
          return;
        }

        if (this.pageIndex() !== desiredUiPage) this.pageIndex.set(desiredUiPage);
        if (this.pageSize() !== beSize) this.pageSize.set(beSize);

        const items = (page?.items ?? []).map((r: any) => this.mapMyRow(r));
        this.mySnapshot.set({
          items,
          totalPages: calcTotalPages,
          totalElements: beTotalElements,
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

        const bePage0 = Number(page?.page ?? 0);
        const beSize = Number(page?.size ?? this.catPageSize());
        const beTotalElements = Number(page?.totalElements ?? 0);
        const calcTotalPages = Math.max(1, Math.ceil(beTotalElements / Math.max(1, beSize)));

        const desiredUiPage = bePage0 + 1;
        if (desiredUiPage > calcTotalPages) {
          this.catPageIndex.set(calcTotalPages);
          return;
        }

        if (this.catPageIndex() !== desiredUiPage) this.catPageIndex.set(desiredUiPage);
        if (this.catPageSize() !== beSize) this.catPageSize.set(beSize);

        const items = (page?.items ?? []).map((r: any) => this.mapCatalogRow(r));
        this.catalogSnapshot.set({
          items,
          totalPages: calcTotalPages,
          totalElements: beTotalElements,
        });
      },
      error: (e) => this.catalogError.set(e?.message || 'Không tải được catalog.'),
      complete: () => this.catalogLoading.set(false),
    });
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

  myPageNumbers(): Array<number | '…'> {
    return this.buildPageNumbers(this.totalPages(), this.pageIndex());
  }

  catPageNumbers(): Array<number | '…'> {
    return this.buildPageNumbers(this.catalogTotalPages(), this.catPageIndex());
  }

  private buildPayload() {
    const raw = this.form.getRawValue();
    const online = raw.status === 'Online';
    const semesterCode: string = raw.semester === 'HK He' ? 'HK He' : raw.semester;

    return {
      classCode: String(raw.code || '').trim(),
      className: String(raw.name || '').trim(),
      courseCode: String(raw.subject || '').trim(),
      semesterCode,
      academicYear: Number(raw.year),
      deliveryMode: online ? 'ONLINE' : 'OFFLINE',
      capacity: Number(raw.size),
      startDate: String(raw.startDate),
      locationNote: raw.locationNote ? String(raw.locationNote).trim() : null,
      note: raw.note ? String(raw.note).trim() : null,
      schedules: (raw.schedule as ScheduleItem[]).map((s) => ({
        weekdayNo: s.day as any,
        startTime: s.start,
        endTime: s.end,
        roomCode: online ? 'Online' : (s.room || '').slice(0, 50),
        link: (s.link || '').trim(),
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

  goPage(i: number | '…'): void {
    if (i === '…') return;
    const total = this.totalPages();
    if (i < 1 || i > total || i === this.pageIndex()) return; 
    this.pageIndex.set(i); 
  }

  goCatalogPage(i: number | '…'): void {
    if (i === '…') return;
    const total = this.catalogTotalPages();
    if (i < 1 || i > total || i === this.catPageIndex()) return;
    this.catPageIndex.set(i);
  }

  goDetail(code: string) {
    this.router.navigate(['/class-detail', code]);
  }

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
    this.refreshScheduleValidators();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  startEdit(item: ClassItem) {
    this.editingId.set(item.code);

    this.http.get<any>(`${this.API}/${encodeURIComponent(item.code)}`).subscribe({
      next: (d) => {
        this.detailEnrolled.set(Number(d.enrolled ?? 0));
        this.canChangeCourse.set((this.detailEnrolled() ?? 0) === 0);

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
          startDate: this.normalizeDateForInput(d.startDate),
          locationNote: d.locationNote || '',
          note: d.note || '',
        });

        const schedules = (d.schedules || []).map((s: any) => ({
          day: Number(s.weekdayNo),
          start: s.startTime,
          end: s.endTime,
          room: s.roomCode || '',
          link: s.link || '',
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
    const online = this.isOnline();
    const g = this.fb.group(
      {
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
        room: this.fb.control<string>(online ? 'Online' : 'P203', {
          nonNullable: true,
          validators: [this.requiredWhen(() => !this.isOnline()), Validators.maxLength(50)],
        }),
        link: this.fb.control<string>('', {
          nonNullable: true,
          validators: [
            this.requiredWhen(() => this.isOnline()),
            Validators.maxLength(255),
            this.urlValidator(),
          ],
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
            room: this.fb.control<string>(it.room || '', {
              nonNullable: true,
              validators: [this.requiredWhen(() => !this.isOnline()), Validators.maxLength(50)],
            }),
            link: this.fb.control<string>(it.link || '', {
              nonNullable: true,
              validators: [
                this.requiredWhen(() => this.isOnline()),
                Validators.maxLength(255),
                this.urlValidator(),
              ],
            }),
          },
          { validators: [this.timeOrderValidator()] }
        )
      )
    );
    if (this.scheduleArray.length === 0) this.addSchedule();
    this.refreshScheduleValidators();
    this.scheduleArray.updateValueAndValidity({ onlySelf: false, emitEvent: true });
  }

  private clearFormArray(arr: FormArray) {
    while (arr.length) arr.removeAt(0);
  }
}
