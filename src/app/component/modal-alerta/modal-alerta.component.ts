import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalAlertaService } from '../../service/modal-alerta.service';

@Component({
  selector: 'app-modal-alerta',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modal-alerta.component.html',
  styleUrl: './modal-alerta.component.css'
})
export class ModalAlertaComponent {
  constructor(public modalService: ModalAlertaService) {}

  onBackdropClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('modal-alerta-backdrop')) {
      if (this.modalService.estado().esConfirmacion) {
        this.modalService.cancelar();
      } else {
        this.modalService.confirmar();
      }
    }
  }

  @HostListener('window:keydown.escape')
  onEscape() {
    if (this.modalService.estado().visible) {
      if (this.modalService.estado().esConfirmacion) {
        this.modalService.cancelar();
      } else {
        this.modalService.confirmar();
      }
    }
  }
}
