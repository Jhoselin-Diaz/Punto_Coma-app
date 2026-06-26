import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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

type InicioTab = 'banner' | 'categorias' | 'productos' | 'config';

@Component({
  selector: 'app-admin-inicio',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-inicio.component.html',
  styleUrl: './admin-inicio.component.css'
})
export class AdminInicioComponent implements OnInit {
  inicioTabActiva: InicioTab = 'banner';

  // Banner Principal
  bannerTitle = 'El arte de tomar café con estilo';
  bannerSubtitle = 'Diseños únicos hechos a mano con cerámica y vidrio premium para acompañar tus mejores momentos.';
  bannerBtnText = 'Explorar Colección';
  bannerBtnLink = '/productos';
  bannerImage = 'images/banner-home.jpg';
  bannerVisible = true;

  // Categorías Destacadas (Inicio) - Visual Cards Aesthetic
  categorias: CategoriaDestacada[] = [
    { id: 1, nombre: 'Tazas Jaspeadas', imagen: 'images/cat-jaspeadas.png', productosCount: 8, visible: true, orden: 1 },
    { id: 2, nombre: 'Set de Regalo', imagen: 'images/cat-sets.png', productosCount: 4, visible: true, orden: 2 },
    { id: 3, nombre: 'Vasos y Mugs', imagen: 'images/cat-vasos.png', productosCount: 6, visible: true, orden: 3 }
  ];

  // Productos Destacados en Inicio
  productosDestacados: ProductoDestacado[] = [
    { id: '1', nombre: 'Taza Arcilla Jaspeada Verde', precio: 45, imagen: 'images/prod-jaspeada.png', tags: ['Nuevo', 'Popular'], seleccionado: true },
    { id: '2', nombre: 'Taza Cerámica Beige Clásica', precio: 38, imagen: 'images/prod-beige.png', tags: ['Descuento'], seleccionado: true },
    { id: '3', nombre: 'Set Coffee Lovers Premium', precio: 120, imagen: 'images/prod-set.png', tags: ['Regalo'], seleccionado: false }
  ];

  // Configuración Visual
  configAnimaciones = true;
  configCarrusel = false;
  configMostrarOfertas = true;
  configCategoriasPopulares = true;

  ngOnInit() {}

  setInicioTab(tab: InicioTab) {
    this.inicioTabActiva = tab;
  }

  toggleVisible(item: { visible: boolean }) {
    item.visible = !item.visible;
  }

  toggleSeleccionado(item: ProductoDestacado) {
    item.seleccionado = !item.seleccionado;
  }

  alertPreview() {
    alert('¡Vista previa generada con éxito! Has sido redirigido temporalmente a la tienda online del cliente.');
  }

  eliminarFila(array: any[], index: number) {
    array.splice(index, 1);
  }
}
