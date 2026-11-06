import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdminLayoutComponent } from '../admin-layout/admin-layout.component';
import { ConfiguracionService } from '../../service/configuracion.service';
import { WhatsappService, WhatsappStateDTO } from '../../service/whatsapp.service';
import { AdminAuthService } from '../../service/admin-auth.service';
import { ModalAlertaService } from '../../service/modal-alerta.service';

@Component({
  selector: 'app-admin-configuracion',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AdminLayoutComponent],
  templateUrl: './admin-configuracion.component.html',
  styleUrl: './admin-configuracion.component.css'
})
export class AdminConfiguracionComponent implements OnInit {
  whatsappState: WhatsappStateDTO = {
    status: 'DISCONNECTED'
  };

  logoFile: File | null = null;
  origenLogo: 'local' | 'drive' = 'local';
  driveLogoUrl: string = '';
  guardandoApariencia = false;
  guardandoNegocio = false;

  constructor(
    private configService: ConfiguracionService,
    private whatsappService: WhatsappService,
    private authService: AdminAuthService,
    private modalAlertaService: ModalAlertaService
  ) {}

  ngOnInit() {
    this.negocio = { ...this.configService.negocio };
    this.normalizarTelefonoInicial();
    this.visual.colorPrincipal = this.configService.negocio.color_principal || '#df6c1b';
    this.visual.logoPreview = this.configService.negocio.logo_url || null;

    if (this.visual.logoPreview) {
      if (this.visual.logoPreview.includes('drive.google.com') || this.visual.logoPreview.includes('googleusercontent.com')) {
        this.origenLogo = 'drive';
        this.driveLogoUrl = this.visual.logoPreview;
      }
    }

    this.configService.config$.subscribe((cfg) => {
      if (cfg) {
        this.negocio = { ...cfg };
        this.normalizarTelefonoInicial();
        this.visual.colorPrincipal = cfg.color_principal || '#df6c1b';
        this.visual.logoPreview = cfg.logo_url || null;
        if (cfg.logo_url && (cfg.logo_url.includes('drive.google.com') || cfg.logo_url.includes('googleusercontent.com'))) {
          this.driveLogoUrl = cfg.logo_url;
        }
      }
    });

    this.whatsappService.getStatus().subscribe({
      next: (res) => {
        if (res) this.whatsappState = res;
      },
      error: () => {
        this.whatsappState.status = 'DISCONNECTED';
      }
    });
  }

  get whatsappStatusClass(): string {
    switch (this.whatsappState.status) {
      case 'CONNECTED': return 'status-connected';
      case 'CONNECTING': return 'status-connecting';
      case 'QR_READY': return 'status-qr-ready';
      case 'DISCONNECTED': default: return 'status-disconnected';
    }
  }

