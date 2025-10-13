import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SectionTitleComponent } from '../../components/title/section-title.component';
import { Router } from '@angular/router';
import { Api } from '../../core/api';

type Status = 'Online' | 'Offline';
type Semester = 'HK1' | 'HK2' | 'HK He';

interface ScheduleItem {
  day: string;
  start: string;
  end: string;
  room: string;
}
interface ClassRow {
  id: string;
  createdAt: string; // ISO
  code: string; // classCode
  name: string; // className
  subject: string; // courseCode
  lecturer: string; // teacherName | '—'
  semester: Semester; // HK1/HK2/HK He
  status: Status; // Online/Offline
  size: number; // capacity
  schedule: ScheduleItem[];
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

type ApiItem = {
  createdAt: string; // "dd/MM/yyyy HH:mm"
  classCode: string;
  className: string;
  courseCode: string;
  teacherName: string | null;
  semesterCode: 'HK1' | 'HK2' | 'HK He';
  deliveryMode: 'ONLINE' | 'OFFLINE';
  capacity: number;
  scheduleText: string | null;
};
type ApiPayload = {
  page: {
    page: number;
    size: number;
    totalPages: number;
    totalElements: number;
    items: ApiItem[];
  };
  stats: { totalClasses: number; totalStudents: number; onlineCount: number; offlineCount: number };
};

@Component({
  selector: 'app-class-catalog',
  standalone: true,
  imports: [CommonModule, SectionTitleComponent],
  templateUrl: './class-catalog.html',
  styleUrls: ['./class-catalog.scss'],
})
export class ClassCatalog {
  constructor(private router: Router, private api: Api) {
    // tải lần đầu (không filter)
    this.load();
  }

  // ----- UI (chưa áp dụng) -----
  uiCourse = signal<string>(''); // chỉ tìm theo courseCode
  uiYear = signal<number | 'ALL'>('ALL');
  uiSemester = signal<Semester | 'ALL'>('ALL');
  uiStatus = signal<Status | 'ALL'>('ALL');

  // ----- đã áp dụng (để gọi API/paging) -----
  qCourse = signal<string>(''); // course query đã áp dụng
  qYear = signal<number | 'ALL'>('ALL');
  qSemester = signal<Semester | 'ALL'>('ALL');
  qStatus = signal<Status | 'ALL'>('ALL');

  // ----- table/paging/sort -----
  loading = signal(false);
  err = signal<string | null>(null);
  rows = signal<ClassRow[]>([]);
  pageIndex = signal<number>(1); // 1-based
  pageSize = signal<number>(10);
  totalPagesSvr = signal<number>(1);
  totalElementsSvr = signal<number>(0);

  sortKey = signal<SortKey>('createdAt');
  sortDir = signal<'asc' | 'desc'>('desc');

  displayed = computed(() => {
    const key = this.sortKey();
    const dir = this.sortDir();
    return [...this.rows()].sort((a, b) => {
      let va: any = (a as any)[key],
        vb: any = (b as any)[key];
      if (key === 'createdAt') {
        va = +new Date(a.createdAt);
        vb = +new Date(b.createdAt);
      }
      if (typeof va === 'string' && typeof vb === 'string') {
        const res = va.localeCompare(vb, 'vi', { numeric: true, sensitivity: 'base' });
        return dir === 'asc' ? res : -res;
      }
      const res = va < vb ? -1 : va > vb ? 1 : 0;
      return dir === 'asc' ? res : -res;
    });
  });

  // ----- stats từ BE -----
  statTotal = signal(0);
  statStudents = signal(0);
  statOnline = signal(0);
  statOffline = signal(0);

  years = computed(() => {
    const y = new Date().getFullYear();
    return [y + 1, y, y - 1, y - 2, y - 3];
  });

  // ----- handlers: chỉ cập nhật UI, KHÔNG gọi API -----
  onSearchInput(e: Event) {
    this.uiCourse.set(((e.target as HTMLInputElement)?.value ?? '').trim());
  }
  onYear(e: Event) {
    const v = (e.target as HTMLSelectElement)?.value ?? 'ALL';
    this.uiYear.set(v === 'ALL' ? 'ALL' : +v);
  }
  onSemester(e: Event) {
    const v = (e.target as HTMLSelectElement)?.value as Semester | 'ALL';
    if (v) this.uiSemester.set(v);
  }
  onStatus(e: Event) {
    const v = (e.target as HTMLSelectElement)?.value as Status | 'ALL';
    if (v) this.uiStatus.set(v);
  }

