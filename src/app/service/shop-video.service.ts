import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ShopVideoDTO {
  id?: number;
  titulo: string;
  descripcion: string;
  plataforma: string;
  videoUrl: string;
  miniaturaUrl?: string;
  views?: string;
  likes?: string;
  clicks?: string;
  visible?: boolean;
  productosIds?: number[];
}

@Injectable({
  providedIn: 'root'
})
export class ShopVideoService {
  private apiUrl = `${environment.apiUrl}/videos`;

  constructor(private http: HttpClient) {}

  crearVideo(video: ShopVideoDTO): Observable<ShopVideoDTO> {
    return this.http.post<ShopVideoDTO>(this.apiUrl, video);
  }

  obtenerTodos(): Observable<ShopVideoDTO[]> {
    return this.http.get<ShopVideoDTO[]>(this.apiUrl);
  }

  obtenerPublicos(): Observable<ShopVideoDTO[]> {
    return this.http.get<ShopVideoDTO[]>(`${this.apiUrl}/publicos`);
  }

  obtenerPorId(id: number): Observable<ShopVideoDTO> {
    return this.http.get<ShopVideoDTO>(`${this.apiUrl}/${id}`);
  }

  actualizarVideo(id: number, video: ShopVideoDTO): Observable<ShopVideoDTO> {
    return this.http.put<ShopVideoDTO>(`${this.apiUrl}/${id}`, video);
  }

  eliminarVideo(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  actualizarVisibilidad(id: number, visible: boolean): Observable<ShopVideoDTO> {
    return this.http.patch<ShopVideoDTO>(`${this.apiUrl}/${id}/visibilidad?visible=${visible}`, {});
  }
}
