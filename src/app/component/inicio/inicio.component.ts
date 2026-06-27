import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterLink, Router, NavigationEnd } from '@angular/router';
import { ClienteLayoutComponent } from '../cliente-layout/cliente-layout.component';
import { Producto, ProductosService } from '../../service/productos.service';
import { ConfiguracionService } from '../../service/configuracion.service';
import { ContentService, HomeBanner } from '../../service/content.service';
import { CategoriasDestacadasService, CategoriaDestacadaDTO } from '../../service/categorias-destacadas.service';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeStyle } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [ClienteLayoutComponent, RouterLink, CommonModule],
  templateUrl: './inicio.component.html',
  styleUrl: './inicio.component.css'
})
export class InicioComponent implements OnInit, OnDestroy {
  categoriasDestacadas: CategoriaDestacadaDTO[] = [];
  banner: HomeBanner | null = null;
  bannerPreviewStyle: SafeStyle = '';
  isBannerLoading = true;

  private bannerSub?: Subscription;
  private routerSub?: Subscription;

  constructor(
    private productosService: ProductosService,
    public configService: ConfiguracionService,
    private contentService: ContentService,
    private categoriasService: CategoriasDestacadasService,
    private sanitizer: DomSanitizer,
    private router: Router
  ) {
    this.routerSub = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      const url = event.urlAfterRedirects || event.url || '';
      if (url === '/inicio' || url === '/') {
        this.cargarDatosFrescos();
      }
    });
  }

  /**
   * Convierte cualquier URL de Google Drive / Supabase a una URL renderizable.
   * Cubre 6 casos: lh3, Supabase, blob, docs/uc, file/d, y fallback.
   */
  obtenerUrlRenderizable(url: string): string {
    if (!url) return '';

    if (url.includes('lh3.googleusercontent.com')) return url;
    if (url.includes('supabase.co/storage') || url.includes('supabase.in/storage')) return url;
    if (url.startsWith('blob:')) return url;

    if (url.includes('docs.google.com/uc') || url.includes('drive.google.com/uc')) {
      const match = url.match(/[?&]id=([^&]+)/);
      if (match && match[1]) {
        return `https://lh3.googleusercontent.com/d/${match[1]}`;
      }
    }

    if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
      const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (fileMatch && fileMatch[1]) {
        return `https://lh3.googleusercontent.com/d/${fileMatch[1]}`;
      }
      const dMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (dMatch && dMatch[1]) {
        return `https://lh3.googleusercontent.com/d/${dMatch[1]}`;
      }
    }

    return url;
  }

  private aplicarBanner(banner: HomeBanner) {
    this.banner = banner;
    if (banner?.imagenUrl) {
      const renderUrl = this.obtenerUrlRenderizable(banner.imagenUrl);
      this.bannerPreviewStyle = this.sanitizer.bypassSecurityTrustStyle(`url('${renderUrl}')`);
    } else {
      this.bannerPreviewStyle = '';
    }
    this.isBannerLoading = false;
  }

  cargarDatosFrescos() {
    this.isBannerLoading = true;

    // Disparar recarga de la configuración del negocio desde la caché
    this.configService.cargarDesdeBackend(false).subscribe({
      error: (err) => console.error('Error al recargar configuracion en inicio:', err)
    });

    // Dispara la carga real del banner desde el backend.
    this.contentService.getHomeBanner().subscribe({
      error: (err) => {
        console.error('Error al cargar el banner en el home del cliente:', err);
        this.isBannerLoading = false;
      }
    });

    // Cargar las categorías destacadas reales del backend
    this.categoriasService.obtenerTodas().subscribe({
      next: (res) => {
        this.categoriasDestacadas = res.filter(c => c.visible);
      },
      error: (err) => {
        console.error('Error al cargar categorias destacadas en inicio:', err);
      }
    });
  }

  ngOnInit() {
    // Parche 4: una sola suscripción a banner$ (BehaviorSubject).
    // - Emite inmediatamente con el último valor conocido (mock o real) → isBannerLoading = false rápido.
    // - Se actualiza automáticamente cuando admin guarda o previsualizael banner.
    this.bannerSub = this.contentService.banner$.subscribe(banner => {
      if (banner) {
        this.aplicarBanner(banner);
      }
    });

    this.cargarDatosFrescos();
  }

  ngOnDestroy() {
    this.bannerSub?.unsubscribe();
    this.routerSub?.unsubscribe();
  }
}
