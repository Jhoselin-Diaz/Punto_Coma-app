import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminLayoutComponent } from '../admin-layout/admin-layout.component';
import { CartService } from '../../service/cart.service';

interface Mensaje {
  texto: string;
  tipo: 'entrada' | 'salida';
  hora: string;
  leido?: boolean;
  isVoucher?: boolean;
  voucherData?: {
    monto: string;
    fecha: string;
  };
}

interface Chat {
  id: string;
  nombre: string;
  telefono: string;
  avatar: string;
  ultimaVez: string;
  noLeidos: number;
  mensajes: Mensaje[];
  primeraCompra: string;
  totalPedidos: number;
  historialPedidos: { id: string; fecha: string; subtotal: string; estado: string }[];
  borrador?: string;
  mensajeGenerado?: string;
  estado?: 'Normal' | 'En revision';
}

@Component({
  selector: 'app-admin-chats',
  standalone: true,
  imports: [CommonModule, AdminLayoutComponent],
  templateUrl: './admin-chats.component.html',
  styleUrl: './admin-chats.component.css'
})
export class AdminChatsComponent implements OnInit, OnDestroy {
  chatSeleccionado: Chat | null = null;
  filtroActivo: 'Todas' | 'No leídas' | 'Pendientes' = 'Todas';
  tabInfoActiva: 'Información' | 'Historial' = 'Información';

  editandoMensajeGenerado = false;
  mensajeGeneradoTemp = '';

  // Estados del Asistente IA
  isGenerating = false;
  generatingStatus = '';

  aiStatus = {
    pedidoIdentificado: false,
    direccionDetectada: false,
    datosCompletos: false,
    contextoAnalizado: false
  };

  chats: Chat[] = [];

  constructor(private cartService: CartService) { }

  get chatsOrdenados(): Chat[] {
    return [...this.chats].sort((a, b) => {
      const aRevision = a.estado === 'En revision';
      const bRevision = b.estado === 'En revision';
      if (aRevision && !bRevision) return -1;
      if (!aRevision && bRevision) return 1;
      return 0;
    });
  }

  actualizarEstadosAsistente(chat: Chat) {
    if (!chat) return;
    const tieneVoucher = chat.mensajes.some(m => m.isVoucher);
    this.aiStatus.pedidoIdentificado = chat.mensajes.length > 0;
    this.aiStatus.direccionDetectada = chat.mensajes.some(m => m.texto.includes('📍') || m.texto.includes('Dirección'));
    this.aiStatus.datosCompletos = tieneVoucher;
    this.aiStatus.contextoAnalizado = chat.mensajes.length > 0;
  }

  ngOnInit() {
    // ── RESTAURAR chats persistidos (si el usuario ya visitó esta vista antes) ──
    const saved = this.cartService.persistedChats;
    if (saved) {
      // Ya existían chats guardados: restaurarlos para no perder mensajes ni vouchers
      this.chats = saved;
      const savedId = this.cartService.persistedSelectedId;
      this.chatSeleccionado = savedId
        ? this.chats.find(c => c.id === savedId) ?? this.chats[0]
        : this.chats[0];

      // ── Aún puede haber un pedido nuevo del carrito que llegó mientras navegabas ──
      const pendingOrder = this.cartService.getPendingOrder();
      if (pendingOrder) {
        this._inyectarPedidoComoChat(pendingOrder);
      }
    } else {
      // Primera visita
      const pendingOrder = this.cartService.getPendingOrder();
      if (pendingOrder) {
        this._inyectarPedidoComoChat(pendingOrder);
      } else {
        this.chatSeleccionado = this.chats[0] ?? null;
      }

      // Persistir el array inicial para futuras navegaciones
      this.cartService.saveChats(this.chats, this.chatSeleccionado?.id ?? null);
    }

    if (this.chatSeleccionado) {
      this.actualizarEstadosAsistente(this.chatSeleccionado);
    }
    this.scrollToBottom();
  }

