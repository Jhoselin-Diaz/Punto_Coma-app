import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminLayoutComponent } from '../admin-layout/admin-layout.component';

// Subcomponentes modularizados (Tu arquitectura limpia de la Fase 22)
import { AdminInicioComponent } from './admin-inicio/admin-inicio.component';
import { AdminProductosComponent } from './admin-productos/admin-productos.component';
import { AdminOfertasComponent } from './admin-ofertas/admin-ofertas.component';
import { AdminShopVideoComponent } from './admin-shop-video/admin-shop-video.component';
import { AdminContactoComponent } from './admin-contacto/admin-contacto.component';

// =========================================================================
// CONFIGURACIÓN DE CREDENCIALES DE GOOGLE API (Restauradas en Fase 24)
// =========================================================================
export const GOOGLE_DEVELOPER_KEY = 'AIzaSyD5ZBrYA5bMkL4Ds8IzHV4pXhk0gpDsSss';
export const GOOGLE_CLIENT_ID = '898823253296-uf76fpr6sr435blefbiuongo09g6fk4m.apps.googleusercontent.com';

type SubSeccion = 'main' | 'inicio' | 'productos' | 'ofertas' | 'shop-video' | 'contacto';

@Component({
  selector: 'app-admin-contenido-web',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    AdminLayoutComponent,
    AdminInicioComponent,
    AdminProductosComponent,
    AdminOfertasComponent,
    AdminShopVideoComponent,
    AdminContactoComponent
  ],
  templateUrl: './admin-contenido-web.component.html',
  styleUrl: './admin-contenido-web.component.css',
  encapsulation: ViewEncapsulation.None // Clave: Comparte los estilos CSS unificados con los componentes hijos
})
export class AdminContenidoWebComponent implements OnInit {
  // Control de la sección activa de la pasarela principal
  seccionActiva: SubSeccion = 'main';

  ngOnInit() {}

  // Enrutador de pestañas principales
  navegarA(seccion: SubSeccion) {
    this.seccionActiva = seccion;
  }

  alertPreview() {
    alert('¡Vista previa generada con éxito! Has sido redirigido temporalmente a la tienda online del cliente.');
  }
}
