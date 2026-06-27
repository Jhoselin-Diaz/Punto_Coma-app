import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { ProductosService } from '../../../service/productos.service';
import { ConfiguracionService } from '../../../service/configuracion.service';
import { GOOGLE_DEVELOPER_KEY, GOOGLE_CLIENT_ID } from '../admin-contenido-web.component';

declare var gapi: any;
declare var google: any;

type ProductModalTab = 'general' | 'imagenes' | 'descripcion' | 'relacionados';

@Component({
  selector: 'app-admin-productos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-productos.component.html',
  styleUrl: './admin-productos.component.css'
})
export class AdminProductosComponent implements OnInit {
  searchTerm = '';
  filtroActivo: 'todos' | 'visibles' | 'ocultos' | 'en-oferta' = 'todos';
  productosAdmin: any[] = [];
  productosFiltrados: any[] = [];
  productosDisponiblesRelacionados: any[] = [];
  isLoading = true;

  // Modales y pestañas
  showAddProductModal = false;
  showEditProductModal = false;
  showGlobalShippingModal = false;
  addProductModalTab: ProductModalTab = 'general';
  editProductModalTab: ProductModalTab = 'general';

  // Google Picker & Upload
  archivoImagen: File | null = null;
  imagenTemporalUrl: SafeUrl | string = '';
  developerKey = GOOGLE_DEVELOPER_KEY;
  clientId = GOOGLE_CLIENT_ID;
  oauthToken = '';
  tokenTimestamp = 0;
  pickerApiLoaded = false;
  miniaturasTemp: any[] = ['', '', ''];
  miniaturasUrls: string[] = ['', '', ''];
  miniaturaError: boolean[] = [false, false, false];

