import { Component, computed, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { SectionTitleComponent } from '../../components/title/section-title.component';
import { Router } from '@angular/router';
import { ConfirmDialog } from '../../components/confirm/confirm-dialog';

type Status = 'Online' | 'Offline';
type Semester = 'HK1' | 'HK2' | 'HK He';
type Role = 'TEACHER' | 'STUDENT';

interface ScheduleItem {
  day: number; // 2..7
  start: string; // HH:mm
  end: string; // HH:mm
  room: string; // "P203" | "Online"
}

interface ClassItem {
  id: string;
  code: string;
  name: string;
  subject: string;
  semester: Semester;
  status: Status;
  size: number;
  students: string[];
  schedule: ScheduleItem[];
  createdAt: string; // ISO
}

@Component({
  selector: 'app-class-manager',
  standalone: true,
  imports: [SectionTitleComponent, CommonModule, ReactiveFormsModule, ConfirmDialog],
  templateUrl: './class-manager.html',
  styleUrls: ['./class-manager.scss'],
})
export class ClassManager {
  // ---------------- Role ----------------
  role = signal<Role>('TEACHER'); // fallback TEACHER cho dev

  private readRoleFromStorage(): Role | null {
    try {
      const raw = localStorage.getItem('auth');
      if (!raw) return null;
      const obj = JSON.parse(raw);
      const r = String(obj?.user?.role ?? '').toUpperCase();
      if (r === 'TEACHER' || r === 'STUDENT') return r as Role;
      return null;
    } catch {
      return null;
    }
  }

  // ---------------- Mock data ----------------
  private catalogData: ClassItem[] = [
    {
      id: crypto.randomUUID(),
      code: 'CS101-K40A',
      name: 'Nhập môn Khoa học Máy tính - K40A',
      subject: 'CS101',
      semester: 'HK1',
      status: 'Offline',
      size: 45,
      students: ['SV0001', 'SV0002', 'SV0003'],
      schedule: [
        { day: 2, start: '08:00', end: '10:00', room: 'P203' },
        { day: 5, start: '08:00', end: '10:00', room: 'P203' },
      ],
      createdAt: new Date().toISOString(),
    },
    {
      id: crypto.randomUUID(),
      code: 'ML113-K40B',
      name: 'Triết học Mác-Lênin - K40B',
      subject: 'ML113',
      semester: 'HK2',
      status: 'Online',
      size: 60,
      students: ['SV0021', 'SV0022'],
      schedule: [{ day: 3, start: '18:00', end: '20:00', room: 'Online' }],
      createdAt: new Date().toISOString(),
    },
  ];

  // ---------------- State ----------------
  myClasses = signal<ClassItem[]>([]);
  catalog = signal<ClassItem[]>(this.catalogData);

  // form (khởi tạo trong constructor để không bị TS2729)
  form!: FormGroup;
  editingId = signal<string | null>(null);

  // confirm dialogs
  showConfirmDelete = signal<boolean>(false);
  classToDelete = signal<ClassItem | null>(null);

  showConfirmDrop = signal<boolean>(false);
  classToDrop = signal<ClassItem | null>(null);

  // filters/paging cho BẢNG DƯỚI (myClasses)
  search = signal<string>('');
  semesterFilter = signal<Semester | 'ALL'>('ALL');
  pageSize = signal<number>(8);
  pageIndex = signal<number>(1);

  // filters/paging cho BẢNG TRÊN (catalog) – chỉ dùng khi STUDENT
  catSearch = signal<string>('');
  catPageSize = signal<number>(8);
  catPageIndex = signal<number>(1);

  // options
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

  constructor(private fb: FormBuilder, private router: Router) {
    // role
    const r = this.readRoleFromStorage();
    if (r) this.role.set(r);

    // form init (đặt ở đây để không còn TS2729)
    this.form = this.fb.group({
      code: ['', [Validators.required, Validators.maxLength(30)]],
      name: ['', [Validators.required, Validators.maxLength(120)]],
      subject: ['', Validators.required],
      semester: ['HK1', Validators.required],
      status: ['Offline', Validators.required],
      size: [40, [Validators.required, Validators.min(1), Validators.max(500)]],
      studentsInput: [''],
      students: this.fb.array<string>([]),
      schedule: this.fb.array<
        FormGroup<{
          day: FormControl<number>;
          start: FormControl<string>;
          end: FormControl<string>;
          room: FormControl<string>;
        }>
      >([]),
    });

    if (this.scheduleArray.length === 0) this.addSchedule();

    // thay đổi filter -> về trang 1
    effect(() => {
      this.search();
      this.semesterFilter();
      this.pageIndex.set(1);
    });
    effect(() => {
      this.catSearch();
      this.catPageIndex.set(1);
    });
  }

  // lifecycle
  ngOnInit() {
    if (this.role() === 'TEACHER') {
      // demo: thầy có sẵn 2 lớp
      this.myClasses.set(this.catalogData.map((c) => ({ ...c })));
    } else {
      this.myClasses.set([]); // SV: chưa đăng ký gì
    }
  }

  // ------------- getters -------------
  get scheduleArray() {
    return this.form.get('schedule') as FormArray;
  }
  get studentsArray() {
    return this.form.get('students') as FormArray;
  }

  // ------------- computed: bảng DƯỚI (myClasses) -------------
  private tableSource = computed<ClassItem[]>(() => this.myClasses());

  filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const sem = this.semesterFilter();
    let data = this.tableSource();
    if (sem !== 'ALL') data = data.filter((c) => c.semester === sem);
    if (q) {
      data = data.filter(
        (c) =>
          c.code.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          c.subject.toLowerCase().includes(q)
      );
    }
    return [...data].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  });

  paged = computed(() => {
    const data = this.filtered();
    const size = this.pageSize();
    const idx = this.pageIndex();
    const start = (idx - 1) * size;
    return data.slice(start, start + size);
  });

  totalPages = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.pageSize())));

  // ------------- computed: bảng TRÊN (catalog – SV) -------------
  catalogFiltered = computed(() => {
    const q = this.catSearch().trim().toLowerCase();
    let data = this.catalog();
    if (q) {
      data = data.filter(
        (c) =>
          c.code.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          c.subject.toLowerCase().includes(q)
      );
    }
    return [...data].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  });

  catalogPaged = computed(() => {
    const data = this.catalogFiltered();
    const size = this.catPageSize();
    const idx = this.catPageIndex();
    const start = (idx - 1) * size;
    return data.slice(start, start + size);
  });

  catalogTotalPages = computed(() =>
    Math.max(1, Math.ceil(this.catalogFiltered().length / this.catPageSize()))
  );

  // ------------- UI handlers (fix NG5002) -------------
  onSearchInput(e: Event) {
    this.search.set((e.target as HTMLInputElement).value);
  }
  onCatalogSearchInput(e: Event) {
    this.catSearch.set((e.target as HTMLInputElement).value);
  }
  onPageSizeChange(e: Event) {
    const v = Number((e.target as HTMLSelectElement | null)?.value ?? 8);
    this.pageSize.set(v);
  }
  onSemesterChange(e: Event) {
    const v = (e.target as HTMLSelectElement | null)?.value as Semester | 'ALL' | undefined;
    if (v) this.semesterFilter.set(v);
  }
  onCatalogPageSizeChange(e: Event) {
    const v = Number((e.target as HTMLSelectElement | null)?.value ?? 8);
    this.catPageSize.set(v);
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

  goDetail(id: string) {
    this.router.navigate(['/class-detail', id]);
  }

  // ------------- TEACHER: form -------------
  startCreate() {
    this.editingId.set(null);
    this.form.reset({
      code: '',
      name: '',
      subject: '',
      semester: 'HK1',
      status: 'Offline',
      size: 40,
      studentsInput: '',
    });
    this.clearFormArray(this.scheduleArray);
    this.clearFormArray(this.studentsArray);
    this.addSchedule();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  startEdit(item: ClassItem) {
    this.editingId.set(item.id);
    this.form.patchValue({
      code: item.code,
      name: item.name,
      subject: item.subject,
      semester: item.semester,
      status: item.status,
      size: item.size,
      studentsInput: '',
    });
    this.setSchedules(item.schedule);
    this.setStudents(item.students);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  save() {
    if (this.role() !== 'TEACHER') return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.value;
    const newItem: ClassItem = {
      id: this.editingId() ?? crypto.randomUUID(),
      code: v.code!,
      name: v.name!,
      subject: v.subject!,
      semester: v.semester!,
      status: v.status!,
      size: Number(v.size),
      students: (v.students as string[]) ?? [],
      schedule: (v.schedule as ScheduleItem[]) ?? [],
      createdAt: this.editingId()
        ? this.myClasses().find((c) => c.id === this.editingId())?.createdAt ??
          new Date().toISOString()
        : new Date().toISOString(),
    };

    if (this.editingId()) {
      this.myClasses.update((list) => list.map((c) => (c.id === this.editingId() ? newItem : c)));
    } else {
      this.myClasses.update((list) => [newItem, ...list]);
    }
    this.startCreate();
  }

  askDelete(item: ClassItem) {
    if (this.role() !== 'TEACHER') return;
    this.classToDelete.set(item);
    this.showConfirmDelete.set(true);
  }
  confirmDelete() {
    const item = this.classToDelete();
    if (!item) return;
    this.myClasses.update((list) => list.filter((c) => c.id !== item.id));
    this.showConfirmDelete.set(false);
    this.classToDelete.set(null);
    const total = Math.max(1, Math.ceil(this.filtered().length / this.pageSize()));
    if (this.pageIndex() > total) this.pageIndex.set(total);
  }
  cancelDelete() {
    this.showConfirmDelete.set(false);
    this.classToDelete.set(null);
  }

  // ------------- STUDENT: đăng ký/hủy -------------
  isEnrolled = (classId: string) => this.myClasses().some((c) => c.id === classId);

  register(item: ClassItem) {
    if (this.role() !== 'STUDENT') return;
    if (this.isEnrolled(item.id)) return;
    this.myClasses.update((list) => [{ ...item }, ...list]);
  }

  askDrop(item: ClassItem) {
    if (this.role() !== 'STUDENT') return;
    this.classToDrop.set(item);
    this.showConfirmDrop.set(true);
  }
  confirmDrop() {
    const item = this.classToDrop();
    if (!item) return;
    this.myClasses.update((list) => list.filter((c) => c.id !== item.id));
    this.showConfirmDrop.set(false);
    this.classToDrop.set(null);
    const total = Math.max(1, Math.ceil(this.filtered().length / this.pageSize()));
    if (this.pageIndex() > total) this.pageIndex.set(total);
  }
  cancelDrop() {
    this.showConfirmDrop.set(false);
    this.classToDrop.set(null);
  }

  // ------------- schedule helpers -------------
  addSchedule() {
    const group = this.fb.group({
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
        validators: [Validators.required, Validators.maxLength(40)],
      }),
    });
    this.scheduleArray.push(group);
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
            validators: [Validators.required, Validators.maxLength(40)],
          }),
        })
      )
    );
    if (this.scheduleArray.length === 0) this.addSchedule();
  }
  addStudentFromInput() {
    const v = (this.form.get('studentsInput')?.value || '').trim();
    if (!v) return;
    if (!this.studentsArray.value.includes(v)) {
      this.studentsArray.push(new FormControl(v, { nonNullable: true }));
    }
    this.form.get('studentsInput')?.reset('');
  }
  removeStudent(idx: number) {
    this.studentsArray.removeAt(idx);
  }
  setStudents(list: string[]) {
    this.clearFormArray(this.studentsArray);
    list.forEach((s) => this.studentsArray.push(new FormControl(s, { nonNullable: true })));
  }
  private clearFormArray(arr: FormArray) {
    while (arr.length) arr.removeAt(0);
  }
}
