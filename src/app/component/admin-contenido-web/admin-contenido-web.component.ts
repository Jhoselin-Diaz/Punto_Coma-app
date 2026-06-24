

import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminLayoutComponent } from '../admin-layout/admin-layout.component';
import { ProductosService } from '../../service/productos.service';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

declare var gapi: any;
declare var google: any;

// =========================================================================
// CONFIGURACIÓN DE CREDENCIALES DE GOOGLE API
// Reemplaza estas constantes con tus valores obtenidos de Google Cloud Console:
// =========================================================================
export const GOOGLE_DEVELOPER_KEY = 'AIzaSyD5ZBrYA5bMkL4Ds8IzHV4pXhk0gpDsSss';
export const GOOGLE_CLIENT_ID = '898823253296-uf76fpr6sr435blefbiuongo09g6fk4m.apps.googleusercontent.com';


interface CategoriaDestacada {
  id: number;
  nombre: string;
  imagen: string;
  productosCount: number;
  visible: boolean;
  orden: number;
}

interface ProductoDestacado {
  id: string;
  nombre: string;
  precio: number;
  imagen: string;
  tags: string[];
  seleccionado: boolean;
}

interface VideoRow {
  id: string;
  platform: 'TikTok' | 'Instagram' | 'YouTube Shorts';
  title: string;
  thumbnail: string;
  productsCount: number;
  visible: boolean;
  views?: string;
  likes?: string;
  clicks?: string;
  description?: string;
  url?: string;
}

interface OfertaAdmin {
  id: number;
  producto: string;
  precioOriginal: number;
  precioOferta: number;
  descuento: number; // Porcentaje auto-calculado
  fechaInicio: string;
  fechaFin: string;
  visible: boolean;
  banner?: string;
}

interface ContactoBlock {
  id: string;
  title: string;
  description: string;
  icon: 'whatsapp' | 'instagram' | 'support' | 'email' | 'info';
  btnText: string;
  btnLink: string;
  visible: boolean;
}

type SubSeccion = 'main' | 'inicio' | 'productos' | 'ofertas' | 'shop-video' | 'contacto';
type InicioTab = 'banner' | 'categorias' | 'productos' | 'config';
type ProductModalTab = 'general' | 'imagenes' | 'descripcion' | 'relacionados';

@Component({
  selector: 'app-admin-contenido-web',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminLayoutComponent],
  templateUrl: './admin-contenido-web.component.html',
  styleUrl: './admin-contenido-web.component.css'
})
export class AdminContenidoWebComponent implements OnInit {
  // Sección activa principal
  seccionActiva: SubSeccion = 'main';

  // Sub-tabs de la sección Inicio
  inicioTabActiva: InicioTab = 'banner';

  // --- MODALES Y SUS PESTAÑAS ---
  showAddProductModal = false;
  showEditProductModal = false;
  addProductModalTab: ProductModalTab = 'general';
  editProductModalTab: ProductModalTab = 'general';
  archivoImagen: File | null = null;
  imagenTemporalUrl: SafeUrl | string = '';

  // Google Picker Configurations
  developerKey = GOOGLE_DEVELOPER_KEY; // Asignado desde constante superior
  clientId = GOOGLE_CLIENT_ID;       // Asignado desde constante superior
  oauthToken = '';
  pickerApiLoaded = false;
  miniaturasTemp: any[] = ['', '', ''];
  miniaturasUrls: string[] = ['', '', ''];

  showAddOfferModal = false;
  showEditOfferModal = false;

  showAddVideoModal = false;
  showEditVideoModal = false;

  showBlockModal = false;
  showWaBottomModal = false;

  // --- SECCIÓN 1: INICIO ---
  // Banner Principal
  bannerTitle = '';
  bannerSubtitle = '';
  bannerBtnText = '';
  bannerBtnLink = '';
  bannerImage = '';
  bannerVisible = true;

  // Categorías Destacadas (Inicio) - Visual Cards Aesthetic
  categorias: CategoriaDestacada[] = [];

