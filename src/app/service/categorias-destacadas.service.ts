import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CategoriaDestacadaDTO {
  id?: number;
  nombreCategoria: string;
  tipo: 'MANUAL' | 'AUTOMATICA_MAS_VISTOS';
  prioridad: number;
  visible: boolean;
  imagenUrl?: string;
  productosCount?: number;
  productosIds?: number[];
  productos?: any[];
}

@Injectable({
  providedIn: 'root'
})
export class CategoriasDestacadasService {
  private readonly apiUrl = `${environment.apiUrl}/categorias-destacadas`;

  constructor(private http: HttpClient) {}

  obtenerTodas(): Observable<CategoriaDestacadaDTO[]> {
    return this.http.get<CategoriaDestacadaDTO[]>(this.apiUrl);
  }

  obtenerPorId(id: number): Observable<CategoriaDestacadaDTO> {
    return this.http.get<CategoriaDestacadaDTO>(`${this.apiUrl}/${id}`);
  }

  crearCategoria(dto: CategoriaDestacadaDTO): Observable<CategoriaDestacadaDTO> {
    return this.http.post<CategoriaDestacadaDTO>(this.apiUrl, dto);
  }

  actualizarCategoria(id: number, dto: CategoriaDestacadaDTO): Observable<CategoriaDestacadaDTO> {
    return this.http.put<CategoriaDestacadaDTO>(`${this.apiUrl}/${id}`, dto);
  }

  eliminarCategoria(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  actualizarVisibilidad(id: number, visible: boolean): Observable<CategoriaDestacadaDTO> {
    return this.http.patch<CategoriaDestacadaDTO>(`${this.apiUrl}/${id}/visibilidad?visible=${visible}`, {});
  }
}
