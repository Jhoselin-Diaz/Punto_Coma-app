import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { ContentService, HomeBanner } from '../../../service/content.service';
import { CategoriasDestacadasService, CategoriaDestacadaDTO } from '../../../service/categorias-destacadas.service';
import { ProductosService } from '../../../service/productos.service';
import { ModalAlertaService } from '../../../service/modal-alerta.service';

declare var gapi: any;
declare var google: any;

export const GOOGLE_DEVELOPER_KEY = 'AIzaSyBqV0Vr1NI8dYU-LE4rE3Fv1GrOdJAh6KU';
export const GOOGLE_CLIENT_ID = '398851876989-tuuj11fvmmn06uqtouahvo76qagm5ej3.apps.googleusercontent.com';

export type InicioTab = 'banner' | 'categorias' | 'productos' | 'config' | 'estadisticas';

export const INICIO_TAB_TO_SLUG: Record<InicioTab, string> = {
  banner: 'banner-principal',
  categorias: 'categorias-destacadas',
  productos: 'productos-destacados',
  config: 'configuracion-visual',
  estadisticas: 'estadisticas'
};

export const INICIO_SLUG_TO_TAB: Record<string, InicioTab> = {
  'banner-principal': 'banner',
  'banner': 'banner',
  'categorias-destacadas': 'categorias',
  'categorias': 'categorias',
  'productos-destacados': 'productos',
  'productos': 'productos',
  'configuracion-visual': 'config',
  'config': 'config',
  'estadisticas': 'estadisticas'
};

@Component({
  selector: 'app-admin-inicio',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-inicio.component.html',
  styleUrl: './admin-inicio.component.css'
})
export class AdminInicioComponent implements OnInit, OnDestroy {
  // Control de sub-pestañas internas de Inicio
  inicioTabActiva: InicioTab = 'banner';
  private routeSub?: Subscription;
  pendingEditCategoryId: number | null = null;

  // Banner Principal state
  bannerId?: number;
  bannerTitle = '';
  bannerSubtitle = '';
  bannerBtnText = '';
  bannerBtnLink = '';
  bannerImage = '';
  bannerPreviewStyle: any = '';
  bannerVisible = true;
  imagenSeleccionada: File | null = null;
  isBannerLoading = false;
  isDraggingBanner = false;
  isDraggingCategory = false;
  archivoCategoriaSeleccionada: File | null = null;

  // Campo de URL manual (alternativa al Google Drive Picker)
  driveUrlManual = '';

  // Variables reales del backend
  categorias: CategoriaDestacadaDTO[] = [];
  productosMasVistos: any[] = [];
  productosDisponibles: any[] = [];

  // Formulario de "+ Agregar Categoria"
  showAddCategoryModal = false;
  isEditingCategory = false;
  categoriaEnEdicion: CategoriaDestacadaDTO = {
    nombreCategoria: '',
    tipo: 'MANUAL',
    prioridad: 0,
    visible: true,
    productosIds: []
  };

  // Interruptores de configuración visual
  configAnimaciones = true;
  configCarrusel = false;
  configMostrarOfertas = true;
  configCategoriasPopulares = true;

  // Google Picker Configurations
  developerKey = GOOGLE_DEVELOPER_KEY;
  clientId = GOOGLE_CLIENT_ID;
  oauthToken = '';
  pickerApiLoaded = false;

  constructor(
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
    private contentService: ContentService,
    private categoriasService: CategoriasDestacadasService,
    private productosService: ProductosService,
    private ngZone: NgZone,
    private modalAlertaService: ModalAlertaService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.cargarBanner();
    this.cargarCategorias();
    this.cargarEstadisticas();
    this.cargarProductosDisponibles();
    this.loadGooglePicker();

    this.sincronizarConUrl();
    this.routeSub = this.route.queryParams.subscribe(() => {
      this.sincronizarConUrl();
    });
  }

  ngOnDestroy() {
    this.routeSub?.unsubscribe();
  }