  // Productos Destacados en Inicio
  productosDestacados: ProductoDestacado[] = [];

  // Configuración Visual
  configAnimaciones = true;
  configCarrusel = false;
  configMostrarOfertas = true;
  configCategoriasPopulares = true;

  // --- SECCIÓN 2: PRODUCTOS ---
  searchTerm = '';
  filtroActivo: 'todos' | 'visibles' | 'ocultos' | 'oferta' | 'nuevos' = 'todos';

  productosAdmin: any[] = [];

  // Formulario AGREGAR PRODUCTO (Vacio)
  newProduct = {
    nombre: '',
    precio: null as number | null,
    precioOferta: null as number | null,
    stock: null as number | null,
    categoria: 'Tazas',
    visible: true,
    destacado: false,
    nuevo: true,
    imagenPrincipal: '',
    descripcionCorta: '',
    descripcionLarga: '',
    caracteristicas: '',
    sugeridosIds: [] as number[]
  };

  // Formulario EDITAR PRODUCTO (Precargado)
  editingProduct = {
    id: '',
    nombre: '',
    precio: 0,
    precioOferta: 0,
    stock: 0,
    categoria: 'Tazas',
    visible: true,
    destacado: false,
    nuevo: false,
    imagenPrincipal: '',
    descripcionCorta: '',
    descripcionLarga: '',
    caracteristicas: ''
  };

  // --- SECCIÓN 3: OFERTAS ---
  statsOfertas = {
    activas: 0,
    productosDescuento: 0,
    proximas: 0
  };

  ofertasList: OfertaAdmin[] = [];

  // Formulario AGREGAR OFERTA
  newOffer: OfertaAdmin = {
    id: 0,
    producto: '',
    precioOriginal: 0,
    precioOferta: 0,
    descuento: 0,
    fechaInicio: '',
    fechaFin: '',
    visible: true,
    banner: ''
  };

  // Formulario EDITAR OFERTA
  editingOffer: OfertaAdmin = {
    id: 0,
    producto: '',
    precioOriginal: 0,
    precioOferta: 0,
    descuento: 0,
    fechaInicio: '',
    fechaFin: '',
    visible: true,
    banner: ''
  };

  // --- SECCIÓN 4: SHOP VIDEO ---
  videosAdmin: VideoRow[] = [];

  // Formulario AGREGAR SHOP VIDEO (Vacio)
  newVideo = {
    title: '',
    description: '',
    url: '',
    platform: 'TikTok' as 'TikTok' | 'Instagram' | 'YouTube Shorts',
    thumbnail: '',
    visible: true
  };

  // Formulario EDITAR SHOP VIDEO (Precargado con estadísticas)
  editingVideo = {
    id: '',
    title: '',
    description: '',
    url: '',
    platform: 'TikTok' as 'TikTok' | 'Instagram' | 'YouTube Shorts',
    thumbnail: '',
    productsCount: 0,
    visible: true,
    // Estadísticas
    views: '0',
    likes: '0',
    clicks: '0'
  };

  // --- SECCIÓN 5: CONTACTO POR BLOQUES INDIVIDUALES ---
  contactoBlocks: ContactoBlock[] = [
    {
      id: 'block-wa',
      title: '',
      description: '',
      icon: 'whatsapp',
      btnText: '',
      btnLink: 'https://wa.me/',
      visible: true
    },
    {
      id: 'block-ig',
      title: '',
      description: '',
      icon: 'instagram',
      btnText: '',
      btnLink: 'https://instagram.com/',
      visible: true
    },
    {
      id: 'block-support',
      title: '',
      description: '',
      icon: 'support',
      btnText: '',
      btnLink: '',
      visible: true
    },
    {
      id: 'block-email',
      title: '',
      description: '',
      icon: 'email',
      btnText: '',
      btnLink: 'mailto:',
      visible: true
    },
    {
      id: 'block-info',
      title: '',
      description: '',
      icon: 'info',
      btnText: '',
      btnLink: '',
      visible: true
    }
  ];

