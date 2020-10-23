import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

// third party
import { PerfectScrollbarModule } from 'ngx-perfect-scrollbar';
import { PerfectScrollbarConfigInterface } from 'ngx-perfect-scrollbar';
const DEFAULT_PERFECT_SCROLLBAR_CONFIG: PerfectScrollbarConfigInterface = {
  suppressScrollX: true
};

import { AppComponent } from './app.component';
import { UserFlowService } from './user-flow.service';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    PerfectScrollbarModule
  ],
  providers: [UserFlowService],
  bootstrap: [AppComponent]
})
export class AppModule { }
