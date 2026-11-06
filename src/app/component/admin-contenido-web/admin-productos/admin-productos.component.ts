import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { ProductosService } from '../../../service/productos.service';
import { ConfiguracionService } from '../../../service/configuracion.service';
import { ModalAlertaService } from '../../../service/modal-alerta.service';
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
export class AdminProductosComponent implements OnInit, OnDestroy {
  searchTerm = '';
  filtroActivo: 'todos' | 'visibles' | 'ocultos' | 'en-oferta' = 'todos';
  productosAdmin: any[] = [];
  productosFiltrados: any[] = [];
  productosDisponiblesRelacionados: any[] = [];
  isLoading = true;
  private routeSub?: Subscription;
  pendingEditProductId: number | null = null;

  // Modales y pestañas
  showAddProductModal = false;
  showEditProductModal = false;
  showGlobalShippingModal = false;
  showCategoriasModal = false;
  categoriasDisponibles: string[] = ['Tazas', 'Vasos', 'Sets de Cerámica', 'Accesorios'];
  nuevaCategoriaTexto = '';
  indiceCategoriaEnEdicion: number | null = null;
  nombreCategoriaEditando = '';
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
  isDraggingMain = false;
  isDraggingThumb: boolean[] = [false, false, false];

  // Modal para selección de origen y pegar URL (Sin window.prompt)
  showModalOrigenImagen = false;
  tipoImagenObjetivo: 'principal' | 'miniatura1' | 'miniatura2' | 'miniatura3' = 'principal';
  showModalPegarUrl = false;
  urlImagenInput = '';

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
    precio: null as number | null,
    precioOferta: null as number | null,
    stock: null as number | null,
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
    public configService: ConfiguracionService,
    private modalAlertaService: ModalAlertaService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.cargarCategorias();
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