  // Botón final de WhatsApp
  contactoWaBottom = {
    btnText: '',
    number: '',
    message: '',
    visible: true
  };

  // Objetos para edición de contacto
  editingBlock: ContactoBlock = {
    id: '',
    title: '',
    description: '',
    icon: 'whatsapp',
    btnText: '',
    btnLink: '',
    visible: true
  };

  editingWaBottom = {
    btnText: '',
    number: '',
    message: '',
    visible: true
  };

  // --- MÉTODOS DE CÁLCULO ---
  getDescuentoPorcentaje(original: number | null, oferta: number | null): number {
    if (!original || !oferta || original <= 0) return 0;
    const diff = original - oferta;
    return Math.max(0, Math.round((diff * 100) / original));
  }

  // --- MÉTODOS DE CONTROL ---
  navegarA(seccion: SubSeccion) {
    this.seccionActiva = seccion;
  }

  setInicioTab(tab: InicioTab) {
    this.inicioTabActiva = tab;
  }

  setAddProductModalTab(tab: ProductModalTab) {
    this.addProductModalTab = tab;
  }

  setEditProductModalTab(tab: ProductModalTab) {
    this.editProductModalTab = tab;
  }

  toggleVisible(item: { visible: boolean }) {
    item.visible = !item.visible;
  }

  toggleDestacado(item: { destacado: boolean }) {
    item.destacado = !item.destacado;
  }

  toggleSeleccionado(item: ProductoDestacado) {
    item.seleccionado = !item.seleccionado;
  }

  // --- CONTROL MODALES ---
  openAddProduct() {
    this.addProductModalTab = 'general';
    // Inicializar vacio
    this.newProduct = {
      nombre: '',
      precio: null,
      precioOferta: null,
      stock: null,
      categoria: 'Tazas',
      visible: true,
      destacado: false,
      nuevo: true,
      imagenPrincipal: '',
      descripcionCorta: '',
      descripcionLarga: '',
      caracteristicas: '',
      sugeridosIds: []
    };
    this.archivoImagen = null;
    this.imagenTemporalUrl = '';
    this.miniaturasTemp = ['', '', ''];
    this.miniaturasUrls = ['', '', ''];
    this.showAddProductModal = true;
  }

  openEditProduct(prod: any) {
    this.editProductModalTab = 'general';
    // Precargar datos
    this.editingProduct = {
      id: prod.id,
      nombre: prod.nombre,
      precio: prod.precio,
      precioOferta: Math.round(prod.precio * 0.8), // Ficticio
      stock: prod.stock,
      categoria: 'Tazas',
      visible: prod.visible,
      destacado: prod.destacado,
      nuevo: false,
      imagenPrincipal: prod.imagenPrincipal || prod.imageUrl || 'images/prod-' + (prod.nombre.toLowerCase().includes('verde') ? 'verde' : prod.nombre.toLowerCase().includes('rosa') ? 'rosa-grande' : prod.nombre.toLowerCase().includes('ondulado') ? 'ondulado' : prod.nombre.toLowerCase().includes('iridiscente') ? 'iridiscente' : 'jaspeada') + '.png',
      descripcionCorta: 'Taza artesanal de altísima calidad.',
      descripcionLarga: 'Hermosa pieza elaborada por artesanos locales de forma meticulosa. Su diseño orgánico brinda máxima comodidad.',
      caracteristicas: 'Apta para lavavajillas. Resistente a altas temperaturas.'
    };
    this.showEditProductModal = true;
  }

  openAddOffer() {
    this.newOffer = {
      id: 0,
      producto: 'Taza de vidrio verde',
      precioOriginal: 45,
      precioOferta: 35,
      descuento: 22,
      fechaInicio: '2026-05-20',
      fechaFin: '2026-06-20',
      visible: true,
      banner: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=2874&auto=format&fit=crop'
    };
    this.showAddOfferModal = true;
  }

