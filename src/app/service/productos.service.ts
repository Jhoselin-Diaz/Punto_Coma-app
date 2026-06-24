import { Injectable } from '@angular/core';

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
}

@Injectable({
  providedIn: 'root'
})
export class ProductosService {
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