  globalConfig = {
    envio_cobertura: '',
    envio_tiempo_lima: '',
    envio_tiempo_provincia: '',
    envio_costo: '',
    envio_proceso: '',
    envio_seguimiento: '',
    devolucion_plazo: '',
    devolucion_condiciones: '',
    devolucion_casos: '',
    devolucion_proceso: '',
    devolucion_reembolso: '',
    devolucion_importante: ''
  };

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
    sugeridosIds: [] as number[],
    capacidad: '',
    material: '',
    aptoPara: '',
    acabado: '',
    diseno: '',
    incluye: '',
    garantia: '',
    material_intro: '',
    material_caracteristicas: '',
    apto_microondas: false,
    apto_lavavajillas: false,
    resiste_choque_termico: false,
    limpieza_suave: false,
    prohibido_fuego_directo: false,
    apto_temperaturas: false,
    grado_alimentario: false,
    evitar_abrasivos: false,
    control_humedad: false,
    lavado_mano: false
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
    caracteristicas: '',
    capacidad: '',
    material: '',
    aptoPara: '',
    acabado: '',
    diseno: '',
    incluye: '',
    garantia: '',
    material_intro: '',
    material_caracteristicas: '',
    apto_microondas: false,
    apto_lavavajillas: false,
    resiste_choque_termico: false,
    limpieza_suave: false,
    prohibido_fuego_directo: false,
    apto_temperaturas: false,
    grado_alimentario: false,
    evitar_abrasivos: false,
    control_humedad: false,
    lavado_mano: false,
    sugeridosIds: [] as number[]
  };

  constructor(
    private productosService: ProductosService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
    public configService: ConfiguracionService
  ) {}

  ngOnInit() {
    this.cargarProductos();
    this.loadGooglePicker();
    this.globalConfig = {
      envio_cobertura: this.configService.negocio.envio_cobertura || '',
      envio_tiempo_lima: this.configService.negocio.envio_tiempo_lima || '',
      envio_tiempo_provincia: this.configService.negocio.envio_tiempo_provincia || '',
      envio_costo: this.configService.negocio.envio_costo || '',
      envio_proceso: this.configService.negocio.envio_proceso || '',
      envio_seguimiento: this.configService.negocio.envio_seguimiento || '',
      devolucion_plazo: this.configService.negocio.devolucion_plazo || '',
      devolucion_condiciones: this.configService.negocio.devolucion_condiciones || '',
      devolucion_casos: this.configService.negocio.devolucion_casos || '',
      devolucion_proceso: this.configService.negocio.devolucion_proceso || '',
      devolucion_reembolso: this.configService.negocio.devolucion_reembolso || '',
      devolucion_importante: this.configService.negocio.devolucion_importante || ''
    };
  }

  cargarProductos() {
    this.isLoading = true;
    this.productosService.obtenerTodosBackend().subscribe({
      next: (res: any) => {
        const data = Array.isArray(res) ? res : (res && Array.isArray(res.content) ? res.content : []);
        this.productosAdmin = data;
        this.filtrarProductos(this.filtroActivo);
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al cargar productos del backend:', err);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  filtrarProductos(filtro: string) {
    this.filtroActivo = filtro as any;
    
    this.productosFiltrados = this.productosAdmin.filter((prod: any) => {
      const visible = prod.visible !== false && prod.activo !== false;
      
      let cumpleFiltro = true;
      if (filtro === 'visibles') {
        cumpleFiltro = visible;
      } else if (filtro === 'ocultos') {
        cumpleFiltro = !visible;
      } else if (filtro === 'en-oferta') {
        const original = prod.precioOriginal || prod.precioAnterior || prod.precio || 0;
        const oferta = prod.precioOferta || 0;
        cumpleFiltro = oferta > 0 && original > oferta;
      }
      
      let cumpleSearch = true;
      if (this.searchTerm && this.searchTerm.trim() !== '') {
        cumpleSearch = prod.nombre.toLowerCase().includes(this.searchTerm.toLowerCase());
      }
      
      return cumpleFiltro && cumpleSearch;
    });
    this.cdr.detectChanges();
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

  cambiarVisibilidadProducto(prod: any) {
    const nuevoEstado = prod.visible;
    this.productosService.actualizarVisibilidadProducto(prod.id, nuevoEstado).subscribe({
      next: () => {
        console.log(`✅ Visibilidad del producto "${prod.nombre}" actualizada a ${nuevoEstado}`);
        this.filtrarProductos(this.filtroActivo);
      },
      error: (err) => {
        console.error('Error al actualizar visibilidad:', err);
        prod.visible = !nuevoEstado;
        alert(`No se pudo actualizar la visibilidad de "${prod.nombre}". Intenta de nuevo.`);
        this.filtrarProductos(this.filtroActivo);
      }
    });
  }

  toggleDestacado(item: { destacado: boolean }) {
    item.destacado = !item.destacado;
    this.cdr.detectChanges();
  }

  setAddProductModalTab(tab: ProductModalTab) {
    this.addProductModalTab = tab;
  }

  setEditProductModalTab(tab: ProductModalTab) {
    this.editProductModalTab = tab;
  }

  limpiarUrl(url: any): string {
    if (url === null || url === undefined) return '';
    const s = String(url).trim();
    if (s === '' || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') return '';
    return s;
  }

  getDescuentoPorcentaje(original: number | null, oferta: number | null): number {
    if (!original || !oferta || original <= 0) return 0;
    const diff = original - oferta;
    return Math.max(0, Math.round((diff * 100) / original));
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
      sugeridosIds: [],
      capacidad: '',
      material: '',
      aptoPara: '',
      acabado: '',
      diseno: '',
      incluye: '',
      garantia: '',
      material_intro: '',
      material_caracteristicas: '',
      apto_microondas: false,
      apto_lavavajillas: false,
      resiste_choque_termico: false,
      limpieza_suave: false,
      prohibido_fuego_directo: false,
      apto_temperaturas: false,
      grado_alimentario: false,
      evitar_abrasivos: false,
      control_humedad: false,
      lavado_mano: false
    };
    this.archivoImagen = null;
    this.imagenTemporalUrl = '';
    this.miniaturasTemp = ['', '', ''];
    this.miniaturasUrls = ['', '', ''];
    this.miniaturaError = [false, false, false];
    this.showAddProductModal = true;
  }

  openEditProduct(prod: any) {
    this.editProductModalTab = 'general';
    this.archivoImagen = null;

    // Parse Sugeridos
    let sugIds: number[] = [];
    const rawSugeridos = prod.sugeridosIds || prod.sugeridos_ids;
    if (rawSugeridos) {
      if (Array.isArray(rawSugeridos)) {
        sugIds = rawSugeridos.map((id: any) => Number(id));
      } else if (typeof rawSugeridos === 'string') {
        sugIds = (rawSugeridos as string).split(',').map(s => Number(s.trim())).filter(n => !isNaN(n));
      }
    }

    // Parse Miniaturas/Gallery
    let extraUrls: string[] = [];
    const rawMiniaturas = prod.miniaturas_adicionales || prod.miniaturasAdicionales || prod.galeriaUrls;
    if (rawMiniaturas) {
      if (Array.isArray(rawMiniaturas)) {
        extraUrls = rawMiniaturas.map((s: any) => this.limpiarUrl(s)).filter(s => s && s.trim().length > 0);
      } else if (typeof rawMiniaturas === 'string') {
        extraUrls = rawMiniaturas.split(',').map((s: string) => this.limpiarUrl(s)).filter(s => s && s.trim().length > 0);
      }
    }
    
    // Pre-populate main image and miniaturas inputs/temps
    let mainImg = prod.imagen_principal || prod.imagenPrincipal || prod.imageUrl || '';
    mainImg = this.limpiarUrl(mainImg);
    this.imagenTemporalUrl = mainImg ? this.sanitizer.bypassSecurityTrustUrl(mainImg) : '';
    this.miniaturasTemp = ['', '', ''];
    this.miniaturasUrls = ['', '', ''];
    this.miniaturaError = [false, false, false];
    extraUrls.forEach((url, i) => {
      if (i < 3 && url) {
        this.miniaturasUrls[i] = url;
        this.miniaturasTemp[i] = this.sanitizer.bypassSecurityTrustUrl(url);
      }
    });

    const origPrice = prod.precioOriginal || prod.precio_original || prod.precioAnterior || prod.precio_anterior || prod.precio || 0;
    const offPrice = (prod.precioOferta || prod.precio_oferta) ? (prod.precioOferta || prod.precio_oferta) : (origPrice > prod.precio ? prod.precio : null);

    this.editingProduct = {
      id: prod.id,
      nombre: prod.nombre,
      precio: origPrice,
      precioOferta: offPrice,
      stock: prod.stock,
      categoria: prod.categoria || 'Tazas',
      visible: prod.visible !== undefined && prod.visible !== null ? prod.visible : (prod.activo !== undefined && prod.activo !== null ? prod.activo : true),
      destacado: prod.destacado || false,
      nuevo: prod.nuevo || prod.esNuevo || false,
      imagenPrincipal: mainImg,
      descripcionCorta: prod.descripcion || '',
      descripcionLarga: prod.descripcionDetallada || '',
      caracteristicas: prod.caracteristicasDestacadas || '',
      capacidad: prod.capacidad || '',
      material: prod.material || '',
      aptoPara: prod.aptoPara || '',
      acabado: prod.acabado || '',
      diseno: prod.diseno || '',
      incluye: prod.incluye || '',
      garantia: prod.garantia || '',
      material_intro: prod.material_intro || prod.materialIntro || '',
      material_caracteristicas: prod.material_caracteristicas || prod.materialCaracteristicas || '',
      apto_microondas: prod.apto_microondas === true || prod.aptoMicroondas === true,
      apto_lavavajillas: prod.apto_lavavajillas === true || prod.aptoLavavajillas === true,
      resiste_choque_termico: prod.resiste_choque_termico === true || prod.resisteChoqueTermico === true,
      limpieza_suave: prod.limpieza_suave === true || prod.limpiezaSuave === true,
      prohibido_fuego_directo: prod.prohibido_fuego_directo === true || prod.prohibidoFuegoDirecto === true,
      apto_temperaturas: prod.apto_temperaturas === true || prod.aptoTemperaturas === true,
      grado_alimentario: prod.grado_alimentario === true || prod.gradoAlimentario === true,
      evitar_abrasivos: prod.evitar_abrasivos === true || prod.evitarAbrasivos === true,
      control_humedad: prod.control_humedad === true || prod.controlHumedad === true,
      lavado_mano: prod.lavado_mano === true || prod.lavadoMano === true,
      sugeridosIds: sugIds
    };

    this.productosService.obtenerProductosPublicos().subscribe({
      next: (res: any) => {
        const data = Array.isArray(res) ? res : (res && Array.isArray(res.content) ? res.content : []);
        this.productosDisponiblesRelacionados = data;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al cargar productos públicos para relacionados:', err);
      }
    });

    this.showEditProductModal = true;
  }

  guardarNuevoProducto() {
    if (!this.newProduct.nombre || this.newProduct.precio === null) {
      alert('Por favor complete los campos obligatorios: Nombre y Precio.');
      return;
    }

    const galUrls = this.miniaturasUrls.filter(url => !!url);
    const imgPrincipal = this.newProduct.imagenPrincipal || 'images/prod-jaspeada.png';

    const hasOffer = this.newProduct.precioOferta && this.newProduct.precioOferta > 0 && this.newProduct.precioOferta < this.newProduct.precio;
    const activePrice = hasOffer ? this.newProduct.precioOferta : this.newProduct.precio;
    const originalPrice = this.newProduct.precio || 0;

    const payload = {
      nombre: this.newProduct.nombre,
      precio: activePrice,
      precioOferta: hasOffer ? this.newProduct.precioOferta : null,
      precio_oferta: hasOffer ? this.newProduct.precioOferta : null,
      precioOriginal: originalPrice,
      precio_original: originalPrice,
      precioAnterior: originalPrice,
      precio_anterior: originalPrice,
      stock: this.newProduct.stock || 0,
      categoria: this.newProduct.categoria,
      activo: this.newProduct.visible,
      imageUrl: imgPrincipal,
      imagenPrincipal: imgPrincipal,
      imagenUrl: imgPrincipal,
      imagen_principal: imgPrincipal,
      descripcion: this.newProduct.descripcionCorta,
      descripcionDetallada: this.newProduct.descripcionLarga,
      caracteristicasDestacadas: this.newProduct.caracteristicas,
      subtitulo: this.newProduct.nombre,
      rating: 5.0,
      resenas: 0,
      sugeridosIds: this.newProduct.sugeridosIds || [],
      sugeridos_ids: this.newProduct.sugeridosIds || [],
      miniaturasAdicionales: galUrls,
      miniaturas_adicionales: galUrls,
      galeriaUrls: galUrls,
      capacidad: this.newProduct.capacidad,
      material: this.newProduct.material,
      aptoPara: this.newProduct.aptoPara,
      acabado: this.newProduct.acabado,
      diseno: this.newProduct.diseno,
      incluye: this.newProduct.incluye,
      garantia: this.newProduct.garantia,
      material_intro: this.newProduct.material_intro,
      material_caracteristicas: this.newProduct.material_caracteristicas,
      apto_microondas: this.newProduct.apto_microondas,
      apto_lavavajillas: this.newProduct.apto_lavavajillas,
      resiste_choque_termico: this.newProduct.resiste_choque_termico,
      limpieza_suave: this.newProduct.limpieza_suave,
      prohibido_fuego_directo: this.newProduct.prohibido_fuego_directo,
      apto_temperaturas: this.newProduct.apto_temperaturas,
      grado_alimentario: this.newProduct.grado_alimentario,
      evitar_abrasivos: this.newProduct.evitar_abrasivos,
      control_humedad: this.newProduct.control_humedad,
      lavado_mano: this.newProduct.lavado_mano
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

  guardarCambiosProducto() {
    if (!this.editingProduct.nombre || this.editingProduct.precio === null) {
      alert('Por favor complete los campos obligatorios: Nombre y Precio.');
      return;
    }

    const galUrls = this.miniaturasUrls.filter(url => !!url);
    const imgPrincipal = this.editingProduct.imagenPrincipal || 'images/prod-jaspeada.png';

    const hasOffer = this.editingProduct.precioOferta && this.editingProduct.precioOferta > 0 && this.editingProduct.precioOferta < this.editingProduct.precio;
    const activePrice = hasOffer ? this.editingProduct.precioOferta : this.editingProduct.precio;
    const originalPrice = this.editingProduct.precio || 0;

    const payload = {
      id: this.editingProduct.id,
      nombre: this.editingProduct.nombre,
      precio: activePrice,
      precioOferta: hasOffer ? this.editingProduct.precioOferta : null,
      precio_oferta: hasOffer ? this.editingProduct.precioOferta : null,
      precioOriginal: originalPrice,
      precio_original: originalPrice,
      precioAnterior: originalPrice,
      precio_anterior: originalPrice,
      stock: this.editingProduct.stock || 0,
      categoria: this.editingProduct.categoria,
      activo: this.editingProduct.visible,
      imageUrl: imgPrincipal,
      imagenPrincipal: imgPrincipal,
      imagenUrl: imgPrincipal,
      imagen_principal: imgPrincipal,
      descripcion: this.editingProduct.descripcionCorta,
      descripcionDetallada: this.editingProduct.descripcionLarga,
      caracteristicasDestacadas: this.editingProduct.caracteristicas,
      subtitulo: this.editingProduct.nombre,
      rating: 5.0,
      resenas: 0,
      sugeridosIds: this.editingProduct.sugeridosIds || [],
      sugeridos_ids: this.editingProduct.sugeridosIds || [],
      miniaturasAdicionales: galUrls,
      miniaturas_adicionales: galUrls,
      galeriaUrls: galUrls,
      capacidad: this.editingProduct.capacidad,
      material: this.editingProduct.material,
      aptoPara: this.editingProduct.aptoPara,
      acabado: this.editingProduct.acabado,
      diseno: this.editingProduct.diseno,
      incluye: this.editingProduct.incluye,
      garantia: this.editingProduct.garantia,
      material_intro: this.editingProduct.material_intro,
      material_caracteristicas: this.editingProduct.material_caracteristicas,
      apto_microondas: this.editingProduct.apto_microondas,
      apto_lavavajillas: this.editingProduct.apto_lavavajillas,
      resiste_choque_termico: this.editingProduct.resiste_choque_termico,
      limpieza_suave: this.editingProduct.limpieza_suave,
      prohibido_fuego_directo: this.editingProduct.prohibido_fuego_directo,
      apto_temperaturas: this.editingProduct.apto_temperaturas,
      grado_alimentario: this.editingProduct.grado_alimentario,
      evitar_abrasivos: this.editingProduct.evitar_abrasivos,
      control_humedad: this.editingProduct.control_humedad,
      lavado_mano: this.editingProduct.lavado_mano
    };

    if (this.archivoImagen) {
      const formData = new FormData();
      formData.append('imagen', this.archivoImagen);
      formData.append('producto', JSON.stringify(payload));

      this.productosService.crearProducto(formData).subscribe({
        next: (res) => {
          alert('¡Producto actualizado con éxito!');
          this.showEditProductModal = false;
          this.cargarProductos();
        },
        error: (err) => {
          console.error('Error al actualizar el producto (Multipart):', err);
          alert('Ocurrió un error al actualizar el producto.');
        }
      });
    } else {
      this.productosService.crearProducto(payload).subscribe({
        next: (res) => {
          alert('¡Producto actualizado con éxito!');
          this.showEditProductModal = false;
          this.cargarProductos();
        },
        error: (err) => {
          console.error('Error al actualizar el producto (JSON):', err);
          alert('Ocurrió un error al actualizar el producto.');
        }
      });
    }
  }

  guardarConfiguracionGlobal() {
    this.configService.actualizarNegocio({
      ...this.configService.negocio,
      ...this.globalConfig
    });
    alert('✅ Configuración global de Envíos y Devoluciones guardada.');
    this.showGlobalShippingModal = false;
  }

  loadGooglePicker() {
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => {
      gapi.load('picker', () => {
        this.pickerApiLoaded = true;
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

  elegirOrigenMiniatura(tipo: 'miniatura1' | 'miniatura2' | 'miniatura3') {
    const usarGoogle = confirm('¿Deseas buscar la imagen en Google Drive? (Presiona Cancelar para pegar la URL directamente)');
    if (usarGoogle) {
      this.abrirPicker(tipo);
    } else {
      this.fallbackUrlPrompt(tipo);
    }
  }

  abrirPicker(tipo: 'principal' | 'miniatura1' | 'miniatura2' | 'miniatura3') {
    // Verificar si el token ya expiró (duración típica de 50 minutos / 3000 segundos)
    const tokenExpirado = this.tokenTimestamp && (Date.now() - this.tokenTimestamp > 3000 * 1000);
    if (tokenExpirado) {
      console.log('🔄 El token de Google ha expirado. Limpiando para forzar re-autenticación.');
      this.oauthToken = '';
      this.tokenTimestamp = 0;
    }

    if (!this.oauthToken) {
      try {
        const client = google.accounts.oauth2.initTokenClient({
          client_id: this.clientId || 'YOUR_CLIENT_ID.apps.googleusercontent.com',
          scope: 'https://www.googleapis.com/auth/drive.readonly',
          callback: (response: any) => {
            if (response.error !== undefined) {
              console.error('❌ Error al inicializar Token Client:', response);
              this.oauthToken = '';
              this.tokenTimestamp = 0;
              return;
            }
            this.oauthToken = response.access_token;
            this.tokenTimestamp = Date.now();
            console.log('✅ Nuevo Token de GSI obtenido con éxito.');
            this.createPicker(tipo);
          },
        });
        client.requestAccessToken({ prompt: 'consent' });
      } catch (err) {
        console.warn('Google GSI Token Client initialization failed, using URL fallback.', err);
        this.oauthToken = '';
        this.tokenTimestamp = 0;
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
            console.log('--- DATA CRUDA DEL PICKER ---', data);
            if (data.action === pickerNamespace.Action.PICKED) {
              const doc = data.docs[0];
              const fileId = doc[pickerNamespace.Document.ID] || doc.id;
              const publicUrl = this.obtenerGoogleDrivePreviewUrl(fileId);
              this.handlePickerUrl(tipo, publicUrl);
            } else if (data.action === 'error' || data.error) {
              console.error('❌ Error detectado en el callback de Google Picker:', data.error || data);
              this.oauthToken = ''; // Resetear el token en caso de error
              this.tokenTimestamp = 0;
            }
          })
          .build();
        picker.setVisible(true);
      } catch (err) {
        console.error('❌ Excepción al crear Google Picker:', err);
        this.oauthToken = '';
        this.tokenTimestamp = 0;
        this.fallbackUrlPrompt(tipo);
      }
    } else {
      console.warn('⚠️ Gapi/Google Picker API no cargada completamente, redireccionando a prompt.');
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
    const cleanId = id.trim();
    if (cleanId.toLowerCase() === 'null' || cleanId.toLowerCase() === 'undefined' || cleanId.length === 0) {
      return '';
    }
    // Si contiene slashes, puntos o dos puntos, no es un ID válido de Google Drive
    if (cleanId.includes('/') || cleanId.includes('.') || cleanId.includes(':')) {
      if (cleanId.startsWith('http')) {
        return cleanId;
      }
      return '';
    }
    return `https://lh3.googleusercontent.com/d/${cleanId}`;
  }

  fallbackUrlPrompt(tipo: 'principal' | 'miniatura1' | 'miniatura2' | 'miniatura3') {
    const input = prompt('Ingresa la URL directa de la imagen, la URL de Google Drive o el ID del archivo:');
    if (input) {
      const trimmed = input.trim();
      let publicUrl = '';
      if (trimmed.startsWith('http') && !trimmed.includes('drive.google.com') && !trimmed.includes('googleusercontent.com')) {
        // Si es una URL directa (http/https) que no pertenece a Google Drive, la usamos tal cual
        publicUrl = trimmed;
      } else {
        const fileId = this.extraerGoogleDriveId(trimmed);
        publicUrl = this.obtenerGoogleDrivePreviewUrl(fileId);
      }
      this.handlePickerUrl(tipo, publicUrl);
    }
  }

  handlePickerUrl(tipo: 'principal' | 'miniatura1' | 'miniatura2' | 'miniatura3', url: string) {
    const safeUrl = this.sanitizer.bypassSecurityTrustUrl(url);
    if (tipo === 'principal') {
      this.imagenTemporalUrl = safeUrl;
      if (this.showEditProductModal) {
        this.editingProduct.imagenPrincipal = url;
        (this.editingProduct as any).imagen_principal = url;
      } else {
        this.newProduct.imagenPrincipal = url;
        (this.newProduct as any).imagenUrl = url;
      }
    } else if (tipo === 'miniatura1') {
      this.miniaturasTemp[0] = safeUrl;
      this.miniaturasUrls[0] = url;
      this.miniaturaError[0] = false;
    } else if (tipo === 'miniatura2') {
      this.miniaturasTemp[1] = safeUrl;
      this.miniaturasUrls[1] = url;
      this.miniaturaError[1] = false;
    } else if (tipo === 'miniatura3') {
      this.miniaturasTemp[2] = safeUrl;
      this.miniaturasUrls[2] = url;
      this.miniaturaError[2] = false;
    }
    this.cdr.detectChanges();
  }

  removeMiniatura(index: number, event: Event) {
    event.stopPropagation();
    this.miniaturasTemp[index] = '';
    this.miniaturasUrls[index] = '';
    this.miniaturaError[index] = false;
    this.cdr.detectChanges();
  }

  handleThumbnailError(index: number) {
    this.miniaturaError[index] = true;
    this.cdr.detectChanges();
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

  toggleSugeridoEdicion(id: any) {
    if (!this.editingProduct.sugeridosIds) {
      this.editingProduct.sugeridosIds = [];
    }
    
    if (typeof this.editingProduct.sugeridosIds === 'string') {
      this.editingProduct.sugeridosIds = (this.editingProduct.sugeridosIds as string)
        .split(',')
        .map(s => s.trim())
        .filter(s => s !== '')
        .map(s => Number(s));
    }

    const idNum = Number(id);
    const idx = this.editingProduct.sugeridosIds.findIndex(item => Number(item) === idNum);
    if (idx === -1) {
      this.editingProduct.sugeridosIds.push(idNum);
    } else {
      this.editingProduct.sugeridosIds.splice(idx, 1);
    }
  }

  esSugeridoSeleccionado(id: any): boolean {
    if (!this.editingProduct.sugeridosIds) return false;
    
    if (Array.isArray(this.editingProduct.sugeridosIds)) {
      return this.editingProduct.sugeridosIds.some(sId => Number(sId) === Number(id));
    }
    
    if (typeof this.editingProduct.sugeridosIds === 'string') {
      const ids = (this.editingProduct.sugeridosIds as string).split(',').map(s => Number(s.trim()));
      return ids.includes(Number(id));
    }
    
    return false;
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
      if (this.showEditProductModal) {
        this.editingProduct.imagenPrincipal = objectUrl;
        (this.editingProduct as any).imagen_principal = objectUrl;
      } else {
        this.newProduct.imagenPrincipal = objectUrl;
        (this.newProduct as any).imagenUrl = objectUrl;
      }
      this.cdr.detectChanges();
    } else {
      alert('Por favor selecciona un archivo de imagen válido.');
    }
  }

  removeImage(event: Event) {
    event.stopPropagation();
    this.archivoImagen = null;
    this.imagenTemporalUrl = '';
    if (this.showEditProductModal) {
      this.editingProduct.imagenPrincipal = '';
      (this.editingProduct as any).imagen_principal = '';
    } else {
      this.newProduct.imagenPrincipal = '';
      (this.newProduct as any).imagenUrl = '';
    }
    this.cdr.detectChanges();
  }
}