  openEditOffer(of: OfertaAdmin) {
    this.editingOffer = { ...of };
    this.showEditOfferModal = true;
  }

  openAddVideo() {
    this.newVideo = {
      title: '',
      description: '',
      url: '',
      platform: 'TikTok',
      thumbnail: 'https://images.unsplash.com/photo-1511556532299-8f662fc26c06?q=80&w=2940&auto=format&fit=crop',
      visible: true
    };
    this.showAddVideoModal = true;
  }

  openEditVideo(vid: VideoRow) {
    this.editingVideo = {
      id: vid.id,
      title: vid.title,
      description: vid.description || 'Video de demostración de productos.',
      url: vid.url || 'https://www.tiktok.com/',
      platform: vid.platform,
      thumbnail: vid.thumbnail,
      productsCount: vid.productsCount,
      visible: vid.visible,
      views: vid.views || '12,450',
      likes: vid.likes || '1,890',
      clicks: vid.clicks || '432'
    };
    this.showEditVideoModal = true;
  }

  openEditBlock(block: ContactoBlock) {
    this.editingBlock = { ...block };
    this.showBlockModal = true;
  }

  saveBlock() {
    const idx = this.contactoBlocks.findIndex(b => b.id === this.editingBlock.id);
    if (idx !== -1) {
      this.contactoBlocks[idx] = { ...this.editingBlock };
    }
    this.showBlockModal = false;
  }

  openEditWaBottom() {
    this.editingWaBottom = { ...this.contactoWaBottom };
    this.showWaBottomModal = true;
  }

  saveWaBottom() {
    this.contactoWaBottom = { ...this.editingWaBottom };
    this.showWaBottomModal = false;
  }

  alertPreview() {
    alert('¡Vista previa generada con éxito! Has sido redirigido temporalmente a la tienda online del cliente.');
  }

  eliminarFila(array: any[], index: number) {
    array.splice(index, 1);
  }

  constructor(
    private productosService: ProductosService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.cargarProductos();
    this.loadGooglePicker();
  }

  loadGooglePicker() {
    // Dynamic load of Google APIs
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => {
      // Cargar el módulo 'picker' como lo especifica la API oficial de Google
      gapi.load('picker', () => {
        this.pickerApiLoaded = true;
        console.log("Picker listo - Google Picker API cargada con éxito.");
      });
    };
    document.head.appendChild(script);

    const gsiScript = document.createElement('script');
    gsiScript.src = 'https://accounts.google.com/gsi/client';
    gsiScript.onload = () => {
      console.log("Google Identity Services (GIS) cargada con éxito.");
    };
    document.head.appendChild(gsiScript);
  }

  abrirPicker(tipo: 'principal' | 'miniatura1' | 'miniatura2' | 'miniatura3') {
    if (!this.oauthToken) {
      // Iniciar el cliente de tokens
      try {
        const client = google.accounts.oauth2.initTokenClient({
          client_id: this.clientId || 'YOUR_CLIENT_ID.apps.googleusercontent.com',
          scope: 'https://www.googleapis.com/auth/drive.readonly',
          callback: (response: any) => {
            if (response.error !== undefined) {
              console.error(response);
              return;
            }
            this.oauthToken = response.access_token;
            this.createPicker(tipo);
          },
        });
        client.requestAccessToken({ prompt: 'consent' });
      } catch (err) {
        console.warn('Google GSI Token Client initialization failed, using URL fallback.', err);
        this.fallbackUrlPrompt(tipo);
      }
    } else {
      this.createPicker(tipo);
    }
  }

