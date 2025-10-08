import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Program } from './program';

describe('Program', () => {
  let component: Program;
  let fixture: ComponentFixture<Program>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Program]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Program);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
