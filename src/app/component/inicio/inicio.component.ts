import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ClienteLayoutComponent } from '../cliente-layout/cliente-layout.component';
import { Producto, ProductosService } from '../../service/productos.service';
import { ConfiguracionService } from '../../service/configuracion.service';
import { ContentService, HomeBanner } from '../../service/content.service';
import { CommonModule } from '@angular/common';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [ClienteLayoutComponent, RouterLink, CommonModule],
  templateUrl: './inicio.component.html',
  styleUrl: './inicio.component.css'
})
export class InicioComponent implements OnInit {
  recienVistos: Producto[];
  categorias: Producto[];
  ofertas: Producto[];
  banner: HomeBanner | null = null;
  bannerPreviewStyle: any = '';
  isBannerLoading = true;

  constructor(
    private productosService: ProductosService,
    public configService: ConfiguracionService,
    private contentService: ContentService,
    private sanitizer: DomSanitizer
  ) {
    this.recienVistos = this.productosService.obtenerRecienVistos();
    this.categorias = this.productosService.obtenerCategorias();
    this.ofertas = this.productosService.obtenerOfertas();
  }

  obtenerUrlRenderizable(url: string): string {
    if (!url) return '';
    if (url.includes('docs.google.com/uc') || url.includes('drive.google.com/uc')) {
      const match = url.match(/[?&]id=([^&]+)/);
      if (match && match[1]) {
        return `https://lh3.googleusercontent.com/d/${match[1]}`;
      }
    }
    return url;
  }

  ngOnInit() {
    this.contentService.getHomeBanner().subscribe({
      next: (banner) => {
        this.banner = banner;
        if (banner && banner.imagenUrl) {
          const renderUrl = this.obtenerUrlRenderizable(banner.imagenUrl);
          this.bannerPreviewStyle = this.sanitizer.bypassSecurityTrustStyle(`url('${renderUrl}')`);
        } else {
          this.bannerPreviewStyle = '';
        }
        this.isBannerLoading = false;
      },
      error: (err) => {
        console.error('Error al cargar el banner en el home del cliente', err);
        this.isBannerLoading = false;
      }
    });
  }
}
