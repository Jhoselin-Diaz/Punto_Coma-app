import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminLayoutComponent } from '../admin-layout/admin-layout.component';

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
export class AdminContenidoWebComponent {
  // Sección activa principal
  seccionActiva: SubSeccion = 'main';

  // Sub-tabs de la sección Inicio
  inicioTabActiva: InicioTab = 'banner';

  // --- MODALES Y SUS PESTAÑAS ---
  showAddProductModal = false;
  showEditProductModal = false;
  addProductModalTab: ProductModalTab = 'general';
  editProductModalTab: ProductModalTab = 'general';

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
    caracteristicas: ''
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
      caracteristicas: ''
    };
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
      imagenPrincipal: 'images/prod-' + (prod.id.includes('verde') ? 'verde' : prod.id.includes('rosa') ? 'rosa-grande' : prod.id.includes('ondulado') ? 'ondulado' : prod.id.includes('iridiscente') ? 'iridiscente' : 'jaspeada') + '.png',
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
}
