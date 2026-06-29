import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminLayoutComponent } from '../admin-layout/admin-layout.component';
import { CartService } from '../../service/cart.service';
import { AdminChatService, ChatDTO, MensajeDTO } from '../../service/admin-chat.service';

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
  id: number;
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
  ultimoMensaje?: string;
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
  private pollingInterval: any = null;
  mostrarMenuOpciones = false;
  mostrarPanelEmojis = false;
  listaEmojis: string[] = ['😊', '👍', '🙌', '🙏', '☕', '📦', '✅', '❌', '🛒', '🛍️', '🧾', '✨', '📝', '📍', '🚗', '📞'];

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

  constructor(
    private cartService: CartService,
    private adminChatService: AdminChatService
  ) { }

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
    this.cargarChatsReales();
  }

  ngOnDestroy() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  cargarChatsReales(seleccionarId?: number) {
    this.adminChatService.getChats().subscribe({
      next: (dtos) => {
        this.chats = dtos.map(dto => this.mapChatDtoToChat(dto));
        if (this.chats.length > 0) {
          if (seleccionarId) {
            const found = this.chats.find(c => c.id === seleccionarId);
            if (found) {
              this.seleccionarChat(found);
              return;
            }
          }
          this.seleccionarChat(this.chats[0]);
        } else {
          this.chatSeleccionado = null;
        }
      },
      error: (err) => console.error('Error al cargar chats reales:', err)
    });
  }

  mapChatDtoToChat(dto: ChatDTO): Chat {
    const formattedTime = this.formatFecha(dto.fechaUltimaActualizacion);
    return {
      id: dto.id,
      nombre: dto.nombreCliente || 'Cliente Nuevo',
      telefono: dto.telefonoCliente || '',
      avatar: dto.nombreCliente ? dto.nombreCliente.charAt(0).toUpperCase() : '👤',
      ultimaVez: formattedTime,
      noLeidos: dto.unreadCount || 0,
      mensajes: [],
      primeraCompra: 'No registrada',
      totalPedidos: 0,
      historialPedidos: [],
      borrador: '',
      mensajeGenerado: '',
      estado: 'Normal',
      ultimoMensaje: dto.ultimoMensaje
    };
  }

  mapMensajeDtoToMensaje(dto: MensajeDTO): Mensaje {
    const isVoucher = dto.contenido.includes('[YAPE_VOUCHER]') || dto.contenido.startsWith('[YAPE_VOUCHER]');
    let voucherData: any = undefined;
    if (isVoucher) {
      const cleaned = dto.contenido.replace('[YAPE_VOUCHER]', '').trim();
      voucherData = {
        monto: cleaned || 'S/ 0.00',
        fecha: this.formatFecha(dto.fechaEnvio)
      };
    }

    return {
      texto: isVoucher ? '[YAPE_VOUCHER]' : dto.contenido,
      tipo: dto.remitente === 'CLIENTE' ? 'entrada' : 'salida',
      hora: this.formatFecha(dto.fechaEnvio),
      leido: true,
      isVoucher,
      voucherData
    };
  }

  formatFecha(dateStr: string): string {
    if (!dateStr) return 'Justo ahora';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Justo ahora';
    }
  }

  seleccionarChat(chat: Chat) {
    this.chatSeleccionado = chat;
    chat.noLeidos = 0;
    this.editandoMensajeGenerado = false;
    this.mostrarMenuOpciones = false;
    this.mostrarPanelEmojis = false;

    // Configurar polling en segundo plano para refrescar mensajes en tiempo real
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
    this.pollingInterval = setInterval(() => {
      this.refrescarMensajesSilencioso();
    }, 2000);
    
    this.adminChatService.getMensajes(chat.id).subscribe({
      next: (mensajeDtos) => {
        chat.mensajes = mensajeDtos.map(dto => this.mapMensajeDtoToMensaje(dto));
        this.scrollToBottom();
        this.actualizarEstadosAsistente(chat);
      },
      error: (err) => console.error('Error al cargar mensajes del chat:', err)
    });
  }

  obtenerEstadoOrden(ordenId: string, estadoOriginal: string): string {
    return this.cartService.getOrderStatus(ordenId, estadoOriginal as any);
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

  enviarMensajeGenerado() {
    if (!this.chatSeleccionado || !this.chatSeleccionado.mensajeGenerado) return;

    const texto = this.chatSeleccionado.mensajeGenerado;
    const chatId = this.chatSeleccionado.id;
    this.chatSeleccionado.mensajeGenerado = ''; 
    this.editandoMensajeGenerado = false;

    this.adminChatService.enviarMensaje(chatId, texto).subscribe({
      next: (creadoDto) => {
        if (this.chatSeleccionado && this.chatSeleccionado.id === chatId) {
          const nuevoMsg = this.mapMensajeDtoToMensaje(creadoDto);
          this.chatSeleccionado.mensajes.push(nuevoMsg);
          this.chatSeleccionado.ultimoMensaje = texto;
          this.chatSeleccionado.ultimaVez = nuevoMsg.hora;
          this.scrollToBottom();
          // Forzar refresco silencioso inmediato
          this.refrescarMensajesSilencioso();
        }
      },
      error: (err) => console.error('Error al enviar mensaje generado:', err)
    });
  }

  enviarMensajeManual() {
    if (!this.chatSeleccionado || !this.chatSeleccionado.borrador || !this.chatSeleccionado.borrador.trim()) return;

    const texto = this.chatSeleccionado.borrador;
    const chatId = this.chatSeleccionado.id;
    this.chatSeleccionado.borrador = ''; 

    this.adminChatService.enviarMensaje(chatId, texto).subscribe({
      next: (creadoDto) => {
        if (this.chatSeleccionado && this.chatSeleccionado.id === chatId) {
          const nuevoMsg = this.mapMensajeDtoToMensaje(creadoDto);
          this.chatSeleccionado.mensajes.push(nuevoMsg);
          this.chatSeleccionado.ultimoMensaje = texto;
          this.chatSeleccionado.ultimaVez = nuevoMsg.hora;
          this.scrollToBottom();
          // Forzar refresco silencioso inmediato
          this.refrescarMensajesSilencioso();
        }
      },
      error: (err) => console.error('Error al enviar mensaje manual:', err)
    });
  }

  insertarEmoji(emoji: string) {
    if (this.chatSeleccionado) {
      this.chatSeleccionado.borrador = (this.chatSeleccionado.borrador || '') + emoji;
    }
    this.mostrarPanelEmojis = false;
    // Devolver el foco al input
    setTimeout(() => {
      const inputEl = document.querySelector('.input-wrapper input') as HTMLInputElement;
      if (inputEl) {
        inputEl.focus();
      }
    }, 50);
  }

  insertarMensajeRapido() {
    if (this.chatSeleccionado) {
      this.chatSeleccionado.borrador = (this.chatSeleccionado.borrador || '') + ' ⚡ ¡Hola! Gracias por comunicarte con Punto y Coma. ¿En qué podemos ayudarte hoy?';
    }
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file && this.chatSeleccionado) {
      this.chatSeleccionado.borrador = (this.chatSeleccionado.borrador || '') + ` [Archivo: ${file.name}]`;
    }
  }

  confirmarEliminarChat(chatId: number) {
    const confirmar = confirm('¿Estás seguro de que deseas eliminar esta conversación?');
    if (confirmar) {
      this.adminChatService.deleteChat(chatId).subscribe({
        next: () => {
          // Remover el chat de la lista local
          this.chats = this.chats.filter(c => c.id !== chatId);
          // Seleccionar otro chat si hay disponibles, o setear a null
          if (this.chats.length > 0) {
            this.seleccionarChat(this.chats[0]);
          } else {
            this.chatSeleccionado = null;
          }
        },
        error: (err) => {
          console.error('Error al eliminar chat:', err);
          alert('Hubo un error al eliminar el chat de la base de datos.');
        }
      });
    }
  }

  anclarChatPrueba() {
    alert('¡Conversación anclada con éxito! (Simulación)');
    this.mostrarMenuOpciones = false;
  }

  generarRespuestaAI() {
    if (!this.chatSeleccionado) return;

    this.isGenerating = true;
    this.generatingStatus = 'Analizando contexto...';

    setTimeout(() => {
      this.generatingStatus = 'Generando respuesta...';
    }, 700);

    setTimeout(() => {
      this.isGenerating = false;

      // Generar una respuesta estándar según las palabras clave en la conversación
      const ultimosMensajes = this.chatSeleccionado!.mensajes;
      const tieneVoucher = ultimosMensajes.some(m => m.isVoucher);

      if (tieneVoucher) {
        this.chatSeleccionado!.mensajeGenerado =
          `Hemos recibido tu comprobante y lo estamos revisando 🔎\nTe notificaremos en breve. ¡Gracias por tu paciencia! 😊`;
      } else {
        this.chatSeleccionado!.mensajeGenerado =
          `¡Hola! Recibimos tu solicitud. Por favor, confírmanos tu método de pago preferido para continuar con tu pedido 🚚.`;
      }

      this.editandoMensajeGenerado = false;
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

  refrescarMensajesSilencioso() {
    if (!this.chatSeleccionado) return;
    const chatId = this.chatSeleccionado.id;
    
    this.adminChatService.getMensajes(chatId).subscribe({
      next: (mensajeDtos) => {
        if (this.chatSeleccionado && this.chatSeleccionado.id === chatId) {
          const nuevosMensajes = mensajeDtos.map(dto => this.mapMensajeDtoToMensaje(dto));
          const cantActual = this.chatSeleccionado.mensajes.length;
          const cantNueva = nuevosMensajes.length;
          
          if (cantActual !== cantNueva || (cantNueva > 0 && this.chatSeleccionado.mensajes[cantActual - 1].texto !== nuevosMensajes[cantNueva - 1].texto)) {
            this.chatSeleccionado.mensajes = nuevosMensajes;
            this.scrollToBottom();
            this.actualizarEstadosAsistente(this.chatSeleccionado);
            this.cargarChatsListaSilencioso();
          }
        }
      },
      error: (err) => console.error('Error en refresco silencioso:', err)
    });
  }

  cargarChatsListaSilencioso() {
    this.adminChatService.getChats().subscribe({
      next: (dtos) => {
        const nuevosChats = dtos.map(dto => this.mapChatDtoToChat(dto));
        
        // Preservar borradores y estados locales de cada chat para evitar sobrescribir
        nuevosChats.forEach(nuevo => {
          const actual = this.chats.find(c => c.id === nuevo.id);
          if (actual) {
            nuevo.borrador = actual.borrador;
            nuevo.mensajeGenerado = actual.mensajeGenerado;
            nuevo.estado = actual.estado;
            
            if (this.chatSeleccionado && this.chatSeleccionado.id === nuevo.id) {
              nuevo.mensajes = this.chatSeleccionado.mensajes;
              this.chatSeleccionado = nuevo;
            }
          }
        });
        
        this.chats = nuevosChats;
      },
      error: (err) => console.error('Error al recargar lista silenciosa:', err)
    });
  }
}
