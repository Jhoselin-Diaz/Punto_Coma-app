import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ClienteLayoutComponent } from '../cliente-layout/cliente-layout.component';
import { DetalleProducto, Producto, ProductosService } from '../../service/productos.service';
import { ConfiguracionService } from '../../service/configuracion.service';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

type TabDetalle = 'detalles' | 'material' | 'envios';

@Component({
  selector: 'app-detalle-producto',
  imports: [ClienteLayoutComponent, RouterLink],
  templateUrl: './detalle-producto.component.html',
  styleUrl: './detalle-producto.component.css'
})
export class DetalleProductoComponent implements OnInit {
  producto?: DetalleProducto;
  relacionados: any[] = [];
  imagenPrincipal = '';
  colorSeleccionado = '';
  cantidad = 1;
  tabActivo: TabDetalle = 'detalles';

  constructor(
    private route: ActivatedRoute,
    private productosService: ProductosService,
    public configService: ConfiguracionService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.cargarProducto(id);
      }
    });
  }

  cargarProducto(id: any) {
    this.productosService.obtenerProductoPorId(id).subscribe({
      next: (p) => {
        this.producto = this.mapProductoToDetalle(p);
        this.imagenPrincipal = this.producto.galeria[0] || '';
        this.colorSeleccionado = this.producto.colores[0]?.nombre || '';
        
        // Cargar recomendados / relacionados
        this.productosService.obtenerProductosPublicos().subscribe({
          next: (todos) => {
            if (p.sugeridosIds && p.sugeridosIds.length > 0) {
              const ids = p.sugeridosIds.map((item: any) => String(item));
              this.relacionados = todos.filter(item => ids.includes(String(item.id)) && String(item.id) !== String(p.id));
            } else {
              this.relacionados = todos.filter(item => String(item.id) !== String(p.id)).slice(0, 4);
            }
            this.cdr.detectChanges();
          },
          error: (err) => {
            console.error('Error al obtener relacionados:', err);
          }
        });

        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al cargar detalle de producto del backend:', err);
      }
    });
  }

  mapProductoToDetalle(p: any): DetalleProducto {
    const mainImage = p.imagenPrincipal || p.imageUrl || '';
    const extraImages = p.miniaturasAdicionales || p.galeriaUrls || [];
    const galeria = [mainImage, ...extraImages].filter(url => !!url);

    const precio = p.precio || 0;
    const precioAnterior = p.precioAnterior || 0;
    const descuentoPct = precioAnterior > precio ? Math.round(((precioAnterior - precio) / precioAnterior) * 100) : 0;
    const descuentoStr = descuentoPct > 0 ? `${descuentoPct}% DSCTO` : '';

    const caracteristicas = p.caracteristicasDestacadas
      ? p.caracteristicasDestacadas.split('.').map((s: string) => s.trim()).filter((s: string) => !!s)
      : ['Elaborado a mano por artesanos locales.', 'Diseño ergonómico y elegante.', 'Resistente a altas temperaturas.'];

    return {
      id: String(p.id),
      nombre: p.nombre,
      precio: precio,
      precioAnterior: precioAnterior,
      imagen: mainImage,
      etiqueta: p.precioAnterior > p.precio ? 'OFERTA' : (p.nuevo || p.esNuevo ? 'NUEVO' : undefined),
      subtitulo: p.subtitulo || 'Edición exclusiva y limitada.',
      categoria: p.categoria || 'Tazas',
      rating: p.rating || 5.0,
      resenas: p.resenas || 12,
      descuento: descuentoStr,
      stock: p.stock > 0 ? `${p.stock} unidades en stock` : 'Agotado',
      capacidad: p.capacidad || '350 ml',
      material: p.material || 'Cerámica Gres',
      aptoPara: p.aptoPara || 'Microondas y Lavavajillas',
      acabado: p.acabado || 'Brillante / Mate',
      diseno: p.diseno || 'Artesanal moderno',
      galeria: galeria,
      colores: [
        {
          nombre: 'Único',
          codigo: '#df6c1b',
          imagen: mainImage
        }
      ],
      descripcion: p.descripcionDetallada || p.descripcion || 'No hay descripción detallada disponible para este producto.',
      caracteristicas: caracteristicas,
      incluye: p.incluye || `1x ${p.nombre}`,
      garantia: p.garantia || 'Garantía de 30 días contra defectos de fabricación.',
      materialDescripcion: 'Nuestras piezas están elaboradas con arcillas de primera calidad y cocidas a altas temperaturas para garantizar su durabilidad y resistencia al uso diario.',
      materialCaracteristicas: [
        'Cerámica cocida a 1200°C',
        'Libre de plomo y metales pesados',
        'Resistente a cambios bruscos de temperatura',
        'Esmaltes aptos para consumo de alimentos'
      ],
      cuidados: [
        'Lavar con esponja suave para conservar el brillo del esmalte.',
        'Apto para microondas en calentamiento moderado.',
        'Evitar caídas o golpes fuertes.',
        'Apto para lavavajillas en ciclo delicado.'
      ],
      envios: [
        'Envíos express en Lima Metropolitana entre 24 a 48 horas.',
        'Envíos a provincias a través de Olva Courier o Shalom.',
        'Todos nuestros paquetes viajan con doble protección contra impactos.'
      ],
      devoluciones: [
        'Aceptamos cambios o devoluciones dentro de los 7 días calendario posteriores a la entrega.',
        'El producto debe estar sin usar y en su embalaje original.',
        'Para iniciar un trámite de devolución, escríbenos por WhatsApp.'
      ]
    };
  }

  seleccionarImagen(imagen: string): void {
    this.imagenPrincipal = imagen;
  }

  seleccionarColor(color: any): void {
    this.colorSeleccionado = color.nombre;
    this.imagenPrincipal = color.imagen;
  }

  cambiarCantidad(valor: number): void {
    this.cantidad = Math.max(1, this.cantidad + valor);
  }

  cambiarTab(tab: TabDetalle): void {
    this.tabActivo = tab;
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
