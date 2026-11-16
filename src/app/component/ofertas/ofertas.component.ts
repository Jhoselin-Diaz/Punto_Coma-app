import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, NavigationEnd } from '@angular/router';
import { ClienteLayoutComponent } from '../cliente-layout/cliente-layout.component';
import { ProductosService } from '../../service/productos.service';
import { ConfiguracionService } from '../../service/configuracion.service';
import { CartService } from '../../service/cart.service';
import { ClienteAuthService } from '../../service/cliente-auth.service';
import { DomSanitizer, SafeUrl, SafeStyle } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-ofertas',
  standalone: true,
  imports: [CommonModule, RouterLink, ClienteLayoutComponent],
  templateUrl: './ofertas.component.html',
  styleUrl: './ofertas.component.css'
})
export class OfertasComponent implements OnInit, OnDestroy {
  productosEnOferta: any[] = [];
  productos: any[] = [];
  cargando = true;
  isConfigLoading = true;
  isLoading = true;
  bannerStyle: SafeStyle = '';
  bannerTitulo = '';
  bannerSubtitulo = '';

  private configSub?: Subscription;

  constructor(
    private productosService: ProductosService,
    public configService: ConfiguracionService,
    private cartService: CartService,
    public clienteAuthService: ClienteAuthService,
    private sanitizer: DomSanitizer,
    private router: Router
  ) {
    this.router.routeReuseStrategy.shouldReuseRoute = () => false;
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

  agregarAlCarrito(producto: any) {
    if (this.esAgotado(producto)) return;
    this.cartService.addItem(producto);
  }

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

  cargarProductosDesdeCache() {
    this.cargando = true;
    this.isLoading = true;

    // Disparar recarga de la configuración desde la caché
    this.configService.cargarDesdeBackend(false).subscribe({
      error: (err) => console.error('Error al recargar configuracion en ofertas:', err)
    });

    // Disparar recarga de los productos en oferta desde la caché
    this.productosService.obtenerProductosPublicos(false).subscribe({
      next: (data) => {
        const hoy = new Date().toISOString().split('T')[0];
        
        const filtered = data.filter((p: any) => {
          // 1. Debe ser visible y activo
          if (p.visible === false || p.activo === false) return false;

          // 2. Debe tener descuento vigente
          const original = p.precioOriginal || p.precioAnterior || p.precio || 0;
          const oferta = p.precioOferta || 0;
          const tieneDescuento = oferta > 0 && original > oferta;
          if (!tieneDescuento) return false;

          // 3. Rango de fechas
          const inicio = this.parseDateToYYYYMMDD(p.fechaInicioOferta);
          const fin = this.parseDateToYYYYMMDD(p.fechaFinOferta);

          const cumpleInicio = !inicio || hoy >= inicio;
          const cumpleFin = !fin || hoy <= fin;

          return cumpleInicio && cumpleFin;
        });

        this.productos = filtered;
        this.productosEnOferta = filtered;
        this.cargando = false;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error al obtener ofertas públicas desde cache:', err);
        this.cargando = false;
        this.isLoading = false;
      }
    });
  }

  ngOnInit() {
    // Suscripción única reactiva a config$
    this.configSub = this.configService.config$.subscribe(config => {
      if (config) {
        this.bannerTitulo = config.ofertas_banner_titulo || 'Ofertas Especiales';
        this.bannerSubtitulo = config.ofertas_banner_subtitulo || 'Aprovecha estas promociones exclusivas y consigue nuestras tazas y vasos más trendy al mejor precio.';
        const imgUrl = config.ofertas_banner_img || '';
        if (imgUrl) {
          const renderUrl = this.obtenerUrlRenderizable(imgUrl);
          this.bannerStyle = this.sanitizer.bypassSecurityTrustStyle(`url('${renderUrl}')`);
        } else {
          this.bannerStyle = '';
        }
        this.isConfigLoading = false;
      }
    });

    this.cargarProductosDesdeCache();
  }

  ngOnDestroy() {
    this.configSub?.unsubscribe();
  }

  parseDateToYYYYMMDD(dateVal: any): string {
    if (!dateVal) return '';
    if (Array.isArray(dateVal)) {
      if (dateVal.length >= 3) {
        const yyyy = dateVal[0];
        const mm = String(dateVal[1]).padStart(2, '0');
        const dd = String(dateVal[2]).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }
    }
    if (typeof dateVal === 'string') {
      const parts = dateVal.split('T')[0].split('-');
      if (parts.length === 3 && parts[0].length === 4 && parts[1].length === 2 && parts[2].length === 2) {
        return dateVal.split('T')[0];
      }
    }
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '';
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    } catch {
      return '';
    }
  }

  obtenerPorcentajeDescuento(original: number, oferta: number): number {
    if (!original || !oferta || original <= 0) return 0;
    const diff = original - oferta;
    return Math.max(0, Math.round((diff * 100) / original));
  }

  extraerGoogleDriveId(input: string): string {
    if (!input) return '';
    const reg1 = /\/file\/d\/([a-zA-Z0-9_-]+)/;
    const reg2 = /[?&]id=([a-zA-Z0-9_-]+)/;
    const reg3 = /\/d\/([a-zA-Z0-9_-]+)/;

    let match = input.match(reg1);
    if (match) return match[1];

    match = input.match(reg2);
    if (match) return match[1];

    match = input.match(reg3);
    if (match) return match[1];

    return input.trim();
  }

  obtenerGoogleDrivePreviewUrl(id: string): string {
    if (!id) return '';
    return `https://lh3.googleusercontent.com/d/${id}`;
  }

  obtenerImagenUrl(url: string): SafeUrl {
    const trimmed = (url || '').trim();
    if (!trimmed || trimmed.startsWith('blob:') || trimmed.includes('localhost:8080') || trimmed.includes('127.0.0.1')) {
      return this.sanitizer.bypassSecurityTrustUrl('images/prod-jaspeada.png');
    }
    if (!trimmed.includes('drive.google.com') && !trimmed.includes('docs.google.com') && !trimmed.includes('googleusercontent.com')) {
      return this.sanitizer.bypassSecurityTrustUrl(trimmed);
    }
    const fileId = this.extraerGoogleDriveId(trimmed);
    const previewUrl = this.obtenerGoogleDrivePreviewUrl(fileId);
    return this.sanitizer.bypassSecurityTrustUrl(previewUrl || 'images/prod-jaspeada.png');
  }

  onImgError(event: any) {
    const target = event?.target as HTMLImageElement;
    if (target) {
      target.onerror = null;
      target.src = 'images/prod-jaspeada.png';
    }
  }
}
