import { Observable } from 'rxjs';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable()
export class UserFlowService {

  constructor(private http: HttpClient) { }

  /**
   * API service stub
   */
  fetchUserFlowData(): Observable<any> {
    return this.http.get('assets/data/1.json');
  }

}
