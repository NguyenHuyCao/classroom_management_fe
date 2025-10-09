import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SectionTitleComponent } from '../../components/title/section-title.component';

type Gender = 'Nam' | 'Nữ';

interface Student {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  major?: string;
  gender?: Gender;
}

interface Lecturer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  dept?: string;
  title?: string;
}

@Component({
  selector: 'app-people-page',
  standalone: true,
  imports: [CommonModule, FormsModule, SectionTitleComponent],
  templateUrl: './list-people.html',
  styleUrls: ['./list-people.scss'],
})
export class ListPeople {
  private readonly _studentsAll = signal<Student[]>([
    {
      id: 'A70001',
      name: 'Trần Thu Thủy',
      email: 'a70001@uni.edu',
      phone: '0901234567',
      major: 'Khoa học máy tính',
      gender: 'Nữ',
    },
    {
      id: 'A70002',
      name: 'Nguyễn Văn An',
      email: 'a70002@uni.edu',
      phone: '0902222333',
      major: 'Hệ thống thông tin',
      gender: 'Nam',
    },
    {
      id: 'A70003',
      name: 'Lê Hải Yến',
      email: 'a70003@uni.edu',
      phone: '0903333444',
      major: 'Kỹ thuật phần mềm',
      gender: 'Nữ',
    },
    {
      id: 'A70004',
      name: 'Phạm Minh Đức',
      email: 'a70004@uni.edu',
      phone: '0904444555',
      major: 'Khoa học dữ liệu',
      gender: 'Nam',
    },
    {
      id: 'A70005',
      name: 'Bùi Hoàng Nam',
      email: 'a70005@uni.edu',
      phone: '0905555666',
      major: 'An toàn thông tin',
      gender: 'Nam',
    },
    {
      id: 'A70006',
      name: 'Vũ Thị Mai',
      email: 'a70006@uni.edu',
      phone: '0906666777',
      major: 'Khoa học máy tính',
      gender: 'Nữ',
    },
    {
      id: 'A70007',
      name: 'Đặng Anh Tuấn',
      email: 'a70007@uni.edu',
      phone: '0907777888',
      major: 'Kỹ thuật phần mềm',
      gender: 'Nam',
    },
    {
      id: 'A70008',
      name: 'Hồ Gia Hân',
      email: 'a70008@uni.edu',
      phone: '0908888999',
      major: 'Hệ thống thông tin',
      gender: 'Nữ',
    },
    {
      id: 'A70009',
      name: 'Trịnh Bá Long',
      email: 'a70009@uni.edu',
      phone: '0911111222',
      major: 'Khoa học dữ liệu',
      gender: 'Nam',
    },
    {
      id: 'A70010',
      name: 'Đoàn Minh Khoa',
      email: 'a70010@uni.edu',
      phone: '0912222333',
      major: 'An toàn thông tin',
      gender: 'Nam',
    },
    {
      id: 'A70011',
      name: 'Ngô Thảo Linh',
      email: 'a70011@uni.edu',
      phone: '0913333444',
      major: 'Khoa học máy tính',
      gender: 'Nữ',
    },
    {
      id: 'A70012',
      name: 'Phan Nhật Quang',
      email: 'a70012@uni.edu',
      phone: '0914444555',
      major: 'Kỹ thuật phần mềm',
      gender: 'Nam',
    },
    {
      id: 'A70013',
      name: 'Trương Khánh Ly',
      email: 'a70013@uni.edu',
      phone: '0915555666',
      major: 'Hệ thống thông tin',
      gender: 'Nữ',
    },
    {
      id: 'A70014',
      name: 'Phùng Thanh Bình',
      email: 'a70014@uni.edu',
      phone: '0916666777',
      major: 'Khoa học dữ liệu',
      gender: 'Nam',
    },
    {
      id: 'A70015',
      name: 'Lý Chí Công',
      email: 'a70015@uni.edu',
      phone: '0917777888',
      major: 'Khoa học máy tính',
      gender: 'Nam',
    },
  ]);

  private readonly _lecturersAll = signal<Lecturer[]>([
    {
      id: 'GV001',
      name: 'PGS.TS. Nguyễn Thị Hạnh',
      dept: 'Khoa CNTT',
      title: 'PGS.TS.',
      phone: '0981111000',
      email: 'hanhnt@uni.edu',
    },
    {
      id: 'GV002',
      name: 'TS. Trần Minh Quân',
      dept: 'Khoa CNTT',
      title: 'TS.',
      phone: '0982222000',
      email: 'quantm@uni.edu',
    },
    {
      id: 'GV003',
      name: 'ThS. Lê Thu Hà',
      dept: 'Khoa KH&DL',
      title: 'ThS.',
      phone: '0983333000',
      email: 'halet@uni.edu',
    },
    {
      id: 'GV004',
      name: 'TS. Phạm Đức Thịnh',
      dept: 'Khoa ATTT',
      title: 'TS.',
      phone: '0984444000',
      email: 'thinhpd@uni.edu',
    },
    {
      id: 'GV005',
      name: 'ThS. Bùi Ngọc Châu',
      dept: 'Khoa HTTT',
      title: 'ThS.',
      phone: '0985555000',
      email: 'chaubn@uni.edu',
    },
    {
      id: 'GV006',
      name: 'TS. Vũ Mạnh Hùng',
      dept: 'Khoa KHMT',
      title: 'TS.',
      phone: '0986666000',
      email: 'hungvm@uni.edu',
    },
    {
      id: 'GV007',
      name: 'ThS. Đỗ Hải Âu',
      dept: 'Khoa KTPM',
      title: 'ThS.',
      phone: '0987777000',
      email: 'audh@uni.edu',
    },
    {
      id: 'GV008',
      name: 'PGS.TS. Trịnh Thị Lan',
      dept: 'Khoa CNTT',
      title: 'PGS.TS.',
      phone: '0988888000',
      email: 'lantrinh@uni.edu',
    },
    {
      id: 'GV009',
      name: 'TS. Hoàng Văn Đạt',
      dept: 'Khoa ATTT',
      title: 'TS.',
      phone: '0989999000',
      email: 'dathv@uni.edu',
    },
    {
      id: 'GV010',
      name: 'ThS. Phạm Thu Trang',
      dept: 'Khoa HTTT',
      title: 'ThS.',
      phone: '0970000111',
      email: 'trangpt@uni.edu',
    },
  ]);

