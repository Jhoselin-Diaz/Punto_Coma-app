import { Component, OnInit, OnDestroy, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { ConfiguracionService } from '../../service/configuracion.service';
import { CartService } from '../../service/cart.service';
import { ProductosService } from '../../service/productos.service';
import { ClienteAuthService, DireccionCliente } from '../../service/cliente-auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-cliente-layout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive],
  templateUrl: './cliente-layout.component.html',
  styleUrl: './cliente-layout.component.css'
})
export class ClienteLayoutComponent implements OnInit, OnDestroy {
  cantidadTotal = 0;
  searchQuery = '';
  productosPublicos: any[] = [];
  sugerencias: any[] = [];
  mostrarSugerencias = false;
  selectedIndex = -1;
  logoError = false;

  // Estado y Modales de Cliente
  cantidadFavoritos = 0;
  loginEmail = '';
  loginPassword = '';
  loginError = '';
  registerNombre = '';
  registerApellidos = '';
  registerEmail = '';
  registerPassword = '';
  registerError = '';

  nombrePilaEdit = '';
  perfilMensajeExito = false;
  misPedidos: any[] = [];
  cargandoPedidos = false;

  // TOAST FLOTANTE DE ÉXITO
  toastVisible = false;
  toastMensaje = '';
  private toastTimer: any = null;

  // AVISO GOOGLE
  avisoGoogle = '';

  // NAVEGACIÓN Y SECCIONES DEL DRAWER (FALABELLA STYLE)
  perfilSeccionActiva: 'compras' | 'datos' | 'direcciones' = 'compras';

  // FORMULARIO: DATOS PERSONALES
  datosNombre = '';
  datosApellidoPaterno = '';
  datosApellidoMaterno = '';
  datosTipoDocumento = 'DNI';
  datosNumeroDocumento = '';
  datosTelefono = '';
  datosEmail = '';
  datosError = '';
  datosMensajeExito = false;

  // FORMULARIO: DIRECCIONES DE DESPACHO
  direcciones: DireccionCliente[] = [];
  mostrandoFormDireccion = false;
  direccionEditId: string | null = null;
  dirDepartamento = 'Lima';
  dirProvincia = 'Lima';
  dirDistrito = '';
  dirDireccion = '';
  dirDetalleOpcional = '';
  dirEsPrincipal = false;
  dirError = '';
  dirMensajeExito = false;

  departamentosPeru: string[] = [
    'Amazonas', 'Áncash', 'Apurímac', 'Arequipa', 'Ayacucho', 'Cajamarca',
    'Callao', 'Cusco', 'Huancavelica', 'Huánuco', 'Ica', 'Junín', 'La Libertad',
    'Lambayeque', 'Lima', 'Loreto', 'Madre de Dios', 'Moquegua', 'Pasco',
    'Piura', 'Puno', 'San Martín', 'Tacna', 'Tumbes', 'Ucayali'
  ];

  private sub = new Subscription();

  constructor(
    public configService: ConfiguracionService,
    private cartService: CartService,
    private productosService: ProductosService,
    public clienteAuthService: ClienteAuthService,
    private router: Router,
    private route: ActivatedRoute,
    private sanitizer: DomSanitizer,
    private elementRef: ElementRef
  ) {}

  ngOnInit() {
    // Sincronizar color principal dinámico de la tienda
    this.aplicarColorPrincipal(this.configService.negocio.color_principal);
    this.sub.add(
      this.configService.config$.subscribe(cfg => {
        if (cfg) {
          this.aplicarColorPrincipal(cfg.color_principal);
          this.logoError = false;
        }
      })
    );

    // 1. Contador reactivo del carrito
    this.sub.add(
      this.cartService.items$.subscribe(items => {
        this.cantidadTotal = items.reduce((acc, item) => acc + item.cantidad, 0);
      })
    );

    // 2. Cargar catálogo para el autocompletado y búsqueda
    this.cargarProductos();

    // 3. Sincronizar input si ya viene un query param ?q=
    this.sub.add(
      this.route.queryParams.subscribe(params => {
        if (params['q'] && !this.searchQuery) {
          this.searchQuery = params['q'];
        }
      })
    );

    // 4. Subscripciones de cliente
    this.sub.add(
      this.clienteAuthService.currentCliente$.subscribe(c => {
        if (c) {
          this.nombrePilaEdit = c.nombrePila || c.nombre || '';
        }
      })
    );

    this.sub.add(
      this.clienteAuthService.favoritos$.subscribe(favs => {
        this.cantidadFavoritos = favs.length;
      })
    );

    this.sub.add(
      this.clienteAuthService.modalPerfilOpen$.subscribe(open => {
        if (open) {
          this.cargarMisPedidos();
        }
      })
    );
  }

