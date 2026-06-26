import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ClienteLayoutComponent } from '../cliente-layout/cliente-layout.component';
import { Producto, ProductosService } from '../../service/productos.service';
import { ConfiguracionService } from '../../service/configuracion.service';

@Component({
  selector: 'app-inicio',
  imports: [ClienteLayoutComponent, RouterLink],
  templateUrl: './inicio.component.html',
  styleUrl: './inicio.component.css'
})
export class InicioComponent {
  recienVistos: Producto[];
  categorias: Producto[];
  ofertas: Producto[];

  constructor(
    private productosService: ProductosService,
    public configService: ConfiguracionService
  ) {
    this.recienVistos = this.productosService.obtenerRecienVistos();
    this.categorias = this.productosService.obtenerCategorias();
    this.ofertas = this.productosService.obtenerOfertas();
  }
}
