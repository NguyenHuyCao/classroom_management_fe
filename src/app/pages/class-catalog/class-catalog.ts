import { Component, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SectionTitleComponent } from '../../components/title/section-title.component';

type Status = 'Online' | 'Offline';
type Semester = 'HK1' | 'HK2' | 'HK He';

interface ScheduleItem {
  day: number; // 2..7
  start: string; // "08:00"
  end: string; // "10:00"
  room: string; // "P203" | "Online"
}

interface ClassRow {
  id: string;
  year: number; // năm học
  code: string; // CS101-K40A
  name: string; // Nhập môn Khoa học Máy tính - K40A
  subject: string; // CS101
  lecturer: string; // giảng viên phụ trách
  semester: Semester; // HK1 | HK2 | HK He
  status: Status; // Online | Offline
  size: number; // sĩ số dự kiến
  students: string[]; // danh sách MSSV/email
  schedule: ScheduleItem[]; // nhiều buổi
  createdAt: string; // ISO
}

type SortKey =
  | 'createdAt'
  | 'code'
  | 'name'
  | 'subject'
  | 'lecturer'
  | 'semester'
  | 'status'
  | 'size';

@Component({
  selector: 'app-class-catalog',
  standalone: true,
  imports: [CommonModule, SectionTitleComponent],
  templateUrl: './class-catalog.html',
  styleUrls: ['./class-catalog.scss'],
})
export class ClassCatalog {
  private seed: ClassRow[] = [
    {
      id: crypto.randomUUID(),
      year: 2025,
      code: 'CS101-K40A',
      name: 'Nhập môn Khoa học Máy tính - K40A',
      subject: 'CS101',
      lecturer: 'Nguyễn Văn A',
      semester: 'HK1',
      status: 'Offline',
      size: 45,
      students: Array.from({ length: 43 }, (_, i) => `SV${(1000 + i).toString()}`),
      schedule: [
        { day: 2, start: '08:00', end: '10:00', room: 'P203' },
        { day: 5, start: '08:00', end: '10:00', room: 'P203' },
      ],
      createdAt: '2025-08-20T08:00:00.000Z',
    },
    {
      id: crypto.randomUUID(),
      year: 2025,
      code: 'ML113-K40B',
      name: 'Triết học Mác-Lênin - K40B',
      subject: 'ML113',
      lecturer: 'Trần Thị B',
      semester: 'HK2',
      status: 'Online',
      size: 60,
      students: Array.from({ length: 58 }, (_, i) => `SV${(2000 + i).toString()}`),
      schedule: [{ day: 3, start: '18:00', end: '20:00', room: 'Online' }],
      createdAt: '2025-01-05T12:00:00.000Z',
    },
    {
      id: crypto.randomUUID(),
      year: 2024,
      code: 'MA101-K39C',
      name: 'Logic & Kỹ thuật đếm - K39C',
      subject: 'MA101',
      lecturer: 'Phạm Quốc C',
      semester: 'HK He',
      status: 'Offline',
      size: 50,
      students: Array.from({ length: 49 }, (_, i) => `SV${(3000 + i).toString()}`),
      schedule: [{ day: 4, start: '13:30', end: '15:30', room: 'P402' }],
      createdAt: '2024-06-03T02:00:00.000Z',
    },
  ];

  rows = signal<ClassRow[]>(this.seed);
  search = signal<string>('');
  yearFilter = signal<number | 'ALL'>('ALL');
  semesterFilter = signal<Semester | 'ALL'>('ALL');
  lecturerFilter = signal<string | 'ALL'>('ALL');
  statusFilter = signal<Status | 'ALL'>('ALL');

  sortKey = signal<SortKey>('createdAt');
  sortDir = signal<'asc' | 'desc'>('desc');

  pageSize = signal<number>(10);
  pageIndex = signal<number>(1);

  years = computed(() => {
    const ys = Array.from(new Set(this.rows().map((r) => r.year))).sort((a, b) => b - a);
    return ys;
  });
  lecturers = computed(() => {
    const ls = Array.from(new Set(this.rows().map((r) => r.lecturer))).sort();
    return ls;
  });

