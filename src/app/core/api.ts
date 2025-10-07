import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class Api {
  private readonly baseUrl = '/api';

  constructor(private http: HttpClient) {}

  getItems() {
    return this.http.get(`${this.baseUrl}/items`);
  }
}