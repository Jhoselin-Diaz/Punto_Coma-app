import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AdminLayoutComponent } from '../admin-layout/admin-layout.component';
import { WhatsappService, WhatsappStateDTO } from '../../service/whatsapp.service';

@Component({
  selector: 'app-admin-whatsapp',
  standalone: true,
  imports: [CommonModule, RouterModule, AdminLayoutComponent],
  templateUrl: './admin-whatsapp.component.html',
  styleUrl: './admin-whatsapp.component.css'
})
export class AdminWhatsappComponent implements OnInit, OnDestroy {
  state: WhatsappStateDTO = {
    status: 'DISCONNECTED',
    qrCodeBase64: null,
    phoneNumber: null,
    connectedAt: null
  };

  // ─── Control de Inactividad y Temporizador (Caso de Prueba CP094) ─────────
  segundosRestantes: number = 120;
  qrExpirado: boolean = false;
  private timerQr: any = null;

  cargando = false;
  desconectando = false;
  errorMessage: string | null = null;
  private pollingInterval: any = null;

  constructor(
    private whatsappService: WhatsappService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.consultarEstado();
    this.iniciarPolling();
  }

  ngOnDestroy(): void {
    this.detenerPolling();
    this.detenerTimerQr();
  }

  iniciarPolling(): void {
    this.detenerPolling();
    this.pollingInterval = setInterval(() => {
      this.consultarEstadoSilencioso();
    }, 2500);
  }

  detenerPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  // ─── Lógica del Temporizador de Expiración del QR (CP094) ────────────────
  iniciarTimerQr(): void {
    this.detenerTimerQr();
    this.segundosRestantes = 120;
    this.qrExpirado = false;
    this.timerQr = setInterval(() => {
      if (this.segundosRestantes > 1) {
        this.segundosRestantes--;
      } else {
        this.segundosRestantes = 0;
        this.qrExpirado = true;
        this.detenerTimerQr();
      }
      this.cdr.detectChanges();
    }, 1000);
  }

  detenerTimerQr(): void {
    if (this.timerQr) {
      clearInterval(this.timerQr);
      this.timerQr = null;
    }
  }

  /**
   * Acción del botón "Recargar QR" en la superposición de expiración.
   * Restablece el temporizador y solicita un nuevo token/estado.
   */
  recargarQR(): void {
    this.qrExpirado = false;
    this.segundosRestantes = 120;
    this.iniciarTimerQr();
    this.consultarEstado();
  }

  consultarEstado(): void {
    this.cargando = true;
    this.errorMessage = null;
    this.whatsappService.getStatus().subscribe({
      next: (res) => {
        this.cargando = false;
        if (res) {
          this.procesarEstado(res);
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.cargando = false;
        console.warn('⚠️ Error al consultar estado de WhatsApp:', err);
        this.errorMessage = 'No se pudo consultar el estado de WhatsApp. Intenta nuevamente.';
        this.state.status = 'DISCONNECTED';
        this.detenerTimerQr();
        this.cdr.detectChanges();
      }
    });
  }

  consultarEstadoSilencioso(): void {
    this.whatsappService.getStatus().subscribe({
      next: (res) => {
        if (res) {
          this.procesarEstado(res);
          this.errorMessage = null;
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.warn('⚠️ Error en polling silencioso de WhatsApp:', err);
      }
    });
  }

  private procesarEstado(res: WhatsappStateDTO): void {
    const qrAnterior = this.state.qrCodeBase64;
    this.state = res;

    if (this.state.status === 'QR_READY') {
      // Inicia el temporizador de 120s si aún no está corriendo y no está expirado
      if (this.state.qrCodeBase64 && this.state.qrCodeBase64 !== qrAnterior && !this.qrExpirado) {
        this.iniciarTimerQr();
      } else if (!this.timerQr && !this.qrExpirado) {
        this.iniciarTimerQr();
      }
    } else {
      this.detenerTimerQr();
      if (this.state.status === 'CONNECTED') {
        this.qrExpirado = false;
      }
    }
  }

  get statusClass(): string {
    if (this.state.status === 'QR_READY' && this.qrExpirado) {
      return 'status-disconnected';
    }
    switch (this.state.status) {
      case 'CONNECTED':
        return 'status-connected';
      case 'CONNECTING':
        return 'status-connecting';
      case 'QR_READY':
        return 'status-qr-ready';
      case 'DISCONNECTED':
      default:
        return 'status-disconnected';
    }
  }

  get statusLabel(): string {
    if (this.state.status === 'QR_READY' && this.qrExpirado) {
      return 'Código QR expirado';
    }
    switch (this.state.status) {
      case 'CONNECTED':
        return 'WhatsApp conectado';
      case 'CONNECTING':
        return 'Conectando con WhatsApp...';
      case 'QR_READY':
        return 'Código QR disponible';
      case 'DISCONNECTED':
      default:
        return 'WhatsApp no conectado';
    }
  }

  /**
   * Cierra la sesión activa de WhatsApp de la empresa y devuelve la vista a estado QR/Desconectado.
   */
  desvincularWhatsapp(): void {
    if (this.desconectando) return;

    const confirmado = confirm('¿Deseas desvincular la cuenta de WhatsApp de la empresa?');
    if (!confirmado) return;

    this.desconectando = true;
    this.errorMessage = null;

    this.whatsappService.desconectar().subscribe({
      next: () => {
        this.desconectando = false;
        this.state = {
          status: 'DISCONNECTED',
          qrCodeBase64: null,
          phoneNumber: null,
          connectedAt: null
        };
        this.qrExpirado = false;
        this.cdr.detectChanges();
        // Consultar de inmediato para capturar el nuevo QR que genera el puente
        setTimeout(() => {
          this.consultarEstado();
        }, 1200);
      },
      error: (err) => {
        console.warn('⚠️ Error al desvincular WhatsApp:', err);
        this.desconectando = false;
        // Aunque devuelva error o timeout, reiniciar vista y reintentar consulta
        this.state.status = 'DISCONNECTED';
        this.cdr.detectChanges();
        setTimeout(() => {
          this.consultarEstado();
        }, 1500);
      }
    });
  }
}
