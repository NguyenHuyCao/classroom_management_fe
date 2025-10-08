import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClassCatalo } from './class-catalog';

describe('ClassCatalo', () => {
  let component: ClassCatalo;
  let fixture: ComponentFixture<ClassCatalo>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClassCatalo]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClassCatalo);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
