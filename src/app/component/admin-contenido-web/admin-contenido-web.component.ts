import { Component, OnInit, ViewEncapsulation, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AdminLayoutComponent } from '../admin-layout/admin-layout.component';
import { ModalAlertaService } from '../../service/modal-alerta.service';

// Subcomponentes modularizados (Tu arquitectura limpia de la Fase 22)
import { AdminInicioComponent } from './admin-inicio/admin-inicio.component';
import { AdminProductosComponent } from './admin-productos/admin-productos.component';
import { AdminOfertasComponent } from './admin-ofertas/admin-ofertas.component';
import { AdminShopVideoComponent } from './admin-shop-video/admin-shop-video.component';
import { AdminContactoComponent } from './admin-contacto/admin-contacto.component';
import { AdminRastreoComponent } from './admin-rastreo/admin-rastreo.component';

// =========================================================================
// CONFIGURACIÓN DE CREDENCIALES DE GOOGLE API (Restauradas en Fase 24)
// =========================================================================
export const GOOGLE_DEVELOPER_KEY = 'AIzaSyBqV0Vr1NI8dYU-LE4rE3Fv1GrOdJAh6KU';
export const GOOGLE_CLIENT_ID = '398851876989-tuuj11fvmmn06uqtouahvo76qagm5ej3.apps.googleusercontent.com';

export type SubSeccion = 'main' | 'inicio' | 'productos' | 'ofertas' | 'shop-video' | 'contacto' | 'rastreo';

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
    AdminContactoComponent,
    AdminRastreoComponent
  ],
  templateUrl: './admin-contenido-web.component.html',
  styleUrl: './admin-contenido-web.component.css',
  encapsulation: ViewEncapsulation.None // Clave: Comparte los estilos CSS unificados con los componentes hijos
})
export class AdminContenidoWebComponent implements OnInit, OnDestroy {
  // Control de la sección activa de la pasarela principal
  seccionActiva: SubSeccion = 'main';
  private routerSub?: Subscription;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private modalAlertaService: ModalAlertaService
  ) {}

  ngOnInit() {
    this.sincronizarSeccionConRuta();
    this.routerSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.sincronizarSeccionConRuta();
      });
  }

  ngOnDestroy() {
    this.routerSub?.unsubscribe();
  }

  private sincronizarSeccionConRuta(): void {
    const url = this.router.url;
    if (url.includes('/admin/contenido-web/inicio')) {
      this.seccionActiva = 'inicio';
    } else if (url.includes('/admin/contenido-web/productos') || url.includes('/admin/productos')) {
      this.seccionActiva = 'productos';
    } else if (url.includes('/admin/contenido-web/ofertas')) {
      this.seccionActiva = 'ofertas';
    } else if (url.includes('/admin/contenido-web/shop-video')) {
      this.seccionActiva = 'shop-video';
    } else if (url.includes('/admin/contenido-web/contacto')) {
      this.seccionActiva = 'contacto';
    } else if (url.includes('/admin/contenido-web/rastreo')) {
      this.seccionActiva = 'rastreo';
    } else {
      this.seccionActiva = 'main';
    }
  }

  // Enrutador de pestañas principales con actualización de URL en el navegador
  navegarA(seccion: SubSeccion) {
    this.seccionActiva = seccion;
    if (seccion === 'main') {
      this.router.navigate(['/admin/contenido-web']);
    } else {
      this.router.navigate(['/admin/contenido-web', seccion]);
    }
  }

  alertPreview() {
    this.modalAlertaService.info(
      'Has generado la vista previa. Puedes revisar los cambios reflejados en la tienda online.',
      'Vista Previa'
    );
  }
}