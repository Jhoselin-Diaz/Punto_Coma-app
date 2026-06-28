import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface CartItem {
  id: string;
  nombre: string;
  precio: number;
  imagen: string;
  cantidad: number;
}

export interface PlacedOrder {
  id: string;
  productos: { nombre: string, cantidad: number }[];
  subtotal: number;
  descuento: number;
  total: number;
  fecha: string;
}

export interface ChatMensaje {
  texto: string;
  tipo: 'entrada' | 'salida';
  hora: string;
  leido?: boolean;
  isVoucher?: boolean;
  voucherData?: { monto: string; fecha: string };
}

export interface ChatConversacion {
  id: string;
  nombre: string;
  telefono: string;
  avatar: string;
  ultimaVez: string;
  noLeidos: number;
  mensajes: ChatMensaje[];
  primeraCompra: string;
  totalPedidos: number;
  historialPedidos: { id: string; fecha: string; subtotal: string; estado: string }[];
  borrador?: string;
  mensajeGenerado?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CartService {

  // ─── CARRITO ────────────────────────────────────────────────────────────────
  private itemsSubject = new BehaviorSubject<CartItem[]>([]);

  items$ = this.itemsSubject.asObservable();

  private discountValue = 0;
  private couponApplied = '';
  private couponPercentage = 0;
  private pendingOrder: PlacedOrder | null = null;
  private allOrders: PlacedOrder[] = [];

  // ─── ESTADO GLOBAL DE PEDIDOS ───────────────────────────────────────────────
  // Solo '#ORD-0002' arranca en Pendiente (chat de Ana María).
  // '#ORD-0001' NO se pre-popula para que el flujo del voucher funcione correctamente.
  private orderStatuses: Record<string, 'Validado' | 'Pendiente' | 'En revision' | 'Rechazado'> = {
    '#ORD-0002': 'Pendiente',
  };

  // ─── CHATS PERSISTENTES ──────────────────────────────────────────────────────
  // El array de chats y el id seleccionado viven aquí para sobrevivir a la
  // destrucción/recreación del componente al cambiar de ruta.
  private _persistedChats: any[] | null = null;   // null = aún no inicializado
  private _persistedSelectedId: string | null = null;

  get persistedChats(): any[] | null { return this._persistedChats; }
  get persistedSelectedId(): string | null { return this._persistedSelectedId; }

  saveChats(chats: any[], selectedId: string | null) {
    this._persistedChats = chats;
    this._persistedSelectedId = selectedId;
  }

  // ─── ESTADO GLOBAL DEL CHAT (PERSISTENTE DURANTE LA SESIÓN) ────────────────
  private _chatsInicializados = false;
  private _chats: ChatConversacion[] = [];
  private _chatSeleccionadoId: string | null = null;

  // Señal reactiva para notificar cambios de estado de pedido a quien escuche
  private orderStatusChanged$ = new BehaviorSubject<string>('');

  get orderStatusChange$() { return this.orderStatusChanged$.asObservable(); }

  // ─── ACCESO AL ESTADO DE CHATS ──────────────────────────────────────────────
  get chats(): ChatConversacion[] { return this._chats; }

  get chatSeleccionadoId(): string | null { return this._chatSeleccionadoId; }

  setChatSeleccionadoId(id: string | null) { this._chatSeleccionadoId = id; }

  get chatSeleccionado(): ChatConversacion | null {
    if (!this._chatSeleccionadoId) return this._chats[0] ?? null;
    return this._chats.find(c => c.id === this._chatSeleccionadoId) ?? this._chats[0] ?? null;
  }

  /**
   * Inicializa el array de chats SOLO la primera vez (singleton).
   * Las siguientes llamadas no hacen nada — el estado persiste.
   */
  inicializarChats(pendingOrder?: PlacedOrder | null) {
    if (this._chatsInicializados) return; // ← clave: no reiniciar

    const base: ChatConversacion[] = [
      {
        id: '1',
        nombre: 'Ana María',
        telefono: '+51 987 654 321',
        avatar: '👩🏽',
        ultimaVez: '11:48 a. m.',
        noLeidos: 2,
        primeraCompra: '12 nov 2024',
        totalPedidos: 3,
        historialPedidos: [
          { id: '#ORD-0001', fecha: 'Hoy, 11:40 a.m.', subtotal: 'S/ 39.00', estado: 'Pendiente' },
          { id: '#ORD-0003', fecha: '23 Dic 2024', subtotal: 'S/ 45.00', estado: 'Completado' },
          { id: '#ORD-0004', fecha: '12 Nov 2024', subtotal: 'S/ 39.00', estado: 'Completado' }
        ],
        mensajes: [
          { texto: 'Hola 😄\nQuiero realizar el siguiente pedido:\n\n🛍️ Productos:\n• Taza aesthetic "Moon" x1\n\n💰 Subtotal: S/ 39.00', tipo: 'entrada', hora: '11:40 a. m.' },
          { texto: '¡Hola! Gracias por comprar en Punto y Coma 💖\n\nTu pedido se encuentra en proceso de validación.\nPara cotizar el costo de envío, por favor completa los siguientes datos 🚚\n\n📍 Departamento:\n📍 Provincia:\n📍 Distrito:\n🏠 Dirección exacta:\n📝 Referencia:\n\nCuando termines, envíanos la información por este chat 😊', tipo: 'salida', hora: '11:41 a. m.', leido: true },
          { texto: 'Claro, aquí te dejo mis datos:\n\n📍 Departamento: Lima\n📍 Provincia: Lima\n📍 Distrito: Surco\n🏠 Dirección: Av. Primavera 123\n📝 Referencia: Frente al parque', tipo: 'entrada', hora: '11:47 a. m.' }
        ],
        mensajeGenerado: '🚚 El costo de envío es: S/ 8.00\n💰 El total final de tu pedido es: S/ 39.00\n\n🏦 Métodos de pago disponibles:\n💳 BCP: 9999999999999\n🏦 Interbank: 9999999999999\n📱 Yape / Plin: 999999999\n\nPor favor, envíanos tu voucher o comprobante de pago por este medio para continuar con la validación de tu pedido 😉'
      },
      { id: '2', nombre: 'Luis Fernando', telefono: '+51 912 345 678', avatar: '👨🏻', ultimaVez: '11:30 a. m.', noLeidos: 1, primeraCompra: '1 ene 2025', totalPedidos: 1, historialPedidos: [{ id: 'PY-1025', fecha: 'Hoy, 11:30 a.m.', subtotal: 'S/ 45.00', estado: 'Pendiente' }], mensajes: [{ texto: '¿El envío llega hoy?', tipo: 'entrada', hora: '11:30 a. m.' }], mensajeGenerado: 'Hola Luis, tu envío está programado para entregarse hoy entre la 1pm y 5pm. ¡Gracias!' },
      { id: '3', nombre: 'Valeria Castro', telefono: '+51 923 456 789', avatar: '👩🏻', ultimaVez: '11:18 a. m.', noLeidos: 1, primeraCompra: '15 dic 2024', totalPedidos: 5, historialPedidos: [{ id: 'PY-1020', fecha: 'Hoy, 11:18 a.m.', subtotal: 'S/ 120.00', estado: 'Pendiente' }, { id: 'PY-0988', fecha: '2 May 2025', subtotal: 'S/ 35.00', estado: 'Completado' }, { id: 'PY-0820', fecha: '15 Dic 2024', subtotal: 'S/ 80.00', estado: 'Completado' }], mensajes: [{ texto: 'Envié el comprobante de pago', tipo: 'entrada', hora: '11:18 a. m.' }], mensajeGenerado: '¡Recibido Valeria! Tu pedido se enviará pronto. 💖' },
      { id: '4', nombre: 'Jorge Ramírez', telefono: '+51 934 567 890', avatar: '👨🏽', ultimaVez: '10:50 a. m.', noLeidos: 0, primeraCompra: '20 oct 2024', totalPedidos: 2, historialPedidos: [{ id: 'PY-0980', fecha: 'Ayer', subtotal: 'S/ 35.00', estado: 'Validado' }, { id: 'PY-0710', fecha: '20 Oct 2024', subtotal: 'S/ 45.00', estado: 'Completado' }], mensajes: [{ texto: 'Gracias, quedo atento', tipo: 'entrada', hora: '10:50 a. m.' }], mensajeGenerado: 'De nada Jorge. Si necesitas algo más, escríbenos.' },
      { id: '5', nombre: 'Sofía López', telefono: '+51 945 678 901', avatar: '👩🏼', ultimaVez: '10:21 a. m.', noLeidos: 0, primeraCompra: '10 may 2025', totalPedidos: 1, historialPedidos: [{ id: 'PY-1030', fecha: 'Hace 3 días', subtotal: 'S/ 0.00', estado: 'Pendiente' }], mensajes: [{ texto: '¿Tienen la taza en color negro?', tipo: 'entrada', hora: '10:21 a. m.' }], mensajeGenerado: '¡Hola Sofía! Sí, contamos con modelos en negro. ¿Te gustaría verlos?' },
      { id: '6', nombre: 'María Fernanda', telefono: '+51 956 789 012', avatar: '👩🏽', ultimaVez: 'Ayer', noLeidos: 0, primeraCompra: '5 abr 2025', totalPedidos: 4, historialPedidos: [{ id: 'PY-1010', fecha: 'Ayer', subtotal: 'S/ 70.00', estado: 'Enviado' }, { id: 'PY-0955', fecha: '14 Abr 2025', subtotal: 'S/ 45.00', estado: 'Completado' }, { id: 'PY-0920', fecha: '5 Abr 2025', subtotal: 'S/ 80.00', estado: 'Completado' }], mensajes: [{ texto: 'Perfecto, muchas gracias', tipo: 'entrada', hora: 'Ayer' }], mensajeGenerado: '¡Gracias a ti María Fernanda! Que disfrutes tu compra.' }
    ];

    // Si hay un pedido del carrito que acaba de llegar, añadirlo al frente
    if (pendingOrder) {
      const productosText = pendingOrder.productos.map(p => `• ${p.nombre} x${p.cantidad}`).join('\n');
      const totalFormatted = pendingOrder.total.toFixed(2);
      const mensajeTexto = `Hola 😄\nQuiero realizar el siguiente pedido:\n\n🛍️ Productos:\n${productosText}\n\n💰 Subtotal: S/ ${pendingOrder.subtotal.toFixed(2)}\nDescuento: - S/ ${pendingOrder.descuento.toFixed(2)}\nTotal final: S/ ${totalFormatted}`;

      const nuevoChat: ChatConversacion = {
        id: pendingOrder.id,
        nombre: 'Juan Pérez (Pedido)',
        telefono: '+51 987 111 222',
        avatar: '🛍️',
        ultimaVez: pendingOrder.fecha.split(', ')[1] || 'Justo ahora',
        noLeidos: 1,
        primeraCompra: new Date().toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' }),
        totalPedidos: 1,
        historialPedidos: [{ id: pendingOrder.id, fecha: pendingOrder.fecha, subtotal: `S/ ${totalFormatted}`, estado: 'Pendiente' }],
        mensajes: [{ texto: mensajeTexto, tipo: 'entrada', hora: pendingOrder.fecha.split(', ')[1] || 'Justo ahora' }],
        mensajeGenerado: `¡Hola Juan! Recibimos tu pedido con éxito 🎉\n\nTu total final es S/ ${totalFormatted}.\nPor favor, confírmanos tu método de pago para continuar 🚚.`
      };
      this._chats = [nuevoChat, ...base];
      this._chatSeleccionadoId = nuevoChat.id;
      this.clearPendingOrder();
    } else {
      this._chats = base;
      this._chatSeleccionadoId = base[0].id;
    }

    this._chatsInicializados = true;
  }

  agregarChatAlFrente(chat: ChatConversacion) {
    this._chats = [chat, ...this._chats.filter(c => c.id !== chat.id)];
    this._chatSeleccionadoId = chat.id;
  }

  // ─── ESTADO DE PEDIDOS ──────────────────────────────────────────────────────
  setOrderStatus(orderId: string, status: 'Validado' | 'Pendiente' | 'En revision' | 'Rechazado') {
    this.orderStatuses[orderId] = status;
    this.orderStatusChanged$.next(orderId); // notificar
  }

  getOrderStatus(orderId: string, defaultStatus: 'Validado' | 'Pendiente' | 'En revision' | 'Rechazado'): 'Validado' | 'Pendiente' | 'En revision' | 'Rechazado' {
    return this.orderStatuses[orderId] ?? defaultStatus;
  }

  // ─── CARRITO ─────────────────────────────────────────────────────────────────
  get items(): CartItem[] { return this.itemsSubject.value; }
  get discount(): number {
    if (this.couponPercentage > 0) {
      return Math.round(this.subtotal * (this.couponPercentage / 100));
    }
    return this.discountValue;
  }
  get coupon(): string { return this.couponApplied; }

  get subtotal(): number {
    return this.items.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);
  }

