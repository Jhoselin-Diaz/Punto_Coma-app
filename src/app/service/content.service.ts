import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface HomeBanner {
  id?: number;
  titulo: string;
  subtitulo: string;
  textoBoton: string;
  linkBoton: string;
  imagenUrl: string;
  actualizadoEn?: string;
  visible: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ContentService {
  private readonly apiUrl = `${environment.apiUrl}/content/home-banner`;

  private mockBanner: HomeBanner = {
    id: 1,
    titulo: 'Elegantes Tazas & Vasos Aesthetic',
    subtitulo: 'Dale un toque premium a tus mañanas con nuestra colección exclusiva elaborada por artesanos.',
    textoBoton: 'Explorar Colección',
    linkBoton: '/productos',
    imagenUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=1920&auto=format&fit=crop',
    visible: true
  };

  /**
   * BehaviorSubject que emite el banner actual.
   * Todos los componentes suscritos (inicio, admin-inicio) reciben
   * el nuevo estado en tiempo real sin recargar la página.
   */
  private bannerSubject = new BehaviorSubject<HomeBanner | null>(null);
  readonly banner$ = this.bannerSubject.asObservable();

  constructor(private http: HttpClient) {}

  getHomeBanner(): Observable<HomeBanner> {
    return this.http.get<HomeBanner>(this.apiUrl).pipe(
      tap(banner => this.bannerSubject.next(banner)),
      catchError(error => {
        console.warn('No se pudo conectar con el backend. Usando datos simulados.', error);
        // Emitir el mock al Subject para que todos los suscriptores (inicio, admin)
        // reciban un valor consistente incluso en modo offline
        this.bannerSubject.next(this.mockBanner);
        return of(this.mockBanner);
      })
    );
  }

  /**
   * Actualización JSON simple (imagen de Drive / URL externa).
   * Emite el resultado al BehaviorSubject para propagar a todas las vistas.
   */
  updateHomeBannerJson(banner: HomeBanner): Observable<HomeBanner> {
    return this.http.put<HomeBanner>(this.apiUrl, banner).pipe(
      tap(res => this.bannerSubject.next(res)),
      catchError(error => {
        console.warn('No se pudo guardar en el backend. Actualizando datos localmente.', error);
        const updated = { ...banner };
        this.mockBanner = updated;
        this.bannerSubject.next(updated);   // ← propaga también en modo offline
        return of(updated);
      })
    );
  }

  /**
   * Actualización multipart (imagen subida desde PC).
   * Emite el resultado al BehaviorSubject para propagar a todas las vistas.
   */
  updateHomeBannerMultipart(banner: HomeBanner, file: File): Observable<HomeBanner> {
    const formData = new FormData();
    formData.append('banner', JSON.stringify(banner));
    formData.append('file', file);

    return this.http.put<HomeBanner>(this.apiUrl, formData).pipe(
      tap(res => this.bannerSubject.next(res)),
      catchError(error => {
        console.warn('No se pudo guardar por FormData. Actualizando datos localmente.', error);
        const updated = { ...banner };
        this.mockBanner = updated;
        this.bannerSubject.next(updated);
        return of(updated);
      })
    );
  }

  /**
   * Fuerza una actualización inmediata del estado sin llamada HTTP.
   * Útil para propagar cambios de previsualización en tiempo real.
   */
  emitirBannerLocal(banner: HomeBanner) {
    this.bannerSubject.next(banner);
  }
}
