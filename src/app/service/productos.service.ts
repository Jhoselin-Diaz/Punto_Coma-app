import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Producto {
  id?: string;
  nombre: string;
  precio: number;
  precioAnterior: number;
  imagen: string;
  etiqueta?: string;
}

export interface ColorProducto {
  nombre: string;
  codigo: string;
  imagen: string;
}

export interface DetalleProducto extends Producto {
  id: string;
  subtitulo: string;
  categoria: string;
  rating: number;
  resenas: number;
  descuento: string;
  stock: string;
  capacidad: string;
  material: string;
  aptoPara: string;
  acabado: string;
  diseno: string;
  galeria: string[];
  colores: ColorProducto[];
  descripcion: string;
  caracteristicas: string[];
  incluye: string;
  garantia: string;
  materialDescripcion: string;
  materialCaracteristicas: string[];
  cuidados: string[];
  envios: string[];
  devoluciones: string[];
  materialIntro?: string;
  materialCuidados?: string;
  enviosInfo?: string;
  devolucionesInfo?: string;
  envios_info?: string;
  devoluciones_info?: string;
  material_intro?: string;
  material_cuidados?: string;
  material_caracteristicas?: string;
  apto_microondas?: boolean;
  apto_lavavajillas?: boolean;
  resiste_choque_termico?: boolean;
  limpieza_suave?: boolean;
  prohibido_fuego_directo?: boolean;
  apto_temperaturas?: boolean;
  grado_alimentario?: boolean;
  evitar_abrasivos?: boolean;
  control_humedad?: boolean;
  lavado_mano?: boolean;
  precio_original?: number;
  precio_oferta?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ProductosService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  crearProducto(productoData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/productos`, productoData);
  }

  obtenerTodosBackend(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/productos`);
  }

  obtenerProductosPublicos(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/productos/publicos`);
  }

  obtenerProductoPorId(id: any): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/productos/${id}`);
  }

  eliminarProducto(id: any): Observable<any> {
    return this.http.delete(`${this.apiUrl}/productos/${id}`);
  }

  actualizarProducto(id: any, payload: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/productos/${id}`, payload);
  }

  actualizarVisibilidadProducto(id: any, visible: boolean): Observable<any> {
    return this.http.patch(`${this.apiUrl}/productos/${id}/visibilidad?visible=${visible}`, {});
  }

  agregarStock(id: any, stockRequest: { cantidad: number; proveedor: string; notas: string; tipoMovimiento?: string }): Observable<any> {
    return this.http.patch(`${this.apiUrl}/productos/${id}/agregar-stock`, stockRequest);
  }

  obtenerMovimientos(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/productos/movimientos`);
  }

  private readonly recienVistos: Producto[] = [];


  private readonly categorias: Producto[] = [];

  private readonly ofertas: Producto[] = [];

  private readonly productos: Producto[] = [];

  private readonly detalles: DetalleProducto[] = [];

  obtenerRecienVistos(): Producto[] {
    return this.recienVistos;
  }

  obtenerCategorias(): Producto[] {
    return this.categorias;
  }

  obtenerOfertas(): Producto[] {
    return this.ofertas;
  }

  obtenerProductos(): Producto[] {
    return this.productos;
  }

  obtenerDetalleProducto(id: string): DetalleProducto | undefined {
    return this.detalles.find((producto) => producto.id === id);
  }

  obtenerRelacionados(id: string): Producto[] {
    return this.productos.filter((producto) => producto.id !== id).slice(0, 4);
  }

  private obtenerSubtitulo(nombre: string): string {
    if (nombre.includes('Vaso')) {
      return 'Diseno moderno para tus bebidas favoritas.';
    }

    if (nombre.includes('Set')) {
      return 'Set elegante para compartir cafe o te.';
    }

    return 'Diseno elegante y moderno para tu cafe diario.';
  }
}
