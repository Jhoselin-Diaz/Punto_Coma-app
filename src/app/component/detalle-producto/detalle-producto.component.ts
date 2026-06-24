import { Component } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ClienteLayoutComponent } from '../cliente-layout/cliente-layout.component';
import { ColorProducto, DetalleProducto, Producto, ProductosService } from '../../service/productos.service';

type TabDetalle = 'detalles' | 'material' | 'envios';

@Component({
  selector: 'app-detalle-producto',
  imports: [ClienteLayoutComponent, RouterLink],
  templateUrl: './detalle-producto.component.html',
  styleUrl: './detalle-producto.component.css'
})
export class DetalleProductoComponent {
  producto?: DetalleProducto;
  relacionados: Producto[] = [];
  imagenPrincipal = '';
  colorSeleccionado = '';
  cantidad = 1;
  tabActivo: TabDetalle = 'detalles';

  constructor(private route: ActivatedRoute, private productosService: ProductosService) {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.producto = this.productosService.obtenerDetalleProducto(id);
    this.relacionados = this.productosService.obtenerRelacionados(id);
    this.imagenPrincipal = this.producto?.galeria[0] ?? '';
    this.colorSeleccionado = this.producto?.colores[0].nombre ?? '';
  }

  seleccionarImagen(imagen: string): void {
    this.imagenPrincipal = imagen;
  }

  seleccionarColor(color: ColorProducto): void {
    this.colorSeleccionado = color.nombre;
    this.imagenPrincipal = color.imagen;
  }

  cambiarCantidad(valor: number): void {
    this.cantidad = Math.max(1, this.cantidad + valor);
  }

  cambiarTab(tab: TabDetalle): void {
    this.tabActivo = tab;
  }
}