  private sincronizarConUrl(): void {
    const qp = this.route.snapshot.queryParamMap;
    const tabParam = qp.get('tab');
    const actionParam = qp.get('action');
    const idParam = qp.get('id');

    // Revisar si la ruta path contiene la subsección/pestaña
    const rawUrl = this.router.url;
    const urlWithoutQuery = rawUrl.split('?')[0];
    const pathSegments = urlWithoutQuery.split('/').filter(Boolean);
    const inicioIdx = pathSegments.indexOf('inicio');
    let pathTab: string | null = null;
    let pathAction: string | null = null;
    let pathId: string | null = null;

    if (inicioIdx !== -1 && pathSegments.length > inicioIdx + 1) {
      pathTab = pathSegments[inicioIdx + 1];
      if (pathSegments.length > inicioIdx + 3) {
        pathAction = pathSegments[inicioIdx + 2];
        pathId = pathSegments[inicioIdx + 3];
      }
    }

    const tabKey = tabParam || pathTab;
    if (tabKey && INICIO_SLUG_TO_TAB[tabKey]) {
      this.inicioTabActiva = INICIO_SLUG_TO_TAB[tabKey];
    }

    const action = actionParam || pathAction;
    const id = idParam || pathId;

    if ((action === 'edit' || action === 'editar') && id) {
      const numId = Number(id);
      if (!isNaN(numId)) {
        this.pendingEditCategoryId = numId;
        this.verificarAperturaModalEdicion(numId);
      }
    } else {
      this.pendingEditCategoryId = null;
      if (this.showAddCategoryModal && this.isEditingCategory) {
        this.showAddCategoryModal = false;
        this.isEditingCategory = false;
      }
    }

    this.cdr.detectChanges();
  }

  private verificarAperturaModalEdicion(id: number): void {
    if (this.categorias && this.categorias.length > 0) {
      const cat = this.categorias.find(c => c.id === id);
      if (cat) {
        this.openEditCategory(cat, false);
      }
    }
  }

  setInicioTab(tab: InicioTab) {
    this.inicioTabActiva = tab;
    const slug = INICIO_TAB_TO_SLUG[tab] || 'banner-principal';
    this.router.navigate(['/admin/contenido-web/inicio'], {
      queryParams: { tab: slug }
    });
    this.cdr.detectChanges();
  }

