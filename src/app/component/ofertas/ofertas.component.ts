import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ClienteLayoutComponent } from '../cliente-layout/cliente-layout.component';
import { ProductosService } from '../../service/productos.service';
import { ConfiguracionService } from '../../service/configuracion.service';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-ofertas',
  standalone: true,
  imports: [CommonModule, RouterLink, ClienteLayoutComponent],
  templateUrl: './ofertas.component.html',
  styleUrl: './ofertas.component.css'
})
export class OfertasComponent implements OnInit {
  productosEnOferta: any[] = [];
  cargando = true;

  constructor(
    private productosService: ProductosService,
    public configService: ConfiguracionService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit() {
    this.cargando = true;
    this.productosService.obtenerProductosPublicos().subscribe({
      next: (data) => {
        const hoy = new Date().toISOString().split('T')[0];
        
        this.productosEnOferta = data.filter((p: any) => {
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

        this.cargando = false;
      },
      error: (err) => {
        console.error('Error al obtener ofertas públicas:', err);
        this.cargando = false;
      }
    });
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
    if (!url) return '';
    if (!url.includes('drive.google.com') && !url.includes('docs.google.com') && !url.includes('googleusercontent.com')) {
      return this.sanitizer.bypassSecurityTrustUrl(url);
    }
    const fileId = this.extraerGoogleDriveId(url);
    const previewUrl = this.obtenerGoogleDrivePreviewUrl(fileId);
    return this.sanitizer.bypassSecurityTrustUrl(previewUrl);
  }
}
