import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClassManager } from './class-manager';

describe('ClassManager', () => {
  let component: ClassManager;
  let fixture: ComponentFixture<ClassManager>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClassManager]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClassManager);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
