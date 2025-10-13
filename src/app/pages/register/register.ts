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

  loading = false;
  showPwd = false;
  showPwd2 = false;
  err: string | null = null;

  roles: { value: Role; label: string }[] = [
    { value: 'student', label: 'Sinh viên' },
    { value: 'lecturer', label: 'Giảng viên' },
  ];

  majors = [
    'Khoa học máy tính',
    'Công nghệ thông tin',
    'Kỹ thuật phần mềm',
    'Hệ thống thông tin',
    'An toàn thông tin',
  ];
  faculties = ['Khoa CNTT', 'Khoa Toán', 'Khoa Kinh tế', 'Khoa Ngôn ngữ'];
  academicRanks = ['ThS.', 'TS.', 'PGS.TS.', 'GS.TS.'];

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
      course: ['', [Validators.required]],
      faculty: ['Khoa CNTT'],
      major: ['Khoa học máy tính', [Validators.required]],
      admissionYear: [2022, [Validators.required, Validators.min(2000), Validators.max(2100)]],
    }),

    lecturer: this.fb.nonNullable.group({
      lecturerId: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9\-]+$/)]],
      dept: ['Khoa CNTT', [Validators.required]],
      title: ['TS.'],
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

  private buildPayload() {
    const v = this.form.getRawValue();
    const base = {
      role: v.role,
      account: {
        fullName: v.account.fullName,
        username: v.account.username,
        email: v.account.email,
        phone: v.account.phone,
        password: v.account.password,
      },
    };
    return v.role === 'student'
      ? {
          ...base,
          student: {
            studentId: v.student.studentId,
            classCode: v.student.classCode,
            course: v.student.course,
            faculty: v.student.faculty || null,
            major: v.student.major,
            admissionYear: v.student.admissionYear,
          },
        }
      : {
          ...base,
          lecturer: {
            lecturerId: v.lecturer.lecturerId,
            dept: v.lecturer.dept,
            title: v.lecturer.title || null,
            officePhone: v.lecturer.officePhone || null,
            workEmail: v.lecturer.workEmail || null,
            officeRoom: v.lecturer.officeRoom || null,
          },
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
      const payload = this.buildPayload();
      await new Promise((res) => setTimeout(res, 700));
      this.router.navigateByUrl('/login');
    } catch {
      this.err = 'Đăng ký thất bại. Vui lòng thử lại.';
    } finally {
      this.loading = false;
    }
  }
}