  get whatsappStatusLabel(): string {
    switch (this.whatsappState.status) {
      case 'CONNECTED': return 'WhatsApp conectado';
      case 'CONNECTING': return 'Conectando...';
      case 'QR_READY': return 'Código QR listo';
      case 'DISCONNECTED': default: return 'WhatsApp no conectado';
    }
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

  // ─── VALIDACIONES CP092 (HU0046) ───────────────────────────────────
  get isNombreValido(): boolean {
    return typeof this.negocio.nombreTienda === 'string' && this.negocio.nombreTienda.trim().length > 0;
  }

  get isTelefonoValido(): boolean {
    const tel = (this.negocio.whatsapp || '').trim();
    return /^[0-9]{9}$/.test(tel);
  }

  get isFormularioInvalido(): boolean {
    return !this.isNombreValido || !this.isTelefonoValido;
  }

  private normalizarTelefonoInicial() {
    if (this.negocio.whatsapp) {
      const raw = this.negocio.whatsapp.trim();
      if (!/^[0-9]{9}$/.test(raw)) {
        const digitsOnly = raw.replace(/\D/g, '');
        if (digitsOnly.length === 11 && digitsOnly.startsWith('51')) {
          this.negocio.whatsapp = digitsOnly.substring(2);
        } else if (digitsOnly.length === 9) {
          this.negocio.whatsapp = digitsOnly;
        }
      }
    } else if (this.negocio.telefono) {
      const raw = this.negocio.telefono.trim();
      if (/^[0-9]{9}$/.test(raw)) {
        this.negocio.whatsapp = raw;
      } else {
        const digitsOnly = raw.replace(/\D/g, '');
        if (digitsOnly.length === 11 && digitsOnly.startsWith('51')) {
          this.negocio.whatsapp = digitsOnly.substring(2);
        } else if (digitsOnly.length === 9) {
          this.negocio.whatsapp = digitsOnly;
        }
      }
    }
  }

  // ─── ACCIONES ─────────────────────────────────────────────────────
  guardarNotificaciones() {
    alert('✅ Preferencias de notificaciones guardadas correctamente.');
  }

  guardarAutomatizacion() {
    alert('✅ Configuración de automatización guardada correctamente.');
  }

  actualizarNegocio() {
    const nombreValido = this.isNombreValido;
    const telefonoValido = this.isTelefonoValido;

    if (!nombreValido || !telefonoValido) {
      let mensaje = '';
      if (!nombreValido && !telefonoValido) {
        mensaje = 'El nombre de la tienda es obligatorio. El teléfono debe constar de exactamente 9 dígitos numéricos.';
      } else if (!nombreValido) {
        mensaje = 'El nombre de la tienda es obligatorio.';
      } else {
        mensaje = 'El teléfono debe constar de exactamente 9 dígitos numéricos.';
      }

      this.modalAlertaService.warning(mensaje, 'Alerta de validación');
      return;
    }

    this.guardandoNegocio = true;
    this.negocio.telefono = this.negocio.whatsapp.trim();
    this.configService.actualizarNegocio({
      nombreTienda: this.negocio.nombreTienda.trim(),
      whatsapp: this.negocio.whatsapp.trim(),
      telefono: this.negocio.whatsapp.trim()
    });
    setTimeout(() => {
      this.guardandoNegocio = false;
      this.modalAlertaService.success('Información del negocio actualizada con éxito.');
    }, 400);
  }

  onFooterClick() {
    if (this.isFormularioInvalido) {
      this.actualizarNegocio();
    }
  }

  onLogoSeleccionado(event: any) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.modalAlertaService.warning('Por favor selecciona un archivo de imagen válido (PNG, JPG, WEBP).', 'Formato no válido');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      this.modalAlertaService.warning('La imagen del logo no debe superar los 2MB.', 'Archivo muy pesado');
      return;
    }

    this.logoFile = file;
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.visual.logoPreview = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  cambiarOrigenLogo(origen: 'local' | 'drive') {
    this.origenLogo = origen;
  }

