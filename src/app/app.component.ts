import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ModalAlertaComponent } from './component/modal-alerta/modal-alerta.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ModalAlertaComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'Punto_Coma-app';
}