  // Acciones de Usuario y Modales de Cliente
  onIconoUsuarioClick(): void {
    if (this.clienteAuthService.isLoggedIn) {
      this.abrirPerfil();
    } else {
      this.abrirAuth('login');
    }
  }

  abrirAuth(tab: 'login' | 'register' = 'login'): void {
    this.loginError = '';
    this.registerError = '';
    this.clienteAuthService.abrirModalAuth(tab);
  }

  cambiarTabAuth(tab: 'login' | 'register'): void {
    this.loginError = '';
    this.registerError = '';
    this.clienteAuthService.modalAuthTab$.next(tab);
  }

  cerrarModalAuth(): void {
    this.clienteAuthService.cerrarModalAuth();
  }

  mostrarToast(mensaje: string): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
    this.toastMensaje = mensaje;
    this.toastVisible = true;
    this.toastTimer = setTimeout(() => {
      this.toastVisible = false;
    }, 3500);
  }

  cerrarToast(): void {
    this.toastVisible = false;
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
  }

  abrirPerfil(seccion: 'compras' | 'datos' | 'direcciones' = 'compras'): void {
    this.perfilSeccionActiva = seccion;
    this.perfilMensajeExito = false;
    this.datosMensajeExito = false;
    this.dirMensajeExito = false;
    this.mostrandoFormDireccion = false;

    this.cargarFormularioDatosPersonales();
    this.cargarDirecciones();
    this.cargarMisPedidos();

    this.clienteAuthService.abrirModalPerfil();
  }

  cambiarSeccionPerfil(seccion: 'compras' | 'datos' | 'direcciones'): void {
    this.perfilSeccionActiva = seccion;
    this.perfilMensajeExito = false;
    this.datosMensajeExito = false;
    this.dirMensajeExito = false;
    this.mostrandoFormDireccion = false;

    if (seccion === 'compras') {
      this.cargarMisPedidos();
    } else if (seccion === 'datos') {
      this.cargarFormularioDatosPersonales();
    } else if (seccion === 'direcciones') {
      this.cargarDirecciones();
    }
  }

  cerrarModalPerfil(): void {
    this.clienteAuthService.cerrarModalPerfil();
    this.mostrandoFormDireccion = false;
  }

  ejecutarLogin(): void {
    this.loginError = '';
    this.avisoGoogle = '';
    const res = this.clienteAuthService.login(this.loginEmail, this.loginPassword);
    if (res.success) {
      const nombre = this.clienteAuthService.nombreParaMostrar;
      this.loginEmail = '';
      this.loginPassword = '';
      this.cerrarModalAuth();
      this.mostrarToast(`¡Bienvenido/a, ${nombre}! Has iniciado sesión con éxito.`);
    } else {
      this.loginError = res.message || 'Error al iniciar sesión.';
    }
  }

  ejecutarRegistro(): void {
    this.registerError = '';
    this.avisoGoogle = '';
    const res = this.clienteAuthService.registro(
      this.registerNombre,
      this.registerApellidos,
      this.registerEmail,
      this.registerPassword
    );
    if (res.success) {
      const nombre = this.clienteAuthService.nombreParaMostrar;
      this.registerNombre = '';
      this.registerApellidos = '';
      this.registerEmail = '';
      this.registerPassword = '';
      this.cerrarModalAuth();
      this.mostrarToast(`¡Bienvenido/a, ${nombre}! Has iniciado sesión con éxito.`);
    } else {
      this.registerError = res.message || 'Error al registrar la cuenta.';
    }
  }

  ejecutarLoginGoogle(): void {
    const res = this.clienteAuthService.loginConGoogle();
    this.avisoGoogle = res.message;
    setTimeout(() => {
      this.avisoGoogle = '';
    }, 4500);
  }

  cargarFormularioDatosPersonales(): void {
    const c = this.clienteAuthService.currentCliente;
    if (c) {
      this.datosNombre = c.nombre || '';
      this.datosApellidoPaterno = c.apellidoPaterno || (c.apellidos ? c.apellidos.split(' ')[0] : '');
      this.datosApellidoMaterno = c.apellidoMaterno || (c.apellidos && c.apellidos.split(' ').length > 1 ? c.apellidos.split(' ').slice(1).join(' ') : '');
      this.datosTipoDocumento = c.tipoDocumento || 'DNI';
      this.datosNumeroDocumento = c.numeroDocumento || '';
      this.datosTelefono = (c.telefono || '').replace(/^\+?51/, '').trim();
      this.datosEmail = c.email || '';
    }
    this.datosError = '';
    this.datosMensajeExito = false;
  }

  guardarDatosPersonales(): void {
    this.datosError = '';
    if (!this.datosNombre.trim()) {
      this.datosError = 'El nombre es obligatorio.';
      return;
    }
    if (!this.datosApellidoPaterno.trim()) {
      this.datosError = 'El apellido paterno es obligatorio.';
      return;
    }
    if (!this.datosNumeroDocumento.trim()) {
      this.datosError = 'El número de documento es obligatorio.';
      return;
    }
    const cleanTel = this.datosTelefono.replace(/\D/g, '');
    if (cleanTel.length !== 9) {
      this.datosError = 'El número de celular debe contener 9 dígitos válidos.';
      return;
    }

    const payload = {
      nombre: this.datosNombre.trim(),
      apellidoPaterno: this.datosApellidoPaterno.trim(),
      apellidoMaterno: this.datosApellidoMaterno.trim(),
      tipoDocumento: this.datosTipoDocumento,
      numeroDocumento: this.datosNumeroDocumento.trim(),
      telefono: '+51 ' + cleanTel
    };

    if (this.clienteAuthService.actualizarDatosPersonales(payload)) {
      this.datosMensajeExito = true;
      this.mostrarToast('Datos personales actualizados correctamente.');
      setTimeout(() => {
        this.datosMensajeExito = false;
      }, 3000);
    }
  }

  cargarDirecciones(): void {
    this.direcciones = this.clienteAuthService.obtenerDirecciones();
    // Si no tiene direcciones y es un usuario con datos, inicializar con una por defecto si aplica
    if (this.direcciones.length === 0) {
      const c = this.clienteAuthService.currentCliente;
      if (c) {
        this.clienteAuthService.guardarDireccion({
          departamento: 'Lima',
          provincia: 'Lima',
          distrito: 'Miraflores',
          direccion: 'Av. Larco 456',
          detalleOpcional: 'Dpto. 302',
          esPrincipal: true
        });
        this.direcciones = this.clienteAuthService.obtenerDirecciones();
      }
    }
  }

  abrirFormNuevaDireccion(): void {
    this.direccionEditId = null;
    this.dirDepartamento = 'Lima';
    this.dirProvincia = 'Lima';
    this.dirDistrito = '';
    this.dirDireccion = '';
    this.dirDetalleOpcional = '';
    this.dirEsPrincipal = this.direcciones.length === 0;
    this.dirError = '';
    this.mostrandoFormDireccion = true;
  }

  cancelarFormDireccion(): void {
    this.mostrandoFormDireccion = false;
    this.direccionEditId = null;
    this.dirError = '';
  }

  guardarDireccion(): void {
    this.dirError = '';
    if (!this.dirDireccion.trim()) {
      this.dirError = 'La dirección (calle, número o lote) es obligatoria.';
      return;
    }
    if (!this.dirDistrito.trim()) {
      this.dirError = 'El distrito es obligatorio.';
      return;
    }
    if (!this.dirDepartamento.trim()) {
      this.dirError = 'El departamento es obligatorio.';
      return;
    }

    this.clienteAuthService.guardarDireccion({
      id: this.direccionEditId || undefined,
      departamento: this.dirDepartamento.trim(),
      provincia: (this.dirProvincia || this.dirDepartamento).trim(),
      distrito: this.dirDistrito.trim(),
      direccion: this.dirDireccion.trim(),
      detalleOpcional: this.dirDetalleOpcional.trim(),
      esPrincipal: this.dirEsPrincipal
    });

    this.cargarDirecciones();
    this.mostrandoFormDireccion = false;
    this.mostrarToast('Dirección guardada correctamente.');
  }

  eliminarDireccion(id: string): void {
    this.clienteAuthService.eliminarDireccion(id);
    this.cargarDirecciones();
    this.mostrarToast('Dirección eliminada.');
  }

  establecerDireccionPrincipal(id: string): void {
    this.clienteAuthService.establecerDireccionPrincipal(id);
    this.cargarDirecciones();
    this.mostrarToast('Dirección establecida como principal.');
  }

  irACatalogo(): void {
    this.cerrarModalPerfil();
    this.router.navigate(['/productos']);
  }

  cerrarSesion(): void {
    this.clienteAuthService.logout();
    this.misPedidos = [];
    this.mostrarToast('Has cerrado sesión correctamente.');
  }

  cargarMisPedidos(): void {
    this.cargandoPedidos = true;
    this.clienteAuthService.obtenerPedidosValidadosCliente().subscribe({
      next: (pedidos) => {
        this.misPedidos = pedidos;
        this.cargandoPedidos = false;
      },
      error: () => {
        this.cargandoPedidos = false;
        this.misPedidos = [];
      }
    });
  }


  abrirFavoritos(): void {
    this.clienteAuthService.abrirModalFavoritos();
  }

  cerrarModalFavoritos(): void {
    this.clienteAuthService.cerrarModalFavoritos();
  }

  cerrarAvisoLogin(): void {
    this.clienteAuthService.cerrarAvisoLogin();
  }

  irAlRegistroDesdeAviso(): void {
    this.clienteAuthService.irAlRegistroDesdeAviso();
  }

  eliminarDeFavoritos(id: number | string): void {
    this.clienteAuthService.eliminarFavorito(id);
  }

  irAProducto(id: number | string): void {
    this.clienteAuthService.cerrarModalFavoritos();
    this.router.navigate(['/productos', id]);
  }

  cargarProductos() {
    this.productosService.obtenerProductosPublicos().subscribe({
      next: (res: any) => {
        const data = Array.isArray(res) ? res : (res && Array.isArray(res.content) ? res.content : []);
        this.productosPublicos = data.filter((p: any) => p.visible !== false && p.activo !== false);
      },
      error: (err) => console.error('Error al cargar productos en navbar:', err)
    });
  }

  onSearchInput(): void {
    const q = this.searchQuery ? this.searchQuery.trim() : '';
    this.selectedIndex = -1;

    if (q.length === 0) {
      this.mostrarSugerencias = false;
      this.sugerencias = [];
      return;
    }

    const qNorm = this.normalizar(q);

    // Filtrar productos visibles y activos coincidentes
    this.sugerencias = this.productosPublicos
      .filter((p: any) => {
        const nombre = this.normalizar(p.nombre);
        const cat = this.normalizar(p.categoria);
        return nombre.includes(qNorm) || cat.includes(qNorm);
      })
      .sort((a: any, b: any) => {
        const aNorm = this.normalizar(a.nombre);
        const bNorm = this.normalizar(b.nombre);
        const aStarts = aNorm.startsWith(qNorm);
        const bStarts = bNorm.startsWith(qNorm);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return 0;
      })
      .slice(0, 6);

    this.mostrarSugerencias = true;
  }

  onSearchFocus(): void {
    if (this.searchQuery && this.searchQuery.trim().length > 0) {
      this.onSearchInput();
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    if (!this.mostrarSugerencias || this.sugerencias.length === 0) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.selectedIndex = (this.selectedIndex + 1) % this.sugerencias.length;
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.selectedIndex = this.selectedIndex <= 0 ? this.sugerencias.length - 1 : this.selectedIndex - 1;
    } else if (event.key === 'Enter') {
      if (this.selectedIndex >= 0 && this.selectedIndex < this.sugerencias.length) {
        event.preventDefault();
        this.seleccionarSugerencia(this.sugerencias[this.selectedIndex]);
      }
    } else if (event.key === 'Escape') {
      this.mostrarSugerencias = false;
      this.selectedIndex = -1;
    }
  }

  seleccionarSugerencia(item: any): void {
    this.searchQuery = item.nombre;
    this.mostrarSugerencias = false;
    this.selectedIndex = -1;
    this.router.navigate(['/productos', item.id]);
  }

  autocompletar(nombre: string): void {
    this.searchQuery = nombre;
    this.onSearchInput();
  }

  limpiarInput(): void {
    this.searchQuery = '';
    this.sugerencias = [];
    this.mostrarSugerencias = false;
    this.selectedIndex = -1;
  }

  buscar(): void {
    const q = this.searchQuery ? this.searchQuery.trim() : '';
    if (!q) return;

    this.mostrarSugerencias = false;
    this.selectedIndex = -1;

    const qNorm = this.normalizar(q);

    // 1. Si coincide exactamente con el nombre de un producto existente y visible
    const productoExacto = this.productosPublicos.find((p: any) =>
      this.normalizar(p.nombre) === qNorm
    );

    if (productoExacto) {
      this.router.navigate(['/productos', productoExacto.id]);
      return;
    }

    // 2. Si no es exacto pero hay una sola coincidencia que contiene el texto
    const coincidencias = this.productosPublicos.filter((p: any) =>
      this.normalizar(p.nombre).includes(qNorm)
    );

    if (coincidencias.length === 1) {
      this.router.navigate(['/productos', coincidencias[0].id]);
      return;
    }

    // 3. De lo contrario, ir al catálogo /productos con el filtro ?q=
    this.router.navigate(['/productos'], { queryParams: { q: q } });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!this.elementRef.nativeElement.querySelector('.search-wrapper')?.contains(target)) {
      this.mostrarSugerencias = false;
    }
  }

  normalizar(text: string): string {
    return (text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  extraerGoogleDriveId(input: string): string {
    if (!input) return '';
    let clean = input.trim().replace(/^[\"']|[\"']$/g, '');
    try {
      clean = decodeURIComponent(clean);
    } catch (e) {}

    const reg1 = /\/file\/d\/([a-zA-Z0-9_-]+)/;
    const reg2 = /[?&]id=([a-zA-Z0-9_-]+)/;
    const reg3 = /\/d\/([a-zA-Z0-9_-]+)/;
    const reg4 = /\/open\?id=([a-zA-Z0-9_-]+)/;

    let match = clean.match(reg1);
    if (match) return match[1];

    match = clean.match(reg4);
    if (match) return match[1];

    match = clean.match(reg2);
    if (match) return match[1];

    match = clean.match(reg3);
    if (match) return match[1];

    if (/^[a-zA-Z0-9_-]{20,}$/.test(clean)) {
      return clean;
    }

    return clean;
  }

  onLogoError(event?: any) {
    const img = event?.target as HTMLImageElement;
    const fileId = this.extraerGoogleDriveId(this.configService.negocio.logo_url || '');
    if (img && fileId) {
      if (!img.src.includes('googleusercontent.com')) {
        img.src = `https://lh3.googleusercontent.com/d/${fileId}`;
        return;
      }
      if (!img.src.includes('=s1000')) {
        img.src = `https://lh3.googleusercontent.com/d/${fileId}=s1000`;
        return;
      }
    }
    this.logoError = true;
  }

  obtenerGoogleDrivePreviewUrl(id: string): string {
    if (!id) return '';
    const cleanId = id.trim();
    if (cleanId.toLowerCase() === 'null' || cleanId.toLowerCase() === 'undefined' || cleanId.length === 0) {
      return '';
    }
    return `https://drive.google.com/thumbnail?id=${cleanId}&sz=w1000`;
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

  aplicarColorPrincipal(color?: string) {
    if (!color) return;
    const hostElem = this.elementRef?.nativeElement;
    if (hostElem) {
      hostElem.style.setProperty('--orange', color);
      hostElem.style.setProperty('--primary-color', color);
      hostElem.style.setProperty('--primary-hover', `color-mix(in srgb, ${color} 82%, #000)`);
      hostElem.style.setProperty('--primary-light', `color-mix(in srgb, ${color} 18%, #fff)`);
      hostElem.style.setProperty('--primary-badge', `color-mix(in srgb, ${color} 28%, #fff)`);
      hostElem.style.setProperty('--primary-shadow', `color-mix(in srgb, ${color} 65%, #000)`);
      hostElem.style.setProperty('--primary-glow', `color-mix(in srgb, ${color} 25%, transparent)`);
    }
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }
}
