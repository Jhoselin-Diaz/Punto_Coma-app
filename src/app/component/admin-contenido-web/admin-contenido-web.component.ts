import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminLayoutComponent } from '../admin-layout/admin-layout.component';

// Subcomponentes modularizados
import { AdminInicioComponent } from './admin-inicio/admin-inicio.component';
import { AdminProductosComponent } from './admin-productos/admin-productos.component';
import { AdminOfertasComponent } from './admin-ofertas/admin-ofertas.component';
import { AdminShopVideoComponent } from './admin-shop-video/admin-shop-video.component';
import { AdminContactoComponent } from './admin-contacto/admin-contacto.component';

// =========================================================================
// CONFIGURACIÓN DE CREDENCIALES DE GOOGLE API
// Reemplaza estas constantes con tus valores obtenidos de Google Cloud Console:
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
    AdminLayoutComponent,
    AdminInicioComponent,
    AdminProductosComponent,
    AdminOfertasComponent,
    AdminShopVideoComponent,
    AdminContactoComponent
  ],
  templateUrl: './admin-contenido-web.component.html',
  styleUrl: './admin-contenido-web.component.css',
  encapsulation: ViewEncapsulation.None // Para compartir los estilos globales CSS de CMS/Tablas/ switches
})
export class AdminContenidoWebComponent implements OnInit {
  seccionActiva: SubSeccion = 'main';

  ngOnInit() {}

  navegarA(seccion: SubSeccion) {
    this.seccionActiva = seccion;
  }

  alertPreview() {
    alert('¡Vista previa generada con éxito! Has sido redirigido temporalmente a la tienda online del cliente.');
  }
}
