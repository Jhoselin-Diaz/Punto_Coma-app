import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminLayoutComponent } from '../admin-layout/admin-layout.component';
import { AdminInicioComponent } from './admin-inicio/admin-inicio.component';
import { AdminContactoComponent } from './admin-contacto/admin-contacto.component';
import { AdminProductosComponent } from './admin-productos/admin-productos.component';
import { AdminOfertasComponent } from './admin-ofertas/admin-ofertas.component';
import { AdminShopVideoComponent } from './admin-shop-video/admin-shop-video.component';

interface CategoriaDestacada {
  id: number;
  nombre: string;
  imagen: string;
  productosCount: number;
  visible: boolean;
  orden: number;
}

interface ProductoDestacado {
  id: string;
  nombre: string;
  precio: number;
  imagen: string;
  tags: string[];
  seleccionado: boolean;
}

type SubSeccion = 'main' | 'inicio' | 'productos' | 'ofertas' | 'shop-video' | 'contacto';
type InicioTab = 'banner' | 'categorias' | 'productos' | 'config';

@Component({
  selector: 'app-admin-contenido-web',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AdminLayoutComponent,
    AdminInicioComponent,
    AdminContactoComponent,
    AdminProductosComponent,
    AdminOfertasComponent,
    AdminShopVideoComponent
  ],
  templateUrl: './admin-contenido-web.component.html',
  styleUrl: './admin-contenido-web.component.css'
})
export class AdminContenidoWebComponent implements OnInit {
  // Sección activa principal
  seccionActiva: SubSeccion = 'main';

  // Sub-tabs de la sección Inicio
  inicioTabActiva: InicioTab = 'banner';

  // --- SECCIÓN 1: INICIO ---
  // Categorías Destacadas (Inicio) - Visual Cards Aesthetic
  categorias: CategoriaDestacada[] = [];

  // Productos Destacados en Inicio
  productosDestacados: ProductoDestacado[] = [];

  // Configuración Visual
  configAnimaciones = true;
  configCarrusel = false;
  configMostrarOfertas = true;
  configCategoriasPopulares = true;

  constructor() {}

  ngOnInit() {
    // Inicialización local de datos
  }

  // --- MÉTODOS DE CONTROL ---
  navegarA(seccion: SubSeccion) {
    this.seccionActiva = seccion;
  }

  setInicioTab(tab: InicioTab) {
    this.inicioTabActiva = tab;
  }

  toggleVisible(item: { visible: boolean }) {
    item.visible = !item.visible;
  }

  toggleSeleccionado(item: ProductoDestacado) {
    item.seleccionado = !item.seleccionado;
  }

  eliminarFila(array: any[], index: number) {
    array.splice(index, 1);
  }

  alertPreview() {
    alert('¡Vista previa generada con éxito! Has sido redirigido temporalmente a la tienda online del cliente.');
  }
}
