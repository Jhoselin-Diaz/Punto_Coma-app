import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ClienteLayoutComponent } from '../cliente-layout/cliente-layout.component';
import { CartService, CartItem } from '../../service/cart.service';
import { AdminCarritoService, ConfiguracionCarrito, Cupon } from '../../service/admin-carrito.service';
import { ClienteAuthService } from '../../service/cliente-auth.service';
import { ConfiguracionService } from '../../service/configuracion.service';
import { ModalAlertaService } from '../../service/modal-alerta.service';
import { Subscription, firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-carrito',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ClienteLayoutComponent],
  templateUrl: './carrito.component.html',
  styleUrl: './carrito.component.css'
})
export class CarritoComponent implements OnInit, OnDestroy {
  itemsCarrito: CartItem[] = [];
  couponCode = '';
  couponError = '';
  couponSuccess = false;
  cuponAplicadoData: Cupon | null = null;

  // Dynamic configuration object
  configuracion: ConfiguracionCarrito | null = null;

  // Cupones disponibles visibles en la tienda (Panel lateral)
  cuponesDisponibles: Cupon[] = [];
  tieneComprasPreviasValidadas = false;

  get cuponesVisibles(): Cupon[] {
    return (this.cuponesDisponibles || []).filter(c => c.activo && c.visibleWeb !== false);
  }

  // Cupón de bienvenida para banner de cliente
  cuponBienvenida = {
    codigo: 'BIENVENIDA10',
    porcentajeDescuento: 10
  };

  private sub = new Subscription();

  constructor(
    public cartService: CartService,
    private adminCarritoService: AdminCarritoService,
    public clienteAuthService: ClienteAuthService,
    private configService: ConfiguracionService,
    private modalAlertaService: ModalAlertaService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.sub.add(
      this.cartService.items$.subscribe(items => {
        this.itemsCarrito = items;
        if (this.cuponAplicadoData && this.cuponAplicadoData.montoMinimo != null && this.cuponAplicadoData.montoMinimo > 0) {
          if (this.cartService.subtotal < this.cuponAplicadoData.montoMinimo) {
            this.cartService.removeCoupon();
            this.couponSuccess = false;
            this.couponError = `Se retiró el cupón: el subtotal (S/ ${this.cartService.subtotal.toFixed(2)}) no alcanza la compra mínima de S/ ${this.cuponAplicadoData.montoMinimo.toFixed(2)}.`;
            this.cuponAplicadoData = null;
          }
        }
      })
    );
    this.sub.add(
      this.clienteAuthService.currentCliente$.subscribe(() => {
        this.verificarComprasPrevias();
      })
    );
    this.couponCode = this.cartService.coupon;
    if (this.couponCode) {
      this.couponSuccess = true;
    }
    this.cargarConfiguracionCarrito();
    this.cargarCuponesTienda();
    this.verificarComprasPrevias();
  }

