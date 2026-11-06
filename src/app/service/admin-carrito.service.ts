import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ConfiguracionCarrito {
  id?: number;
  whatsappUrl: string;
  beneficio1: string;
  beneficio2: string;
  beneficio3: string;
  beneficio4: string;
}

export type TipoAplicacionCupon = 'BIENVENIDA' | 'CATEGORIA' | 'OFERTAS' | 'OFERTA' | 'LIQUIDACION' | 'GENERAL';

export interface Cupon {
  id?: number;
  codigo: string;
  porcentajeDescuento: number;
  activo: boolean;
  montoMinimo?: number | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  limiteUso?: number | null;
  usosActuales?: number | null;
  tipoAplicacion?: TipoAplicacionCupon;
  categoriaAplicable?: string | null;
  productoIds?: string | null;
  visibleWeb?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AdminCarritoService {
  private readonly configUrl = `${environment.apiUrl}/configuracion-carrito`;
  private readonly cuponesUrl = `${environment.apiUrl}/cupones`;

  constructor(private http: HttpClient) {}

  obtenerConfiguracion(): Observable<ConfiguracionCarrito> {
    return this.http.get<ConfiguracionCarrito>(this.configUrl);
  }

  guardarConfiguracion(config: ConfiguracionCarrito): Observable<ConfiguracionCarrito> {
    return this.http.put<ConfiguracionCarrito>(this.configUrl, config);
  }

  listarCupones(): Observable<Cupon[]> {
    return this.http.get<Cupon[]>(this.cuponesUrl);
  }

  crearCupon(cupon: Cupon): Observable<Cupon> {
    return this.http.post<Cupon>(this.cuponesUrl, cupon);
  }

  actualizarCupon(id: number, cupon: Cupon): Observable<Cupon> {
    return this.http.put<Cupon>(`${this.cuponesUrl}/${id}`, cupon);
  }

  eliminarCupon(id: number): Observable<void> {
    return this.http.delete<void>(`${this.cuponesUrl}/${id}`);
  }

  validarCupon(codigo: string): Observable<Cupon> {
    return this.http.get<Cupon>(`${this.cuponesUrl}/validar/${codigo}`);
  }

  registrarUsoCupon(id: number): Observable<Cupon> {
    return this.http.post<Cupon>(`${this.cuponesUrl}/${id}/usar`, {});
  }
}
