import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ClienteLayoutComponent } from '../cliente-layout/cliente-layout.component';
import { Producto, ProductosService } from '../../service/productos.service';
import { ConfiguracionService } from '../../service/configuracion.service';

@Component({
  selector: 'app-productos',
  imports: [ClienteLayoutComponent, RouterLink],
  templateUrl: './productos.component.html',
  styleUrl: './productos.component.css'
})
export class ProductosComponent {
  productos: Producto[];

  constructor(
    private productosService: ProductosService,
    public configService: ConfiguracionService
  ) {
    this.productos = this.productosService.obtenerProductos();
  }
}
