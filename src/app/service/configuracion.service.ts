import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, tap, shareReplay } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ConfiguracionService {
  private apiUrl = environment.apiUrl;

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
    ofertas_banner_img: '',
    color_principal: '#df6c1b',
    logo_url: '',
    url_rastreo_shalom: 'https://rastreo.shalom.pe/',
    url_rastreo_olva: 'https://tracking.olvacourier.com/'
  };

  private configSubject = new BehaviorSubject<any | null>(null);
  readonly config$ = this.configSubject.asObservable();
  private configCache$?: Observable<any>;

  constructor(private http: HttpClient) {
    const saved = localStorage.getItem('puntoycoma_config_negocio');
    if (saved) {
      try {
        this.negocio = JSON.parse(saved);
        this.configSubject.next(this.negocio); // Emit cached values immediately to prevent 3s blank space
      } catch (e) {
        // Fallback en caso de error de parseo
      }
    }
    this.cargarDesdeBackend().subscribe({
      error: (err) => console.error('Error al inicializar configuracion desde backend', err)
    });
  }

  cargarDesdeBackend(forceReload: boolean = false): Observable<any> {
    if (forceReload) {
      this.configCache$ = undefined;
    }
    if (!this.configCache$) {
      this.configCache$ = this.http.get<any>(`${this.apiUrl}/configuracion`).pipe(
        tap((data) => {
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
              ofertas_banner_img: data.ofertasBannerImg || this.negocio.ofertas_banner_img,
              color_principal: data.colorPrincipal || this.negocio.color_principal || '#df6c1b',
              logo_url: data.logoUrl || this.negocio.logo_url || ''
            };
            localStorage.setItem('puntoycoma_config_negocio', JSON.stringify(this.negocio));
            this.configSubject.next(this.negocio);
          } else {
            this.configSubject.next(this.negocio);
          }
        }),
        catchError((err) => {
          console.warn('⚠️ No se pudo obtener la configuración del backend. Usando LocalStorage.', err);
          this.configSubject.next(this.negocio);
          return of(this.negocio);
        }),
        shareReplay(1)
      );
    }
    return this.configCache$;
  }

  guardarConfiguracion(datos: any) {
    this.actualizarNegocio(datos);
  }

  actualizarNegocio(datos: any) {
    this.configCache$ = undefined;
    this.negocio = { ...this.negocio, ...datos };
    localStorage.setItem('puntoycoma_config_negocio', JSON.stringify(this.negocio));

    const payload = {
      nombreTienda: this.negocio.nombreTienda,
      whatsapp: this.negocio.whatsapp,
      telefono: this.negocio.telefono || this.negocio.whatsapp,
      colorPrincipal: this.negocio.color_principal,
      logoUrl: this.negocio.logo_url,
      urlRastreoShalom: this.negocio.url_rastreo_shalom,
      urlRastreoOlva: this.negocio.url_rastreo_olva
    };

    this.http.put(`${this.apiUrl}/configuracion`, payload).subscribe({
      next: () => {
        console.log('✅ Configuración sincronizada exitosamente con el servidor Spring Boot / Supabase.');
        this.configSubject.next(this.negocio);
      },
      error: (err) => {
        console.error('❌ Error al persistir la configuración en el backend:', err);
        this.configSubject.next(this.negocio);
      }
    });
  }


  subirLogo(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<any>(`${this.apiUrl}/configuracion/logo`, formData).pipe(
      tap((res) => {
        if (res && res.logoUrl) {
          this.negocio.logo_url = res.logoUrl;
          localStorage.setItem('puntoycoma_config_negocio', JSON.stringify(this.negocio));
          this.configSubject.next(this.negocio);
        }
      })
    );
  }

  guardarApariencia(colorPrincipal: string, logoUrl?: string | null): Observable<any> {
    this.configCache$ = undefined;
    this.negocio.color_principal = colorPrincipal;
    if (logoUrl !== undefined && logoUrl !== null) {
      this.negocio.logo_url = logoUrl;
    }
    localStorage.setItem('puntoycoma_config_negocio', JSON.stringify(this.negocio));
    const payload: any = {
      colorPrincipal: colorPrincipal
    };
    if (logoUrl !== undefined && logoUrl !== null) {
      payload.logoUrl = logoUrl;
    }
    return this.http.put<any>(`${this.apiUrl}/configuracion`, payload).pipe(
      tap((res) => {
        if (res) {
          this.negocio.color_principal = res.colorPrincipal || colorPrincipal;
          if (res.logoUrl !== undefined) {
            this.negocio.logo_url = res.logoUrl || '';
          }
          localStorage.setItem('puntoycoma_config_negocio', JSON.stringify(this.negocio));
          this.configSubject.next(this.negocio);
        }
      })
    );
  }

  obtenerWhatsappUrl(mensaje: string = ''): string {
    // Leer el enlace o número de WhatsApp configurado exclusivamente del campo whatsapp
    const rawVal = (this.negocio.whatsapp || '').trim();
    if (!rawVal) {
      return '';
    }
    
    // Si ya es un enlace wa.me o api.whatsapp completo, usarlo o adaptarlo
    if (rawVal.includes('wa.me') || rawVal.includes('whatsapp.com')) {
      try {
        const url = new URL(rawVal);
        const pathPhone = url.pathname.replace(/\//g, '');
        if (pathPhone && pathPhone.replace(/\D/g, '').length >= 9) {
          return `https://wa.me/${pathPhone}${mensaje ? '?text=' + encodeURIComponent(mensaje) : ''}`;
        }
        return '';
      } catch (e) {
        return '';
      }
    }

    // Extraer solo dígitos numéricos del campo
    const cleanNum = rawVal.replace(/\D/g, '');
    if (!cleanNum || cleanNum.length < 9) {
      return '';
    }

    // Retornar la URL construida
    return `https://wa.me/${cleanNum}${mensaje ? '?text=' + encodeURIComponent(mensaje) : ''}`;
  }
}
