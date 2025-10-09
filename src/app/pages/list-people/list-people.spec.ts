import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListPeople } from './list-people';

describe('ListPeople', () => {
  let component: ListPeople;
  let fixture: ComponentFixture<ListPeople>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListPeople]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ListPeople);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