  verificarComprasPrevias() {
    if (!this.clienteAuthService.isLoggedIn) {
      this.tieneComprasPreviasValidadas = false;
      this.cdr.markForCheck();
      return;
    }

    const cliente = this.clienteAuthService.currentCliente;
    const clienteEmail = (cliente?.email || '').toLowerCase().trim();
    const clienteNombre = (cliente?.nombre || '').toLowerCase().trim();

    const yaUsoCupon = localStorage.getItem('cupon_bienvenida_usado_' + clienteEmail) === 'true';
    if (yaUsoCupon) {
      this.tieneComprasPreviasValidadas = true;
      this.cdr.markForCheck();
      return;
    }

    this.clienteAuthService.obtenerPedidosValidadosCliente().subscribe({
      next: (pedidos) => {
        if (Array.isArray(pedidos) && pedidos.length > 0) {
          const tienePedidos = pedidos.some(p => {
            const pEmail = (p.email || p.usuario?.correo || p.usuario?.email || '').toLowerCase().trim();
            const pNombre = (p.nombreCompleto || p.usuario?.nombre || p.cliente || '').toLowerCase().trim();
            return (clienteEmail && pEmail === clienteEmail) || (clienteNombre && pNombre && pNombre === clienteNombre);
          });
          this.tieneComprasPreviasValidadas = tienePedidos;
        } else {
          this.tieneComprasPreviasValidadas = false;
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.tieneComprasPreviasValidadas = false;
        this.cdr.markForCheck();
      }
    });
  }

  cargarCuponesTienda() {
    this.adminCarritoService.listarCupones().subscribe({
      next: (cupones) => {
        if (Array.isArray(cupones) && cupones.length > 0) {
          const activos = cupones.filter(c => c.activo);
          
          // Cupones con visibilidad web activa para el panel lateral
          this.cuponesDisponibles = activos.filter(c => c.visibleWeb !== false);

          const cuponBienvenida = activos.find(c => {
            return c.tipoAplicacion === 'BIENVENIDA' || (c.codigo || '').toUpperCase().includes('BIENVENID');
          });

          if (cuponBienvenida) {
            this.cuponBienvenida = {
              codigo: cuponBienvenida.codigo,
              porcentajeDescuento: cuponBienvenida.porcentajeDescuento
            };
          } else {
            this.cuponBienvenida = {
              codigo: 'BIENVENIDA10',
              porcentajeDescuento: 10
            };
          }
        } else {
          this.cuponesDisponibles = [];
          this.cuponBienvenida = {
            codigo: 'BIENVENIDA10',
            porcentajeDescuento: 10
          };
        }
        this.cdr.markForCheck();
      },
      error: (err) => console.warn('Error al cargar cupones de la tienda:', err)
    });
  }

  aplicarCuponDesdePanel(cupon: Cupon) {
    this.couponCode = cupon.codigo;
    this.aplicarCupon();
  }

  aplicarCuponBienvenidaDirecto(event?: Event) {
    if (event) event.stopPropagation();
    this.couponCode = this.cuponBienvenida.codigo;
    this.aplicarCupon();
  }

  obtenerCondicionResumida(cupon: Cupon): string {
    const tipo = (cupon.tipoAplicacion || '').toUpperCase().trim();
    let condicion = '';
    switch (tipo) {
      case 'BIENVENIDA':
        condicion = '1ra compra';
        break;
      case 'CATEGORIA':
        condicion = `Cat: ${cupon.categoriaAplicable || 'Específica'}`;
        break;
      case 'OFERTA':
      case 'OFERTAS':
        condicion = 'Solo en ofertas';
        break;
      case 'LIQUIDACION':
        condicion = 'Productos selec.';
        break;
      case 'GENERAL':
      default:
        condicion = 'Toda la tienda';
        break;
    }
    if (cupon.montoMinimo && cupon.montoMinimo > 0) {
      condicion += ` • Min. S/ ${cupon.montoMinimo.toFixed(0)}`;
    }
    return condicion;
  }

  abrirCuponesPerfil() {
    this.clienteAuthService.abrirModalPerfil('cupones');
  }

  abrirRegistroDesdeCarrito() {
    this.clienteAuthService.abrirModalAuth('register');
  }

  cargarConfiguracionCarrito() {
    this.adminCarritoService.obtenerConfiguracion().subscribe({
      next: (config) => {
        this.configuracion = config;
      },
      error: (err) => console.error('Error al obtener configuracion del carrito:', err)
    });
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  incrementar(item: CartItem) {
    this.cartService.updateQuantity(item.id, item.cantidad + 1);
  }

  decrementar(item: CartItem) {
    if (item.cantidad > 1) {
      this.cartService.updateQuantity(item.id, item.cantidad - 1);
    } else {
      this.eliminar(item);
    }
  }

  cambiarCantidadSelect(item: CartItem, event: any) {
    const qty = parseInt(event.target.value, 10);
    if (!isNaN(qty)) {
      this.cartService.updateQuantity(item.id, qty);
    }
  }

  eliminar(item: CartItem) {
    this.cartService.removeItem(item.id);
  }

  onCouponInput() {
    if (this.couponError) {
      this.couponError = '';
      this.cdr.markForCheck();
    }
  }

  quitarCupon() {
    this.cartService.removeCoupon();
    this.cuponAplicadoData = null;
    this.couponCode = '';
    this.couponSuccess = false;
    this.couponError = '';
    this.cdr.markForCheck();
  }

  obtenerPrecioDescontado(item: CartItem): number {
    return this.cartService.getItemDiscountedPrice(item);
  }

  obtenerPrecioUnitarioDescontado(item: CartItem): number {
    return this.cartService.getItemDiscountedUnitPrice(item);
  }

  aplicarCupon() {
    this.couponError = '';
    this.couponSuccess = false;
    const code = this.couponCode.trim().toUpperCase();
    if (!code) {
      this.couponError = 'Por favor, ingrese un código de cupón.';
      return;
    }

    this.adminCarritoService.validarCupon(code).subscribe({
      next: async (cupon) => {
        if (cupon && cupon.activo) {
          const hoy = new Date().toISOString().split('T')[0];

          // 1. Validar fecha de inicio
          if (cupon.fechaInicio && hoy < cupon.fechaInicio) {
            this.couponError = `Este cupón aún no está vigente (disponible a partir del ${cupon.fechaInicio}).`;
            this.cartService.removeCoupon();
            this.cuponAplicadoData = null;
            this.couponSuccess = false;
            this.cdr.markForCheck();
            return;
          }

          // 2. Validar fecha de fin
          if (cupon.fechaFin && hoy > cupon.fechaFin) {
            this.couponError = `El cupón no es válido o ha caducado (expiró el ${cupon.fechaFin}).`;
            this.cartService.removeCoupon();
            this.cuponAplicadoData = null;
            this.couponSuccess = false;
            this.cdr.markForCheck();
            return;
          }

          // 3. Validar monto mínimo de compra
          const subtotalActual = this.cartService.subtotal;
          if (cupon.montoMinimo != null && cupon.montoMinimo > 0 && subtotalActual < cupon.montoMinimo) {
            this.couponError = `Este cupón requiere una compra mínima de S/ ${cupon.montoMinimo.toFixed(2)}. (Tu subtotal actual es S/ ${subtotalActual.toFixed(2)}).`;
            this.cartService.removeCoupon();
            this.cuponAplicadoData = null;
            this.couponSuccess = false;
            this.cdr.markForCheck();
            return;
          }

          // 4. Validar límite de uso
          if (cupon.limiteUso != null && cupon.limiteUso > 0 && (cupon.usosActuales ?? 0) >= cupon.limiteUso) {
            this.couponError = `Este cupón ha alcanzado su límite máximo de usos permitidos (${cupon.limiteUso}).`;
            this.cartService.removeCoupon();
            this.cuponAplicadoData = null;
            this.couponSuccess = false;
            this.cdr.markForCheck();
            return;
          }

          // 5. Restricción y Consumo del Cupón de Bienvenida
          const esBienvenida = cupon.tipoAplicacion === 'BIENVENIDA' || (cupon.codigo || '').toUpperCase().includes('BIENVENID');
          if (esBienvenida) {
            if (!this.clienteAuthService.isLoggedIn) {
              this.couponError = 'Debes iniciar sesión o registrarte para utilizar este cupón de bienvenida.';
              this.cartService.removeCoupon();
              this.cuponAplicadoData = null;
              this.couponSuccess = false;
              this.cdr.markForCheck();
              return;
            }

            const cliente = this.clienteAuthService.currentCliente;
            const clienteEmail = (cliente?.email || '').toLowerCase().trim();
            const clienteNombre = (cliente?.nombre || '').toLowerCase().trim();
            const yaUsoCupon = localStorage.getItem('cupon_bienvenida_usado_' + clienteEmail) === 'true';

            if (yaUsoCupon) {
              this.couponError = 'Este cupón de bienvenida es válido únicamente para la primera compra de clientes registrados.';
              this.cartService.removeCoupon();
              this.cuponAplicadoData = null;
              this.couponSuccess = false;
              this.cdr.markForCheck();
              return;
            }

            try {
              const pedidosValidados = await firstValueFrom(this.clienteAuthService.obtenerPedidosValidadosCliente());
              if (Array.isArray(pedidosValidados) && pedidosValidados.length > 0) {
                const tienePedidosPrevios = pedidosValidados.some(p => {
                  const pEmail = (p.email || p.usuario?.correo || p.usuario?.email || '').toLowerCase().trim();
                  const pNombre = (p.nombreCompleto || p.usuario?.nombre || p.cliente || '').toLowerCase().trim();
                  return (clienteEmail && pEmail === clienteEmail) || (clienteNombre && pNombre && pNombre === clienteNombre);
                });
                if (tienePedidosPrevios) {
                  this.couponError = 'Este cupón de bienvenida es válido únicamente para la primera compra de clientes registrados.';
                  this.cartService.removeCoupon();
                  this.cuponAplicadoData = null;
                  this.couponSuccess = false;
                  this.cdr.markForCheck();
                  return;
                }
              }
            } catch (err) {
              console.warn('Error al verificar pedidos validados del cliente:', err);
            }
          }

          // 6. Validar que al menos un producto del carrito califica para el cupón
          const algunItemCalifica = this.itemsCarrito.some(item => this.cartService.esItemElegibleParaCupon(item, cupon));
          if (!algunItemCalifica) {
            this.couponError = 'Ninguno de los productos en tu carrito califica para el cupón ingresado.';
            this.cartService.removeCoupon();
            this.cuponAplicadoData = null;
            this.couponSuccess = false;
            this.cdr.markForCheck();
            return;
          }

          this.cartService.applyDynamicCoupon(cupon);
          this.cuponAplicadoData = cupon;
          this.couponSuccess = true;
          this.couponError = '';
          this.cdr.markForCheck();
        } else {
          this.couponError = 'El cupón no es válido o ha caducado.';
          this.cartService.removeCoupon();
          this.cuponAplicadoData = null;
          this.couponSuccess = false;
          this.cdr.markForCheck();
        }
      },
      error: (err) => {
        this.cartService.removeCoupon();
        this.cuponAplicadoData = null;
        this.couponSuccess = false;
        this.couponError = 'El cupón no es válido o ha caducado.';
        this.cdr.markForCheck();
      }
    });
  }

  obtenerUrlBaseWhatsapp(): string {
    if (this.configuracion && this.configuracion.whatsappUrl !== undefined && this.configuracion.whatsappUrl !== null) {
      return this.configuracion.whatsappUrl.trim();
    }
    return (this.configService?.negocio?.whatsapp || '').trim();
  }

  extraerNumeroWhatsapp(rawUrl: string): string {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    const trimmed = rawUrl.trim();
    if (!trimmed) return '';
    const lower = trimmed.toLowerCase();
    if (lower.includes('undefined') || lower.includes('null')) return '';

    // Extraer base antes de cualquier query string (? o &)
    const base = trimmed.split('?')[0].split('&')[0];
    if (base.endsWith('wa.me') || base.endsWith('wa.me/')) return '';

    let phoneDigits = '';
    if (trimmed.includes('phone=')) {
      const match = trimmed.match(/phone=([0-9]+)/);
      if (match) phoneDigits = match[1];
    } else {
      phoneDigits = base.replace(/\D/g, '');
    }

    return phoneDigits;
  }

  validarEnlaceWhatsapp(rawUrl?: string | null): boolean {
    if (!rawUrl) return false;
    const phoneDigits = this.extraerNumeroWhatsapp(rawUrl);
    return !!(phoneDigits && phoneDigits.length >= 9);
  }

  mostrarAlertaContingenciaWhatsApp() {
    this.modalAlertaService.warning(
      'No pudimos conectar con WhatsApp en este momento. Por favor, reintenta o escríbenos directamente.',
      'Problemas al conectar con WhatsApp'
    );
  }

  mostrarAlertaErrorWhatsapp() {
    this.mostrarAlertaContingenciaWhatsApp();
  }

  finalizarPedido(event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (!this.itemsCarrito || this.itemsCarrito.length === 0) {
      return;
    }

    // Paso 1: Verificar conectividad (CP016)
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.mostrarAlertaContingenciaWhatsApp();
      return;
    }

    // Paso 2: Extraer y validar el número de teléfono del enlace configurado (CP016)
    const rawUrl = this.obtenerUrlBaseWhatsapp();
    if (!rawUrl) {
      this.mostrarAlertaContingenciaWhatsApp();
      return;
    }

    if (rawUrl.toLowerCase().includes('undefined') || rawUrl.toLowerCase().includes('null')) {
      this.mostrarAlertaContingenciaWhatsApp();
      return;
    }

    const phoneDigits = this.extraerNumeroWhatsapp(rawUrl);

    // Regla estricta: Si el enlace es 'https://wa.me/?text=' (sin número), o si el campo está vacío,
    // o si los dígitos extraídos no contienen al menos 9 dígitos correspondientes a un teléfono real:
    // -> DETENER COMPLETAMENTE la función.
    // -> NO llamar a window.open ni cambiar window.location.href.
    // -> NO vaciar el carrito (mantener intactos los productos y montos).
    // -> Ejecutar this.mostrarAlertaContingenciaWhatsApp().
    if (!phoneDigits || phoneDigits.length < 9) {
      this.mostrarAlertaContingenciaWhatsApp();
      return;
    }

    try {
      let textMsg = '';
      if (this.clienteAuthService.isLoggedIn) {
        const cliente = this.clienteAuthService.currentCliente;
        const nombre = cliente?.nombre || this.clienteAuthService.nombreParaMostrar || 'Cliente';
        const apellido = cliente?.apellidoPaterno || cliente?.apellidos || '';
        const nombreCompleto = `${nombre} ${apellido}`.trim();
        const dni = cliente?.numeroDocumento || 'No especificado';
        const telefono = cliente?.telefono || 'No especificado';

        const direcciones = this.clienteAuthService.obtenerDirecciones();
        const dirPrincipal = (direcciones && direcciones.length > 0)
          ? (direcciones.find(d => d.esPrincipal) || direcciones[0])
          : null;

        let dirTexto = 'No registrada';
        if (dirPrincipal) {
          const det = dirPrincipal.detalleOpcional ? ` (${dirPrincipal.detalleOpcional})` : '';
          dirTexto = `${dirPrincipal.direccion}${det}, ${dirPrincipal.distrito}, ${dirPrincipal.departamento}`;
        }

        textMsg = `✨ [PEDIDO DE CLIENTE REGISTRADO]\n` +
                  `👤 Cliente: ${nombreCompleto}\n` +
                  `📄 DNI: ${dni}\n` +
                  `📱 Teléfono: ${telefono}\n` +
                  `📍 Dirección de entrega registrada: ${dirTexto}\n\n` +
                  `Hola! Me gustaría confirmar mi pedido:\n` + 
                  this.itemsCarrito.map(i => `- ${i.nombre} (Cantidad: ${i.cantidad})`).join('\n') +
                  `\nSubtotal: S/ ${this.cartService.subtotal.toFixed(2)}` +
                  `\nDescuento: S/ ${this.cartService.discount.toFixed(2)}` +
                  `\nTotal: S/ ${this.cartService.total.toFixed(2)}`;
      } else {
        textMsg = `Hola! Me gustaría confirmar mi pedido:\n` + 
                  this.itemsCarrito.map(i => `- ${i.nombre} (Cantidad: ${i.cantidad})`).join('\n') +
                  `\nSubtotal: S/ ${this.cartService.subtotal.toFixed(2)}` +
                  `\nDescuento: S/ ${this.cartService.discount.toFixed(2)}` +
                  `\nTotal: S/ ${this.cartService.total.toFixed(2)}`;
      }

      let waUrl = '';
      if (rawUrl.includes('wa.me') || rawUrl.includes('whatsapp.com')) {
        const baseSinQuery = rawUrl.split('?')[0];
        waUrl = `${baseSinQuery}?text=${encodeURIComponent(textMsg)}`;
      } else {
        waUrl = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(textMsg)}`;
      }

      // 3. Registrar uso de cupón si aplica
      if (this.cuponAplicadoData && this.cuponAplicadoData.id) {
        this.adminCarritoService.registrarUsoCupon(this.cuponAplicadoData.id).subscribe({
          next: (c) => console.log('Uso de cupón registrado con éxito:', c),
          error: (err) => console.error('Error al registrar uso del cupón:', err)
        });
      }

      if (this.cuponAplicadoData) {
        const esBienvenida = this.cuponAplicadoData.tipoAplicacion === 'BIENVENIDA' || (this.cuponAplicadoData.codigo || '').toUpperCase().includes('BIENVENID');
        if (esBienvenida && this.clienteAuthService.currentCliente?.email) {
          localStorage.setItem('cupon_bienvenida_usado_' + this.clienteAuthService.currentCliente.email.toLowerCase().trim(), 'true');
          this.tieneComprasPreviasValidadas = true;
        }
      }

      // 4. Abrir navegación externa hacia WhatsApp
      const ventana = window.open(waUrl, '_blank');
      if (!ventana && typeof window !== 'undefined') {
        window.location.href = waUrl;
      }

      // 5. Vaciar el carrito únicamente al proceder con éxito la redirección
      this.cartService.clearCart();
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('cart');
        localStorage.removeItem('carrito');
        localStorage.removeItem('puntoycoma_cart');
      }
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('cart');
        sessionStorage.removeItem('carrito');
        sessionStorage.removeItem('puntoycoma_cart');
      }
      this.itemsCarrito = [];
      this.quitarCupon();
      this.cdr.markForCheck();
    } catch (error) {
      console.warn('Error al iniciar compra por WhatsApp:', error);
      this.mostrarAlertaContingenciaWhatsApp();
    }
  }

  obtenerEnlaceWhatsapp(): string {
    const rawUrl = this.obtenerUrlBaseWhatsapp();
    if (!this.validarEnlaceWhatsapp(rawUrl)) {
      return '';
    }
    const phoneDigits = this.extraerNumeroWhatsapp(rawUrl);
    return `https://wa.me/${phoneDigits}`;
  }
}
