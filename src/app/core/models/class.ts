export type Status = 'Online' | 'Offline';
export type Semester = 'HK1' | 'HK2' | 'HK He';

export interface ScheduleItem {
  day: number;
  start: string;
  end: string;
  room: string;
  link?: string;
}
export interface ClassListItem {
  id: string;
  year: number;
  code: string;
  name: string;
  subject: string;
  lecturer: string;
  semester: Semester;
  status: Status;
  size: number;
  schedule: ScheduleItem[];
  createdAt: string;
}
export interface ClassDetail {
  id: string;
  year: number;
  code: string;
  name: string;
  subject: string;
  lecturer: { name: string; email?: string; phone?: string; dept?: string };
  semester: Semester;
  status: Status;
  capacity: number;
  students: { id: string; name: string; email?: string; phone: string; major?: string }[];
  schedule: ScheduleItem[];
  description?: string;
  createdAt: string;
  updatedAt: string;
  locationNote?: string;
}
