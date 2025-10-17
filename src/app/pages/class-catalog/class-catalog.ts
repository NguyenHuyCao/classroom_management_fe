import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SectionTitleComponent } from '../../components/title/section-title.component';
import { Router } from '@angular/router';
import { Api } from '../../core/api';
import { HttpClient } from '@angular/common/http';

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
  createdAt: string;
  code: string;
  name: string;
  subject: string;
  lecturer: string;
  semester: Semester;
  status: Status;
  size: number;
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
  createdAt: string;
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
  page: { page: number; size: number; totalPages: number; totalElements: number; items: ApiItem[] };
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
  constructor(private router: Router, private api: Api, private http: HttpClient) {
    this.load();
  }

  uiCourse = signal<string>('');
  uiYear = signal<number | 'ALL'>('ALL');
  uiSemester = signal<Semester | 'ALL'>('ALL');
  uiStatus = signal<Status | 'ALL'>('ALL');

  qCourse = signal<string>('');
  qYear = signal<number | 'ALL'>('ALL');
  qSemester = signal<Semester | 'ALL'>('ALL');
  qStatus = signal<Status | 'ALL'>('ALL');

  loading = signal(false);
  exporting = signal(false);
  err = signal<string | null>(null);
  rows = signal<ClassRow[]>([]);

  pageIndex = signal<number>(1);
  pageSize = signal<number>(5);
  totalPagesSvr = signal<number>(1);
  totalElementsSvr = signal<number>(0);

  sortKey = signal<SortKey>('createdAt');
  sortDir = signal<'asc' | 'desc'>('desc');

  displayed = computed(() => {
    const key = this.sortKey();
    const dir = this.sortDir();
    return [...this.rows()].sort((a, b) => {
      let va: any = (a as any)[key];
      let vb: any = (b as any)[key];

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

  statTotal = signal(0);
  statStudents = signal(0);
  statOnline = signal(0);
  statOffline = signal(0);

  years = computed(() => {
    const y = new Date().getFullYear();
    return [y + 1, y, y - 1, y - 2, y - 3];
  });

  pageNumbers(): Array<number | '…'> {
    const total = Math.max(1, this.totalPagesSvr());
    const cur = Math.min(Math.max(1, this.pageIndex()), total);
    const windowSize = 5;

    const out: Array<number | '…'> = [];
    const push = (v: number | '…') => out.push(v);

    push(1);

    if (total <= windowSize) {
      for (let p = 2; p <= total; p++) push(p);
      return out;
    }

    const middleCount = windowSize - 2;
    let start = cur - Math.floor(middleCount / 2);
    let end = cur + Math.floor(middleCount / 2);

    if (start < 2) {
      end += 2 - start;
      start = 2;
    }
    if (end > total - 1) {
      const diff = end - (total - 1);
      start = Math.max(2, start - diff);
      end = total - 1;
    }

    if (start > 2) push('…');
    for (let p = start; p <= end; p++) push(p);
    if (end < total - 1) push('…');

    push(total);
    return out;
  }

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

  doSearch() {
    this.qCourse.set(this.uiCourse().trim());
    this.qYear.set(this.uiYear());
    this.qSemester.set(this.uiSemester());
    this.qStatus.set(this.uiStatus());
    this.pageIndex.set(1);
    this.load();
  }

  toggleSort(key: SortKey) {
    if (this.sortKey() === key) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortKey.set(key);
      this.sortDir.set('asc');
    }
  }

  goPage(i: number | '…') {
    if (i === '…') return;
    const total = Math.max(1, this.totalPagesSvr());
    if (i < 1 || i > total || i === this.pageIndex()) return;
    this.pageIndex.set(i);
    this.load();
  }

  goDetail(id: string) {
    this.router.navigate(['/class-detail', id]);
  }

  async exportPDF() {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.err.set(null);

    try {
      const params: Record<string, any> = {
        page: this.pageIndex() - 1,
        size: Math.max(this.pageSize(), 1),
      };
      const course = this.qCourse().trim();
      if (course) params['course'] = course;
      const yf = this.qYear();
      if (yf !== 'ALL') params['year'] = yf;
      const sf = this.qSemester();
      if (sf !== 'ALL') params['semester'] = sf;
      const st = this.qStatus();
      if (st !== 'ALL') params['mode'] = st === 'Online' ? 'ONLINE' : 'OFFLINE';

      const res = await this.http
        .get('/api/v1/reports/export', {
          params,
          observe: 'response',
          responseType: 'blob' as const,
          withCredentials: true,
        })
        .toPromise();

      const disposition = res?.headers.get('Content-Disposition') || '';
      const m = /filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i.exec(disposition);
      const fallback = `classes_${new Date().toISOString().slice(0, 10)}.pdf`;
      const filename = m ? decodeURIComponent(m[1]) : fallback;

      const blob = new Blob([res!.body!], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const win = window.open(url);
      if (!win) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e: any) {
      this.err.set(e?.message || 'Không thể xuất PDF.');
    } finally {
      this.exporting.set(false);
    }
  }

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
      const params: Record<string, any> = { page: this.pageIndex() - 1, size: this.pageSize() };
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

      const bePage = res?.page?.page ?? 0;
      const beSize = res?.page?.size ?? this.pageSize();
      const beTotalElements = res?.page?.totalElements ?? items.length;
      const beTotalPages = Math.max(1, res?.page?.totalPages ?? 1);

      this.pageIndex.set(bePage + 1);
      this.pageSize.set(beSize);
      this.totalElementsSvr.set(beTotalElements);
      this.totalPagesSvr.set(beTotalPages);

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
