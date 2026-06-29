import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminLayoutComponent } from '../admin-layout/admin-layout.component';
import { CartService } from '../../service/cart.service';
import { AdminChatService, ChatDTO, MensajeDTO } from '../../service/admin-chat.service';
import { AdminPedidoService } from '../../service/admin-pedido.service';

interface Mensaje {
  texto: string;
  tipo: 'entrada' | 'salida';
  hora: string;
  leido?: boolean;
  isVoucher?: boolean;
  isImage?: boolean;
  imageUrl?: string;
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
  prioridad?: string;
  sugerenciaIa?: string;
  pedidoReferenciadoId?: number;
  pedidoIdentificado?: boolean;
  direccionDetectada?: boolean;
  datosCompletos?: boolean;
  fasePedido?: string;
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
  private generalPollingInterval: any = null;
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
    private adminChatService: AdminChatService,
    private adminPedidoService: AdminPedidoService
  ) { }

  get chatsOrdenados(): Chat[] {
    return [...this.chats].sort((a, b) => {
      const pesoPrioridad = (p?: string) => {
        if (p === 'ALTA') return 1;
        if (p === 'INTERMEDIA') return 2;
        if (p === 'BAJA') return 3;
        return 4;
      };

      const pesoA = pesoPrioridad(a.prioridad);
      const pesoB = pesoPrioridad(b.prioridad);

      if (pesoA !== pesoB) {
        return pesoA - pesoB;
      }

      return b.id - a.id;
    });
  }

  actualizarEstadosAsistente(chat: Chat) {
    if (!chat) return;
    this.aiStatus.pedidoIdentificado = !!chat.pedidoIdentificado;
    this.aiStatus.direccionDetectada = !!chat.direccionDetectada;
    this.aiStatus.datosCompletos = !!chat.datosCompletos;
    this.aiStatus.contextoAnalizado = !!chat.prioridad || !!chat.fasePedido;
  }

  ngOnInit() {
    this.cargarChatsReales();

    // Iniciar polling silencioso de la lista general cada 2 segundos
    this.generalPollingInterval = setInterval(() => {
      this.cargarChatsListaSilencioso();
    }, 2000);
  }

  ngOnDestroy() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    if (this.generalPollingInterval) {
      clearInterval(this.generalPollingInterval);
      this.generalPollingInterval = null;
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
      mensajeGenerado: dto.sugerenciaIa || '',
      estado: 'Normal',
      ultimoMensaje: dto.ultimoMensaje,
      prioridad: dto.prioridad,
      sugerenciaIa: dto.sugerenciaIa,
      pedidoReferenciadoId: dto.pedidoReferenciadoId,
      pedidoIdentificado: dto.pedidoIdentificado,
      direccionDetectada: dto.direccionDetectada,
      datosCompletos: dto.datosCompletos,
      fasePedido: dto.fasePedido
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

    const rawContenido = dto.contenido;
    let isImage = false;
    let imageUrl = '';
    let textoMostrar = rawContenido;

    if (rawContenido.startsWith('data:image/') || rawContenido.startsWith('[VOUCHER]')) {
      isImage = true;
      let cleanContent = rawContenido;
      if (rawContenido.startsWith('[VOUCHER]')) {
        cleanContent = rawContenido.substring('[VOUCHER]'.length).trim();
      }

      const parts = cleanContent.split('|');
      imageUrl = parts[0].trim();
      if (parts.length > 1) {
        textoMostrar = parts[1].trim();
      } else {
        textoMostrar = '';
      }
    }

    return {
      texto: isVoucher ? '[YAPE_VOUCHER]' : (isImage ? textoMostrar : dto.contenido),
      tipo: dto.remitente === 'CLIENTE' ? 'entrada' : 'salida',
      hora: this.formatFecha(dto.fechaEnvio),
      leido: true,
      isVoucher,
      voucherData,
      isImage,
      imageUrl
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

    // Cargar historial de pedidos reales de este cliente desde Supabase
    this.adminPedidoService.getPedidosDeCliente(chat.telefono).subscribe({
      next: (pedidos) => {
        chat.historialPedidos = pedidos.map(p => ({
          id: p.id,
          fecha: p.fecha + ', ' + p.hora,
          subtotal: p.total,
          estado: p.estado
        }));
        chat.totalPedidos = pedidos.length;
      },
      error: (err) => console.error('Error al cargar historial de pedidos del cliente:', err)
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

    // Cargar el mensaje en el input-area/borrador para revisión y envío
    this.chatSeleccionado.borrador = this.chatSeleccionado.mensajeGenerado;
    this.chatSeleccionado.mensajeGenerado = '';
    this.editandoMensajeGenerado = false;
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
          this.chats = this.chats.filter(c => c.id !== chatId);
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
    this.generatingStatus = 'Enviando petición a OpenAI...';

    // Gatillar la petición HTTP real hacia el endpoint del backend
    this.adminChatService.regenerarIa(this.chatSeleccionado.id).subscribe({
      next: () => {
        this.generatingStatus = 'Procesando respuesta en OpenAI...';
        setTimeout(() => {
          this.isGenerating = false;
          this.refrescarMensajesSilencioso();
          this.cargarChatsListaSilencioso();
        }, 2000);
      },
      error: (err) => {
        console.error('Error al forzar regeneración de respuesta:', err);
        this.isGenerating = false;
        alert('Hubo un error al comunicarse con la IA del backend.');
      }
    });
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
    const telefono = this.chatSeleccionado.telefono;

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

            // Refrescar el historial de pedidos del cliente silenciosamente al recibir nuevos mensajes
            this.adminPedidoService.getPedidosDeCliente(telefono).subscribe({
              next: (pedidos) => {
                if (this.chatSeleccionado && this.chatSeleccionado.id === chatId) {
                  this.chatSeleccionado.historialPedidos = pedidos.map(p => ({
                    id: p.id,
                    fecha: p.fecha + ', ' + p.hora,
                    subtotal: p.total,
                    estado: p.estado
                  }));
                  this.chatSeleccionado.totalPedidos = pedidos.length;
                }
              }
            });
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

        nuevosChats.forEach(nuevo => {
          const actual = this.chats.find(c => c.id === nuevo.id);
          if (actual) {
            nuevo.borrador = actual.borrador;
            if (this.editandoMensajeGenerado && this.chatSeleccionado && this.chatSeleccionado.id === nuevo.id) {
              nuevo.mensajeGenerado = actual.mensajeGenerado;
            }
            nuevo.estado = actual.estado;

            if (this.chatSeleccionado && this.chatSeleccionado.id === nuevo.id) {
              nuevo.mensajes = this.chatSeleccionado.mensajes;

              if (!this.editandoMensajeGenerado && actual.mensajeGenerado !== nuevo.mensajeGenerado) {
                this.chatSeleccionado.mensajeGenerado = nuevo.mensajeGenerado;
              }

              this.chatSeleccionado.prioridad = nuevo.prioridad;
              this.chatSeleccionado.sugerenciaIa = nuevo.sugerenciaIa;
              this.chatSeleccionado.pedidoReferenciadoId = nuevo.pedidoReferenciadoId;
              this.chatSeleccionado.pedidoIdentificado = nuevo.pedidoIdentificado;
              this.chatSeleccionado.direccionDetectada = nuevo.direccionDetectada;
              this.chatSeleccionado.datosCompletos = nuevo.datosCompletos;
              this.chatSeleccionado.fasePedido = nuevo.fasePedido;
              this.chatSeleccionado.ultimoMensaje = nuevo.ultimoMensaje;
              this.chatSeleccionado.ultimaVez = nuevo.ultimaVez;
              this.chatSeleccionado.noLeidos = nuevo.noLeidos;

              this.actualizarEstadosAsistente(this.chatSeleccionado);
            }
          }
        });

        this.chats = nuevosChats;
      },
      error: (err) => console.error('Error al cargar chats lista silencioso:', err)
    });
  }
}