  ngOnDestroy() {
    // Guardar estado actual antes de que el componente sea destruido
    this.cartService.saveChats(this.chats, this.chatSeleccionado?.id ?? null);
  }

  /** Crea un nuevo chat a partir de un pedido del carrito y lo coloca al frente */
  private _inyectarPedidoComoChat(pendingOrder: any) {
    const productosText = pendingOrder.productos
      .map((p: any) => `• ${p.nombre} x${p.cantidad}`)
      .join('\n');
    const subtotalFormatted  = pendingOrder.subtotal.toFixed(2);
    const descuentoFormatted = pendingOrder.descuento.toFixed(2);
    const totalFormatted     = pendingOrder.total.toFixed(2);

    const mensajeTexto = `Hola 😄\nQuiero realizar el siguiente pedido:\n\n🛍️ Productos:\n${productosText}\n\n💰 Subtotal: S/ ${subtotalFormatted}\nDescuento: - S/ ${descuentoFormatted}\nTotal final: S/ ${totalFormatted}`;

    const nuevoChat: Chat = {
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
      mensajeGenerado: `¡Hola Juan! Recibimos tu pedido con éxito 🎉\n\nTu total final es S/ ${totalFormatted}.\nPor favor, confírmanos tu método de pago preferido para continuar 🚚.`,
      estado: 'Normal'
    };

    this.chats = [nuevoChat, ...this.chats];
    this.chatSeleccionado = nuevoChat;
    this.cartService.clearPendingOrder();
    this.cartService.saveChats(this.chats, nuevoChat.id);
  }

  seleccionarChat(chat: Chat) {
    this.chatSeleccionado = chat;
    chat.noLeidos = 0;
    this.editandoMensajeGenerado = false;
    this.cartService.saveChats(this.chats, chat.id); // persistir selección
    this.scrollToBottom();
    this.actualizarEstadosAsistente(chat);
  }

  iniciarEdicionMensaje() {
    this.editandoMensajeGenerado = true;
    this.mensajeGeneradoTemp = this.chatSeleccionado?.mensajeGenerado || '';
  }

  cancelarEdicionMensaje() {
    this.editandoMensajeGenerado = false;
  }

  guardarEdicionMensaje() {
    if (this.chatSeleccionado) {
      this.chatSeleccionado.mensajeGenerado = this.mensajeGeneradoTemp;
    }
    this.editandoMensajeGenerado = false;
  }

  // ─── MÉTODOS DE LA SIMULACIÓN FLUIDA ──────────────────────────────────

  obtenerEstadoOrden(ordenId: string, estadoOriginal: string): string {
    return this.cartService.getOrderStatus(ordenId, estadoOriginal as any);
  }

  enviarMensajeGenerado() {
    if (!this.chatSeleccionado || !this.chatSeleccionado.mensajeGenerado) return;

    const texto = this.chatSeleccionado.mensajeGenerado;
    this.chatSeleccionado.mensajeGenerado = ''; // Limpiar mensaje generado
    this.editandoMensajeGenerado = false;

    this.agregarMensajeAlChat(texto, 'salida');
  }

  enviarMensajeManual() {
    if (!this.chatSeleccionado || !this.chatSeleccionado.borrador || !this.chatSeleccionado.borrador.trim()) return;

    const texto = this.chatSeleccionado.borrador;
    this.chatSeleccionado.borrador = ''; // Limpiar borrador

    this.agregarMensajeAlChat(texto, 'salida');
  }

