import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductosService } from '../../../service/productos.service';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

declare var gapi: any;
declare var google: any;

export const GOOGLE_DEVELOPER_KEY = 'AIzaSyD5ZBrYA5bMkL4Ds8IzHV4pXhk0gpDsSss';
export const GOOGLE_CLIENT_ID = '898823253296-uf76fpr6sr435blefbiuongo09g6fk4m.apps.googleusercontent.com';

interface ProductoDestacado {
  id: string;
  nombre: string;
  precio: number;
  imagen: string;
  tags: string[];
  seleccionado: boolean;
}

type ProductModalTab = 'general' | 'imagenes' | 'descripcion' | 'relacionados';

@Component({
  selector: 'app-admin-productos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-productos.component.html',
  styleUrl: './admin-productos.component.css'
})
export class AdminProductosComponent implements OnInit {
  showAddProductModal = false;
  showEditProductModal = false;
  addProductModalTab: ProductModalTab = 'general';
  editProductModalTab: ProductModalTab = 'general';
  archivoImagen: File | null = null;
  imagenTemporalUrl: SafeUrl | string = '';

  // Google Picker Configurations
  developerKey = GOOGLE_DEVELOPER_KEY;
  clientId = GOOGLE_CLIENT_ID;
  oauthToken = '';
  pickerApiLoaded = false;
  miniaturasTemp: any[] = ['', '', ''];
  miniaturasUrls: string[] = ['', '', ''];

  searchTerm = '';
  filtroActivo: 'todos' | 'visibles' | 'ocultos' | 'oferta' | 'nuevos' = 'todos';
  productosAdmin: any[] = [];

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

  constructor(
    private productosService: ProductosService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    this.cargarProductos();
    this.loadGooglePicker();
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

  openAddProduct() {
    this.addProductModalTab = 'general';
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
    this.editingProduct = {
      id: prod.id,
      nombre: prod.nombre,
      precio: prod.precio,
      precioOferta: Math.round(prod.precio * 0.8),
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

  loadGooglePicker() {
    const hasGapi = typeof window !== 'undefined' && (window as any).gapi;
    const hasGoogle = typeof window !== 'undefined' && (window as any).google;

    if (hasGapi && (window as any).gapi.load) {
      gapi.load('picker', () => {
        this.pickerApiLoaded = true;
      });
    } else {
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        gapi.load('picker', () => {
          this.pickerApiLoaded = true;
        });
      };
      document.head.appendChild(script);
    }

    if (!hasGoogle || !(window as any).google.accounts) {
      const gsiScript = document.createElement('script');
      gsiScript.src = 'https://accounts.google.com/gsi/client';
      document.head.appendChild(gsiScript);
    }
  }

  abrirPicker(tipo: 'principal' | 'miniatura1' | 'miniatura2' | 'miniatura3') {
    if (!this.oauthToken) {
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
        client.requestAccessToken({prompt: 'consent'});
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
        const view = new pickerNamespace.View(pickerNamespace.ViewId.DOCS);
        view.setMimeTypes('image/png,image/jpeg,image/jpg,image/webp,image/gif');

        const picker = new pickerNamespace.PickerBuilder()
          .enableFeature(pickerNamespace.Feature.NAV_HIDDEN)
          .setDeveloperKey(this.developerKey || 'YOUR_DEVELOPER_KEY')
          .setAppId(this.clientId ? this.clientId.split('-')[0] : 'YOUR_APP_ID')
          .setOAuthToken(this.oauthToken)
          .addView(view)
          .setCallback((data: any) => {
            if (data[google.picker.Response.ACTION] === google.picker.Action.PICKED) {
              const doc = data[google.picker.Response.DOCUMENTS][0];
              const fileId = doc[google.picker.Document.ID];
              const directUrl = `https://docs.google.com/uc?export=view&id=${fileId}`;
              this.ngZone.run(() => {
                this.handlePickerUrl(tipo, directUrl);
              });
              this.cdr.detectChanges();
            }
          })
          .build();
        picker.setVisible(true);
      } catch (err) {
        console.error('Error al crear Google Picker:', err);
        this.fallbackUrlPrompt(tipo);
      }
    } else {
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
    return `https://docs.google.com/uc?export=view&id=${id}`;
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

  fallbackUrlPrompt(tipo: 'principal' | 'miniatura1' | 'miniatura2' | 'miniatura3') {
    const input = prompt('Ingresa la URL de la imagen de Google Drive o el ID del archivo:');
    if (input) {
      const fileId = this.extraerGoogleDriveId(input);
      const publicUrl = this.obtenerGoogleDrivePreviewUrl(fileId);
      this.handlePickerUrl(tipo, publicUrl);
    }
  }

  handlePickerUrl(tipo: 'principal' | 'miniatura1' | 'miniatura2' | 'miniatura3', url: string) {
    this.ngZone.run(() => {
      const renderUrl = this.obtenerUrlRenderizable(url);
      const safeUrl = this.sanitizer.bypassSecurityTrustUrl(renderUrl);
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
      this.cdr.detectChanges();
    });
  }

  removeMiniatura(index: number, event: Event) {
    event.stopPropagation();
    this.miniaturasTemp[index] = '';
    this.miniaturasUrls[index] = '';
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
      imagenUrl: imgPrincipal,
      descripcion: this.newProduct.descripcionCorta,
      descripcionDetallada: this.newProduct.descripcionLarga,
      caracteristicasDestacadas: this.newProduct.caracteristicas,
      subtitulo: this.newProduct.nombre,
      precioAnterior: this.newProduct.precio ? this.newProduct.precio * 1.25 : 0.0,
      rating: 5.0,
      resenas: 0,
      sugeridosIds: this.newProduct.sugeridosIds || [],
      miniaturasAdicionales: galUrls,
      galeriaUrls: galUrls
    };

    if (this.archivoImagen) {
      const formData = new FormData();
      formData.append('imagen', this.archivoImagen);
      formData.append('producto', JSON.stringify(payload));

      this.productosService.crearProducto(formData).subscribe({
        next: (res) => {
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
