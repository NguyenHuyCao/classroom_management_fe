import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { SectionTitleComponent } from '../../components/title/section-title.component';
import { environment } from '../../../environments/environment';
import { NgSelectModule } from '@ng-select/ng-select';

type TrainingItem = {
  courseCode: string;
  courseName: string;
  creditPoints: number;
  contactHours: number;
  weightFactor: number;
  departmentName: string;
  categoryName: string;
};
type TrainingCategory = { categoryName: string; items: TrainingItem[] };

@Component({
  selector: 'app-program',
  standalone: true,
  imports: [CommonModule, FormsModule, SectionTitleComponent, NgSelectModule],
  templateUrl: './program.html',
  styleUrl: './program.scss',
})
export class Program {
  private http = inject(HttpClient);
  private base = environment.apiBaseUrl;

  cohorts = ['K40', 'K39', 'K38'];
  majorsVI = [
    'Khoa học máy tính',
    'Công nghệ thông tin',
    'Kỹ thuật phần mềm',
    'Hệ thống thông tin',
    'An toàn thông tin',
  ];

  private majorMap: Record<string, string> = {
    'Khoa học máy tính': 'Khoa học máy tính',
    'Công nghệ thông tin': 'Information Technology',
    'Kỹ thuật phần mềm': 'Software Engineering',
    'Hệ thống thông tin': 'Information Systems',
    'An toàn thông tin': 'Information Security',
  };
  private majorMapRev: Record<string, string> = Object.fromEntries(
    Object.entries(this.majorMap).map(([vi, en]) => [en, vi])
  );

  cohort = signal<'ALL' | string>('ALL');
  majorVI = signal<'ALL' | string>('ALL');
  category = signal<'ALL' | string>('ALL');

  loading = signal(false);
  err = signal<string | null>(null);
  categories = signal<TrainingCategory[]>([]);

  // tùy chọn nhóm dùng cho Select “Nhóm học phần”
  categoryOptions = computed(() => {
    const names = new Set(this.categories().map((c) => c.categoryName));
    return ['ALL', ...names];
  });

  totalCredits = computed(() =>
    this.categories().reduce((s, c) => s + c.items.reduce((a, i) => a + i.creditPoints, 0), 0)
  );
  totalHours = computed(() =>
    this.categories().reduce((s, c) => s + c.items.reduce((a, i) => a + i.contactHours, 0), 0)
  );

  constructor() {
    this.prefillFromMe().then(() => this.search());
  }

  private async prefillFromMe() {
    try {
      const me = await firstValueFrom(this.http.get<any>(`${this.base}/users/me`));
      if (me?.cohortName) this.cohort.set(me.cohortName);
      if (me?.majorName) this.majorVI.set(this.majorMapRev[me.majorName] ?? me.majorName);
    } catch {
      /* giữ ALL nếu lỗi */
    }
  }

  async search() {
    this.loading.set(true);
    this.err.set(null);
    try {
      let params = new HttpParams();
      if (this.cohort() !== 'ALL') params = params.set('cohort', this.cohort());
      if (this.majorVI() !== 'ALL')
        params = params.set('major', this.majorMap[this.majorVI()] ?? this.majorVI());
      if (this.category() !== 'ALL') params = params.set('category', this.category());

      // Nếu bạn KHÔNG dùng envelope-interceptor thì đổi sang:
      // const res = await firstValueFrom(this.http.get<{data: TrainingCategory[]}>(`${this.base}/training-program`, { params }));
      // this.categories.set(res.data ?? []);
      const data = await firstValueFrom(
        this.http.get<TrainingCategory[]>(`${this.base}/training-program`, { params })
      );
      this.categories.set(Array.isArray(data) ? data : []);
    } catch (e: any) {
      this.err.set(e?.message || 'Không thể tải chương trình đào tạo.');
      this.categories.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  clearFilters() {
    // chỉ reset nhóm (để tránh vô tình giữ “Giáo dục đại cương” khiến kết quả chỉ có 1 nhóm)
    this.category.set('ALL');
  }
}
