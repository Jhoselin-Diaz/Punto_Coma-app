import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { ProductosService } from '../../../service/productos.service';
import { ConfiguracionService } from '../../../service/configuracion.service';
import { ModalAlertaService } from '../../../service/modal-alerta.service';
import { GOOGLE_DEVELOPER_KEY, GOOGLE_CLIENT_ID } from '../admin-contenido-web.component';

declare var google: any;
declare var gapi: any;

@Component({
  selector: 'app-admin-ofertas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-ofertas.component.html',
  styleUrl: './admin-ofertas.component.css'
})
export class AdminOfertasComponent implements OnInit, OnDestroy {
  pestanaActiva = 'descuentos';
  isLoading = true;
  private routeSub?: Subscription;
  pendingEditOfferId: number | null = null;

  statsOfertas = {
    activas: 0,
    productosDescuento: 0,
    proximas: 0
  };

  ofertasList: any[] = [];
  productosDisponibles: any[] = [];
  productoSeleccionado: any = null;
  productoSeleccionadoEdit: any = null;

  showAddOfferModal = false;
  showEditOfferModal = false;

  // Errores de validación CP076
  errorDescuentoNuevo = false;
  errorPrecioOfertaNuevo = false;
  errorDescuentoEdit = false;
  errorPrecioOfertaEdit = false;

  // Formulario AGREGAR OFERTA
  newOffer = {
    id: '',
    producto: '',
    precioOriginal: 0,
    precioOferta: 0,
    descuento: 0,
    fechaInicio: '',
    fechaFin: '',
    visible: true
  };

  // Formulario EDITAR OFERTA
  editingOffer = {
    id: '',
    producto: '',
    precioOriginal: 0,
    precioOferta: 0,
    descuento: 0,
    fechaInicio: '',
    fechaFin: '',
    visible: true
  };

  // Configuración del Banner Promocional
  bannerConfig = {
    titulo: '',
    descripcion: '',
    imagenUrl: ''
  };

  // Configuración del Google Picker
  developerKey = GOOGLE_DEVELOPER_KEY;
  clientId = GOOGLE_CLIENT_ID;
  oauthToken = '';
  tokenTimestamp = 0;
  pickerApiLoaded = false;

  constructor(
    private productosService: ProductosService,
    public configService: ConfiguracionService,
    private modalAlertaService: ModalAlertaService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.cargarOfertas();
    this.cargarConfiguracionBannerOfertas();
    this.loadGooglePicker();

    this.routeSub = this.route.queryParams.subscribe(params => {
      if (params['action'] === 'edit' && params['id']) {
        const numId = Number(params['id']);
        if (!isNaN(numId)) {
          this.pendingEditOfferId = numId;
          this.verificarAperturaModalEdicion(numId);
        }
      } else {
        this.pendingEditOfferId = null;
        if (this.showEditOfferModal) {
          this.showEditOfferModal = false;
        }
      }
    });
  }

  ngOnDestroy() {
    this.routeSub?.unsubscribe();
  }

  private verificarAperturaModalEdicion(id: number): void {
    if (this.ofertasList && this.ofertasList.length > 0) {
      const of = this.ofertasList.find(o => o.id === id) || this.productosDisponibles.find(p => p.id === id);
      if (of) {
        this.openEditOffer(of, false);
      }
    }
  }

