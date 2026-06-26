import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ClienteLayoutComponent } from '../cliente-layout/cliente-layout.component';
import { ConfiguracionService } from '../../service/configuracion.service';
import { ShopVideoService } from '../../service/shop-video.service';
import { ProductosService } from '../../service/productos.service';

interface Product {
  id: string;
  nombre: string;
  precio: number;
  precioAnterior: number;
  imagen: string;
}

interface VideoRow {
  id: number;
  titulo: string;
  descripcion: string;
  videoUrl: string;
  urlSegura: SafeResourceUrl;
  platform: string;
  likes: string;
  views: string;
  clicks: string;
  productos: Product[];
}

@Component({
  selector: 'app-shop-video',
  standalone: true,
  imports: [CommonModule, RouterLink, ClienteLayoutComponent],
  templateUrl: './shop-video.component.html',
  styleUrl: './shop-video.component.css'
})
export class ShopVideoComponent implements OnInit {
  videos: VideoRow[] = [];
  productosDisponibles: any[] = [];
  cargando = true;

  constructor(
    public configService: ConfiguracionService,
    private shopVideoService: ShopVideoService,
    private productosService: ProductosService,
    private sanitizer: DomSanitizer
  ) { }

  ngOnInit() {
    this.cargarDatos();
  }

  cargarDatos() {
    this.cargando = true;
    this.productosService.obtenerProductosPublicos().subscribe({
      next: (resProducts: any) => {
        const products = Array.isArray(resProducts) ? resProducts : (resProducts && Array.isArray(resProducts.content) ? resProducts.content : []);
        this.productosDisponibles = products;

        this.shopVideoService.obtenerPublicos().subscribe({
          next: (resVideos: any) => {
            const videosData = Array.isArray(resVideos) ? resVideos : (resVideos && Array.isArray(resVideos.content) ? resVideos.content : []);
            this.videos = videosData.map((v: any) => {
              // Resolve products
              const linkedProducts = (v.productosIds || [])
                .map((id: any) => this.productosDisponibles.find((p: any) => p.id === id))
                .filter((p: any) => !!p)
                .map((p: any) => ({
                  id: p.id ? p.id.toString() : '',
                  nombre: p.nombre,
                  precio: p.precio,
                  precioAnterior: p.precioOriginal || p.precioAnterior || p.precio || 0,
                  imagen: this.obtenerImagenUrl(p.imagenPrincipal || p.imageUrl || 'images/prod-jaspeada.png')
                }));

              const embedUrl = this.obtenerEmbedUrl(v.videoUrl);
              const urlSegura = this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);

              return {
                id: v.id ? v.id : 0,
                titulo: v.titulo,
                descripcion: v.descripcion || '',
                videoUrl: v.videoUrl,
                urlSegura: urlSegura,
                platform: v.plataforma,
                likes: v.likes || '0',
                views: v.views || '0',
                clicks: v.clicks || '0',
                productos: linkedProducts
              };
            });
            this.cargando = false;
          },
          error: (err) => {
            console.error('Error al cargar videos públicos:', err);
            this.cargando = false;
          }
        });
      },
      error: (err) => {
        console.error('Error al cargar productos públicos:', err);
        this.cargando = false;
      }
    });
  }

  obtenerEmbedUrl(url: string): string {
    if (!url) return '';
    let cleanUrl = url.trim().split('?')[0];

    // TikTok
    if (cleanUrl.includes('tiktok.com')) {
      const match = cleanUrl.match(/\/video\/([0-9]{19})/) || cleanUrl.match(/\/video\/([0-9]+)/);
      if (match) {
        return `https://www.tiktok.com/embed/v2/${match[1]}`;
      }
    }

    // Instagram
    if (cleanUrl.includes('instagram.com/reel/') || cleanUrl.includes('instagram.com/p/')) {
      let baseUrl = cleanUrl.replace(/\/captioned\/?$/, '');
      baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      if (!baseUrl.endsWith('/embed')) {
        baseUrl = `${baseUrl}/embed`;
      }
      return `${baseUrl}/`;
    }

    // YouTube Shorts / standard YouTube
    if (cleanUrl.includes('youtube.com/shorts/')) {
      const match = cleanUrl.match(/\/shorts\/([a-zA-Z0-9_-]+)/);
      if (match) {
        return `https://www.youtube.com/embed/${match[1]}`;
      }
    }
    if (cleanUrl.includes('youtube.com/watch')) {
      const match = url.match(/[?&]v=([a-zA-Z0-9_-]+)/);
      if (match) {
        return `https://www.youtube.com/embed/${match[1]}`;
      }
    }
    if (cleanUrl.includes('youtu.be/')) {
      const match = cleanUrl.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
      if (match) {
        return `https://www.youtube.com/embed/${match[1]}`;
      }
    }

    return cleanUrl;
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

  obtenerImagenUrl(url: string): string {
    if (!url) return '';
    if (!url.includes('drive.google.com') && !url.includes('docs.google.com') && !url.includes('googleusercontent.com')) {
      return url;
    }
    const fileId = this.extraerGoogleDriveId(url);
    return this.obtenerGoogleDrivePreviewUrl(fileId);
  }
}