  studentQuery = signal({ id: '', name: '', phone: '', email: '' });
  lecturerQuery = signal({ id: '', name: '', phone: '', email: '', dept: '' });

  private studentFilters = signal({ id: '', name: '', phone: '', email: '' });
  private lecturerFilters = signal({ id: '', name: '', phone: '', email: '', dept: '' });

  private _studentPageIndex = signal(1);
  private _studentPageSize = signal(10);
  private _lecturerPageIndex = signal(1);
  private _lecturerPageSize = signal(10);

  studentPageSizeInternal = this._studentPageSize();
  lecturerPageSizeInternal = this._lecturerPageSize();

  private normalize = (v?: string) =>
    (v ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  studentsFiltered = computed(() => {
    const f = this.studentFilters();
    const id = this.normalize(f.id);
    const name = this.normalize(f.name);
    const phone = this.normalize(f.phone);
    const email = this.normalize(f.email);

    return this._studentsAll().filter(
      (s) =>
        (!id || this.normalize(s.id).includes(id)) &&
        (!name || this.normalize(s.name).includes(name)) &&
        (!phone || this.normalize(s.phone).includes(phone)) &&
        (!email || this.normalize(s.email).includes(email))
    );
  });

  studentTotalPages = computed(() =>
    Math.max(1, Math.ceil(this.studentsFiltered().length / this._studentPageSize()))
  );

  studentPageNumbers = computed(() =>
    Array.from({ length: this.studentTotalPages() }, (_, i) => i + 1)
  );

  studentsPaged = computed(() => {
    const size = this._studentPageSize();
    const start = (this._studentPageIndex() - 1) * size;
    return this.studentsFiltered().slice(start, start + size);
  });

  lecturersFiltered = computed(() => {
    const f = this.lecturerFilters();
    const id = this.normalize(f.id);
    const name = this.normalize(f.name);
    const dept = this.normalize(f.dept);
    const phone = this.normalize(f.phone);
    const email = this.normalize(f.email);

    return this._lecturersAll().filter(
      (l) =>
        (!id || this.normalize(l.id).includes(id)) &&
        (!name || this.normalize(l.name).includes(name)) &&
        (!dept || this.normalize(l.dept).includes(dept)) &&
        (!phone || this.normalize(l.phone).includes(phone)) &&
        (!email || this.normalize(l.email).includes(email))
    );
  });

  lecturerTotalPages = computed(() =>
    Math.max(1, Math.ceil(this.lecturersFiltered().length / this._lecturerPageSize()))
  );

  lecturerPageNumbers = computed(() =>
    Array.from({ length: this.lecturerTotalPages() }, (_, i) => i + 1)
  );

  lecturersPaged = computed(() => {
    const size = this._lecturerPageSize();
    const start = (this._lecturerPageIndex() - 1) * size;
    return this.lecturersFiltered().slice(start, start + size);
  });

  applyStudentFilters() {
    this.studentFilters.set({ ...this.studentQuery() });
    this._studentPageIndex.set(1);
  }
  clearStudentFilters() {
    this.studentQuery.set({ id: '', name: '', phone: '', email: '' });
    this.applyStudentFilters();
  }
  goStudentPage(p: number) {
    const max = this.studentTotalPages();
    if (p < 1) p = 1;
    if (p > max) p = max;
    this._studentPageIndex.set(p);
  }
  changeStudentPageSize(n: number) {
    this._studentPageSize.set(n);
    this._studentPageIndex.set(1);
  }

  applyLecturerFilters() {
    this.lecturerFilters.set({ ...this.lecturerQuery() });
    this._lecturerPageIndex.set(1);
  }
  clearLecturerFilters() {
    this.lecturerQuery.set({ id: '', name: '', phone: '', email: '', dept: '' });
    this.applyLecturerFilters();
  }
  goLecturerPage(p: number) {
    const max = this.lecturerTotalPages();
    if (p < 1) p = 1;
    if (p > max) p = max;
    this._lecturerPageIndex.set(p);
  }
  changeLecturerPageSize(n: number) {
    this._lecturerPageSize.set(n);
    this._lecturerPageIndex.set(1);
  }

  studentPageIndex = () => this._studentPageIndex();
  lecturerPageIndex = () => this._lecturerPageIndex();

  trackStudent = (_: number, s: Student) => s.id;
  trackLecturer = (_: number, l: Lecturer) => l.id;
}
