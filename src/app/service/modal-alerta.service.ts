import { Injectable, signal } from '@angular/core';

export type TipoAlerta = 'peligro' | 'advertencia' | 'exito' | 'info' | 'confirmar';

export interface ModalAlertaConfig {
  titulo?: string;
  mensaje: string;
  tipo?: TipoAlerta;
  textoConfirmar?: string;
  textoCancelar?: string;
  esConfirmacion?: boolean;
}

interface ModalEstadoInterno extends ModalAlertaConfig {
  visible: boolean;
  resolver?: (valor: boolean) => void;
}

@Injectable({
  providedIn: 'root'
})
export class ModalAlertaService {
  estado = signal<ModalEstadoInterno>({
    visible: false,
    mensaje: '',
    tipo: 'info',
    esConfirmacion: false
  });

  constructor() {
    this.interceptarAlertNativo();
  }

  /**
   * Muestra un modal de confirmación con dos botones (Aceptar / Cancelar)
   * Devuelve una promesa con true o false según lo elegido por el usuario.
   */
  confirm(
    opciones: string | {
      titulo?: string;
      mensaje: string;
      tipo?: TipoAlerta;
      textoConfirmar?: string;
      textoCancelar?: string;
    }
  ): Promise<boolean> {
    return new Promise((resolve) => {
      let cfg: ModalAlertaConfig;
      if (typeof opciones === 'string') {
        cfg = {
          mensaje: opciones,
          titulo: '¿Estás seguro?',
          tipo: 'confirmar',
          textoConfirmar: 'Aceptar',
          textoCancelar: 'Cancelar'
        };
      } else {
        cfg = {
          titulo: opciones.titulo || '¿Estás seguro?',
          mensaje: opciones.mensaje,
          tipo: opciones.tipo || 'confirmar',
          textoConfirmar: opciones.textoConfirmar || 'Aceptar',
          textoCancelar: opciones.textoCancelar || 'Cancelar'
        };
      }

      this.estado.set({
        ...cfg,
        esConfirmacion: true,
        visible: true,
        resolver: resolve
      });
    });
  }

  /**
   * Muestra un modal de notificación informativo con un botón de cierre.
   */
  alert(
    mensaje: string,
    tipo: TipoAlerta = 'info',
    titulo?: string
  ): Promise<boolean> {
    return new Promise((resolve) => {
      let defaultTitulo = 'Notificación';
      if (tipo === 'exito') defaultTitulo = '¡Operación Exitosa!';
      if (tipo === 'peligro') defaultTitulo = 'Atención';
      if (tipo === 'advertencia') defaultTitulo = 'Aviso';

      this.estado.set({
        titulo: titulo || defaultTitulo,
        mensaje,
        tipo,
        esConfirmacion: false,
        textoConfirmar: 'Entendido',
        visible: true,
        resolver: resolve
      });
    });
  }

  success(mensaje: string, titulo: string = '¡Operación Exitosa!'): Promise<boolean> {
    return this.alert(mensaje, 'exito', titulo);
  }

  error(mensaje: string, titulo: string = 'Atención'): Promise<boolean> {
    return this.alert(mensaje, 'peligro', titulo);
  }

  warning(mensaje: string, titulo: string = 'Aviso'): Promise<boolean> {
    return this.alert(mensaje, 'advertencia', titulo);
  }

  info(mensaje: string, titulo: string = 'Información'): Promise<boolean> {
    return this.alert(mensaje, 'info', titulo);
  }

  confirmar() {
    const s = this.estado();
    if (s.resolver) {
      s.resolver(true);
    }
    this.cerrar();
  }

  cancelar() {
    const s = this.estado();
    if (s.resolver) {
      s.resolver(false);
    }
    this.cerrar();
  }

  cerrar() {
    this.estado.update((act) => ({ ...act, visible: false, resolver: undefined }));
  }

  private interceptarAlertNativo() {
    if (typeof window !== 'undefined') {
      window.alert = (message?: any) => {
        const msg = message !== undefined ? String(message) : '';
        let tipo: TipoAlerta = 'info';
        let titulo = 'Notificación';

        const low = msg.toLowerCase();
        if (
          msg.includes('✅') ||
          msg.includes('¡') ||
          low.includes('éxito') ||
          low.includes('exito') ||
          low.includes('actualizad') ||
          low.includes('guardad') ||
          low.includes('registrad')
        ) {
          tipo = 'exito';
          titulo = '¡Operación Exitosa!';
        } else if (
          msg.includes('❌') ||
          low.includes('error') ||
          low.includes('no se pudo') ||
          low.includes('incorrecta')
        ) {
          tipo = 'peligro';
          titulo = 'Atención';
        } else if (
          msg.includes('⚠️') ||
          low.includes('obligatorio') ||
          low.includes('por favor') ||
          low.includes('debe') ||
          low.includes('atención')
        ) {
          tipo = 'advertencia';
          titulo = 'Aviso';
        }

        // Limpiar emojis repetidos al inicio del texto para mostrar una UI limpia
        const limpio = msg.replace(/^(\s*[✅❌⚠️🔒📊📥🔍\s]+)/, '').trim();
        this.alert(limpio || msg, tipo, titulo);
      };
    }
  }
}