  cargarCategorias() {
    this.categoriasService.obtenerTodas().subscribe({
      next: (res) => {
        this.categorias = res;
        if (this.pendingEditCategoryId) {
          this.verificarAperturaModalEdicion(this.pendingEditCategoryId);
        }
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error al cargar categorias', err)
    });
  }

  cargarEstadisticas() {
    this.productosService.obtenerMasVistos().subscribe({
      next: (res) => {
        this.productosMasVistos = res;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error al cargar mas vistos', err)
    });
  }

  cargarProductosDisponibles() {
    this.productosService.obtenerTodosBackend().subscribe({
      next: (res) => {
        this.productosDisponibles = res;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error al cargar productos disponibles', err)
    });
  }

  openAddCategory() {
    this.isEditingCategory = false;
    this.isDraggingCategory = false;
    this.archivoCategoriaSeleccionada = null;
    this.categoriaEnEdicion = {
      nombreCategoria: '',
      tipo: 'MANUAL',
      prioridad: this.categorias.length + 1,
      visible: true,
      productosIds: []
    };
    this.showAddCategoryModal = true;
    this.cdr.detectChanges();
  }

  openEditCategory(cat: CategoriaDestacadaDTO, updateUrl = true) {
    this.isEditingCategory = true;
    this.isDraggingCategory = false;
    this.archivoCategoriaSeleccionada = null;
    this.categoriaEnEdicion = {
      id: cat.id,
      nombreCategoria: cat.nombreCategoria,
      tipo: cat.tipo,
      prioridad: cat.prioridad,
      visible: cat.visible,
      imagenUrl: cat.imagenUrl,
      productosIds: cat.productosIds ? [...cat.productosIds] : []
    };
    this.showAddCategoryModal = true;
    if (updateUrl && cat.id) {
      const slug = INICIO_TAB_TO_SLUG[this.inicioTabActiva] || 'categorias-destacadas';
      this.router.navigate(['/admin/contenido-web/inicio'], {
        queryParams: { tab: slug, action: 'edit', id: cat.id }
      });
    }
    this.cdr.detectChanges();
  }

  closeCategoryModal() {
    this.showAddCategoryModal = false;
    this.isEditingCategory = false;
    this.isDraggingCategory = false;
    this.archivoCategoriaSeleccionada = null;
    this.pendingEditCategoryId = null;
    const slug = INICIO_TAB_TO_SLUG[this.inicioTabActiva] || 'categorias-destacadas';
    this.router.navigate(['/admin/contenido-web/inicio'], {
      queryParams: { tab: slug }
    });
    this.cdr.detectChanges();
  }

  toggleCategoryVisibility(cat: CategoriaDestacadaDTO) {
    if (!cat.id) return;
    this.categoriasService.actualizarVisibilidad(cat.id, !cat.visible).subscribe({
      next: (res) => {
        cat.visible = res.visible;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error al cambiar visibilidad de categoria', err)
    });
  }

  toggleProductInSelection(prodId: number) {
    if (!this.categoriaEnEdicion.productosIds) {
      this.categoriaEnEdicion.productosIds = [];
    }
    const idx = this.categoriaEnEdicion.productosIds.indexOf(prodId);
    if (idx > -1) {
      this.categoriaEnEdicion.productosIds.splice(idx, 1);
    } else {
      this.categoriaEnEdicion.productosIds.push(prodId);
    }
    this.cdr.detectChanges();
  }

  isProductSelected(prodId: number): boolean {
    return !!this.categoriaEnEdicion.productosIds && this.categoriaEnEdicion.productosIds.includes(prodId);
  }

  saveCategory() {
    if (!this.categoriaEnEdicion.nombreCategoria.trim()) {
      alert('Por favor ingresa un nombre para la categoría.');
      return;
    }

    const request$ = this.isEditingCategory && this.categoriaEnEdicion.id
      ? this.categoriasService.actualizarCategoria(this.categoriaEnEdicion.id, this.categoriaEnEdicion)
      : this.categoriasService.crearCategoria(this.categoriaEnEdicion);

    request$.subscribe({
      next: () => {
        alert('Categoría destacada guardada exitosamente.');
        this.closeCategoryModal();
        this.cargarCategorias();
        this.cargarEstadisticas();
      },
      error: (err) => {
        console.error('Error al guardar categoria', err);
        alert('Ocurrió un error al guardar la categoría.');
      }
    });
  }

  async borrarCategoria(id?: number) {
    if (!id) return;
    const confirmado = await this.modalAlertaService.confirm({
      titulo: '¿Eliminar categoría?',
      mensaje: '¿Estás seguro de eliminar esta categoría destacada?',
      tipo: 'peligro',
      textoConfirmar: 'Sí, eliminar',
      textoCancelar: 'Cancelar'
    });
    if (confirmado) {
      this.categoriasService.eliminarCategoria(id).subscribe({
        next: () => {
          this.modalAlertaService.success('Categoría eliminada exitosamente.');
          this.cargarCategorias();
        },
        error: (err) => {
          console.error('Error al borrar categoria', err);
          this.modalAlertaService.error('Ocurrió un error al intentar eliminar la categoría.');
        }
      });
    }
  }

  cargarBanner() {
    this.isBannerLoading = true;
    this.contentService.getHomeBanner().subscribe({
      next: (banner) => {
        this.bannerId = banner.id;
        this.bannerTitle = banner.titulo;
        this.bannerSubtitle = banner.subtitulo;
        this.bannerBtnText = banner.textoBoton;
        this.bannerBtnLink = banner.linkBoton;
        this.bannerImage = banner.imagenUrl;
        this.bannerVisible = banner.visible;
        this.driveUrlManual = '';
        if (this.bannerImage) {
          const renderUrl = this.obtenerUrlRenderizable(this.bannerImage);
          this.bannerPreviewStyle = this.sanitizer.bypassSecurityTrustStyle(`url('${renderUrl}')`);
        } else {
          this.bannerPreviewStyle = '';
        }
        this.isBannerLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al cargar el banner', err);
        this.isBannerLoading = false;
      }
    });
  }

  /**
   * Se dispara cada vez que el usuario pega o escribe en el campo de URL manual.
   * Acepta: URL completa de Drive, ID de 33 carácteres, URLs de Supabase, cualquier URL directa.
   */
  onUrlManualChange(valor: string) {
    const trimmed = (valor || '').trim();
    if (!trimmed) return;

    const id = this.extraerGoogleDriveId(trimmed);
    const directUrl = `https://lh3.googleusercontent.com/d/${id}`;

    this.bannerImage = directUrl;
    this.driveUrlManual = trimmed;
    this.bannerPreviewStyle = this.sanitizer.bypassSecurityTrustStyle(`url('${directUrl}')`);
    this.imagenSeleccionada = null;
    this.emitirPreviewLocal();
    this.cdr.detectChanges();
  }

  /**
   * Emite el estado actual del formulario al BehaviorSubject del servicio
   * para que inicio.component.ts (vista pública) refleje los cambios al instante.
   */
  emitirPreviewLocal() {
    this.contentService.emitirBannerLocal({
      id: this.bannerId,
      titulo: this.bannerTitle,
      subtitulo: this.bannerSubtitle,
      textoBoton: this.bannerBtnText,
      linkBoton: this.bannerBtnLink,
      imagenUrl: this.bannerImage,
      visible: this.bannerVisible
    });
  }

  loadGooglePicker() {
    const hasGapi = typeof window !== 'undefined' && (window as any).gapi;
    const hasGoogle = typeof window !== 'undefined' && (window as any).google;

    if (hasGapi && (window as any).gapi.load) {
      gapi.load('picker', () => {
        this.pickerApiLoaded = true;
        console.log("Picker listo en AdminInicio - Google Picker API cargada con éxito.");
      });
    } else {
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        gapi.load('picker', () => {
          this.pickerApiLoaded = true;
          console.log("Picker listo en AdminInicio - Google Picker API cargada con éxito.");
        });
      };
      document.head.appendChild(script);
    }

    if (!hasGoogle || !(window as any).google.accounts) {
      const gsiScript = document.createElement('script');
      gsiScript.src = 'https://accounts.google.com/gsi/client';
      gsiScript.onload = () => {
        console.log("Google Identity Services (GIS) cargada con éxito en AdminInicio.");
      };
      document.head.appendChild(gsiScript);
    } else {
      console.log("Google Identity Services (GIS) ya disponible en AdminInicio.");
    }
  }

  abrirPicker(tipo: 'banner') {
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

  createPicker(tipo: 'banner') {
    const isGooglePickerAvailable = typeof window !== 'undefined' && (window as any).google && (window as any).google.picker;
    const isGapiPickerAvailable = typeof window !== 'undefined' && (window as any).gapi && (window as any).gapi.picker;

    if (this.pickerApiLoaded && this.oauthToken && (isGooglePickerAvailable || isGapiPickerAvailable)) {
      try {
        const pickerNamespace = isGooglePickerAvailable ? (window as any).google.picker : (window as any).gapi.picker;
        console.log("Picker listo - Objeto de picker disponible en AdminInicio:", pickerNamespace);

        const view = new pickerNamespace.View(pickerNamespace.ViewId.DOCS);
        view.setMimeTypes('image/png,image/jpeg,image/jpg,image/webp,image/gif');

        const picker = new pickerNamespace.PickerBuilder()
          .enableFeature(pickerNamespace.Feature.NAV_HIDDEN)
          .setDeveloperKey(this.developerKey || 'YOUR_DEVELOPER_KEY')
          .setAppId(this.clientId ? this.clientId.split('-')[0] : 'YOUR_APP_ID')
          .setOAuthToken(this.oauthToken)
          .addView(view)
          .setCallback((data: any) => {
            console.log('Picker Event Completo en AdminInicio:', data);

            if (data[google.picker.Response.ACTION] === google.picker.Action.PICKED) {
              const doc = data[google.picker.Response.DOCUMENTS][0];
              console.log('Documento seleccionado de Drive en AdminInicio:', doc);

              // Usar lh3.googleusercontent.com directamente para evitar bloqueos CORS
              // de docs.google.com/uc que no carga en background-image cross-origin
              const fileId = doc[google.picker.Document.ID] || doc.id;
              const directUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
              console.log('URL lh3 construida en AdminInicio:', directUrl);

              this.ngZone.run(() => {
                this.handlePickerUrl(tipo, directUrl);
              });
              this.cdr.detectChanges();
            } else if (data[google.picker.Response.ACTION] === google.picker.Action.CANCEL) {
              console.log('El usuario canceló el Picker en AdminInicio');
            }
          })
          .build();
        picker.setVisible(true);
      } catch (err) {
        console.error('Error al crear Google Picker en AdminInicio:', err);
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
    // Usar lh3 en vez de docs.google.com/uc para evitar bloqueos CORS en background-image
    return `https://lh3.googleusercontent.com/d/${id}`;
  }

  /**
   * Convierte cualquier variante de URL de Google Drive o Supabase
   * a una URL directamente renderizable en background-image / img src.
   *
   * Casos que cubre:
   *  - docs.google.com/uc?export=view&id=ID  → lh3.googleusercontent.com/d/ID
   *  - drive.google.com/uc?export=view&id=ID → lh3.googleusercontent.com/d/ID
   *  - drive.google.com/file/d/ID/view       → lh3.googleusercontent.com/d/ID
   *  - lh3.googleusercontent.com/d/ID        → sin cambios (ya procesada)
   *  - https://xxx.supabase.co/storage/v1/... → sin cambios (URL directa de Supabase)
   *  - blob:http://...                        → sin cambios (ObjectURL local de PC)
   *  - cualquier otra URL                    → sin cambios
   */
  obtenerUrlRenderizable(url: string): string {
    if (!url) return '';

    // 1. Ya está en formato lh3 — usar tal cual
    if (url.includes('lh3.googleusercontent.com')) return url;

    // 2. URL de Supabase (almacenamiento directo) — usar tal cual
    if (url.includes('supabase.co/storage') || url.includes('supabase.in/storage')) return url;

    // 3. blob: ObjectURL de selección desde PC — usar tal cual
    if (url.startsWith('blob:')) return url;

    // 4. docs.google.com/uc?export=view&id=ID o drive.google.com/uc?id=ID
    if (url.includes('docs.google.com/uc') || url.includes('drive.google.com/uc')) {
      const match = url.match(/[?&]id=([^&]+)/);
      if (match && match[1]) {
        return `https://lh3.googleusercontent.com/d/${match[1]}`;
      }
    }

    // 5. drive.google.com/file/d/ID/... o /open?id=ID
    if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
      const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (fileMatch && fileMatch[1]) {
        return `https://lh3.googleusercontent.com/d/${fileMatch[1]}`;
      }
      // /d/ID directamente
      const dMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (dMatch && dMatch[1]) {
        return `https://lh3.googleusercontent.com/d/${dMatch[1]}`;
      }
    }

    // 6. Cualquier otra URL — devolver sin modificar
    return url;
  }

  fallbackUrlPrompt(tipo: 'banner') {
    const input = prompt('Ingresa la URL de la imagen de Google Drive o el ID del archivo:');
    if (input) {
      const fileId = this.extraerGoogleDriveId(input);
      const publicUrl = this.obtenerGoogleDrivePreviewUrl(fileId);
      this.handlePickerUrl(tipo, publicUrl);
    }
  }

  handlePickerUrl(tipo: 'banner', url: string) {
    this.ngZone.run(() => {
      const renderUrl = this.obtenerUrlRenderizable(url);
      if (tipo === 'banner') {
        this.bannerImage = url;
        this.bannerPreviewStyle = this.sanitizer.bypassSecurityTrustStyle(`url('${renderUrl}')`);
        this.imagenSeleccionada = null;
      }
      this.cdr.detectChanges();
    });
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

    // Formatos válidos: exclusivamente archivos con extensión o tipo MIME de .jpg, .jpeg o .png
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

  onDragOverBanner(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingBanner = true;
  }

  onDragLeaveBanner(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingBanner = false;
  }

  onDropBanner(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingBanner = false;
    if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      this.procesarArchivoBanner(file);
    }
  }

  onBannerFileSelected(event: any) {
    if (event.target && event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      this.procesarArchivoBanner(file);
      event.target.value = '';
    }
  }

  procesarArchivoBanner(file: File) {
    if (!this.validarArchivoImagen(file)) {
      return;
    }

    this.imagenSeleccionada = file;
    const objectUrl = URL.createObjectURL(file);
    this.bannerImage = objectUrl;
    this.driveUrlManual = '';
    this.ngZone.run(() => {
      this.bannerPreviewStyle = this.sanitizer.bypassSecurityTrustStyle(`url('${objectUrl}')`);
      this.cdr.detectChanges();
    });
  }

  onDragOverCategory(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingCategory = true;
  }

  onDragLeaveCategory(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingCategory = false;
  }

  onDropCategory(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingCategory = false;
    if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      this.procesarArchivoCategoria(file);
    }
  }

  onCategoryFileSelected(event: any) {
    if (event.target && event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      this.procesarArchivoCategoria(file);
      event.target.value = '';
    }
  }

  procesarArchivoCategoria(file: File) {
    if (!this.validarArchivoImagen(file)) {
      return;
    }

    this.archivoCategoriaSeleccionada = file;
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.categoriaEnEdicion.imagenUrl = e.target.result;
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);
  }

  guardarCambios() {
    // Parche 3: nunca persistir un blob: URL (ObjectURL local de selección de PC).
    // Si bannerImage es blob: y no hay imagenSeleccionada, la imagen no se guarda
    // (el backend no puede acceder a un blob del navegador del admin).
    const urlParaPersistir = (this.bannerImage || '').startsWith('blob:')
      ? ''
      : (this.bannerImage || '');

    const bannerActualizado: HomeBanner = {
      id: this.bannerId,
      titulo: this.bannerTitle,
      subtitulo: this.bannerSubtitle,
      textoBoton: this.bannerBtnText,
      linkBoton: this.bannerBtnLink,
      imagenUrl: urlParaPersistir,
      visible: this.bannerVisible
    };

    const request$ = this.imagenSeleccionada
      ? this.contentService.updateHomeBannerMultipart(bannerActualizado, this.imagenSeleccionada)
      : this.contentService.updateHomeBannerJson(bannerActualizado);

    request$.subscribe({
      next: (res) => {
        alert('¡Banner guardado exitosamente en la base de datos de Supabase!');
        this.bannerId = res.id;
        this.bannerTitle = res.titulo;
        this.bannerSubtitle = res.subtitulo;
        this.bannerBtnText = res.textoBoton;
        this.bannerBtnLink = res.linkBoton;
        this.bannerImage = res.imagenUrl;
        this.bannerVisible = res.visible;
        this.imagenSeleccionada = null;
        if (this.bannerImage) {
          const renderUrl = this.obtenerUrlRenderizable(this.bannerImage);
          this.bannerPreviewStyle = this.sanitizer.bypassSecurityTrustStyle(`url('${renderUrl}')`);
        } else {
          this.bannerPreviewStyle = '';
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al guardar cambios del banner:', err);
        alert('Ocurrió un error al guardar los cambios en el servidor.');
      }
    });
  }
}