  statTotal = computed(() => this.filtered().length);
  statOnline = computed(() => this.filtered().filter((r) => r.status === 'Online').length);
  statOffline = computed(() => this.filtered().filter((r) => r.status === 'Offline').length);
  statStudents = computed(() => this.filtered().reduce((acc, r) => acc + r.students.length, 0));

  filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const yf = this.yearFilter();
    const sf = this.semesterFilter();
    const lf = this.lecturerFilter();
    const st = this.statusFilter();

    let data = this.rows();

    if (yf !== 'ALL') data = data.filter((r) => r.year === yf);
    if (sf !== 'ALL') data = data.filter((r) => r.semester === sf);
    if (lf !== 'ALL') data = data.filter((r) => r.lecturer === lf);
    if (st !== 'ALL') data = data.filter((r) => r.status === st);

    if (q) {
      data = data.filter(
        (r) =>
          r.code.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q) ||
          r.subject.toLowerCase().includes(q) ||
          r.lecturer.toLowerCase().includes(q)
      );
    }

    const key = this.sortKey();
    const dir = this.sortDir();
    data = [...data].sort((a: ClassRow, b: ClassRow) => {
      let va: any = (a as any)[key];
      let vb: any = (b as any)[key];
      if (key === 'createdAt') {
        va = +new Date(a.createdAt);
        vb = +new Date(b.createdAt);
      }
      if (typeof va === 'string' && typeof vb === 'string') {
        const res = va.localeCompare(vb, 'vi', { numeric: true, sensitivity: 'base' });
        return dir === 'asc' ? res : -res;
      } else {
        const res = va < vb ? -1 : va > vb ? 1 : 0;
        return dir === 'asc' ? res : -res;
      }
    });

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

  constructor() {
    effect(() => {
      this.search();
      this.yearFilter();
      this.semesterFilter();
      this.lecturerFilter();
      this.statusFilter();
      this.sortKey();
      this.sortDir();
      this.pageIndex.set(1);
    });
  }

  onSearch(e: Event) {
    const v = (e.target as HTMLInputElement | null)?.value ?? '';
    this.search.set(v);
  }
  onYear(e: Event) {
    const v = (e.target as HTMLSelectElement | null)?.value ?? 'ALL';
    this.yearFilter.set(v === 'ALL' ? 'ALL' : Number(v));
  }
  onSemester(e: Event) {
    const v = (e.target as HTMLSelectElement | null)?.value as Semester | 'ALL' | undefined;
    if (v) this.semesterFilter.set(v);
  }
  onLecturer(e: Event) {
    const v = (e.target as HTMLSelectElement | null)?.value ?? 'ALL';
    this.lecturerFilter.set(v as any);
  }
  onStatus(e: Event) {
    const v = (e.target as HTMLSelectElement | null)?.value as Status | 'ALL' | undefined;
    if (v) this.statusFilter.set(v);
  }
  onPageSize(e: Event) {
    const v = Number((e.target as HTMLSelectElement | null)?.value ?? 10);
    this.pageSize.set(v);
  }

  toggleSort(key: SortKey) {
    if (this.sortKey() === key) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortKey.set(key);
      this.sortDir.set('asc');
    }
  }

  goPage(i: number) {
    const total = this.totalPages();
    if (i < 1 || i > total) return;
    this.pageIndex.set(i);
  }

  exportCSV() {
    const cols = [
      'year',
      'code',
      'name',
      'subject',
      'lecturer',
      'semester',
      'status',
      'size',
      'studentsCount',
      'schedule',
      'createdAt',
    ];
    const rows = this.filtered().map((r) => {
      const sch = r.schedule.map((s) => `Thu ${s.day} ${s.start}-${s.end} @ ${s.room}`).join(' | ');
      return [
        r.year,
        r.code,
        r.name,
        r.subject,
        r.lecturer,
        r.semester,
        r.status,
        r.size,
        r.students.length,
        sch,
        r.createdAt,
      ];
    });
    const csv = [
      cols.join(','),
      ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `class_catalog_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
