import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ClienteLayoutComponent } from '../cliente-layout/cliente-layout.component';
import { CartService, CartItem } from '../../service/cart.service';
import { AdminCarritoService, ConfiguracionCarrito } from '../../service/admin-carrito.service';
import { Subscription } from 'rxjs';

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

  // Dynamic configuration object
  configuracion: ConfiguracionCarrito | null = null;

  private sub = new Subscription();

  constructor(
    public cartService: CartService,
    private adminCarritoService: AdminCarritoService,
    private router: Router
  ) {}

  ngOnInit() {
    this.sub.add(
      this.cartService.items$.subscribe(items => {
        this.itemsCarrito = items;
      })
    );
    this.couponCode = this.cartService.coupon;
    if (this.couponCode) {
      this.couponSuccess = true;
    }
    this.cargarConfiguracionCarrito();
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

  aplicarCupon() {
    this.couponError = '';
    this.couponSuccess = false;
    const code = this.couponCode.trim().toUpperCase();
    if (!code) {
      this.couponError = 'Por favor, ingrese un código de cupón.';
      return;
    }

    this.adminCarritoService.validarCupon(code).subscribe({
      next: (cupon) => {
        if (cupon && cupon.activo) {
          this.cartService.applyDynamicCoupon(cupon.codigo, cupon.porcentajeDescuento);
          this.couponSuccess = true;
        } else {
          this.couponError = 'Cupón inválido o inactivo.';
          this.cartService.removeCoupon();
        }
      },
      error: (err) => {
        // Fallback to local coupon rules
        const success = this.cartService.applyCoupon(code);
        if (success) {
          this.couponSuccess = true;
        } else {
          this.couponError = 'Cupón inválido o vencido.';
          this.cartService.removeCoupon();
        }
      }
    });
  }

  finalizarPedido(event: MouseEvent) {
    if (this.itemsCarrito.length === 0) {
      event.preventDefault();
      return;
    }
    this.cartService.finalizarPedido();
    this.router.navigate(['/admin/chats']);
  }

  obtenerEnlaceWhatsapp(): string {
    let waUrl = this.configuracion?.whatsappUrl || 'https://wa.me/51933526011';
    if (!waUrl.includes('text=')) {
      if (waUrl.includes('?')) {
        waUrl += '&text=';
      } else {
        waUrl += '?text=';
      }
    }
    const textMsg = `Hola! Me gustaría confirmar mi pedido:\n` + 
                    this.itemsCarrito.map(i => `- ${i.nombre} (Cantidad: ${i.cantidad})`).join('\n') +
                    `\nSubtotal: S/ ${this.cartService.subtotal}` +
                    `\nDescuento: S/ ${this.cartService.discount}` +
                    `\nTotal: S/ ${this.cartService.total}`;
    
    return waUrl + encodeURIComponent(textMsg);
  }
}
