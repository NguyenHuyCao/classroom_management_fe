import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-section-title',
  standalone: true,
  templateUrl: './section-title.component.html',
})
export class SectionTitleComponent {
  @Input() title: string = '';
}