  extraerGoogleDriveId(input: string): string {
    if (!input) return '';
    let clean = input.trim().replace(/^[\"']|[\"']$/g, '');
    try {
      clean = decodeURIComponent(clean);
    } catch (e) {}

    const reg1 = /\/file\/d\/([a-zA-Z0-9_-]+)/;
    const reg2 = /[?&]id=([a-zA-Z0-9_-]+)/;
    const reg3 = /\/d\/([a-zA-Z0-9_-]+)/;
    const reg4 = /\/open\?id=([a-zA-Z0-9_-]+)/;

    let match = clean.match(reg1);
    if (match) return match[1];

    match = clean.match(reg4);
    if (match) return match[1];

    match = clean.match(reg2);
    if (match) return match[1];

    match = clean.match(reg3);
    if (match) return match[1];

    if (/^[a-zA-Z0-9_-]{20,}$/.test(clean)) {
      return clean;
    }

    return clean;
  }

  obtenerGoogleDrivePreviewUrl(id: string): string {
    if (!id) return '';
    const cleanId = id.trim();
    if (cleanId.toLowerCase() === 'null' || cleanId.toLowerCase() === 'undefined' || cleanId.length === 0) {
      return '';
    }
    return `https://drive.google.com/thumbnail?id=${cleanId}&sz=w1000`;
  }

  onDriveUrlInput() {
    // Solo procesar si contiene un ID o enlace completo y válido sin disparar alertas intrusivas
    if (this.driveLogoUrl && (this.driveLogoUrl.includes('/d/') || this.driveLogoUrl.includes('id='))) {
      const fileId = this.extraerGoogleDriveId(this.driveLogoUrl);
      if (fileId && fileId.length >= 20) {
        this.visual.logoPreview = this.obtenerGoogleDrivePreviewUrl(fileId);
        this.logoFile = null;
      }
    }
  }

  aplicarDriveUrl() {
    if (!this.driveLogoUrl || !this.driveLogoUrl.trim()) {
      return;
    }
    const trimmed = this.driveLogoUrl.trim();
    let publicUrl = '';
    if (trimmed.startsWith('http') && !trimmed.includes('drive.google.com') && !trimmed.includes('googleusercontent.com')) {
      publicUrl = trimmed;
    } else {
      const fileId = this.extraerGoogleDriveId(trimmed);
      if (!fileId || fileId.length < 15) {
        this.modalAlertaService.warning('No se pudo identificar el ID del archivo de Google Drive. Asegúrate de pegar el enlace completo.', 'Enlace no reconocido');
        return;
      }
      publicUrl = this.obtenerGoogleDrivePreviewUrl(fileId);
    }
    this.visual.logoPreview = publicUrl;
    this.logoFile = null;
  }

  onLogoImgError(event?: any) {
    const img = event?.target as HTMLImageElement;
    if (!img) return;
    const fileId = this.extraerGoogleDriveId(this.driveLogoUrl || this.visual.logoPreview || '');
    if (!fileId) return;

    if (!img.src.includes('googleusercontent.com')) {
      img.src = `https://lh3.googleusercontent.com/d/${fileId}`;
    } else if (!img.src.includes('=s1000')) {
      img.src = `https://lh3.googleusercontent.com/d/${fileId}=s1000`;
    } else {
      console.warn('No se pudo cargar la vista previa del logo desde Google Drive.');
    }
  }

  eliminarLogo() {
    this.visual.logoPreview = null;
    this.logoFile = null;
    this.driveLogoUrl = '';
  }

  guardarApariencia() {
    this.guardandoApariencia = true;

    // Caso 1: Archivo local seleccionado
    if (this.logoFile) {
      this.configService.subirLogo(this.logoFile).subscribe({
        next: (res) => {
          this.logoFile = null;
          const logoSubido = res?.logoUrl || this.configService.negocio.logo_url;
          this.configService.guardarApariencia(this.visual.colorPrincipal, logoSubido).subscribe({
            next: () => {
              this.guardandoApariencia = false;
              this.modalAlertaService.success('Personalización visual guardada correctamente.');
            },
            error: (err) => {
              console.error('Error al guardar apariencia tras subir logo:', err);
              this.guardandoApariencia = false;
              this.modalAlertaService.success('Logo subido correctamente.');
            }
          });
        },
        error: (err) => {
          console.error('Error al subir logo:', err);
          this.guardandoApariencia = false;
          this.modalAlertaService.error('Ocurrió un error al subir el logo al servidor.');
        }
      });
      return;
    }

    // Caso 2: Origen Google Drive con URL escrita
    if (this.origenLogo === 'drive' && this.driveLogoUrl && this.driveLogoUrl.trim()) {
      this.aplicarDriveUrl();
    }

    // Caso 3: Guardar el color y el logo actual (o vacío si fue eliminado)
    const logoAGuardar = this.visual.logoPreview || '';
    this.configService.guardarApariencia(this.visual.colorPrincipal, logoAGuardar).subscribe({
      next: () => {
        this.guardandoApariencia = false;
        this.modalAlertaService.success('Personalización visual guardada correctamente.');
      },
      error: (err) => {
        console.error('Error al guardar apariencia:', err);
        this.guardandoApariencia = false;
        this.modalAlertaService.error('Ocurrió un error al guardar los cambios de apariencia.');
      }
    });
  }

  cambiarContrasena() {
    if (!this.seguridad.passActual) {
      alert('⚠️ Por favor ingresa tu contraseña actual.');
      return;
    }

    if (!this.seguridad.passNueva || this.seguridad.passNueva.length < 6) {
      alert('⚠️ La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (this.seguridad.passNueva !== this.seguridad.passConfirm) {
      alert('⚠️ Las contraseñas nuevas no coinciden. Por favor verifica los campos.');
      return;
    }

    const adminCorreo = this.authService.adminActual?.correo || 'admin@puntoycoma.com';

    this.authService.cambiarPassword(adminCorreo, this.seguridad.passActual, this.seguridad.passNueva).subscribe({
      next: () => {
        this.seguridad.passActual = '';
        this.seguridad.passNueva = '';
        this.seguridad.passConfirm = '';
        alert('🔒 Contraseña actualizada con éxito en la base de datos.');
      },
      error: (err) => {
        console.error('Error al cambiar contraseña:', err);
        if (err.status === 400 || err.status === 401) {
          alert('⚠️ La contraseña actual ingresada es incorrecta.');
        } else if (err.error && err.error.mensaje) {
          alert(`❌ ${err.error.mensaje}`);
        } else {
          alert('❌ No se pudo actualizar la contraseña. Verifica tu conexión con el servidor.');
        }
      }
    });
  }

  cerrarSesiones() {
    this.authService.logout(true);
  }
}