  closeEditOfferModal() {
    this.showEditOfferModal = false;
    this.pendingEditOfferId = null;
    this.errorDescuentoEdit = false;
    this.errorPrecioOfertaEdit = false;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { action: null, id: null },
      queryParamsHandling: 'merge'
    });
  }

  parseBackendDate(dateVal: any): any {
    if (!dateVal) return null;
    
    // Si viene como array [yyyy, mm, dd] (común con Jackson deserializando LocalDate)
    if (Array.isArray(dateVal)) {
      if (dateVal.length >= 3) {
        const yyyy = dateVal[0];
        const mm = String(dateVal[1]).padStart(2, '0');
        const dd = String(dateVal[2]).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }
    }
    
    return dateVal;
  }

  cargarOfertas() {
    this.isLoading = true;
    this.productosService.obtenerTodosBackend().subscribe({
      next: (data) => {
        this.productosDisponibles = data;
        
        // Filtramos solo los productos que tienen precioOferta mayor a 0 y menor a precioOriginal
        this.ofertasList = data
          .filter(p => p.precioOferta && p.precioOferta > 0 && p.precioOriginal > p.precioOferta)
          .map(p => {
            const original = p.precioOriginal || p.precio || 0;
            const oferta = p.precioOferta || 0;
            const desc = this.getDescuentoPorcentaje(original, oferta);
            return {
              id: p.id,
              producto: p.nombre,
              precioOriginal: original,
              precioOferta: oferta,
              descuento: desc,
              fechaInicio: this.parseBackendDate(p.fechaInicioOferta),
              fechaFin: this.parseBackendDate(p.fechaFinOferta),
              fechaInicioOferta: this.parseBackendDate(p.fechaInicioOferta),
              fechaFinOferta: this.parseBackendDate(p.fechaFinOferta),
              visible: p.visible !== false && p.activo !== false,
              imagenPrincipal: p.imagenPrincipal || p.imageUrl || p.imagen_principal || 'images/prod-jaspeada.png'
            };
          });
          
        this.recalcularStats();
        if (this.pendingEditOfferId) {
          this.verificarAperturaModalEdicion(this.pendingEditOfferId);
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error al cargar ofertas del backend:', err);
        this.isLoading = false;
      }
    });
  }

  recalcularStats() {
    this.statsOfertas.activas = this.ofertasList.filter(o => o.visible).length;
    this.statsOfertas.productosDescuento = this.ofertasList.length;
    this.statsOfertas.proximas = 0;
  }

  getDescuentoPorcentaje(original: number, oferta: number): number {
    if (!original || !oferta || original <= 0) return 0;
    const diff = original - oferta;
    return Math.max(0, Math.round((diff * 100) / original));
  }

  getProductoImagen(prod: any): string {
    if (!prod) return 'images/prod-jaspeada.png';
    return prod.imagenPrincipal || prod.imageUrl || prod.imagen_principal || 'images/prod-jaspeada.png';
  }

  formatDateToYYYYMMDD(dateVal: any): string {
    if (!dateVal) return '';
    
    // Si viene como array [yyyy, mm, dd]
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

  toggleVisible(of: any) {
    const nuevoEstado = !of.visible;
    this.productosService.actualizarVisibilidadProducto(of.id, nuevoEstado).subscribe({
      next: () => {
        of.visible = nuevoEstado;
        this.productosService.obtenerProductosPublicos(true).subscribe(); // Pre-cargar cache fresco
        console.log(`✅ Visibilidad de la oferta/producto "${of.producto}" conmutada a ${nuevoEstado}`);
        this.recalcularStats();
      },
      error: (err) => {
        console.error('Error al cambiar visibilidad de la oferta:', err);
        alert('No se pudo actualizar la visibilidad en el servidor.');
      }
    });
  }

  async eliminarOferta(of: any) {
    const confirmado = await this.modalAlertaService.confirm({
      titulo: '¿Eliminar oferta?',
      mensaje: `¿Estás seguro de que deseas eliminar la oferta del producto "${of.producto}"?`,
      tipo: 'peligro',
      textoConfirmar: 'Sí, eliminar',
      textoCancelar: 'Cancelar'
    });
    if (confirmado) {
      const prod = this.productosDisponibles.find(p => p.id === of.id);
      if (prod) {
        // Restauramos el producto a su precio original y limpiamos los campos de oferta
        const original = prod.precioOriginal || prod.precioAnterior || prod.precio || 0;
        const payload = {
          ...prod,
          precio: original,
          precioOferta: null,
          precio_oferta: null,
          precioOriginal: original,
          precio_original: original,
          precioAnterior: original,
          precio_anterior: original,
          fechaInicioOferta: null,
          fechaFinOferta: null,
          fecha_inicio_oferta: null,
          fecha_fin_oferta: null
        };
 
        this.productosService.actualizarProducto(prod.id, payload).subscribe({
          next: () => {
            this.productosService.obtenerProductosPublicos(true).subscribe(); // Pre-cargar cache fresco
            this.modalAlertaService.success('¡Oferta eliminada con éxito!');
            this.cargarOfertas();
          },
          error: (err) => {
            console.error('Error al eliminar la oferta:', err);
            this.modalAlertaService.error('Ocurrió un error al intentar eliminar la oferta.');
          }
        });
      } else {
        this.modalAlertaService.error('No se pudo encontrar el producto en la base de datos.');
      }
    }
  }

  onProductoSeleccionadoChange() {
    if (this.productoSeleccionado) {
      this.newOffer.producto = this.productoSeleccionado.nombre;
      this.newOffer.precioOriginal = this.productoSeleccionado.precioOriginal || this.productoSeleccionado.precio || 0;
      if (this.newOffer.descuento) {
        this.onDescuentoChange();
      } else {
        this.newOffer.precioOferta = this.newOffer.precioOriginal;
        this.newOffer.descuento = 0;
      }
    }
  }

  onPrecioOriginalOrOfertaChange() {
    if (this.newOffer.precioOferta != null && !isNaN(Number(this.newOffer.precioOferta)) && Number(this.newOffer.precioOferta) >= 0) {
      this.errorPrecioOfertaNuevo = false;
    }
    if (this.newOffer.precioOriginal && this.newOffer.precioOferta) {
      this.newOffer.descuento = this.getDescuentoPorcentaje(this.newOffer.precioOriginal, this.newOffer.precioOferta);
      if (this.newOffer.descuento >= 1 && this.newOffer.descuento <= 99) {
        this.errorDescuentoNuevo = false;
      }
    }
  }

  onDescuentoChange() {
    if (this.newOffer.descuento != null && !isNaN(Number(this.newOffer.descuento)) && Number(this.newOffer.descuento) >= 1 && Number(this.newOffer.descuento) <= 99) {
      this.errorDescuentoNuevo = false;
    }
    if (this.newOffer.precioOriginal) {
      const desc = this.newOffer.descuento || 0;
      this.newOffer.precioOferta = Math.round(this.newOffer.precioOriginal * (1 - desc / 100) * 100) / 100;
      if (this.newOffer.precioOferta >= 0) {
        this.errorPrecioOfertaNuevo = false;
      }
    }
  }

  onPrecioOriginalOrOfertaChangeEdit() {
    if (this.editingOffer.precioOferta != null && !isNaN(Number(this.editingOffer.precioOferta)) && Number(this.editingOffer.precioOferta) >= 0) {
      this.errorPrecioOfertaEdit = false;
    }
    if (this.editingOffer.precioOriginal && this.editingOffer.precioOferta) {
      this.editingOffer.descuento = this.getDescuentoPorcentaje(this.editingOffer.precioOriginal, this.editingOffer.precioOferta);
      if (this.editingOffer.descuento >= 1 && this.editingOffer.descuento <= 99) {
        this.errorDescuentoEdit = false;
      }
    }
  }

  onDescuentoChangeEdit() {
    if (this.editingOffer.descuento != null && !isNaN(Number(this.editingOffer.descuento)) && Number(this.editingOffer.descuento) >= 1 && Number(this.editingOffer.descuento) <= 99) {
      this.errorDescuentoEdit = false;
    }
    if (this.editingOffer.precioOriginal) {
      const desc = this.editingOffer.descuento || 0;
      this.editingOffer.precioOferta = Math.round(this.editingOffer.precioOriginal * (1 - desc / 100) * 100) / 100;
      if (this.editingOffer.precioOferta >= 0) {
        this.errorPrecioOfertaEdit = false;
      }
    }
  }

  openAddOffer() {
    this.productoSeleccionado = null;
    this.errorDescuentoNuevo = false;
    this.errorPrecioOfertaNuevo = false;
    this.newOffer = {
      id: '',
      producto: '',
      precioOriginal: 0,
      precioOferta: 0,
      descuento: 0,
      fechaInicio: '',
      fechaFin: '',
      visible: true
    };
    this.showAddOfferModal = true;
  }

  guardarNuevaOferta() {
    if (!this.productoSeleccionado) {
      this.modalAlertaService.warning('Por favor seleccione un producto para la oferta.', 'Alerta de validación');
      return;
    }

    const desc = Number(this.newOffer.descuento);
    const oferta = Number(this.newOffer.precioOferta);

    const descInvalido = this.newOffer.descuento == null || this.newOffer.descuento === ('' as any) || isNaN(desc) || desc < 1 || desc > 99;
    const precioInvalido = this.newOffer.precioOferta == null || this.newOffer.precioOferta === ('' as any) || isNaN(oferta) || oferta < 0;

    if (descInvalido || precioInvalido) {
      this.errorDescuentoNuevo = descInvalido;
      this.errorPrecioOfertaNuevo = precioInvalido;
      this.modalAlertaService.warning(
        'El descuento debe situarse entre el 1% y el 99%, y el precio no puede ser negativo.',
        'Alerta de validación'
      );
      return;
    }

    this.errorDescuentoNuevo = false;
    this.errorPrecioOfertaNuevo = false;
 
    const prod = this.productoSeleccionado;
    const original = this.newOffer.precioOriginal;
 
    const payload = {
      ...prod,
      precio: oferta,
      precioOferta: oferta,
      precio_oferta: oferta,
      precioOriginal: original,
      precio_original: original,
      precioAnterior: original,
      precio_anterior: original,
      fechaInicioOferta: this.newOffer.fechaInicio || null,
      fechaFinOferta: this.newOffer.fechaFin || null,
      fecha_inicio_oferta: this.newOffer.fechaInicio || null,
      fecha_fin_oferta: this.newOffer.fechaFin || null
    };
 
    this.productosService.actualizarProducto(prod.id, payload).subscribe({
      next: () => {
        this.productosService.obtenerProductosPublicos(true).subscribe(); // Pre-cargar cache fresco
        this.modalAlertaService.success('¡Oferta creada y guardada con éxito!');
        this.showAddOfferModal = false;
        this.cargarOfertas();
      },
      error: (err) => {
        console.error('Error al guardar la oferta:', err);
        this.modalAlertaService.error('Ocurrió un error al guardar la oferta.');
      }
    });
  }

  openEditOffer(of: any, updateUrl = true) {
    this.errorDescuentoEdit = false;
    this.errorPrecioOfertaEdit = false;
    this.editingOffer = {
      ...of,
      fechaInicio: this.formatDateToYYYYMMDD(of.fechaInicioOferta || of.fechaInicio),
      fechaFin: this.formatDateToYYYYMMDD(of.fechaFinOferta || of.fechaFin)
    };
    this.productoSeleccionadoEdit = this.productosDisponibles.find(p => p.id === of.id);
    this.showEditOfferModal = true;
    if (updateUrl && of?.id) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { action: 'edit', id: of.id },
        queryParamsHandling: 'merge'
      });
    }
  }
 
  guardarCambiosOferta() {
    if (!this.productoSeleccionadoEdit) {
      this.modalAlertaService.warning('Por favor seleccione un producto para la oferta.', 'Alerta de validación');
      return;
    }

    const desc = Number(this.editingOffer.descuento);
    const oferta = Number(this.editingOffer.precioOferta);

    const descInvalido = this.editingOffer.descuento == null || this.editingOffer.descuento === ('' as any) || isNaN(desc) || desc < 1 || desc > 99;
    const precioInvalido = this.editingOffer.precioOferta == null || this.editingOffer.precioOferta === ('' as any) || isNaN(oferta) || oferta < 0;

    if (descInvalido || precioInvalido) {
      this.errorDescuentoEdit = descInvalido;
      this.errorPrecioOfertaEdit = precioInvalido;
      this.modalAlertaService.warning(
        'El descuento debe situarse entre el 1% y el 99%, y el precio no puede ser negativo.',
        'Alerta de validación'
      );
      return;
    }

    this.errorDescuentoEdit = false;
    this.errorPrecioOfertaEdit = false;
 
    const prod = this.productoSeleccionadoEdit;
    const original = this.editingOffer.precioOriginal;
 
    const payload = {
      ...prod,
      precio: oferta,
      precioOferta: oferta,
      precio_oferta: oferta,
      precioOriginal: original,
      precio_original: original,
      precioAnterior: original,
      precio_anterior: original,
      fechaInicioOferta: this.editingOffer.fechaInicio || null,
      fechaFinOferta: this.editingOffer.fechaFin || null,
      fecha_inicio_oferta: this.editingOffer.fechaInicio || null,
      fecha_fin_oferta: this.editingOffer.fechaFin || null
    };
 
    this.productosService.actualizarProducto(prod.id, payload).subscribe({
      next: () => {
        this.productosService.obtenerProductosPublicos(true).subscribe(); // Pre-cargar cache fresco
        this.modalAlertaService.success('¡Cambios guardados con éxito!');
        this.closeEditOfferModal();
        this.cargarOfertas();
      },
      error: (err) => {
        console.error('Error al actualizar la oferta:', err);
        this.modalAlertaService.error('Ocurrió un error al actualizar la oferta.');
      }
    });
  }

  cargarConfiguracionBannerOfertas() {
    this.bannerConfig.titulo = this.configService.negocio.ofertas_banner_titulo || 'Ofertas Especiales';
    this.bannerConfig.descripcion = this.configService.negocio.ofertas_banner_subtitulo || 'Aprovecha estas promociones exclusivas y consigue nuestras tazas y vasos más trendy al mejor precio.';
    this.bannerConfig.imagenUrl = this.configService.negocio.ofertas_banner_img || 'https://images.unsplash.com/photo-1577918349257-2e1d7fbebf96?q=80&w=2940&auto=format&fit=crop';
  }

  guardarConfiguracionBannerOfertas() {
    this.configService.negocio.ofertas_banner_titulo = this.bannerConfig.titulo;
    this.configService.negocio.ofertas_banner_subtitulo = this.bannerConfig.descripcion;
    this.configService.negocio.ofertas_banner_img = this.bannerConfig.imagenUrl;
    
    this.configService.actualizarNegocio(this.configService.negocio);
    this.configService.cargarDesdeBackend(true).subscribe(); // Pre-cargar cache config fresco
    alert('¡Configuración del banner de ofertas guardada con éxito!');
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
      console.log("Google Identity Services (GIS) cargada con éxito en Ofertas.");
    };
    document.head.appendChild(gsiScript);
  }

  abrirPicker(tipo: 'banner') {
    const tokenExpirado = this.tokenTimestamp && (Date.now() - this.tokenTimestamp > 3000 * 1000);
    if (tokenExpirado) {
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
              console.error('Error al inicializar Token Client:', response);
              this.oauthToken = '';
              this.tokenTimestamp = 0;
              return;
            }
            this.oauthToken = response.access_token;
            this.tokenTimestamp = Date.now();
            this.createPicker(tipo);
          },
        });
        client.requestAccessToken({ prompt: 'consent' });
      } catch (err) {
        console.warn('Google GSI Token Client initialization failed, using prompt fallback.', err);
        this.oauthToken = '';
        this.tokenTimestamp = 0;
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
        const view = new pickerNamespace.View(pickerNamespace.ViewId.DOCS);
        view.setMimeTypes('image/png,image/jpeg,image/jpg,image/webp,image/gif');

        const picker = new pickerNamespace.PickerBuilder()
          .enableFeature(pickerNamespace.Feature.NAV_HIDDEN)
          .setDeveloperKey(this.developerKey || 'YOUR_DEVELOPER_KEY')
          .setAppId(this.clientId ? this.clientId.split('-')[0] : 'YOUR_APP_ID')
          .setOAuthToken(this.oauthToken)
          .addView(view)
          .setCallback((data: any) => {
            console.log('--- DATA CRUDA DEL PICKER EN OFERTAS ---', data);
            if (data.action === pickerNamespace.Action.PICKED) {
              const doc = data.docs[0];
              const fileId = doc[pickerNamespace.Document.ID] || doc.id;
              const publicUrl = this.obtenerGoogleDrivePreviewUrl(fileId);
              this.handlePickerUrl(tipo, publicUrl);
            } else if (data.action === 'error' || data.error) {
              console.error('Error detectado en el callback de Google Picker:', data.error || data);
              this.oauthToken = '';
              this.tokenTimestamp = 0;
            }
          })
          .build();
        picker.setVisible(true);
      } catch (err) {
        console.error('Excepción al crear Google Picker:', err);
        this.oauthToken = '';
        this.tokenTimestamp = 0;
        this.fallbackUrlPrompt(tipo);
      }
    } else {
      console.warn('Gapi/Google Picker API no cargada completamente, usando prompt.');
      this.fallbackUrlPrompt(tipo);
    }
  }

  fallbackUrlPrompt(tipo: 'banner') {
    const val = prompt('Pegue la URL de la imagen:');
    if (val) {
      this.handlePickerUrl(tipo, val);
    }
  }

  handlePickerUrl(tipo: 'banner', url: string) {
    if (url) {
      this.bannerConfig.imagenUrl = url;
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
    return `https://lh3.googleusercontent.com/d/${id}`;
  }

  obtenerUrlRenderizable(url: string): string {
    if (!url) return '';

    if (url.includes('lh3.googleusercontent.com')) return url;
    if (url.includes('supabase.co/storage') || url.includes('supabase.in/storage')) return url;
    if (url.startsWith('blob:')) return url;

    if (url.includes('docs.google.com/uc') || url.includes('drive.google.com/uc')) {
      const match = url.match(/[?&]id=([^&]+)/);
      if (match && match[1]) {
        return `https://lh3.googleusercontent.com/d/${match[1]}`;
      }
    }

    if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
      const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (fileMatch && fileMatch[1]) {
        return `https://lh3.googleusercontent.com/d/${fileMatch[1]}`;
      }
      const dMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (dMatch && dMatch[1]) {
        return `https://lh3.googleusercontent.com/d/${dMatch[1]}`;
      }
    }

    return url;
  }

  onBannerImgChange(value: string) {
    const trimmed = (value || '').trim();
    if (trimmed) {
      const renderUrl = this.obtenerUrlRenderizable(trimmed);
      this.bannerConfig.imagenUrl = renderUrl;
    } else {
      this.bannerConfig.imagenUrl = '';
    }
  }

  get bannerPreviewUrl(): string {
    return this.obtenerUrlRenderizable(this.bannerConfig.imagenUrl);
  }
}
