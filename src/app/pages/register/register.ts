// src/app/pages/register/register.ts
import { Component, inject } from '@angular/core';
import { CommonModule, NgFor, NgIf } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  AbstractControl,
  ValidationErrors,
  FormGroup,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ApiError } from '../../core/interceptors/envelope.interceptor';
import { ToastService } from '../../components/toast/toast.service';

function sameAs(other: string) {
  return (ctrl: AbstractControl): ValidationErrors | null => {
    const parent = ctrl.parent as FormGroup | null;
    if (!parent) return null;
    const otherCtrl = parent.get(other);
    if (!otherCtrl) return null;
    return ctrl.value === otherCtrl.value ? null : { notSame: true };
  };
}

type Role = 'student' | 'lecturer';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, NgIf, NgFor],
  templateUrl: './register.html',
  styleUrls: ['./register.scss'],
})
export class Register {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  loading = false;
  showPwd = false;
  showPwd2 = false;
  err: string | null = null;

  roles: { value: Role; label: string }[] = [
    { value: 'student', label: 'Sinh viên' },
    { value: 'lecturer', label: 'Giảng viên' },
  ];

  // Hiển thị cho người dùng (VI)
  majors = [
    'Khoa học máy tính',
    'Công nghệ thông tin',
    'Kỹ thuật phần mềm',
    'Hệ thống thông tin',
    'An toàn thông tin',
  ];
  faculties = ['Khoa CNTT', 'Khoa Toán', 'Khoa Kinh tế', 'Khoa Ngôn ngữ'];
  academicRanks = ['ThS.', 'TS.', 'PGS.TS.', 'GS.TS.'];

  // Map sang BE
  private majorMap: Record<string, string> = {
    'Khoa học máy tính': 'Computer Science',
    'Công nghệ thông tin': 'Information Technology',
    'Kỹ thuật phần mềm': 'Software Engineering',
    'Hệ thống thông tin': 'Information Systems',
    'An toàn thông tin': 'Information Security',
  };
  private rankMap: Record<string, string> = {
    'ThS.': 'MSC',
    'TS.': 'DR',
    'PGS.TS.': 'ASSOC_PROF',
    'GS.TS.': 'PROF',
  };

  form = this.fb.nonNullable.group({
    role: <Role>'student',

    account: this.fb.nonNullable.group({
      fullName: ['', [Validators.required, Validators.minLength(3)]],
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9]{9,11}$/)]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirm: ['', [Validators.required, Validators.minLength(6), sameAs('password')]],
    }),

    student: this.fb.nonNullable.group({
      studentId: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9]+$/)]],
      classCode: ['', [Validators.required]],
      course: ['', [Validators.required]], // ví dụ: "K40"
      faculty: ['Khoa CNTT'],
      major: ['Khoa học máy tính', [Validators.required]],
      gender: <'MALE' | 'FEMALE'>'MALE',
    }),

    lecturer: this.fb.nonNullable.group({
      lecturerId: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9\-]+$/)]],
      dept: ['Khoa CNTT', [Validators.required]],
      title: ['TS.'], // sẽ map -> DR
      officePhone: ['', [Validators.pattern(/^[0-9]{9,11}$/)]],
      workEmail: ['', [Validators.email]],
      officeRoom: [''],
    }),
  });

  get roleCtrl() {
    return this.form.controls.role;
  }
  get acc() {
    return (this.form.get('account') as FormGroup).controls as any;
  }
  get stu() {
    return (this.form.get('student') as FormGroup).controls as any;
  }
  get lec() {
    return (this.form.get('lecturer') as FormGroup).controls as any;
  }

  constructor() {
    this.applyRole(this.roleCtrl.value);
    this.roleCtrl.valueChanges.subscribe((r) => this.applyRole(r as Role));
  }

  private applyRole(role: Role) {
    const studentGroup = this.form.get('student') as FormGroup;
    const lecturerGroup = this.form.get('lecturer') as FormGroup;
    if (role === 'student') {
      studentGroup.enable({ emitEvent: false });
      lecturerGroup.disable({ emitEvent: false });
    } else {
      lecturerGroup.enable({ emitEvent: false });
      studentGroup.disable({ emitEvent: false });
    }
  }

  /** Tạo payload đúng theo API BE */
  private buildStudentPayload() {
    const v = this.form.getRawValue();
    return {
      email: v.account.email,
      password: v.account.password,
      fullName: v.account.fullName,
      phone: v.account.phone,
      studentCode: v.student.studentId,
      cohort: v.student.course, // vd: "K40"
      major: this.majorMap[v.student.major] ?? v.student.major, // map VI -> EN nếu có
      specializedClass: v.student.classCode,
      gender: v.student.gender, // 'MALE' | 'FEMALE'
    };
  }

  private buildTeacherPayload() {
    const v = this.form.getRawValue();
    return {
      email: v.account.email,
      password: v.account.password,
      fullName: v.account.fullName,
      phone: v.account.phone,
      lecturerCode: v.lecturer.lecturerId,
      department: v.lecturer.dept,
      academicRank: this.rankMap[v.lecturer.title] ?? v.lecturer.title, // map VI -> code
    };
  }

  async submit() {
    if (this.form.invalid || this.loading) {
      this.form.markAllAsTouched();
      return;
    }
    this.err = null;
    this.loading = true;

    try {
      if (this.roleCtrl.value === 'student') {
        await this.auth.registerStudent(this.buildStudentPayload());
      } else {
        await this.auth.registerTeacher(this.buildTeacherPayload());
      }
      this.toast.success('Đăng ký thành công! Vui lòng đăng nhập.');
      this.router.navigateByUrl('/login');
    } catch (e: any) {
      const msg =
        e instanceof ApiError
          ? e.message || 'Đăng ký thất bại.'
          : e?.message || 'Đăng ký thất bại.';
      this.err = msg;
      this.toast.danger(msg);
    } finally {
      this.loading = false;
    }
  }
}