  get total(): number {
    const t = this.subtotal - this.discount;
    return t > 0 ? t : 0;
  }

  updateQuantity(id: string, cantidad: number) {
    if (cantidad <= 0) { this.removeItem(id); return; }
    this.itemsSubject.next(this.items.map(item => item.id === id ? { ...item, cantidad } : item));
  }

  removeItem(id: string) {
    this.itemsSubject.next(this.items.filter(item => item.id !== id));
  }

  applyCoupon(code: string): boolean {
    const c = code.trim().toUpperCase();
    if (c === 'DESC20') {
      this.couponApplied = c;
      this.couponPercentage = 20;
      return true;
    }
    if (c === 'PUNTOYCOMA') {
      this.couponApplied = c;
      this.couponPercentage = 10;
      return true;
    }
    return false;
  }

  applyDynamicCoupon(codigo: string, porcentaje: number) {
    this.couponApplied = codigo;
    this.couponPercentage = porcentaje;
    this.discountValue = 0;
  }

  removeCoupon() {
    this.couponApplied = '';
    this.couponPercentage = 0;
    this.discountValue = 0;
  }

  finalizarPedido() {
    if (this.items.length === 0) return;
    const hora = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    const orderId = `PY-${Math.floor(1000 + Math.random() * 9000)}`;

    this.pendingOrder = {
      id: orderId,
      productos: this.items.map(i => ({ nombre: i.nombre, cantidad: i.cantidad })),
      subtotal: this.subtotal,
      descuento: this.discount,
      total: this.total,
      fecha: `Hoy, ${hora}`
    };

    this.allOrders.unshift(this.pendingOrder);
    this.setOrderStatus(orderId, 'Pendiente');
    this.itemsSubject.next([]);
  }

  getPendingOrder(): PlacedOrder | null { return this.pendingOrder; }
  clearPendingOrder() { this.pendingOrder = null; }
  clearCart() {
    this.itemsSubject.next([]);
    this.removeCoupon();
  }
  getAllOrders(): PlacedOrder[] { return this.allOrders; }

  addItem(product: any) {
    const existing = this.items.find(item => item.id === String(product.id));
    if (existing) {
      this.updateQuantity(existing.id, existing.cantidad + 1);
    } else {
      const price = product.precioOferta && product.precioOferta > 0 ? product.precioOferta : product.precio;
      const newItem: CartItem = {
        id: String(product.id),
        nombre: product.nombre,
        precio: price,
        imagen: product.imagenPrincipal || product.imageUrl || product.imagen || 'images/prod-jaspeada.png',
        cantidad: 1
      };
      this.itemsSubject.next([...this.items, newItem]);
    }
  }
}
