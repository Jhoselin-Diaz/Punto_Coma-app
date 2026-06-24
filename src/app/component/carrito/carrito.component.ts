import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ClienteLayoutComponent } from '../cliente-layout/cliente-layout.component';
import { CartService, CartItem } from '../../service/cart.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-carrito',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ClienteLayoutComponent],
  templateUrl: './carrito.component.html',
  styleUrl: './carrito.component.css'
})
export class CarritoComponent implements OnInit, OnDestroy {
  items: CartItem[] = [];
  couponCode = '';
  couponError = '';
  couponSuccess = false;
  private sub = new Subscription();

  constructor(public cartService: CartService, private router: Router) {}

  ngOnInit() {
    this.sub.add(
      this.cartService.items$.subscribe(items => {
        this.items = items;
      })
    );
    this.couponCode = this.cartService.coupon;
    if (this.couponCode) {
      this.couponSuccess = true;
    }
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
    if (this.cartService.applyCoupon(this.couponCode)) {
      this.couponSuccess = true;
    } else {
      this.couponError = 'Cupón inválido. Intente con DESC20 o PUNTOYCOMA.';
      this.cartService.removeCoupon();
    }
  }

  finalizarPedido() {
    if (this.items.length === 0) return;
    this.cartService.finalizarPedido();
    this.router.navigate(['/admin/chats']);
  }
}
