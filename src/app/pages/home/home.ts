import { Component } from '@angular/core';
import { SectionTitleComponent } from '../../components/title/section-title.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [SectionTitleComponent],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {}
