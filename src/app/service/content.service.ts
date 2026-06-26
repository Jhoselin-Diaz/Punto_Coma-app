import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

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
  private readonly apiUrl = 'http://localhost:8080/api/content/home-banner';

  private mockBanner: HomeBanner = {
    id: 1,
    titulo: 'Elegantes Tazas & Vasos Aesthetic',
    subtitulo: 'Dale un toque premium a tus mañanas con nuestra colección exclusiva elaborada por artesanos.',
    textoBoton: 'Explorar Colección',
    linkBoton: '/productos',
    imagenUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=1920&auto=format&fit=crop',
    visible: true
  };

  constructor(private http: HttpClient) {}

  getHomeBanner(): Observable<HomeBanner> {
    return this.http.get<HomeBanner>(this.apiUrl).pipe(
      catchError(error => {
        console.warn('No se pudo conectar con el backend de Spring Boot. Usando datos simulados localmente.', error);
        return of(this.mockBanner);
      })
    );
  }

  /**
   * Actualización utilizando JSON simple (usada cuando la imagen proviene de Google Drive / Picker o no cambia)
   */
  updateHomeBannerJson(banner: HomeBanner): Observable<HomeBanner> {
    return this.http.put<HomeBanner>(this.apiUrl, banner).pipe(
      catchError(error => {
        console.warn('No se pudo guardar en el backend por JSON. Actualizando datos localmente.', error);
        this.mockBanner = { ...banner };
        return of(this.mockBanner);
      })
    );
  }

  /**
   * Actualización utilizando Multipart/FormData (usada al subir un archivo local binario)
   */
  updateHomeBannerMultipart(banner: HomeBanner, file: File): Observable<HomeBanner> {
    const formData = new FormData();
    formData.append('banner', JSON.stringify(banner));
    formData.append('file', file);

    return this.http.put<HomeBanner>(this.apiUrl, formData).pipe(
      catchError(error => {
        console.warn('No se pudo guardar en el backend por FormData. Actualizando datos localmente.', error);
        this.mockBanner = { ...banner };
        return of(this.mockBanner);
      })
    );
  }
}
