import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClassDetail } from './class-detail';

describe('ClassDetail', () => {
  let component: ClassDetail;
  let fixture: ComponentFixture<ClassDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClassDetail]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClassDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
