import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdminLayoutComponent } from '../admin-layout/admin-layout.component';
import { ConfiguracionService } from '../../service/configuracion.service';

@Component({
  selector: 'app-admin-configuracion',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AdminLayoutComponent],
  templateUrl: './admin-configuracion.component.html',
  styleUrl: './admin-configuracion.component.css'
})
export class AdminConfiguracionComponent implements OnInit {

  constructor(private configService: ConfiguracionService) {}

  ngOnInit() {
    this.negocio = { ...this.configService.negocio };
  }

  // ─── NOTIFICACIONES ───────────────────────────────────────────────
  notif = {
    nuevosPedidos: true,
    pagosPendientes: true,
    pagoNoCoincide: false,
    reportesAutomaticos: true
  };

  // ─── AUTOMATIZACIÓN ASISTIDA ──────────────────────────────────────
  auto = {
    sugerirAcciones: true,
    validarPagos: false,
    detectarIncompletos: true,
    clasificarConversaciones: false
  };

  // ─── INFORMACIÓN DEL NEGOCIO ──────────────────────────────────────
  negocio = {
    nombreTienda: '',
    correo: '',
    telefono: '',
    whatsapp: '',
    instagram: '',
    direccion: '',
    envios_info_global: '',
    devoluciones_info_global: '',
    envio_cobertura: '',
    envio_tiempo_lima: '',
    envio_tiempo_provincia: '',
    envio_costo: '',
    envio_proceso: '',
    envio_seguimiento: '',
    devolucion_plazo: '',
    devolucion_condiciones: '',
    devolucion_casos: '',
    devolucion_proceso: '',
    devolucion_reembolso: '',
    devolucion_importante: ''
  };

  // ─── PERSONALIZACIÓN VISUAL ───────────────────────────────────────
  visual = {
    colorPrincipal: '#ef6737',
    logoPreview: null as string | null,
    portadaPreview: null as string | null
  };

  // ─── SEGURIDAD ────────────────────────────────────────────────────
  seguridad = {
    passActual: '',
    passNueva: '',
    passConfirm: '',
    verificacionAdicional: false
  };

  // ─── ACCIONES ─────────────────────────────────────────────────────
  guardarNotificaciones() {
    alert('✅ Preferencias de notificaciones guardadas correctamente.');
  }

  guardarAutomatizacion() {
    alert('✅ Configuración de automatización guardada correctamente.');
  }

  actualizarNegocio() {
    this.configService.actualizarNegocio(this.negocio);
    alert('✅ Información del negocio actualizada con éxito.');
  }

  guardarApariencia() {
    alert('✅ Personalización visual guardada correctamente.');
  }

  cambiarContrasena() {
    if (!this.seguridad.passNueva || this.seguridad.passNueva !== this.seguridad.passConfirm) {
      alert('⚠️ Las contraseñas nuevas no coinciden. Por favor verifica los campos.');
      return;
    }
    this.seguridad.passActual = '';
    this.seguridad.passNueva = '';
    this.seguridad.passConfirm = '';
    alert('🔒 Contraseña actualizada con éxito.');
  }

  cerrarSesiones() {
    alert('🚪 Todas las sesiones activas han sido cerradas correctamente.');
  }
}
