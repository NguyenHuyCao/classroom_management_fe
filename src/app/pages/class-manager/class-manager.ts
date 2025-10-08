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

type Status = 'Online' | 'Offline';
type Semester = 'HK1' | 'HK2' | 'HK He';

interface ScheduleItem {
  day: number; // 2..7
  start: string; // "08:00"
  end: string; // "10:00"
  room: string; // "P203" | "Online"
}

interface ClassItem {
  id: string;
  code: string; // CS101-K40A
  name: string; // Tên lớp hiển thị
  subject: string; // Môn học
  semester: Semester; // HK1 
  status: Status; // Online | Offline
  size: number; // Sĩ số dự kiến
  students: string[]; // Danh sách MSSV
  schedule: ScheduleItem[]; // Nhiều buổi
  createdAt: string; // ISO
}

@Component({
  selector: 'app-class-manager',
  standalone: true,
  imports: [SectionTitleComponent, CommonModule, ReactiveFormsModule],
  templateUrl: './class-manager.html',
  styleUrls: ['./class-manager.scss'],
})
export class ClassManager {
  private initialData: ClassItem[] = [
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

  classes = signal<ClassItem[]>(this.initialData);
  search = signal<string>('');
  semesterFilter = signal<Semester | 'ALL'>('ALL');

  pageSize = signal<number>(8);
  pageIndex = signal<number>(1);

  form: FormGroup;
  editingId = signal<string | null>(null);

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

  constructor(private fb: FormBuilder) {
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

    if ((this.form.get('schedule') as FormArray).length === 0) {
      this.addSchedule();
    }

    effect(() => {
      this.search();
      this.semesterFilter();
      this.pageIndex.set(1);
    });
  }

  onSemesterChange(e: Event) {
    const v = (e.target as HTMLSelectElement | null)?.value as Semester | 'ALL' | undefined;
    if (v) this.semesterFilter.set(v);
  }
  onPageSizeChange(e: Event) {
    const v = Number((e.target as HTMLSelectElement | null)?.value ?? 8);
    this.pageSize.set(v);
  }

  get scheduleArray() {
    return this.form.get('schedule') as FormArray;
  }
  get studentsArray() {
    return this.form.get('students') as FormArray;
  }

  filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const sem = this.semesterFilter();

    let data = this.classes();
    if (sem !== 'ALL') data = data.filter((c) => c.semester === sem);
    if (q) {
      data = data.filter(
        (c) =>
          c.code.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          c.subject.toLowerCase().includes(q)
      );
    }
    data = [...data].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    return data;
  });

  paged = computed(() => {
    const data = this.filtered();
    const size = this.pageSize();
    const idx = this.pageIndex();
    const start = (idx - 1) * size;
    return data.slice(start, start + size);
  });

  totalPages = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.pageSize())));

  // --- CRUD ---
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
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.value;
    const newItem: ClassItem = {
      id: this.editingId() ?? crypto.randomUUID(),
      code: value.code!,
      name: value.name!,
      subject: value.subject!,
      semester: value.semester!,
      status: value.status!,
      size: Number(value.size),
      students: (value.students as string[]) ?? [],
      schedule: (value.schedule as ScheduleItem[]) ?? [],
      createdAt: this.editingId()
        ? this.classes().find((c) => c.id === this.editingId())?.createdAt ??
          new Date().toISOString()
        : new Date().toISOString(),
    };

    if (this.editingId()) {
      this.classes.update((list) => list.map((c) => (c.id === this.editingId() ? newItem : c)));
    } else {
      this.classes.update((list) => [newItem, ...list]);
    }

    this.startCreate();
  }

  delete(item: ClassItem) {
    if (confirm(`Xóa lớp "${item.name}"?`)) {
      this.classes.update((list) => list.filter((c) => c.id !== item.id));
    }
  }

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

  goPage(i: number) {
    const total = this.totalPages();
    if (i < 1 || i > total) return;
    this.pageIndex.set(i);
  }
}