  // Bấm Tìm (hoặc Enter) mới ÁP DỤNG filter + gọi API
  doSearch() {
    this.qCourse.set(this.uiCourse().trim());
    this.qYear.set(this.uiYear());
    this.qSemester.set(this.uiSemester());
    this.qStatus.set(this.uiStatus());
    this.pageIndex.set(1);
    this.load();
  }

  toggleSort(key: SortKey) {
    if (this.sortKey() === key) this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    else {
      this.sortKey.set(key);
      this.sortDir.set('asc');
    }
  }

  goPage(i: number) {
    if (i < 1 || i > this.totalPagesSvr() || i === this.pageIndex()) return;
    this.pageIndex.set(i);
    this.load();
  }

  goDetail(id: string) {
    this.router.navigate(['/class-detail', id]);
  }

  exportCSV() {
    const cols = [
      'createdAt',
      'classCode',
      'className',
      'courseCode',
      'teacherName',
      'semester',
      'mode',
      'capacity',
      'schedule',
    ];
    const rows = this.displayed().map((r) => {
      const sch = r.schedule.map((s) => `${s.day} ${s.start}–${s.end} @ ${s.room}`).join(' | ');
      return [
        new Date(r.createdAt).toLocaleString('vi-VN'),
        r.code,
        r.name,
        r.subject,
        r.lecturer,
        r.semester,
        r.status,
        r.size,
        sch,
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

  // ----- data -----
  private parseVnDate(s: string): string {
    const [d, t = '00:00'] = s.split(' ');
    const [dd, MM, yyyy] = d.split('/').map(Number);
    const [hh, mm] = t.split(':').map(Number);
    return new Date(yyyy, MM - 1, dd, hh, mm).toISOString();
  }
  private parseSchedule(text: string | null): ScheduleItem[] {
    if (!text) return [];
    return text.split('\n').map((line) => {
      const [d, time, room] = line.split('•').map((x) => x.trim());
      const [start, end] = (time || '').split('–').map((x) => x.trim());
      return { day: d || '', start: start || '', end: end || '', room: room || '' };
    });
  }
  private mapItem(it: ApiItem): ClassRow {
    return {
      id: it.classCode,
      createdAt: this.parseVnDate(it.createdAt),
      code: it.classCode,
      name: it.className,
      subject: it.courseCode,
      lecturer: it.teacherName ?? '—',
      semester: it.semesterCode,
      status: it.deliveryMode === 'ONLINE' ? 'Online' : 'Offline',
      size: it.capacity,
      schedule: this.parseSchedule(it.scheduleText),
    };
  }

  async load() {
    this.loading.set(true);
    this.err.set(null);
    try {
      const params: Record<string, any> = {
        page: this.pageIndex() - 1,
        size: this.pageSize(),
      };
      const course = this.qCourse().trim();
      if (course) params['course'] = course;
      const yf = this.qYear();
      if (yf !== 'ALL') params['year'] = yf;
      const sf = this.qSemester();
      if (sf !== 'ALL') params['semester'] = sf;
      const st = this.qStatus();
      if (st !== 'ALL') params['mode'] = st === 'Online' ? 'ONLINE' : 'OFFLINE';

      const res = await this.api
        .get<{ page: ApiPayload['page']; stats: ApiPayload['stats'] }>('/classes', params)
        .toPromise();

      const items = (res?.page?.items ?? []).map((i) => this.mapItem(i));
      this.rows.set(items);
      this.totalPagesSvr.set(res?.page?.totalPages ?? 1);
      this.totalElementsSvr.set(res?.page?.totalElements ?? items.length);

      this.statTotal.set(res?.stats?.totalClasses ?? items.length);
      this.statStudents.set(res?.stats?.totalStudents ?? 0);
      this.statOnline.set(res?.stats?.onlineCount ?? 0);
      this.statOffline.set(res?.stats?.offlineCount ?? 0);
    } catch (e: any) {
      this.err.set(e?.message || 'Không thể tải danh sách lớp.');
    } finally {
      this.loading.set(false);
    }
  }
}