    this.routeSub = this.route.queryParams.subscribe(params => {
      if (params['action'] === 'edit' && params['id']) {
        const numId = Number(params['id']);
        if (!isNaN(numId)) {
          this.pendingEditProductId = numId;
          this.verificarAperturaModalEdicion(numId);
        }
      } else {
        this.pendingEditProductId = null;
        if (this.showEditProductModal) {
          this.showEditProductModal = false;
        }
      }
    });
  }

  ngOnDestroy() {
    this.routeSub?.unsubscribe();
  }

  private verificarAperturaModalEdicion(id: number): void {
    if (this.productosAdmin && this.productosAdmin.length > 0) {
      const prod = this.productosAdmin.find(p => p.id === id);
      if (prod) {
        this.openEditProduct(prod, false);
      }
    }
  }

  closeEditProductModal() {
    this.showEditProductModal = false;
    this.pendingEditProductId = null;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { action: null, id: null },
      queryParamsHandling: 'merge'
    });
    this.cdr.detectChanges();
  }

  cargarProductos() {
    this.isLoading = true;
    this.productosService.obtenerTodosBackend().subscribe({
      next: (res: any) => {
        const data = Array.isArray(res) ? res : (res && Array.isArray(res.content) ? res.content : []);
        this.productosAdmin = data;
        this.sincronizarCategoriasDeProductos();
        this.filtrarProductos(this.filtroActivo);
        if (this.pendingEditProductId) {
          this.verificarAperturaModalEdicion(this.pendingEditProductId);
        }
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

  async eliminarProducto(id: any) {
    const confirmado = await this.modalAlertaService.confirm({
      titulo: '¿Eliminar producto?',
      mensaje: '¿Estás seguro de que deseas eliminar este producto? Esta acción no se puede deshacer.',
      tipo: 'peligro',
      textoConfirmar: 'Sí, eliminar',
      textoCancelar: 'Cancelar'
    });
    if (confirmado) {
      this.productosService.eliminarProducto(id).subscribe({
        next: () => {
          this.modalAlertaService.success('¡Producto eliminado exitosamente!');
          this.cargarProductos();
        },
        error: (err) => {
          console.error('Error al eliminar el producto:', err);
          this.modalAlertaService.error('Ocurrió un error al intentar eliminar el producto.');
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
        this.modalAlertaService.error(`No se pudo actualizar la visibilidad de "${prod.nombre}". Intenta de nuevo.`, 'Error');
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

  // ==========================================
  // GESTIÓN DE CATEGORÍAS DE PRODUCTOS
  // ==========================================

  cargarCategorias(): void {
    const raw = localStorage.getItem('admin_categorias_productos');
    let lista: string[] = [];
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          lista = parsed.map(c => String(c).trim()).filter(c => c.length > 0);
        }
      } catch (e) {
        console.error('Error al leer categorías de localStorage:', e);
      }
    }

    if (lista.length === 0) {
      lista = ['Tazas', 'Vasos', 'Sets de Cerámica', 'Accesorios'];
    }

    this.categoriasDisponibles = lista;
    this.sincronizarCategoriasDeProductos();
    this.guardarCategoriasEnStorage();
  }

  sincronizarCategoriasDeProductos(): void {
    if (!this.productosAdmin || this.productosAdmin.length === 0) return;
    let huboCambios = false;
    this.productosAdmin.forEach(p => {
      if (p.categoria && typeof p.categoria === 'string') {
        const catNombre = p.categoria.trim();
        if (catNombre && !this.categoriasDisponibles.some(c => c.toLowerCase() === catNombre.toLowerCase())) {
          this.categoriasDisponibles.push(catNombre);
          huboCambios = true;
        }
      }
    });
    if (huboCambios) {
      this.guardarCategoriasEnStorage();
    }
  }

  guardarCategoriasEnStorage(): void {
    try {
      localStorage.setItem('admin_categorias_productos', JSON.stringify(this.categoriasDisponibles));
    } catch (e) {
      console.error('Error al guardar categorías en localStorage:', e);
    }
  }

  abrirModalCategorias(): void {
    this.nuevaCategoriaTexto = '';
    this.cancelarEdicionCategoria();
    this.cargarCategorias();
    this.showCategoriasModal = true;
  }

  cerrarModalCategorias(): void {
    this.showCategoriasModal = false;
    this.nuevaCategoriaTexto = '';
    this.cancelarEdicionCategoria();
  }

  iniciarEdicionCategoria(index: number, cat: string): void {
    this.indiceCategoriaEnEdicion = index;
    this.nombreCategoriaEditando = cat;
  }

  cancelarEdicionCategoria(): void {
    this.indiceCategoriaEnEdicion = null;
    this.nombreCategoriaEditando = '';
  }

  agregarCategoria(): void {
    const nombre = (this.nuevaCategoriaTexto || '').trim();
    if (!nombre) {
      this.modalAlertaService.warning('No se puede guardar una categoría con la casilla en blanco.', 'Casilla en blanco');
      return;
    }

    const existe = this.categoriasDisponibles.some(
      c => c.toLowerCase() === nombre.toLowerCase()
    );
    if (existe) {
      this.modalAlertaService.warning(`La categoría "${nombre}" ya existe en la lista.`, 'Categoría existente');
      return;
    }

    this.categoriasDisponibles.push(nombre);
    this.guardarCategoriasEnStorage();
    this.nuevaCategoriaTexto = '';
    this.modalAlertaService.success(`Categoría "${nombre}" agregada correctamente.`, 'Categoría agregada');
  }

  guardarEdicionCategoria(index: number): void {
    const nombreAnterior = this.categoriasDisponibles[index];
    const nuevoNombre = (this.nombreCategoriaEditando || '').trim();

    if (!nuevoNombre) {
      this.modalAlertaService.warning('No se puede guardar el cambio si se deja la casilla en blanco.', 'Casilla en blanco');
      return;
    }

    if (nuevoNombre.toLowerCase() === nombreAnterior.toLowerCase()) {
      this.categoriasDisponibles[index] = nuevoNombre;
      this.guardarCategoriasEnStorage();
      this.cancelarEdicionCategoria();
      return;
    }

    const yaExiste = this.categoriasDisponibles.some(
      (c, idx) => idx !== index && c.toLowerCase() === nuevoNombre.toLowerCase()
    );
    if (yaExiste) {
      this.modalAlertaService.warning(`Ya existe otra categoría con el nombre "${nuevoNombre}".`, 'Categoría duplicada');
      return;
    }

    this.categoriasDisponibles[index] = nuevoNombre;
    this.guardarCategoriasEnStorage();

    if (this.newProduct.categoria === nombreAnterior) {
      this.newProduct.categoria = nuevoNombre;
    }
    if (this.editingProduct.categoria === nombreAnterior) {
      this.editingProduct.categoria = nuevoNombre;
    }

    this.cancelarEdicionCategoria();
    this.modalAlertaService.success(`Categoría actualizada a "${nuevoNombre}".`, 'Cambio guardado');
  }

  eliminarCategoria(index: number, cat: string): void {
    if (this.categoriasDisponibles.length <= 1) {
      this.modalAlertaService.warning('Debe existir al menos una categoría en el sistema.', 'Acción no permitida');
      return;
    }

    const productosConCat = this.productosAdmin.filter(
      p => (p.categoria || '').toLowerCase() === cat.toLowerCase()
    );

    this.categoriasDisponibles.splice(index, 1);
    this.guardarCategoriasEnStorage();

    if (this.newProduct.categoria === cat) {
      this.newProduct.categoria = this.categoriasDisponibles[0] || 'Tazas';
    }
    if (this.editingProduct.categoria === cat) {
      this.editingProduct.categoria = this.categoriasDisponibles[0] || 'Tazas';
    }

    if (this.indiceCategoriaEnEdicion === index) {
      this.cancelarEdicionCategoria();
    }

    const nota = productosConCat.length > 0 
      ? ` (Nota: Hay ${productosConCat.length} producto(s) asignados a esta categoría).` 
      : '';
    this.modalAlertaService.success(`Categoría "${cat}" eliminada con éxito.${nota}`, 'Categoría eliminada');
  }

  openAddProduct() {
    this.addProductModalTab = 'general';
    this.newProduct = {
      nombre: '',
      precio: null,
      precioOferta: null,
      stock: null,
      categoria: this.categoriasDisponibles[0] || 'Tazas',
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

  openEditProduct(prod: any, updateUrl = true) {
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

    const origPrice = prod.precioOriginal || prod.precio_original || prod.precioAnterior || prod.precio_anterior || prod.precio || null;
    const offPrice = (prod.precioOferta || prod.precio_oferta) ? (prod.precioOferta || prod.precio_oferta) : (origPrice && prod.precio && origPrice > prod.precio ? prod.precio : null);

    this.editingProduct = {
      id: prod.id,
      nombre: prod.nombre,
      precio: origPrice !== null && !isNaN(Number(origPrice)) && Number(origPrice) > 0 ? Number(origPrice) : null,
      precioOferta: offPrice !== null && !isNaN(Number(offPrice)) && Number(offPrice) > 0 ? Number(offPrice) : null,
      stock: prod.stock !== undefined && prod.stock !== null && !isNaN(Number(prod.stock)) && Number(prod.stock) > 0 ? Number(prod.stock) : null,
      categoria: prod.categoria || (this.categoriasDisponibles[0] || 'Tazas'),
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
    if (updateUrl && prod?.id) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { action: 'edit', id: prod.id },
        queryParamsHandling: 'merge'
      });
    }
  }

  // ==========================================
  // VALIDACIONES NUMÉRICAS (STOCK Y PRECIOS)
  // ==========================================

  validarSoloEnterosStock(event: KeyboardEvent, target: 'new' | 'edit'): void {
    const allowedKeys = [
      'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
      'Home', 'End'
    ];

    if (allowedKeys.includes(event.key)) {
      const obj = target === 'new' ? this.newProduct : this.editingProduct;
      if (event.key === 'ArrowDown' && (obj.stock === null || obj.stock === undefined || obj.stock <= 1)) {
        event.preventDefault();
      }
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      return;
    }

    // Bloquear el 0 como primer dígito (stock debe ser superior a 0)
    if (event.key === '0') {
      const input = event.target as HTMLInputElement;
      if (
        !input.value ||
        (input.selectionStart === 0 && input.selectionEnd === input.value.length) ||
        input.value === '0'
      ) {
        event.preventDefault();
        return;
      }
    }

    // Bloquear signos (+, -), puntos (.), comas (,), exponentes (e, E) y cualquier carácter que no sea 0-9
    if (!/^[0-9]$/.test(event.key)) {
      event.preventDefault();
    }
  }

  sanitizarStockInput(event: Event, target: 'new' | 'edit'): void {
    const input = event.target as HTMLInputElement;
    if (!input) return;

    let val = input.value;
    val = val.replace(/[^0-9]/g, '');

    if (val.length > 1 && val.startsWith('0')) {
      val = val.replace(/^0+/, '') || '';
    }

    if (val === '0') {
      val = '';
    }

    input.value = val;

    if (val === '') {
      if (target === 'new') this.newProduct.stock = null;
      else this.editingProduct.stock = null;
    } else {
      const parsed = parseInt(val, 10);
      if (target === 'new') this.newProduct.stock = parsed;
      else this.editingProduct.stock = parsed;
    }
  }

  validarPegadoStock(event: ClipboardEvent, target: 'new' | 'edit'): void {
    event.preventDefault();
    const clipboardData = event.clipboardData;
    if (!clipboardData) return;

    const pastedText = clipboardData.getData('text');
    let cleanDigits = pastedText.replace(/[^0-9]/g, '');
    if (cleanDigits) {
      if (cleanDigits.length > 1 && cleanDigits.startsWith('0')) {
        cleanDigits = cleanDigits.replace(/^0+/, '') || '';
      }
      if (cleanDigits === '0') {
        cleanDigits = '';
      }
      const input = event.target as HTMLInputElement;
      const start = input.selectionStart ?? 0;
      const end = input.selectionEnd ?? 0;
      const current = input.value || '';
      let finalVal = current.slice(0, start) + cleanDigits + current.slice(end);
      finalVal = finalVal.replace(/^0+/, '');
      input.value = finalVal;
      const parsed = finalVal ? parseInt(finalVal, 10) : null;
      if (target === 'new') this.newProduct.stock = parsed;
      else this.editingProduct.stock = parsed;
    }
  }

  validarPrecioKeydown(event: KeyboardEvent): void {
    const allowedKeys = [
      'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
      'Home', 'End'
    ];

    if (allowedKeys.includes(event.key)) {
      if (event.key === 'ArrowDown') {
        const input = event.target as HTMLInputElement;
        const num = parseFloat(input.value);
        if (isNaN(num) || num <= 0.01) {
          event.preventDefault();
        }
      }
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      return;
    }

    // Bloquear signos (+, -) y notación científica (e, E)
    if (['-', '+', 'e', 'E'].includes(event.key)) {
      event.preventDefault();
      return;
    }

    const input = event.target as HTMLInputElement;
    const currentVal = input.value || '';
    const selStart = input.selectionStart ?? 0;
    const selEnd = input.selectionEnd ?? 0;

    // Control para separadores decimales (punto o coma)
    if (event.key === '.' || event.key === ',') {
      const hasDecimal = currentVal.includes('.') || currentVal.includes(',');
      const selectedHasDecimal = currentVal.slice(selStart, selEnd).includes('.') || currentVal.slice(selStart, selEnd).includes(',');
      if (hasDecimal && !selectedHasDecimal) {
        event.preventDefault();
        return;
      }
      return;
    }

    // Solo permitir dígitos
    if (!/^[0-9]$/.test(event.key)) {
      event.preventDefault();
    }
  }

  sanitizarPrecioInput(event: Event, target: 'new' | 'edit', field: 'precio' | 'precioOferta'): void {
    const input = event.target as HTMLInputElement;
    if (!input) return;

    let val = input.value;
    if (!val || val.trim() === '') {
      if (target === 'new') {
        this.newProduct[field] = null;
      } else {
        this.editingProduct[field] = null;
      }
      return;
    }

    // Cambiar coma por punto
    val = val.replace(/,/g, '.');

    // Remover caracteres no numéricos excepto el punto
    val = val.replace(/[^0-9.]/g, '');

    // Si comienza con punto (ej: ".5"), anteponer "0."
    if (val.startsWith('.')) {
      val = '0' + val;
    }

    // Mantener sólo el primer punto
    const parts = val.split('.');
    if (parts.length > 2) {
      val = parts[0] + '.' + parts.slice(1).join('');
    }

    // Limitar a máximo 2 decimales
    if (parts.length >= 2 && parts[1].length > 2) {
      val = parts[0] + '.' + parts[1].substring(0, 2);
    }

    // Normalizar ceros a la izquierda (ej: "05" -> "5", manteniendo "0." o "0.5")
    if (val.length > 1 && val.startsWith('0') && !val.startsWith('0.')) {
      val = val.replace(/^0+/, '') || '0';
    }

    input.value = val;

    // Permitir al usuario continuar escribiendo si termina en "." o es "0." o "0"
    if (val.endsWith('.') || val === '0.' || val === '0') {
      const parsed = parseFloat(val);
      const num = !isNaN(parsed) && parsed > 0 ? parsed : null;
      if (target === 'new') this.newProduct[field] = num;
      else this.editingProduct[field] = num;
      return;
    }

    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      if (target === 'new') this.newProduct[field] = num;
      else this.editingProduct[field] = num;
    } else {
      if (target === 'new') this.newProduct[field] = null;
      else this.editingProduct[field] = null;
    }
  }

  validarPegadoPrecio(event: ClipboardEvent, target: 'new' | 'edit', field: 'precio' | 'precioOferta'): void {
    event.preventDefault();
    const clipboardData = event.clipboardData;
    if (!clipboardData) return;

    let text = clipboardData.getData('text').trim();
    text = text.replace(/,/g, '.').replace(/[^0-9.]/g, '');

    if (text.startsWith('.')) {
      text = '0' + text;
    }

    const parts = text.split('.');
    if (parts.length > 2) {
      text = parts[0] + '.' + parts.slice(1).join('');
    }
    if (parts.length >= 2 && parts[1].length > 2) {
      text = parts[0] + '.' + parts[1].substring(0, 2);
    }
    if (text.length > 1 && text.startsWith('0') && !text.startsWith('0.')) {
      text = text.replace(/^0+/, '') || '0';
    }

    const input = event.target as HTMLInputElement;
    const num = parseFloat(text);

    if (!isNaN(num) && num > 0) {
      input.value = text;
      if (target === 'new') this.newProduct[field] = num;
      else this.editingProduct[field] = num;
    } else {
      input.value = '';
      if (target === 'new') this.newProduct[field] = null;
      else this.editingProduct[field] = null;
    }
  }

  formatearPrecioBlur(target: 'new' | 'edit', field: 'precio' | 'precioOferta'): void {
    const obj = target === 'new' ? this.newProduct : this.editingProduct;
    const rawVal = obj[field];

    if (rawVal === null || rawVal === undefined || isNaN(Number(rawVal)) || Number(rawVal) <= 0) {
      obj[field] = null;
    } else {
      obj[field] = Math.round(Number(rawVal) * 100) / 100;
    }
  }

  guardarNuevoProducto() {
    if (!this.newProduct.nombre || !this.newProduct.nombre.trim()) {
      this.modalAlertaService.warning('Por favor ingrese el nombre del producto.', 'Campo requerido');
      return;
    }

    const precio = Number(this.newProduct.precio);
    if (this.newProduct.precio === null || this.newProduct.precio === undefined || isNaN(precio) || precio <= 0) {
      this.modalAlertaService.warning('El precio original debe ser un valor numérico mayor a 0.', 'Precio inválido');
      return;
    }

    const stock = Number(this.newProduct.stock);
    if (this.newProduct.stock === null || this.newProduct.stock === undefined || isNaN(stock) || stock <= 0 || !Number.isInteger(stock)) {
      this.modalAlertaService.warning('El stock debe ser un número entero superior a 0.', 'Stock inválido');
      return;
    }

    let precioOferta: number | null = null;
    if (this.newProduct.precioOferta !== null && this.newProduct.precioOferta !== undefined && String(this.newProduct.precioOferta).trim() !== '') {
      const oferta = Number(this.newProduct.precioOferta);
      if (isNaN(oferta) || oferta <= 0) {
        this.modalAlertaService.warning('El precio de oferta debe ser mayor a 0 o dejarse vacío.', 'Precio de oferta inválido');
        return;
      }
      if (oferta >= precio) {
        this.modalAlertaService.warning('El precio de oferta debe ser menor al precio original.', 'Precio de oferta inválido');
        return;
      }
      precioOferta = Math.round(oferta * 100) / 100;
    }

    const precioFinal = Math.round(precio * 100) / 100;
    const hasOffer = precioOferta !== null && precioOferta > 0 && precioOferta < precioFinal;
    const activePrice = hasOffer ? precioOferta : precioFinal;
    const originalPrice = precioFinal;

    const galUrls = this.miniaturasUrls.filter(url => !!url);
    const imgPrincipal = this.newProduct.imagenPrincipal || 'images/prod-jaspeada.png';

    const payload = {
      nombre: this.newProduct.nombre.trim(),
      precio: activePrice,
      precioOferta: hasOffer ? precioOferta : null,
      precio_oferta: hasOffer ? precioOferta : null,
      precioOriginal: originalPrice,
      precio_original: originalPrice,
      precioAnterior: originalPrice,
      precio_anterior: originalPrice,
      stock: stock,
      categoria: this.newProduct.categoria,
      activo: this.newProduct.visible,
      imageUrl: imgPrincipal,
      imagenPrincipal: imgPrincipal,
      imagenUrl: imgPrincipal,
      imagen_principal: imgPrincipal,
      descripcion: this.newProduct.descripcionCorta,
      descripcionDetallada: this.newProduct.descripcionLarga,
      caracteristicasDestacadas: this.newProduct.caracteristicas,
      subtitulo: this.newProduct.nombre.trim(),
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
          this.modalAlertaService.success('¡Producto registrado con éxito!', '¡Producto registrado con éxito!');
          this.showAddProductModal = false;
          this.cargarProductos();
        },
        error: (err) => {
          console.error('Error al guardar el producto (Multipart):', err);
          this.modalAlertaService.error('Ocurrió un error al guardar el producto.', 'Error al guardar');
        }
      });
    } else {
      this.productosService.crearProducto(payload).subscribe({
        next: (res) => {
          this.modalAlertaService.success('¡Producto registrado con éxito!', '¡Producto registrado con éxito!');
          this.showAddProductModal = false;
          this.cargarProductos();
        },
        error: (err) => {
          console.error('Error al guardar el producto (JSON):', err);
          this.modalAlertaService.error('Ocurrió un error al guardar el producto.', 'Error al guardar');
        }
      });
    }
  }

  guardarCambiosProducto() {
    if (!this.editingProduct.nombre || !this.editingProduct.nombre.trim()) {
      this.modalAlertaService.warning('Por favor ingrese el nombre del producto.', 'Campo requerido');
      return;
    }

    const precio = Number(this.editingProduct.precio);
    if (this.editingProduct.precio === null || this.editingProduct.precio === undefined || isNaN(precio) || precio <= 0) {
      this.modalAlertaService.warning('El precio original debe ser un valor numérico mayor a 0.', 'Precio inválido');
      return;
    }

    const stock = Number(this.editingProduct.stock);
    if (this.editingProduct.stock === null || this.editingProduct.stock === undefined || isNaN(stock) || stock <= 0 || !Number.isInteger(stock)) {
      this.modalAlertaService.warning('El stock debe ser un número entero superior a 0.', 'Stock inválido');
      return;
    }

    let precioOferta: number | null = null;
    if (this.editingProduct.precioOferta !== null && this.editingProduct.precioOferta !== undefined && String(this.editingProduct.precioOferta).trim() !== '') {
      const oferta = Number(this.editingProduct.precioOferta);
      if (isNaN(oferta) || oferta <= 0) {
        this.modalAlertaService.warning('El precio de oferta debe ser mayor a 0 o dejarse vacío.', 'Precio de oferta inválido');
        return;
      }
      if (oferta >= precio) {
        this.modalAlertaService.warning('El precio de oferta debe ser menor al precio original.', 'Precio de oferta inválido');
        return;
      }
      precioOferta = Math.round(oferta * 100) / 100;
    }

    const precioFinal = Math.round(precio * 100) / 100;
    const hasOffer = precioOferta !== null && precioOferta > 0 && precioOferta < precioFinal;
    const activePrice = hasOffer ? precioOferta : precioFinal;
    const originalPrice = precioFinal;

    const galUrls = this.miniaturasUrls.filter(url => !!url);
    const imgPrincipal = this.editingProduct.imagenPrincipal || 'images/prod-jaspeada.png';

    const payload = {
      id: this.editingProduct.id,
      nombre: this.editingProduct.nombre.trim(),
      precio: activePrice,
      precioOferta: hasOffer ? precioOferta : null,
      precio_oferta: hasOffer ? precioOferta : null,
      precioOriginal: originalPrice,
      precio_original: originalPrice,
      precioAnterior: originalPrice,
      precio_anterior: originalPrice,
      stock: stock,
      categoria: this.editingProduct.categoria,
      activo: this.editingProduct.visible,
      imageUrl: imgPrincipal,
      imagenPrincipal: imgPrincipal,
      imagenUrl: imgPrincipal,
      imagen_principal: imgPrincipal,
      descripcion: this.editingProduct.descripcionCorta,
      descripcionDetallada: this.editingProduct.descripcionLarga,
      caracteristicasDestacadas: this.editingProduct.caracteristicas,
      subtitulo: this.editingProduct.nombre.trim(),
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
          this.modalAlertaService.success('¡Producto actualizado con éxito!', 'Actualización exitosa');
          this.closeEditProductModal();
          this.cargarProductos();
        },
        error: (err) => {
          console.error('Error al actualizar el producto (Multipart):', err);
          this.modalAlertaService.error('Ocurrió un error al actualizar el producto.', 'Error al actualizar');
        }
      });
    } else {
      this.productosService.crearProducto(payload).subscribe({
        next: (res) => {
          this.modalAlertaService.success('¡Producto actualizado con éxito!', 'Actualización exitosa');
          this.closeEditProductModal();
          this.cargarProductos();
        },
        error: (err) => {
          console.error('Error al actualizar el producto (JSON):', err);
          this.modalAlertaService.error('Ocurrió un error al actualizar el producto.', 'Error al actualizar');
        }
      });
    }
  }

  guardarConfiguracionGlobal() {
    this.configService.actualizarNegocio({
      ...this.configService.negocio,
      ...this.globalConfig
    });
    this.modalAlertaService.success('Configuración global de Envíos y Devoluciones guardada.', 'Configuración Guardada');
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

  abrirModalOrigenImagen(tipo: 'principal' | 'miniatura1' | 'miniatura2' | 'miniatura3') {
    this.tipoImagenObjetivo = tipo;
    this.showModalOrigenImagen = true;
  }

  cerrarModalOrigenImagen() {
    this.showModalOrigenImagen = false;
  }

  seleccionarGoogleDriveDesdeModal() {
    const tipo = this.tipoImagenObjetivo;
    this.cerrarModalOrigenImagen();
    this.abrirPicker(tipo);
  }

  seleccionarPegarUrlDesdeModal() {
    const tipo = this.tipoImagenObjetivo;
    this.cerrarModalOrigenImagen();
    this.abrirModalPegarUrl(tipo);
  }

  abrirModalPegarUrl(tipo: 'principal' | 'miniatura1' | 'miniatura2' | 'miniatura3') {
    this.tipoImagenObjetivo = tipo;
    this.urlImagenInput = '';
    this.showModalPegarUrl = true;
  }

  cerrarModalPegarUrl() {
    this.showModalPegarUrl = false;
    this.urlImagenInput = '';
  }

  guardarUrlPegada() {
    if (!this.urlImagenInput || !this.urlImagenInput.trim()) {
      this.modalAlertaService.warning('Por favor, ingresa una URL válida de Google Drive.', 'URL de Drive');
      return;
    }
    const trimmed = this.urlImagenInput.trim();
    if (!trimmed.includes('drive.google.com')) {
      this.modalAlertaService.warning('Por favor, ingresa una URL válida de Google Drive.', 'URL de Drive');
      return;
    }

    const fileId = this.extraerGoogleDriveId(trimmed);
    const publicUrl = this.obtenerGoogleDrivePreviewUrl(fileId) || trimmed;

    this.handlePickerUrl(this.tipoImagenObjetivo, publicUrl);
    this.cerrarModalPegarUrl();
  }

  onFileSeleccionadoModal(event: any) {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      if (!this.validarArchivoImagen(file)) {
        if (event.target) event.target.value = '';
        return;
      }

      const tipo = this.tipoImagenObjetivo;
      if (tipo === 'principal') {
        this.handleImageFile(file);
      } else {
        const index = tipo === 'miniatura1' ? 0 : (tipo === 'miniatura2' ? 1 : 2);
        this.procesarArchivoMiniatura(file, index);
      }
      this.cerrarModalOrigenImagen();
      this.cdr.detectChanges();
    }
    if (event.target) {
      event.target.value = '';
    }
  }

  // Delegación para mantener compatibilidad si se invoca elegirOrigenMiniatura
  elegirOrigenMiniatura(tipo: 'miniatura1' | 'miniatura2' | 'miniatura3') {
    this.abrirModalOrigenImagen(tipo);
  }

  abrirPicker(tipo: 'principal' | 'miniatura1' | 'miniatura2' | 'miniatura3') {
    const isGoogleLoaded = typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2;
    const isGapiLoaded = typeof window !== 'undefined' && (window as any).gapi;

    if (!isGoogleLoaded || !isGapiLoaded) {
      console.warn('Google API scripts aún no están listos. Reintentando inicialización...');
      this.loadGooglePicker();
      this.modalAlertaService.info('Iniciando servicios de Google Drive. Por favor intenta presionar el botón de nuevo en un momento.', 'Google Drive');
      return;
    }

    const tokenExpirado = this.tokenTimestamp && (Date.now() - this.tokenTimestamp > 3000 * 1000);
    if (tokenExpirado) {
      this.oauthToken = '';
      this.tokenTimestamp = 0;
    }

    if (!this.oauthToken) {
      try {
        const client = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: this.clientId || GOOGLE_CLIENT_ID,
          scope: 'https://www.googleapis.com/auth/drive.readonly',
          callback: (response: any) => {
            if (response.error !== undefined) {
              console.error('❌ Error al inicializar Token Client:', response);
              this.oauthToken = '';
              this.tokenTimestamp = 0;
              this.modalAlertaService.error('No se pudo autenticar con Google. Puedes utilizar la opción "Pegar URL" o "Desde PC".', 'Error de Autenticación');
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
        console.warn('Google GSI Token Client initialization failed:', err);
        this.oauthToken = '';
        this.tokenTimestamp = 0;
        this.modalAlertaService.warning('No se pudo iniciar sesión con Google Drive. Puedes usar "Pegar URL" o "Desde PC".', 'Google Drive');
      }
    } else {
      this.createPicker(tipo);
    }
  }

  createPicker(tipo: 'principal' | 'miniatura1' | 'miniatura2' | 'miniatura3') {
    const isGooglePickerAvailable = typeof window !== 'undefined' && (window as any).google?.picker;
    const isGapiPickerAvailable = typeof window !== 'undefined' && (window as any).gapi?.picker;

    if (this.pickerApiLoaded && this.oauthToken && (isGooglePickerAvailable || isGapiPickerAvailable)) {
      try {
        const pickerNamespace = isGooglePickerAvailable ? (window as any).google.picker : (window as any).gapi.picker;
        const view = new pickerNamespace.View(pickerNamespace.ViewId.DOCS);
        view.setMimeTypes('image/png,image/jpeg,image/jpg,image/webp,image/gif');

        const picker = new pickerNamespace.PickerBuilder()
          .enableFeature(pickerNamespace.Feature.NAV_HIDDEN)
          .setDeveloperKey(this.developerKey || GOOGLE_DEVELOPER_KEY)
          .setAppId(this.clientId ? this.clientId.split('-')[0] : '398851876989')
          .setOAuthToken(this.oauthToken)
          .addView(view)
          .setCallback((data: any) => {
            if (data.action === pickerNamespace.Action.PICKED) {
              const doc = data.docs[0];
              const fileId = doc[pickerNamespace.Document.ID] || doc.id;
              const publicUrl = this.obtenerGoogleDrivePreviewUrl(fileId);
              this.handlePickerUrl(tipo, publicUrl);
            } else if (data.action === 'error' || data.error) {
              console.error('❌ Error detectado en el callback de Google Picker:', data.error || data);
              this.oauthToken = '';
              this.tokenTimestamp = 0;
            }
          })
          .build();
        picker.setVisible(true);
      } catch (err) {
        console.error('❌ Excepción al crear Google Picker:', err);
        this.oauthToken = '';
        this.tokenTimestamp = 0;
        this.modalAlertaService.warning('Ocurrió un problema al abrir el selector de Google Drive.', 'Google Drive');
      }
    } else {
      if (typeof window !== 'undefined' && (window as any).gapi) {
        (window as any).gapi.load('picker', () => {
          this.pickerApiLoaded = true;
          this.createPicker(tipo);
        });
      } else {
        this.modalAlertaService.warning('La API de Google Picker aún se está cargando. Intenta de nuevo en unos segundos.', 'Google Drive');
      }
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
    if (cleanId.includes('/') || cleanId.includes('.') || cleanId.includes(':')) {
      if (cleanId.startsWith('http')) {
        return cleanId;
      }
      return '';
    }
    return `https://lh3.googleusercontent.com/d/${cleanId}`;
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

  validarArchivoImagen(file: File): boolean {
    if (!file) return false;

    const validExtensions = ['.jpg', '.jpeg', '.png'];
    const validMimeTypes = ['image/jpeg', 'image/jpg', 'image/png'];

    const fileName = (file.name || '').toLowerCase();
    const fileExt = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : '';
    const fileMime = (file.type || '').toLowerCase();

    const hasValidExt = validExtensions.includes(fileExt);
    const hasValidMime = validMimeTypes.includes(fileMime);

    // Formato válido: exclusivamente archivos con extensión o tipo MIME de .jpg, .jpeg o .png
    const esFormatoValido = hasValidExt && (hasValidMime || fileMime === '');

    // Tamaño máximo: 2 MB (2 * 1024 * 1024 = 2,097,152 bytes)
    const maxBytes = 2 * 1024 * 1024;
    const esTamanoValido = file.size > 0 && file.size <= maxBytes;

    if (!esFormatoValido || !esTamanoValido) {
      this.modalAlertaService.warning(
        'Formato no válido. Solo se admiten archivos .jpg, .jpeg o .png de hasta 2MB.',
        'Formato no válido'
      );
      return false;
    }

    return true;
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingMain = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingMain = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingMain = false;
    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      this.handleImageFile(file);
    }
  }

  onDragOverMiniatura(event: DragEvent, index: number) {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingThumb[index] = true;
  }

  onDragLeaveMiniatura(event: DragEvent, index: number) {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingThumb[index] = false;
  }

  onDropMiniatura(event: DragEvent, index: number) {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingThumb[index] = false;
    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      this.procesarArchivoMiniatura(file, index);
    }
  }

  procesarArchivoMiniatura(file: File, index: number) {
    if (!this.validarArchivoImagen(file)) {
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const safeUrl = this.sanitizer.bypassSecurityTrustUrl(objectUrl);
    this.miniaturasTemp[index] = safeUrl;
    this.miniaturasUrls[index] = objectUrl;
    this.miniaturaError[index] = false;

    if (this.showEditProductModal && this.editingProduct?.id) {
      this.productosService.subirImagenProducto(this.editingProduct.id, file).subscribe({
        next: (res: any) => {
          const urlGuardada = res.imagenPrincipal || res.imageUrl || res.url;
          if (urlGuardada) {
            this.miniaturasUrls[index] = urlGuardada;
            this.miniaturasTemp[index] = this.sanitizer.bypassSecurityTrustUrl(urlGuardada);
            this.modalAlertaService.success('Miniatura subida y guardada exitosamente.', 'Miniatura actualizada');
            this.cdr.detectChanges();
          }
        },
        error: (err: any) => {
          console.error('Error al subir miniatura:', err);
          this.modalAlertaService.error('Error al subir la miniatura al servidor.', 'Error de subida');
        }
      });
    }
    this.cdr.detectChanges();
  }

  readonly DEFAULT_PLACEHOLDER = '/assets/img/placeholder-producto.png';

  onImgError(event: Event, prod?: any) {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.onerror = null; // Corta la propagación y bucles infinitos
      target.src = this.DEFAULT_PLACEHOLDER;
    }
    if (prod) {
      prod.imagenPrincipal = this.DEFAULT_PLACEHOLDER;
      prod.imageUrl = this.DEFAULT_PLACEHOLDER;
      prod.imagen_principal = this.DEFAULT_PLACEHOLDER;
    }
  }

  onFileSelected(event: any) {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      this.handleImageFile(file);
    }
    if (event.target) {
      event.target.value = '';
    }
  }

  handleImageFile(file: File) {
    if (!this.validarArchivoImagen(file)) {
      return;
    }

    this.archivoImagen = file;
    const objectUrl = URL.createObjectURL(file);
    this.imagenTemporalUrl = this.sanitizer.bypassSecurityTrustUrl(objectUrl);
    if (this.showEditProductModal) {
      this.editingProduct.imagenPrincipal = objectUrl;
      (this.editingProduct as any).imagen_principal = objectUrl;

      // Subida directa al backend de Spring Boot
      if (this.editingProduct.id) {
        this.productosService.subirImagenProducto(this.editingProduct.id, file).subscribe({
          next: (res: any) => {
            const urlGuardada = res.imagenPrincipal || res.imageUrl || res.url;
            if (urlGuardada) {
              this.editingProduct.imagenPrincipal = urlGuardada;
              (this.editingProduct as any).imagen_principal = urlGuardada;
              (this.editingProduct as any).imageUrl = urlGuardada;
              this.imagenTemporalUrl = this.sanitizer.bypassSecurityTrustUrl(urlGuardada);

              this.cargarProductos();
              this.modalAlertaService.success('Imagen subida y guardada exitosamente en el servidor.', 'Imagen actualizada');
              this.cdr.detectChanges();
            }
          },
          error: (err: any) => {
            console.error('Error al subir imagen al servidor:', err);
            this.modalAlertaService.error('Error al subir la imagen al servidor.', 'Error de subida');
          }
        });
      }
    } else {
      this.newProduct.imagenPrincipal = objectUrl;
      (this.newProduct as any).imagenUrl = objectUrl;
    }
    this.cdr.detectChanges();
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
