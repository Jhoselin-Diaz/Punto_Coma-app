import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterLink, Router, NavigationEnd } from '@angular/router';
import { ClienteLayoutComponent } from '../cliente-layout/cliente-layout.component';
import { Producto, ProductosService } from '../../service/productos.service';
import { ConfiguracionService } from '../../service/configuracion.service';
import { ContentService, HomeBanner } from '../../service/content.service';
import { CategoriasDestacadasService, CategoriaDestacadaDTO } from '../../service/categorias-destacadas.service';
import { ClienteAuthService } from '../../service/cliente-auth.service';
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
    public clienteAuthService: ClienteAuthService,
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
    if (!url) return 'images/prod-jaspeada.png';
    const trimmed = (url || '').trim();
    if (!trimmed || trimmed.startsWith('blob:') || trimmed.includes('localhost:8080') || trimmed.includes('127.0.0.1')) {
      return 'images/prod-jaspeada.png';
    }

    if (trimmed.includes('lh3.googleusercontent.com')) return trimmed;
    if (trimmed.includes('supabase.co/storage') || trimmed.includes('supabase.in/storage')) return trimmed;

    if (trimmed.includes('docs.google.com/uc') || trimmed.includes('drive.google.com/uc')) {
      const match = trimmed.match(/[?&]id=([^&]+)/);
      if (match && match[1]) {
        return `https://lh3.googleusercontent.com/d/${match[1]}`;
      }
    }

    if (trimmed.includes('drive.google.com') || trimmed.includes('docs.google.com')) {
      const fileMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (fileMatch && fileMatch[1]) {
        return `https://lh3.googleusercontent.com/d/${fileMatch[1]}`;
      }
      const dMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (dMatch && dMatch[1]) {
        return `https://lh3.googleusercontent.com/d/${dMatch[1]}`;
      }
    }

    return trimmed;
  }

  obtenerImagenUrl(url?: string): string {
    if (!url) return 'images/prod-jaspeada.png';
    const render = this.obtenerUrlRenderizable(url);
    return render || 'images/prod-jaspeada.png';
  }

  onImgError(event: any) {
    const target = event?.target as HTMLImageElement;
    if (target) {
      target.onerror = null;
      target.src = 'images/prod-jaspeada.png';
    }
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

  esAgotado(producto: any): boolean {
    return producto && producto.stock !== undefined && producto.stock !== null && Number(producto.stock) <= 0;
  }

  toggleFavorito(event: Event, producto: any): void {
    event.stopPropagation();
    event.preventDefault();
    this.clienteAuthService.toggleFavorito(producto);
  }

  esFavorito(id: number | string): boolean {
    return this.clienteAuthService.esFavorito(id);
  }

  ngOnDestroy() {
    this.bannerSub?.unsubscribe();
    this.routerSub?.unsubscribe();
  }
}
