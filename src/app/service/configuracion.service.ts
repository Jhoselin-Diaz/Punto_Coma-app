import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ConfiguracionService {
  negocio = {
    nombreTienda: '',
    correo: '',
    telefono: '',
    whatsapp: '',
    instagram: '',
    direccion: ''
  };

  constructor() {
    const saved = localStorage.getItem('puntoycoma_config_negocio');
    if (saved) {
      try {
        this.negocio = JSON.parse(saved);
      } catch (e) {
        // Fallback en caso de error de parseo
      }
    }
  }

  actualizarNegocio(datos: typeof this.negocio) {
    this.negocio = { ...datos };
    localStorage.setItem('puntoycoma_config_negocio', JSON.stringify(this.negocio));
  }

  obtenerWhatsappUrl(mensaje: string = ''): string {
    // Leer el enlace o número de WhatsApp configurado
    const rawVal = this.negocio.whatsapp || this.negocio.telefono || '';
    
    // Si ya es un enlace wa.me o api.whatsapp completo, usarlo o adaptarlo
    if (rawVal.includes('wa.me') || rawVal.includes('whatsapp.com')) {
      // Intentar extraer el número de teléfono o usar el enlace directamente
      try {
        const url = new URL(rawVal);
        const pathPhone = url.pathname.replace(/\//g, '');
        if (pathPhone) {
          return `https://wa.me/${pathPhone}${mensaje ? '?text=' + encodeURIComponent(mensaje) : ''}`;
        }
        return rawVal;
      } catch (e) {
        return rawVal;
      }
    }

    // Extraer solo dígitos numéricos del campo
    const cleanNum = rawVal.replace(/\D/g, '');
    if (!cleanNum) {
      // Fallback seguro si la cadena está vacía
      return 'https://wa.me/';
    }

    // Retornar la URL construida
    return `https://wa.me/${cleanNum}${mensaje ? '?text=' + encodeURIComponent(mensaje) : ''}`;
  }
}
