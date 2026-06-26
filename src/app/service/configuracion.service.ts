import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class ConfiguracionService {
  private apiUrl = 'http://localhost:8080/api';

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
    devolucion_importante: '',
    ofertas_banner_titulo: '',
    ofertas_banner_subtitulo: '',
    ofertas_banner_img: ''
  };

  constructor(private http: HttpClient) {
    const saved = localStorage.getItem('puntoycoma_config_negocio');
    if (saved) {
      try {
        this.negocio = JSON.parse(saved);
      } catch (e) {
        // Fallback en caso de error de parseo
      }
    }
    this.cargarDesdeBackend();
  }

  cargarDesdeBackend() {
    this.http.get<any>(`${this.apiUrl}/configuracion`).subscribe({
      next: (data) => {
        if (data) {
          this.negocio = {
            ...this.negocio,
            nombreTienda: data.nombreTienda || this.negocio.nombreTienda,
            correo: data.correo || this.negocio.correo,
            telefono: data.telefono || this.negocio.telefono,
            whatsapp: data.whatsapp || this.negocio.whatsapp,
            instagram: data.instagram || this.negocio.instagram,
            direccion: data.direccion || this.negocio.direccion,
            ofertas_banner_titulo: data.ofertasBannerTitulo || this.negocio.ofertas_banner_titulo,
            ofertas_banner_subtitulo: data.ofertasBannerSubtitulo || this.negocio.ofertas_banner_subtitulo,
            ofertas_banner_img: data.ofertasBannerImg || this.negocio.ofertas_banner_img
          };
          localStorage.setItem('puntoycoma_config_negocio', JSON.stringify(this.negocio));
        }
      },
      error: (err) => {
        console.warn('⚠️ No se pudo obtener la configuración del backend. Usando LocalStorage.', err);
      }
    });
  }

  actualizarNegocio(datos: any) {
    this.negocio = { ...this.negocio, ...datos };
    localStorage.setItem('puntoycoma_config_negocio', JSON.stringify(this.negocio));

    const payload = {
      nombreTienda: this.negocio.nombreTienda,
      correo: this.negocio.correo,
      telefono: this.negocio.telefono,
      whatsapp: this.negocio.whatsapp,
      instagram: this.negocio.instagram,
      direccion: this.negocio.direccion,
      ofertasBannerTitulo: this.negocio.ofertas_banner_titulo,
      ofertasBannerSubtitulo: this.negocio.ofertas_banner_subtitulo,
      ofertasBannerImg: this.negocio.ofertas_banner_img
    };

    this.http.put(`${this.apiUrl}/configuracion`, payload).subscribe({
      next: () => {
        console.log('✅ Configuración sincronizada exitosamente con el servidor Spring Boot / Supabase.');
      },
      error: (err) => {
        console.error('❌ Error al persistir la configuración en el backend:', err);
      }
    });
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
