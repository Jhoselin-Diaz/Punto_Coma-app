import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ClienteLayoutComponent } from '../cliente-layout/cliente-layout.component';
import { DetalleProducto, Producto, ProductosService } from '../../service/productos.service';
import { ConfiguracionService } from '../../service/configuracion.service';
import { CartService } from '../../service/cart.service';
import { ClienteAuthService } from '../../service/cliente-auth.service';
import { ModalAlertaService } from '../../service/modal-alerta.service';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { NgIf } from '@angular/common';

type TabDetalle = 'detalles' | 'material' | 'envios';

@Component({
  selector: 'app-detalle-producto',
  imports: [ClienteLayoutComponent, RouterLink, NgIf],
  templateUrl: './detalle-producto.component.html',
  styleUrl: './detalle-producto.component.css'
})
export class DetalleProductoComponent implements OnInit {
  producto?: DetalleProducto;
  cargando = true;
  productoNoEncontrado = false;
  productoDisponible = true;
  relacionados: any[] = [];
  imagenPrincipal = '';
  colorSeleccionado = '';
  cantidad = 1;
  tabActivo: TabDetalle = 'detalles';
  materialCaracteristicasArray: string[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private productosService: ProductosService,
    public configService: ConfiguracionService,
    private cartService: CartService,
    public clienteAuthService: ClienteAuthService,
    private modalAlertaService: ModalAlertaService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.cargarProducto(id);
      } else {
        this.cargando = false;
        this.productoNoEncontrado = true;
        this.cdr.detectChanges();
      }
    });
  }

  toggleFavorito(producto: any): void {
    if (!producto) return;
    this.clienteAuthService.toggleFavorito(producto);
  }

  esFavorito(id?: number | string): boolean {
    if (!id) return false;
    return this.clienteAuthService.esFavorito(id);
  }

  cargarProducto(id: any) {
    this.cargando = true;
    this.productoNoEncontrado = false;
    this.productoDisponible = true;
    this.producto = undefined;

    this.productosService.obtenerProductoPorId(id).subscribe({
      next: (p) => {
        console.log('Respuesta producto backend:', p);

        if (!p || (typeof p === 'object' && Object.keys(p).length === 0)) {
          this.marcarProductoNoDisponible();
          return;
        }

        // Validación estricta de visibilidad y estado activo (HU0003 - Escenario 2 / CP006)
        const esInactivoOculto = p.visible === false || p.esVisible === false || p.activo === false || p.estado === false || p.estado === 'INACTIVO' || p.estado === 'NO_VISIBLE';
        if (esInactivoOculto) {
          console.warn(`[SEGURIDAD] Producto con ID ${id} no está visible en web o se encuentra inactivo. Bloqueando renderizado.`);
          this.productoDisponible = false;
          this.productoNoEncontrado = true;
          this.producto = undefined;
          this.cargando = false;
          this.cdr.detectChanges();
          return;
        }

        this.productoDisponible = true;
        this.productoNoEncontrado = false;
        this.producto = this.mapProductoToDetalle(p);
        this.imagenPrincipal = this.producto.galeria[0] || '';
        this.colorSeleccionado = this.producto.colores[0]?.nombre || '';
        
        if (p.materialCaracteristicas && p.materialCaracteristicas.trim()) {
          this.materialCaracteristicasArray = p.materialCaracteristicas
            .split('.')
            .map((s: string) => s.trim())
            .filter((s: string) => !!s);
        } else {
          this.materialCaracteristicasArray = [];
        }

        this.cargando = false;
        
        // Cargar recomendados / relacionados
        this.productosService.obtenerProductosPublicos().subscribe({
          next: (resTodos: any) => {
            const todos = Array.isArray(resTodos) ? resTodos : (resTodos && Array.isArray(resTodos.content) ? resTodos.content : []);
            if (p.sugeridosIds && p.sugeridosIds.length > 0) {
              const ids = p.sugeridosIds.map((item: any) => String(item));
              this.relacionados = todos.filter((item: any) => ids.includes(String(item.id)) && String(item.id) !== String(p.id));
            } else {
              this.relacionados = todos.filter((item: any) => String(item.id) !== String(p.id)).slice(0, 4);
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
        console.error('Error al cargar detalle de producto del backend (404/Inactivo):', err);
        this.marcarProductoNoDisponible();
      }
    });
  }

  marcarProductoNoDisponible(): void {
    this.cargando = false;
    this.productoDisponible = false;
    this.productoNoEncontrado = true;
    this.producto = undefined;
    this.cdr.detectChanges();
  }
  irAlCatalogo(): void {
    this.router.navigate(['/productos']);
  }

  mapProductoToDetalle(p: any): DetalleProducto {
    const mainImage = p.imagenPrincipal || p.imageUrl || p.imagen_principal || '';
    const extraImages = p.miniaturasAdicionales || p.galeriaUrls || [];
    const galeria = [mainImage, ...extraImages].filter(url => !!url);

    let precio_original = p.precioOriginal || p.precio_original || p.precioAnterior || p.precio_anterior || p.precio || 0;
    let precio_oferta = p.precioOferta || p.precio_oferta || 0;

    // Fallback si precioAnterior es mayor que precio (por compatibilidad de campos)
    if (precio_oferta === 0 && p.precioAnterior && p.precioAnterior > p.precio) {
      precio_original = p.precioAnterior;
      precio_oferta = p.precio;
    }

    if (precio_oferta >= precio_original) {
      precio_oferta = 0;
    }

    const descuentoPct = precio_oferta > 0 ? Math.round(((precio_original - precio_oferta) / precio_original) * 100) : 0;
    const descuentoStr = descuentoPct > 0 ? `${descuentoPct}% DSCTO` : '';

    const etiqueta = precio_oferta > 0 ? 'OFERTA' : (p.nuevo || p.esNuevo ? 'NUEVO' : undefined);

    const caracteristicas = p.caracteristicasDestacadas
      ? p.caracteristicasDestacadas.split('.').map((s: string) => s.trim()).filter((s: string) => !!s)
      : ['Elaborado a mano por artesanos locales.', 'Diseño ergonómico y elegante.', 'Resistente a altas temperaturas.'];

    const rawMatSpecs = p.materialCaracteristicas || p.material_caracteristicas || '';
    const matSpecs = rawMatSpecs
      ? rawMatSpecs.split('.').map((s: string) => s.trim()).filter((s: string) => !!s)
      : [
          'Cerámica cocida a 1200°C',
          'Libre de plomo y metales pesados',
          'Resistente a cambios bruscos de temperatura',
          'Esmaltes aptos para consumo de alimentos'
        ];

    const numStock = p.stock !== undefined && p.stock !== null ? Number(p.stock) : 0;

    return {
      id: String(p.id),
      nombre: p.nombre,
      precio: precio_oferta > 0 ? precio_oferta : precio_original,
      precioAnterior: precio_original,
      precio_original: precio_original,
      precio_oferta: precio_oferta,
      imagen: mainImage,
      etiqueta: etiqueta,
      subtitulo: p.subtitulo || 'Edición exclusiva y limitada.',
      categoria: p.categoria || 'Tazas',
      rating: p.rating || 5.0,
      resenas: p.resenas || 12,
      descuento: descuentoStr,
      stock: numStock > 0 ? `${numStock} unidades en stock` : 'Agotado (Sin stock)',
      stockNumero: numStock,
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
      materialCaracteristicas: matSpecs,
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
      ],
      materialIntro: p.material_intro || p.materialIntro || '',
      materialCuidados: p.material_cuidados || p.materialCuidados || '',
      material_intro: p.material_intro || p.materialIntro || '',
      material_cuidados: p.material_cuidados || p.materialCuidados || '',
      material_caracteristicas: p.material_caracteristicas || p.materialCaracteristicas || '',
      apto_microondas: p.apto_microondas !== undefined ? p.apto_microondas : (p.aptoMicroondas || false),
      apto_lavavajillas: p.apto_lavavajillas !== undefined ? p.apto_lavavajillas : (p.aptoLavavajillas || false),
      resiste_choque_termico: p.resiste_choque_termico !== undefined ? p.resiste_choque_termico : (p.resisteChoqueTermico || false),
      limpieza_suave: p.limpieza_suave !== undefined ? p.limpieza_suave : (p.limpiezaSuave || false),
      prohibido_fuego_directo: p.prohibido_fuego_directo !== undefined ? p.prohibido_fuego_directo : (p.prohibidoFuegoDirecto || false),
      apto_temperaturas: p.apto_temperaturas !== undefined ? p.apto_temperaturas : (p.aptoTemperaturas || false),
      grado_alimentario: p.grado_alimentario !== undefined ? p.grado_alimentario : (p.gradoAlimentario || false),
      evitar_abrasivos: p.evitar_abrasivos !== undefined ? p.evitar_abrasivos : (p.evitarAbrasivos || false),
      control_humedad: p.control_humedad !== undefined ? p.control_humedad : (p.controlHumedad || false),
      lavado_mano: p.lavado_mano !== undefined ? p.lavado_mano : (p.lavadoMano || false)
    };
  }

  seleccionarImagen(imagen: string): void {
    this.imagenPrincipal = imagen;
  }

  seleccionarColor(color: any): void {
    this.colorSeleccionado = color.nombre;
    this.imagenPrincipal = color.imagen;
  }

  get tieneStock(): boolean {
    if (!this.producto) return false;
    return (this.producto.stockNumero ?? 0) > 0;
  }

  agregarAlCarrito(): void {
    if (!this.producto || !this.productoDisponible || !this.tieneStock) {
      this.modalAlertaService.warning('Este producto no tiene unidades disponibles en este momento.', 'Producto Agotado');
      return;
    }
    for (let i = 0; i < this.cantidad; i++) {
      this.cartService.addItem({
        id: this.producto.id,
        nombre: this.producto.nombre,
        precio: this.producto.precio,
        imagenPrincipal: this.imagenPrincipal || this.producto.imagen,
        stock: this.producto.stockNumero
      });
    }
    this.modalAlertaService.success(`Se agregaron ${this.cantidad} ${this.cantidad === 1 ? 'unidad' : 'unidades'} de "${this.producto.nombre}" al carrito.`, '¡Agregado al carrito!');
  }

  cambiarCantidad(valor: number): void {
    if (!this.tieneStock) return;
    const max = this.producto?.stockNumero ?? 99;
    this.cantidad = Math.min(max, Math.max(1, this.cantidad + valor));
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