  createPicker(tipo: 'principal' | 'miniatura1' | 'miniatura2' | 'miniatura3') {
    const isGooglePickerAvailable = typeof window !== 'undefined' && (window as any).google && (window as any).google.picker;
    const isGapiPickerAvailable = typeof window !== 'undefined' && (window as any).gapi && (window as any).gapi.picker;

    if (this.pickerApiLoaded && this.oauthToken && (isGooglePickerAvailable || isGapiPickerAvailable)) {
      try {
        const pickerNamespace = isGooglePickerAvailable ? (window as any).google.picker : (window as any).gapi.picker;
        console.log("Picker listo - Objeto de picker disponible:", pickerNamespace);

        const view = new pickerNamespace.View(pickerNamespace.ViewId.DOCS);
        view.setMimeTypes('image/png,image/jpeg,image/jpg,image/webp,image/gif');

        const picker = new pickerNamespace.PickerBuilder()
          .enableFeature(pickerNamespace.Feature.NAV_HIDDEN)
          .setDeveloperKey(this.developerKey || 'YOUR_DEVELOPER_KEY')
          .setAppId(this.clientId ? this.clientId.split('-')[0] : 'YOUR_APP_ID')
          .setOAuthToken(this.oauthToken)
          .addView(view)
          .setCallback((data: any) => {
            if (data.action === pickerNamespace.Action.PICKED) {
              const doc = data.docs[0];
              const fileId = doc[pickerNamespace.Document.ID] || doc.id;
              const publicUrl = this.obtenerGoogleDrivePreviewUrl(fileId);
              this.handlePickerUrl(tipo, publicUrl);
            }
          })
          .build();
        picker.setVisible(true);
      } catch (err) {
        console.error('Error al crear Google Picker:', err);
        this.fallbackUrlPrompt(tipo);
      }
    } else {
      console.warn('Google Picker API no está cargada completamente o falta token. Usando fallback.');
      this.fallbackUrlPrompt(tipo);
    }
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
    // Usar la API de renderizado alternativo de Google Drive para evitar restricciones de cookies y CORS
    return `https://lh3.googleusercontent.com/d/${id}`;
  }

  fallbackUrlPrompt(tipo: 'principal' | 'miniatura1' | 'miniatura2' | 'miniatura3') {
    const input = prompt('Ingresa la URL de la imagen de Google Drive o el ID del archivo:');
    if (input) {
      const fileId = this.extraerGoogleDriveId(input);
      const publicUrl = this.obtenerGoogleDrivePreviewUrl(fileId);
      this.handlePickerUrl(tipo, publicUrl);
    }
  }

  handlePickerUrl(tipo: 'principal' | 'miniatura1' | 'miniatura2' | 'miniatura3', url: string) {
    const safeUrl = this.sanitizer.bypassSecurityTrustUrl(url);
    if (tipo === 'principal') {
      this.imagenTemporalUrl = safeUrl;
      this.newProduct.imagenPrincipal = url;
      (this.newProduct as any).imagenUrl = url;
    } else if (tipo === 'miniatura1') {
      this.miniaturasTemp[0] = safeUrl;
      this.miniaturasUrls[0] = url;
    } else if (tipo === 'miniatura2') {
      this.miniaturasTemp[1] = safeUrl;
      this.miniaturasUrls[1] = url;
    } else if (tipo === 'miniatura3') {
      this.miniaturasTemp[2] = safeUrl;
      this.miniaturasUrls[2] = url;
    }
    // Forzar la detección de cambios para renderizado inmediato en el DOM
    this.cdr.detectChanges();
  }

  removeMiniatura(index: number, event: Event) {
    event.stopPropagation();
    this.miniaturasTemp[index] = '';
    this.miniaturasUrls[index] = '';
    // Forzar la detección de cambios para renderizado inmediato en el DOM
    this.cdr.detectChanges();
  }

  cargarProductos() {
    this.productosService.obtenerTodosBackend().subscribe({
      next: (data) => {
        this.productosAdmin = data;
      },
      error: (err) => {
        console.error('Error al cargar productos del backend:', err);
      }
    });
  }

  eliminarProducto(id: any) {
    if (confirm('¿Estás seguro de que deseas eliminar este producto? Esta acción no se puede deshacer.')) {
      this.productosService.eliminarProducto(id).subscribe({
        next: () => {
          alert('¡Producto eliminado exitosamente!');
          this.cargarProductos();
        },
        error: (err) => {
          console.error('Error al eliminar el producto:', err);
          alert('Ocurrió un error al intentar eliminar el producto.');
        }
      });
    }
  }