  private agregarMensajeAlChat(texto: string, tipo: 'entrada' | 'salida', isVoucher = false, voucherData?: any) {
    if (!this.chatSeleccionado) return;

    const fechaAhora = new Date();
    const hora = fechaAhora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

    const nuevoMensaje: Mensaje = {
      texto,
      tipo,
      hora,
      leido: tipo === 'salida' ? true : undefined,
      isVoucher,
      voucherData
    };

    // Registrar mensaje en la lista local
    this.chatSeleccionado.mensajes.push(nuevoMensaje);

    // Sincronizar info de última interacción en la lista
    this.chatSeleccionado.ultimaVez = hora;

    // ← Persistir inmediatamente para que los mensajes sobrevivan a la navegación
    this.cartService.saveChats(this.chats, this.chatSeleccionado.id);

    this.scrollToBottom();

    // Si el mensaje es de salida, simular respuesta automática del cliente
    if (tipo === 'salida') {
      const ordenActiva = this.chatSeleccionado.historialPedidos[0];
      const yaTieneVoucher = this.chatSeleccionado.mensajes.some(m => m.isVoucher);

      // Si hay una orden pendiente y no ha enviado el voucher, simular Yape tras 1.5s
      if (ordenActiva && this.obtenerEstadoOrden(ordenActiva.id, ordenActiva.estado) === 'Pendiente' && !yaTieneVoucher) {
        setTimeout(() => {
          this.simularPagoYape(ordenActiva);
        }, 1500);
      }
    }
  }

  private simularPagoYape(orden: any) {
    if (!this.chatSeleccionado) return;

    const now = new Date();
    const hora = now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    const fechaText = now.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' }) + ' - ' + hora;

    // Obtener monto real del pedido o S/ 39.00 como fallback
    const monto = orden.subtotal || 'S/ 39.00';

    // 1. Añadir el Voucher de Yape
    this.agregarMensajeAlChat('[YAPE_VOUCHER]', 'entrada', true, {
      monto: monto,
      fecha: fechaText
    });

    // 2. Añadir el texto "Listo 😊" 1 segundo después
    setTimeout(() => {
      this.agregarMensajeAlChat('Listo 😊', 'entrada');
    }, 1000);
  }

  generarRespuestaAI() {
    if (!this.chatSeleccionado) return;

    this.isGenerating = true;
    this.generatingStatus = 'Analizando contexto...';

    // Pequeño skeleton loader con spinner minimalista
    setTimeout(() => {
      this.generatingStatus = 'Generando respuesta...';
    }, 700);

    setTimeout(() => {
      this.isGenerating = false;

      const ordenActiva  = this.chatSeleccionado!.historialPedidos[0];
      const estadoActual = ordenActiva
        ? this.obtenerEstadoOrden(ordenActiva.id, ordenActiva.estado)
        : 'Pendiente';

      // ── Respuesta inteligente según estado de conciliación ──────────────────
      if (estadoActual === 'Validado') {
        this.chatSeleccionado!.mensajeGenerado =
          `Pedido confirmado ✅\nTu pedido será preparado y enviado pronto.\nGracias por confiar en Punto y Coma 💖`;

      } else if (estadoActual === 'Rechazado') {
        this.chatSeleccionado!.mensajeGenerado =
          `❌ Pago no procede\n\nHemos revisado tu comprobante, pero el pago no ha sido validado.\n\nEsto puede deberse a:\n• Monto incorrecto\n• Comprobante incompleto\n• Pago pendiente de procesarse\n\nPor favor, verifica y envía un nuevo comprobante válido.\n\nSi necesitas ayuda, estoy aquí 😊`;

      } else if (estadoActual === 'En revision') {
        this.chatSeleccionado!.mensajeGenerado =
          `Hemos recibido tu comprobante y lo estamos revisando 🔎\nTe notificaremos en breve. ¡Gracias por tu paciencia! 😊`;

      } else {
        // Pendiente: primer mensaje tras recibir el voucher
        this.chatSeleccionado!.mensajeGenerado =
          `Un momento por favor, validaremos su pago 😊`;
      }

      this.editandoMensajeGenerado = false;
      this.cartService.saveChats(this.chats, this.chatSeleccionado?.id ?? null); // persistir
      this.scrollToBottom();
    }, 1600);
  }

  scrollToBottom() {
    setTimeout(() => {
      const container = document.querySelector('.chat-messages');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 80);
  }
}
