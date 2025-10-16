import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { SectionTitleComponent } from '../../components/title/section-title.component';
import { environment } from '../../../environments/environment';

type PageResp<T> = {
  page: number;
  size: number;
  totalPages: number;
  totalElements: number;
  items: T[];
};

type StudentApiRow = {
  studentCode: string;
  fullName: string;
  phone?: string | null;
  email?: string | null;
  majorName?: string | null;
  genderCode?: 'MALE' | 'FEMALE' | string | null;
};
type LecturerApiRow = {
  lecturerCode: string;
  fullName: string;
  departmentName?: string | null;
  academicRank?: string | null;
  phone?: string | null;
  email?: string | null;
};

type Gender = 'Nam' | 'Nữ' | '—';
type StudentRow = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  major?: string;
  gender: Gender;
};
type LecturerRow = {
  id: string;
  name: string;
  dept?: string;
  title?: string;
  phone?: string;
  email?: string;
};

@Component({
  selector: 'app-people-page',
  standalone: true,
  imports: [CommonModule, FormsModule, SectionTitleComponent],
  templateUrl: './list-people.html',
  styleUrls: ['./list-people.scss'],
})
export class ListPeople {
  private http = inject(HttpClient);
  private base = environment.apiBaseUrl;

  studentForm = { code: '', name: '', phone: '', email: '' };
  students = signal<StudentRow[]>([]);
  stuLoading = signal(false);
  stuErr = signal<string | null>(null);

  stuPage = signal(1);
  stuSize = signal(10);
  stuTotalPages = signal(1);
  stuTotalElements = signal(0);

  stuPageNumbers = computed(() => Array.from({ length: this.stuTotalPages() }, (_, i) => i + 1));

  lecturerForm = { code: '', name: '', phone: '', email: '' };
  lecturers = signal<LecturerRow[]>([]);
  lecLoading = signal(false);
  lecErr = signal<string | null>(null);

  lecPage = signal(1);
  lecSize = signal(10);
  lecTotalPages = signal(1);
  lecTotalElements = signal(0);

  lecPageNumbers = computed(() => Array.from({ length: this.lecTotalPages() }, (_, i) => i + 1));

  private toGender(g?: string | null): Gender {
    if (g === 'MALE') return 'Nam';
    if (g === 'FEMALE') return 'Nữ';
    return '—';
  }
  private mapStudent(v: StudentApiRow): StudentRow {
    return {
      id: v.studentCode,
      name: v.fullName,
      phone: v.phone ?? '—',
      email: v.email ?? '—',
      major: v.majorName ?? '—',
      gender: this.toGender(v.genderCode),
    };
  }
  private mapLecturer(v: LecturerApiRow): LecturerRow {
    return {
      id: v.lecturerCode,
      name: v.fullName,
      dept: v.departmentName ?? '—',
      title: v.academicRank ?? '—',
      phone: v.phone ?? '—',
      email: v.email ?? '—',
    };
  }

  async loadStudents() {
    this.stuLoading.set(true);
    this.stuErr.set(null);
    try {
      let params = new HttpParams()
        .set('page', String(this.stuPage()))
        .set('size', String(this.stuSize()));
      const f = this.studentForm;
      if (f.code.trim()) params = params.set('code', f.code.trim());
      if (f.name.trim()) params = params.set('name', f.name.trim());
      if (f.phone.trim()) params = params.set('phone', f.phone.trim());
      if (f.email.trim()) params = params.set('email', f.email.trim());

      const data = await firstValueFrom(
        this.http.get<PageResp<StudentApiRow>>(`${this.base}/users/students`, { params })
      );

      this.students.set((data.items ?? []).map((it) => this.mapStudent(it)));
      this.stuTotalPages.set(data.totalPages ?? 1);
      this.stuTotalElements.set(data.totalElements ?? 0);
      this.stuPage.set(data.page ?? 1);
      this.stuSize.set(data.size ?? this.stuSize());
    } catch (e: any) {
      this.stuErr.set(e?.message || 'Không thể tải danh sách sinh viên.');
      this.students.set([]);
      this.stuTotalPages.set(1);
      this.stuTotalElements.set(0);
    } finally {
      this.stuLoading.set(false);
    }
  }

  async loadLecturers() {
    this.lecLoading.set(true);
    this.lecErr.set(null);
    try {
      let params = new HttpParams()
        .set('page', String(this.lecPage()))
        .set('size', String(this.lecSize()));
      const f = this.lecturerForm;
      if (f.code.trim()) params = params.set('code', f.code.trim());
      if (f.name.trim()) params = params.set('name', f.name.trim());
      if (f.phone.trim()) params = params.set('phone', f.phone.trim());
      if (f.email.trim()) params = params.set('email', f.email.trim());

      const data = await firstValueFrom(
        this.http.get<PageResp<LecturerApiRow>>(`${this.base}/users/lecturers`, { params })
      );

      this.lecturers.set((data.items ?? []).map((it) => this.mapLecturer(it)));
      this.lecTotalPages.set(data.totalPages ?? 1);
      this.lecTotalElements.set(data.totalElements ?? 0);
      this.lecPage.set(data.page ?? 1);
      this.lecSize.set(data.size ?? this.lecSize());
    } catch (e: any) {
      this.lecErr.set(e?.message || 'Không thể tải danh sách giảng viên.');
      this.lecturers.set([]);
      this.lecTotalPages.set(1);
      this.lecTotalElements.set(0);
    } finally {
      this.lecLoading.set(false);
    }
  }

  searchStudents() {
    this.stuPage.set(1);
    this.loadStudents();
  }
  clearStudentFilters() {
    this.studentForm = { code: '', name: '', phone: '', email: '' };
    this.searchStudents();
  }
  goStudentPage(p: number) {
    if (p < 1) p = 1;
    if (p > this.stuTotalPages()) p = this.stuTotalPages();
    if (p === this.stuPage()) return;
    this.stuPage.set(p);
    this.loadStudents();
  }

  searchLecturers() {
    this.lecPage.set(1);
    this.loadLecturers();
  }
  clearLecturerFilters() {
    this.lecturerForm = { code: '', name: '', phone: '', email: '' };
    this.searchLecturers();
  }
  goLecturerPage(p: number) {
    if (p < 1) p = 1;
    if (p > this.lecTotalPages()) p = this.lecTotalPages();
    if (p === this.lecPage()) return;
    this.lecPage.set(p);
    this.loadLecturers();
  }

  constructor() {
    this.loadStudents();
    this.loadLecturers();
  }

  trackStudent = (_: number, s: StudentRow) => s.id;
  trackLecturer = (_: number, l: LecturerRow) => l.id;
}
