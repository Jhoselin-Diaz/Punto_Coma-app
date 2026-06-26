import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ClienteLayoutComponent } from '../cliente-layout/cliente-layout.component';
import { ProductosService } from '../../service/productos.service';
import { ConfiguracionService } from '../../service/configuracion.service';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-productos',
  imports: [ClienteLayoutComponent, RouterLink],
  templateUrl: './productos.component.html',
  styleUrl: './productos.component.css'
})
export class ProductosComponent implements OnInit {
  productos: any[] = [];
  cargando = true;

  constructor(
    private productosService: ProductosService,
    public configService: ConfiguracionService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit() {
    this.cargando = true;
    this.productosService.obtenerProductosPublicos().subscribe({
      next: (res: any) => {
        const data = Array.isArray(res) ? res : (res && Array.isArray(res.content) ? res.content : []);
        this.productos = data.filter((p: any) => p.visible !== false && p.activo !== false);
        this.cargando = false;
      },
      error: (err) => {
        console.error('Error al obtener productos públicos:', err);
        this.cargando = false;
      }
    });
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
    if (!url) return '';
    if (!url.includes('drive.google.com') && !url.includes('docs.google.com') && !url.includes('googleusercontent.com')) {
      return this.sanitizer.bypassSecurityTrustUrl(url);
    }
    const fileId = this.extraerGoogleDriveId(url);
    const previewUrl = this.obtenerGoogleDrivePreviewUrl(fileId);
    return this.sanitizer.bypassSecurityTrustUrl(previewUrl);
  }
}