  toggleSugerido(id: any) {
    if (!this.newProduct.sugeridosIds) {
      this.newProduct.sugeridosIds = [];
    }
    const idx = this.newProduct.sugeridosIds.indexOf(id);
    if (idx === -1) {
      this.newProduct.sugeridosIds.push(id);
    } else {
      this.newProduct.sugeridosIds.splice(idx, 1);
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      this.handleImageFile(file);
    }
  }

  onFileSelected(event: any) {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      this.handleImageFile(file);
    }
  }

  handleImageFile(file: File) {
    if (file.type.startsWith('image/')) {
      this.archivoImagen = file;
      const objectUrl = URL.createObjectURL(file);
      this.imagenTemporalUrl = this.sanitizer.bypassSecurityTrustUrl(objectUrl);
      this.newProduct.imagenPrincipal = objectUrl;
      (this.newProduct as any).imagenUrl = objectUrl;
      // Forzar la detección de cambios para renderizado inmediato en el DOM
      this.cdr.detectChanges();
    } else {
      alert('Por favor selecciona un archivo de imagen válido.');
    }
  }

  removeImage(event: Event) {
    event.stopPropagation();
    this.archivoImagen = null;
    this.imagenTemporalUrl = '';
    this.newProduct.imagenPrincipal = '';
    (this.newProduct as any).imagenUrl = '';
    // Forzar la detección de cambios para renderizado inmediato en el DOM
    this.cdr.detectChanges();
  }

  guardarNuevoProducto() {
    if (!this.newProduct.nombre || this.newProduct.precio === null) {
      alert('Por favor complete los campos obligatorios: Nombre y Precio.');
      return;
    }

    const galUrls = this.miniaturasUrls.filter(url => !!url);
    const imgPrincipal = this.newProduct.imagenPrincipal || 'images/prod-jaspeada.png';

    const payload = {
      nombre: this.newProduct.nombre,
      precio: this.newProduct.precio,
      stock: this.newProduct.stock || 0,
      categoria: this.newProduct.categoria,
      activo: this.newProduct.visible,
      imageUrl: imgPrincipal,
      imagenPrincipal: imgPrincipal,
      imagenUrl: imgPrincipal, // Send both as requested
      descripcion: this.newProduct.descripcionCorta,
      descripcionDetallada: this.newProduct.descripcionLarga,
      caracteristicasDestacadas: this.newProduct.caracteristicas,
      subtitulo: this.newProduct.nombre,
      precioAnterior: this.newProduct.precio ? this.newProduct.precio * 1.25 : 0.0,
      rating: 5.0,
      resenas: 0,
      sugeridosIds: this.newProduct.sugeridosIds || [],
      miniaturasAdicionales: galUrls, // Arreglo de enlaces públicos de Drive
      galeriaUrls: galUrls
    };

    if (this.archivoImagen) {
      const formData = new FormData();
      formData.append('imagen', this.archivoImagen);
      formData.append('producto', JSON.stringify(payload));

      this.productosService.crearProducto(formData).subscribe({
        next: (res) => {
          console.log('¡Producto guardado exitosamente en el backend (Multipart)!', res);
          alert('¡Producto guardado exitosamente!');
          this.showAddProductModal = false;
          this.cargarProductos();
        },
        error: (err) => {
          console.error('Error al guardar el producto (Multipart):', err);
          alert('Ocurrió un error al guardar el producto.');
        }
      });
    } else {
      this.productosService.crearProducto(payload).subscribe({
        next: (res) => {
          console.log('¡Producto guardado exitosamente en el backend (JSON)!', res);
          alert('¡Producto guardado exitosamente!');
          this.showAddProductModal = false;
          this.cargarProductos();
        },
        error: (err) => {
          console.error('Error al guardar el producto (JSON):', err);
          alert('Ocurrió un error al guardar el producto.');
        }
      });
    }
  }
}
