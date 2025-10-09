import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ClassCatalog } from './class-catalog';

describe('ClassCatalo', () => {
  let component: ClassCatalog;
  let fixture: ComponentFixture<ClassCatalog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClassCatalog],
    }).compileComponents();

    fixture = TestBed.createComponent(ClassCatalog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
