import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { ClienteLayoutComponent } from '../cliente-layout/cliente-layout.component';
import { ProductosService } from '../../service/productos.service';
import { ConfiguracionService } from '../../service/configuracion.service';
import { CartService } from '../../service/cart.service';
import { ClienteAuthService } from '../../service/cliente-auth.service';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-productos',
  standalone: true,
  imports: [CommonModule, ClienteLayoutComponent, RouterLink],
  templateUrl: './productos.component.html',
  styleUrl: './productos.component.css'
})
export class ProductosComponent implements OnInit, OnDestroy {
  todosLosProductos: any[] = [];
  productos: any[] = [];
  terminoBusqueda = '';
  isLoading = true;

  private sub = new Subscription();

  constructor(
    private productosService: ProductosService,
    public configService: ConfiguracionService,
    private cartService: CartService,
    public clienteAuthService: ClienteAuthService,
    private sanitizer: DomSanitizer,
    private router: Router,
    private route: ActivatedRoute
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

  ngOnInit() {
    this.isLoading = true;

    // Cargar catálogo de productos públicos
    this.productosService.obtenerProductosPublicos().subscribe({
      next: (res: any) => {
        const data = Array.isArray(res) ? res : (res && Array.isArray(res.content) ? res.content : []);
        // Solo considerar productos que no estén ocultos ni inactivos
        this.todosLosProductos = data.filter((p: any) => p.visible !== false && p.activo !== false);
        this.isLoading = false;
        this.aplicarFiltro();
      },
      error: (err) => {
        console.error('Error al obtener productos públicos:', err);
        this.isLoading = false;
      }
    });

    // Escuchar cambios de parámetros de consulta (?q=...)
    this.sub.add(
      this.route.queryParams.subscribe(params => {
        this.terminoBusqueda = params['q'] ? params['q'].trim() : '';
        if (!this.isLoading) {
          this.aplicarFiltro();
        }
      })
    );
  }

  aplicarFiltro(): void {
    if (!this.terminoBusqueda) {
      this.productos = [...this.todosLosProductos];
      return;
    }

    const qNorm = this.normalizar(this.terminoBusqueda);
    this.productos = this.todosLosProductos.filter((p: any) => {
      // Filtrar solo productos que estén visibles y activos
      const esVisible = p.visible !== false && p.activo !== false;
      if (!esVisible) return false;

      const matchNombre = this.normalizar(p.nombre).includes(qNorm);
      const matchCategoria = this.normalizar(p.categoria).includes(qNorm);
      const matchSku = this.normalizar(p.sku).includes(qNorm);
      return matchNombre || matchCategoria || matchSku;
    });
  }

  limpiarBusqueda(): void {
    this.terminoBusqueda = '';
    this.router.navigate(['/productos'], { queryParams: {} });
  }

  normalizar(text: string): string {
    return (text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
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

  readonly DEFAULT_PLACEHOLDER = '/assets/img/placeholder-producto.png';

  onImgError(event: Event, producto?: any) {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.onerror = null; // Corta la propagación y previene bucles infinitos de reintentos
      target.src = this.DEFAULT_PLACEHOLDER;
    }
    if (producto) {
      // Actualiza el modelo para que la detección de cambios de Angular no reintente la URL rota
      producto.imagenPrincipal = this.DEFAULT_PLACEHOLDER;
      producto.imageUrl = this.DEFAULT_PLACEHOLDER;
    }
  }

  obtenerImagenUrl(url: string): SafeUrl {
    if (!url) return '';
    if (!url.includes('drive.google.com') && !url.includes('docs.google.com') && !url.includes('googleusercontent.com')) {
      return this.sanitizer.bypassSecurityTrustUrl(url);
    }
    const fileId = this.extraerGoogleDriveId(url);
    const previewUrl = this.obtenerGoogleDrivePreviewUrl(fileId);
    return this.sanitizer.bypassSecurityTrustUrl(previewUrl);
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }
}
