import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AdminLayoutComponent } from '../admin-layout/admin-layout.component';
import { AdminPedidoService } from '../../service/admin-pedido.service';
import { AdminChatService, ChatDTO } from '../../service/admin-chat.service';
import { ProductosService } from '../../service/productos.service';
import { CartService } from '../../service/cart.service';
import { AdminNotificationService } from '../../service/admin-notification.service';
import { Subscription, forkJoin, of } from 'rxjs';
import { timeout, catchError, take, finalize } from 'rxjs/operators';

export interface ActividadEvento {
  id: string;
  tipo: 'confirmado' | 'pago' | 'nuevo_cliente' | 'agotado' | 'enviado' | 'incompleto';
  titulo: string;
  descripcion: string;
  tiempo: string;
  badgeClass: string;
  pedidoId?: string;
  chatId?: string;
  movimientoId?: number | string;
  accionTexto?: string;
  fechaRaw?: any;
  horaRaw?: any;
}

export interface AlertaOperativa {
  id: string;
  tipo: 'pedido_revision' | 'pedido_pendiente' | 'prod_agotado' | 'prod_bajo' | 'chat_pendiente';
  nivel: 'urgente' | 'moderado';
  titulo: string;
  detalles: string;
  accionLabel: string;
  ruta: string;
  pedidoId?: string;
  chatId?: string;
  tiempo: string;
  iconoClase: string;
  leida: boolean;
  fechaRaw?: any;
  horaRaw?: any;
}

export interface ProductoResumen {
  id?: number | string;
  nombre: string;
  sku: string;
  ventas: number;
  stock: number;
  disponible?: number;
  tipo: 'venta' | 'alerta' | 'agotado';
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AdminLayoutComponent],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css'
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  isLoading: boolean = true;
  fechaHoy = '';
  subtituloActividad = 'Eventos logísticos y del cliente registrados hoy.';

  // Resumen Rápido de hoy (Operativo)
  stats = {
    pedidosHoy: 0,
    ventasHoy: 0.00,
    chatsPendientes: 0,
    pedidosConfirmados: 0,
    stockBajo: 0
  };

  // Alertas Operativas Críticas
  alertasOperativas: AlertaOperativa[] = [];
  alertasLeidasIds: Set<string> = new Set<string>();
  contadorNotificaciones: number = 0;

  // Actividad Reciente del Día
  actividades: ActividadEvento[] = [];

  // Resumen de Pedidos (Estados de Operación)
  resumenEstados = [
    { nombre: 'Pendientes', cantidad: 0, porcentaje: 0, clase: 'state-pend' },
    { nombre: 'Confirmados', cantidad: 0, porcentaje: 0, clase: 'state-conf' },
    { nombre: 'En preparación', cantidad: 0, porcentaje: 0, clase: 'state-prep' },
    { nombre: 'Enviados hoy', cantidad: 0, porcentaje: 0, clase: 'state-env' }
  ];

  // Bloque: Productos Claves a Vigilar
  productosDestacados: ProductoResumen[] = [];

  // Beneficios del Asistente del Negocio
  beneficios = [
    {
      titulo: 'Menos tiempo organizando pedidos',
      desc: 'El sistema ordena automáticamente las tazas y vasos elegidos por el cliente según prioridad de entrega.',
      icono: '⏱️'
    },
    {
      titulo: 'Menos errores manuales',
      desc: 'Las alertas inteligentes detectan si falta una dirección o un pago antes de procesar el despacho físico.',
      icono: '💡'
    }
  ];

  private pollingSubscription?: Subscription;
  private orderStatusSubscription?: Subscription;

  constructor(
    private adminPedidoService: AdminPedidoService,
    private adminChatService: AdminChatService,
    private productosService: ProductosService,
    private cartService: CartService,
    private router: Router,
    private adminNotificationService: AdminNotificationService
  ) {}

  ngOnInit() {
    this.actualizarFechaTexto(new Date());

    // Carga inicial reactiva
    this.cargarDatosDashboard();

    // Seguro de tiempo límite (fallback) para evitar que quede cargando indefinidamente
    setTimeout(() => {
      if (this.isLoading) {
        console.warn('Tiempo de carga excedido: forzando isLoading = false');
        this.isLoading = false;
      }
    }, 3500);

    // Polling reactivo cada 3 segundos para sincronizar con la actividad del sistema y detectar cambio de fecha
    const intervalId = setInterval(() => {
      this.cargarDatosDashboard();
    }, 3000);

    // Suscripción al cambio reactivo de pedidos en cartService
    this.orderStatusSubscription = this.cartService.orderStatusChange$.subscribe(() => {
      this.cargarDatosDashboard();
    });

    this.pollingSubscription = new Subscription(() => clearInterval(intervalId));
  }

  ngOnDestroy() {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
    }
    if (this.orderStatusSubscription) {
      this.orderStatusSubscription.unsubscribe();
    }
  }

  private actualizarFechaTexto(fecha: Date) {
    const opciones: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    this.fechaHoy = fecha.toLocaleDateString('es-ES', opciones);
  }

  // Sanitizador helper para reemplazar cadenas crudas de base64 y vouchers
  public sanitizarTexto(texto: string | null | undefined): string {
    if (!texto) return '';
    let res = String(texto);
    // Patrones de voucher con base64
    res = res.replace(/\[VOUCHER\]\s*data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=]+/gi, '[Comprobante adjunto]');
    res = res.replace(/\[VOUCHER\]\s*data:image[^\s]*/gi, '[Comprobante adjunto]');
    res = res.replace(/\[VOUCHER\][^\n\r]*/gi, '[Comprobante adjunto]');
    res = res.replace(/data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=]+/gi, '[Imagen adjunta]');
    return res;
  }

  // Corrección y normalización tipográfica de nombres de productos
  public formatearNombreProducto(nombre: string | null | undefined): string {
    if (!nombre) return '';
    let res = String(nombre);
    res = res.replace(/Juegod\s*etazas/gi, 'Juego de tazas');
    res = res.replace(/Juego\s*detazas/gi, 'Juego de tazas');
    return res;
  }

  cargarDatosDashboard(fechaRef?: Date) {
    forkJoin({
      pedidos: this.adminPedidoService.getPedidos().pipe(
        take(1),
        timeout(6000),
        catchError(err => {
          console.warn('Error o timeout al obtener pedidos:', err);
          return of([]);
        })
      ),
      chats: this.adminChatService.getChats().pipe(
        take(1),
        timeout(6000),
        catchError(err => {
          console.warn('Error o timeout al obtener chats:', err);
          return of([]);
        })
      ),
      productos: this.productosService.obtenerTodosBackend().pipe(
        take(1),
        timeout(6000),
        catchError(err => {
          console.warn('Error o timeout al obtener productos:', err);
          return of([]);
        })
      ),
      movimientos: this.productosService.obtenerMovimientos().pipe(
        take(1),
        timeout(6000),
        catchError(err => {
          console.warn('Error o timeout al obtener movimientos:', err);
          return of([]);
        })
      ),
      vigilancia: this.adminPedidoService.getVigilanciaStock().pipe(
        take(1),
        timeout(6000),
        catchError(err => {
          console.warn('Error o timeout al obtener vigilancia de stock:', err);
          return of(null);
        })
      )
    }).pipe(
      finalize(() => {
        this.isLoading = false;
      })
    ).subscribe({
      next: ({ pedidos, chats, productos, movimientos, vigilancia }) => {
        this.isLoading = false;
        this.procesarDatosDashboard(pedidos || [], chats || [], productos || [], movimientos || [], fechaRef, vigilancia);
      },
      error: (err) => {
        console.warn('Error en forkJoin del dashboard:', err);
        this.isLoading = false;
      }
    });
  }

  public procesarDatosDashboard(
    pedidosDb: any[],
    chatsDb: any[],
    productosDb: any[],
    movimientosDb: any[],
    fechaReferencia?: Date,
    vigilanciaDb?: any
  ) {
    const fechaActual = fechaReferencia || new Date();
    this.actualizarFechaTexto(fechaActual);

    // 1. Unificar pedidos (BD + Checkout local del cliente en sesión si aplica)
    const localOrders = (this.cartService.getAllOrders() || []).map((p: any) => ({
      id: p.id,
      cliente: 'Cliente Web',
      producto: (p.productos || []).map((pr: any) => `${this.formatearNombreProducto(pr.nombre)} x${pr.cantidad}`).join(', '),
      estado: this.cartService.getOrderStatus(p.id, 'Pendiente'),
      validacion: 'Pendiente de validación',
      fecha: p.fecha || 'Hoy',
      hora: p.hora || 'Reciente',
      total: `S/ ${p.total.toFixed(2)}`,
      productosDetalle: (p.productos || []).map((pr: any) => ({ nombre: this.formatearNombreProducto(pr.nombre), cantidad: pr.cantidad, precio: 0 }))
    }));

    const pedidosCombinados = [...(pedidosDb || [])];
    localOrders.forEach(lo => {
      if (!pedidosCombinados.some(p => p.id === lo.id)) {
        pedidosCombinados.push(lo);
      }
    });

    // 2. Chats reales del sistema
    const chatsFinales = [...(chatsDb || [])];

    // 3. Productos del sistema con respaldo consistente
    const catalogoBase = [
      { id: 9, sku: 'PC-9', nombre: 'Taza artesana de arcilla', stock: 39 },
      { id: 5, sku: 'PC-5', nombre: 'Taza Nube', stock: 17 },
      { id: 8, sku: 'PC-8', nombre: 'Juego de tazas', stock: 5 },
      { id: 4, sku: 'PC-4', nombre: 'Tazas Ondas', stock: 32 }
    ];

    let productosFinales = Array.isArray(productosDb) && productosDb.length > 0 ? [...productosDb] : [];
    if (productosFinales.length === 0) {
      try {
        const cached = localStorage.getItem('admin_catalogo_cache');
        if (cached) productosFinales = JSON.parse(cached);
      } catch (e) {}
    }
    if (productosFinales.length === 0) {
      productosFinales = [...catalogoBase];
    } else {
      try {
        localStorage.setItem('admin_catalogo_cache', JSON.stringify(productosFinales));
      } catch (e) {}
    }

    // ----------------------------------------------------
    // CÁLCULO DE LAS TARJETAS SUPERIORES
    // ----------------------------------------------------

    // Pedidos hoy: únicamente correspondientes a la fecha actual del sistema
    const pedidosDeHoy = pedidosCombinados.filter(p =>
      this.esFechaHoy(p.fecha, fechaActual) || this.esFechaHoy(p.fechaPago, fechaActual)
    );
    this.stats.pedidosHoy = pedidosDeHoy.length;

    // Ventas hoy: monto real de pedidos de hoy cuyo estado es venta válida ('validado', 'confirmado', 'enviado', 'entregado')
    const estadosValidosVenta = ['validado', 'confirmado', 'enviado', 'entregado'];
    const totalVentasHoy = pedidosDeHoy
      .filter(p => estadosValidosVenta.includes((p.estado || '').toLowerCase().trim()))
      .reduce((acc, p) => {
        let monto = 0;
        if (typeof p.total === 'number') {
          monto = p.total;
        } else if (typeof p.total === 'string') {
          monto = parseFloat(p.total.replace(/[^\d.-]/g, '')) || 0;
        }
        return acc + monto;
      }, 0);
    this.stats.ventasHoy = totalVentasHoy;

    // Chats pendientes: cantidad real de chats que actualmente requieren respuesta
    const chatsQueRequierenAtencion = chatsFinales.filter(c => {
      const unread = Number(c.unreadCount ?? c.noLeidos ?? 0);
      const prioridad = (c.prioridad || '').toUpperCase();
      const fase = (c.fasePedido || '').toUpperCase();
      const estado = (c.estado || '').toLowerCase();
      return unread > 0 || prioridad === 'ALTA' || fase === 'EN_REVISION' || estado === 'en revision';
    });
    this.stats.chatsPendientes = chatsQueRequierenAtencion.length;

    // Pedidos confirmados: pedidos con estado 'validado' o 'confirmado'
    const estadosConfirmados = ['validado', 'confirmado'];
    const pedidosConfirmados = pedidosCombinados.filter(p =>
      estadosConfirmados.includes((p.estado || '').toLowerCase().trim())
    );
    this.stats.pedidosConfirmados = pedidosConfirmados.length;

    // Bajo stock: cantidad real de productos con stock <= 5 (umbral definido en inventario)
    const prodsBajoStock = productosFinales.filter(p => {
      const stock = Number(p.stock ?? 0);
      return stock <= 5;
    });
    this.stats.stockBajo = prodsBajoStock.length;

    // ----------------------------------------------------
    // ALERTAS OPERATIVAS IMPORTANTES
    // ----------------------------------------------------
    const alertas: AlertaOperativa[] = [];

    // Pedidos en revisión (discrepancia OCR o comprobante observado)
    const pedidosEnRevision = pedidosCombinados.filter(p => {
      const st = (p.estado || '').toLowerCase().trim();
      return st === 'en revision' || st === 'en revisión';
    });
    pedidosEnRevision.forEach(p => {
      const pIdLimpio = String(p.id).replace(/^WSP-/, '');
      const alertId = `pedido-${pIdLimpio || p.id}`;
      const estaLeida = this.adminNotificationService.esAlertaLeida(alertId);
      alertas.push({
        id: alertId,
        tipo: 'pedido_revision',
        nivel: 'urgente',
        titulo: `Pedido ${p.id} en revisión`,
        detalles: `Comprobante de ${p.cliente || 'cliente'} requiere validación (${p.total}).`,
        accionLabel: 'Revisar pedido',
        ruta: '/admin/pedidos',
        pedidoId: p.id,
        horaRaw: p.hora,
        fechaRaw: p.fechaPago || p.fecha,
        tiempo: this.calcularTiempoRelativo(p.fechaPago || p.fecha, p.hora, fechaActual),
        iconoClase: 'icon-urgente',
        leida: estaLeida
      });
    });

    // Pedidos pendientes de confirmación
    const pedidosPendientes = pedidosCombinados.filter(p => (p.estado || '').toLowerCase().trim() === 'pendiente');
    pedidosPendientes.forEach(p => {
      const pIdLimpio = String(p.id).replace(/^WSP-/, '');
      const alertId = `pedido-pend-${pIdLimpio || p.id}`;
      const estaLeida = this.adminNotificationService.esAlertaLeida(alertId);
      alertas.push({
        id: alertId,
        tipo: 'pedido_pendiente',
        nivel: 'moderado',
        titulo: `Pedido ${p.id} pendiente`,
        detalles: `${p.cliente || 'Cliente'} generó orden por ${p.total}. En espera de pago.`,
        accionLabel: 'Ver pedido',
        ruta: '/admin/pedidos',
        pedidoId: p.id,
        horaRaw: p.hora,
        fechaRaw: p.fecha,
        tiempo: this.calcularTiempoRelativo(p.fecha, p.hora, fechaActual),
        iconoClase: 'icon-moderado',
        leida: estaLeida
      });
    });

    // Productos agotados (stock === 0)
    const prodsAgotados = productosFinales.filter(p => Number(p.stock ?? 0) === 0);
    prodsAgotados.slice(0, 3).forEach(p => {
      const pKey = p.sku || p.id || p.nombre;
      const alertId = `stock-agotado-${pKey}`;
      const estaLeida = this.adminNotificationService.esAlertaLeida(alertId);
      const nombreLimpio = this.formatearNombreProducto(p.nombre);
      alertas.push({
        id: alertId,
        tipo: 'prod_agotado',
        nivel: 'urgente',
        titulo: `Sin existencias: ${nombreLimpio}`,
        detalles: `Stock agotado (0 unidades) en inventario. Se sugiere reabastecer.`,
        accionLabel: 'Reabastecer',
        ruta: '/admin/inventario',
        tiempo: 'Hace 5 min',
        iconoClase: 'icon-urgente',
        leida: estaLeida
      });
    });

    // Productos con stock crítico (1 a 5 unidades)
    const prodsBajoCritico = productosFinales.filter(p => {
      const s = Number(p.stock ?? 0);
      return s > 0 && s <= 5;
    });
    prodsBajoCritico.slice(0, 3).forEach(p => {
      const pKey = p.sku || p.id || p.nombre;
      const alertId = `stock-bajo-${pKey}`;
      const estaLeida = this.adminNotificationService.esAlertaLeida(alertId);
      const nombreLimpio = this.formatearNombreProducto(p.nombre);
      alertas.push({
        id: alertId,
        tipo: 'prod_bajo',
        nivel: 'moderado',
        titulo: `Bajo stock: ${nombreLimpio}`,
        detalles: `Quedan solo ${p.stock} unidades disponibles en inventario.`,
        accionLabel: 'Ver inventario',
        ruta: '/admin/inventario',
        tiempo: 'Hace 15 min',
        iconoClase: 'icon-moderado',
        leida: estaLeida
      });
    });

    // Chats pendientes de respuesta
    chatsQueRequierenAtencion.slice(0, 3).forEach(c => {
      const cKey = c.id || c.nombreCliente || 'chat';
      const alertId = `chat-${cKey}`;
      const estaLeida = this.adminNotificationService.esAlertaLeida(alertId);
      const esAlta = (c.prioridad || '').toUpperCase() === 'ALTA';
      const msgSanitizado = this.sanitizarTexto(c.ultimoMensaje);
      alertas.push({
        id: alertId,
        tipo: 'chat_pendiente',
        nivel: esAlta ? 'urgente' : 'moderado',
        titulo: `Chat de ${c.nombreCliente || 'Cliente'} pendiente`,
        detalles: msgSanitizado ? (msgSanitizado.length > 55 ? msgSanitizado.slice(0, 55) + '...' : msgSanitizado) : 'Consulta de WhatsApp por responder.',
        accionLabel: 'Responder',
        ruta: '/admin/chats',
        chatId: String(c.id),
        horaRaw: c.fechaUltimaActualizacion,
        tiempo: this.calcularTiempoRelativo(c.fechaUltimaActualizacion, undefined, fechaActual),
        iconoClase: esAlta ? 'icon-urgente' : 'icon-info',
        leida: estaLeida
      });
    });

    this.alertasOperativas = alertas;
    this.contadorNotificaciones = alertas.filter(a => !a.leida).length;
    
    // Notificar al servicio de notificaciones para la campana de la cabecera
    this.adminNotificationService.setAlerts(
      alertas.map(a => ({
        id: a.id,
        tipo: a.tipo,
        nivel: a.nivel,
        titulo: a.titulo,
        detalles: a.detalles,
        tiempo: a.tiempo,
        ruta: a.ruta,
        pedidoId: a.pedidoId,
        chatId: a.chatId,
        leida: a.leida
      }))
    );

    // ----------------------------------------------------
    // ACTIVIDAD DE LA TIENDA (TIMELINE)
    // ----------------------------------------------------
    const timelineEvents: ActividadEvento[] = [];

    // Eventos de pedidos correspondientes al día actual
    pedidosDeHoy.forEach(p => {
      const st = (p.estado || '').toLowerCase().trim();
      let tipo: 'confirmado' | 'pago' | 'nuevo_cliente' | 'agotado' | 'enviado' | 'incompleto' = 'confirmado';
      let badgeClass = 'badge-green';
      let titulo = `Pedido ${p.id} registrado`;
      let descripcion = `${p.cliente || 'Cliente'} generó un pedido por ${p.total || 'S/ 0.00'}.`;

      if (st === 'validado' || st === 'confirmado') {
        tipo = 'confirmado';
        badgeClass = 'badge-green';
        titulo = `Pedido ${p.id} confirmado`;
        descripcion = `${p.cliente || 'Cliente'} confirmó compra de ${this.formatearNombreProducto(p.producto || 'productos')} (${p.total}).`;
      } else if (st === 'enviado' || st === 'entregado') {
        tipo = 'enviado';
        badgeClass = 'badge-green';
        titulo = `Pedido ${p.id} despachado`;
        descripcion = `Enviado a ${p.direccion || p.direccionEntrega || 'dirección registrada'}.`;
      } else if (st === 'en revision' || st === 'en revisión') {
        tipo = 'incompleto';
        badgeClass = 'badge-red';
        titulo = `Pedido ${p.id} en revisión`;
        descripcion = `Comprobante de ${p.cliente || 'cliente'} requiere validación manual.`;
      } else if (st === 'rechazado') {
        tipo = 'incompleto';
        badgeClass = 'badge-red';
        titulo = `Pedido ${p.id} rechazado`;
        descripcion = `Pago rechazado o cancelado para ${p.cliente || 'cliente'}.`;
      } else {
        tipo = 'incompleto';
        badgeClass = 'badge-orange';
        titulo = `Nuevo pedido ${p.id}`;
        descripcion = `${p.cliente || 'Cliente'} ingresó orden por ${p.total}. En espera de pago.`;
      }

      timelineEvents.push({
        id: `ped-${p.id}`,
        tipo,
        titulo: this.sanitizarTexto(titulo),
        descripcion: this.sanitizarTexto(descripcion),
        tiempo: this.calcularTiempoRelativo(p.fechaPago || p.fecha, p.hora, fechaActual),
        badgeClass,
        pedidoId: p.id,
        accionTexto: 'Ver pedido',
        fechaRaw: p.fecha,
        horaRaw: p.hora
      });
    });

    // Eventos de inventario registrados en el día actual
    const movimientosHoy = (movimientosDb || []).filter(m => this.esFechaHoy(m.fecha, fechaActual));
    movimientosHoy.forEach(m => {
      const tipoMov = (m.tipoMovimiento || '').toUpperCase();
      const prodNombre = this.formatearNombreProducto(m.productoNombre || (m.producto ? m.producto.nombre : 'Producto'));
      const tiempoStr = this.calcularTiempoRelativo(m.fecha, undefined, fechaActual);

      if (tipoMov === 'ENTRADA') {
        timelineEvents.push({
          id: `mov-${m.id}`,
          tipo: 'pago',
          titulo: 'Ingreso a inventario',
          descripcion: `+${m.cantidad} u. añadidas a ${prodNombre}.${m.notas ? ' (' + m.notas + ')' : ''}`,
          tiempo: tiempoStr,
          badgeClass: 'badge-green',
          movimientoId: m.id
        });
      } else if (tipoMov === 'SALIDA') {
        timelineEvents.push({
          id: `mov-${m.id}`,
          tipo: 'agotado',
          titulo: 'Salida de inventario',
          descripcion: `-${m.cantidad} u. descontadas de ${prodNombre}.${m.notas ? ' (' + m.notas + ')' : ''}`,
          tiempo: tiempoStr,
          badgeClass: 'badge-orange',
          movimientoId: m.id
        });
      } else {
        timelineEvents.push({
          id: `mov-${m.id}`,
          tipo: 'incompleto',
          titulo: 'Ajuste de inventario',
          descripcion: `Ajuste de ${m.cantidad} u. en ${prodNombre}.`,
          tiempo: tiempoStr,
          badgeClass: 'badge-purple',
          movimientoId: m.id
        });
      }
    });

    // Chats con interacción registrada en el día actual
    const chatsHoy = (chatsFinales || []).filter(c => this.esFechaHoy(c.fechaUltimaActualizacion, fechaActual));
    chatsHoy.forEach(c => {
      const tiempoStr = this.calcularTiempoRelativo(c.fechaUltimaActualizacion, undefined, fechaActual);
      const msgLimpio = this.sanitizarTexto(c.ultimoMensaje);
      const msgPreview = msgLimpio ? (msgLimpio.length > 60 ? msgLimpio.slice(0, 60) + '...' : msgLimpio) : 'Consulta en WhatsApp';
      timelineEvents.push({
        id: `chat-${c.id}`,
        tipo: 'nuevo_cliente',
        titulo: `Mensaje de ${c.nombreCliente || 'Cliente'}`,
        descripcion: msgPreview,
        tiempo: tiempoStr,
        badgeClass: 'badge-purple',
        chatId: String(c.id),
        accionTexto: 'Ver chat'
      });
    });

    if (timelineEvents.length > 0) {
      this.subtituloActividad = 'Eventos logísticos y del cliente registrados hoy.';
      this.actividades = timelineEvents.slice(0, 5);
    } else {
      // Si no hay actividad registrada hoy, mostrar los últimos 5 eventos recientes registrados
      this.subtituloActividad = 'Última actividad registrada';
      const eventosRecientes: ActividadEvento[] = [];

      pedidosCombinados.forEach(p => {
        const st = (p.estado || '').toLowerCase().trim();
        let tipo: 'confirmado' | 'pago' | 'nuevo_cliente' | 'agotado' | 'enviado' | 'incompleto' = 'confirmado';
        let badgeClass = 'badge-green';
        let titulo = `Pedido ${p.id} registrado`;
        let descripcion = `${p.cliente || 'Cliente'} generó compra de ${this.formatearNombreProducto(p.producto || 'productos')} (${p.total}).`;

        if (st === 'validado' || st === 'confirmado') {
          tipo = 'confirmado';
          badgeClass = 'badge-green';
          titulo = `Pedido ${p.id} confirmado`;
        } else if (st === 'enviado' || st === 'entregado') {
          tipo = 'enviado';
          badgeClass = 'badge-green';
          titulo = `Pedido ${p.id} despachado`;
        } else if (st === 'en revision' || st === 'en revisión') {
          tipo = 'incompleto';
          badgeClass = 'badge-red';
          titulo = `Pedido ${p.id} en revisión`;
          descripcion = `Comprobante de ${p.cliente || 'cliente'} requiere validación manual.`;
        }

        eventosRecientes.push({
          id: `ped-${p.id}`,
          tipo,
          titulo: this.sanitizarTexto(titulo),
          descripcion: this.sanitizarTexto(descripcion),
          tiempo: this.calcularTiempoRelativo(p.fechaPago || p.fecha, p.hora, fechaActual),
          badgeClass,
          pedidoId: p.id,
          accionTexto: 'Ver pedido',
          fechaRaw: p.fechaPago || p.fecha,
          horaRaw: p.hora
        });
      });

      chatsFinales.forEach(c => {
        const msgLimpio = this.sanitizarTexto(c.ultimoMensaje);
        eventosRecientes.push({
          id: `chat-${c.id}`,
          tipo: 'nuevo_cliente',
          titulo: `Mensaje de ${c.nombreCliente || 'Cliente'}`,
          descripcion: msgLimpio ? (msgLimpio.length > 60 ? msgLimpio.slice(0, 60) + '...' : msgLimpio) : 'Consulta en WhatsApp',
          tiempo: this.calcularTiempoRelativo(c.fechaUltimaActualizacion, undefined, fechaActual),
          badgeClass: 'badge-purple',
          chatId: String(c.id),
          accionTexto: 'Ver chat',
          fechaRaw: c.fechaUltimaActualizacion
        });
      });

      (movimientosDb || []).forEach(m => {
        const tipoMov = (m.tipoMovimiento || '').toUpperCase();
        const prodNombre = this.formatearNombreProducto(m.productoNombre || (m.producto ? m.producto.nombre : 'Producto'));
        eventosRecientes.push({
          id: `mov-${m.id}`,
          tipo: tipoMov === 'ENTRADA' ? 'pago' : 'agotado',
          titulo: tipoMov === 'ENTRADA' ? 'Ingreso a inventario' : 'Salida de inventario',
          descripcion: `${tipoMov === 'ENTRADA' ? '+' : '-'}${m.cantidad} u. en ${prodNombre}.`,
          tiempo: this.calcularTiempoRelativo(m.fecha, undefined, fechaActual),
          badgeClass: tipoMov === 'ENTRADA' ? 'badge-green' : 'badge-orange',
          movimientoId: m.id,
          fechaRaw: m.fecha
        });
      });

      this.actividades = eventosRecientes.slice(0, 5);
    }

    // ----------------------------------------------------
    // MONITOREO DE PEDIDOS (FLUJO LOGÍSTICO)
    // ----------------------------------------------------
    const cantPendientes = pedidosCombinados.filter(p => {
      const st = (p.estado || '').toLowerCase().trim();
      return st === 'pendiente' || st === 'en revision' || st === 'en revisión';
    }).length;

    const cantConfirmados = pedidosCombinados.filter(p => {
      const st = (p.estado || '').toLowerCase().trim();
      return st === 'validado' || st === 'confirmado';
    }).length;

    const cantEnPreparacion = pedidosCombinados.filter(p => {
      const st = (p.estado || '').toLowerCase().trim();
      return st === 'en preparación' || st === 'en preparacion' || st === 'preparación' || st === 'preparacion';
    }).length;

    // Enviados hoy: pedidos enviados/entregados correspondientes estrictamente al día actual
    const cantEnviadosHoy = pedidosDeHoy.filter(p => {
      const st = (p.estado || '').toLowerCase().trim();
      return st === 'enviado' || st === 'entregado';
    }).length;

    const totalMonitoreo = cantPendientes + cantConfirmados + cantEnPreparacion + cantEnviadosHoy;

    this.resumenEstados = [
      {
        nombre: 'Pendientes',
        cantidad: cantPendientes,
        porcentaje: totalMonitoreo > 0 ? Math.round((cantPendientes / totalMonitoreo) * 100) : 0,
        clase: 'state-pend'
      },
      {
        nombre: 'Confirmados',
        cantidad: cantConfirmados,
        porcentaje: totalMonitoreo > 0 ? Math.round((cantConfirmados / totalMonitoreo) * 100) : 0,
        clase: 'state-conf'
      },
      {
        nombre: 'En preparación',
        cantidad: cantEnPreparacion,
        porcentaje: totalMonitoreo > 0 ? Math.round((cantEnPreparacion / totalMonitoreo) * 100) : 0,
        clase: 'state-prep'
      },
      {
        nombre: 'Enviados hoy',
        cantidad: cantEnviadosHoy,
        porcentaje: totalMonitoreo > 0 ? Math.round((cantEnviadosHoy / totalMonitoreo) * 100) : 0,
        clase: 'state-env'
      }
    ];

    // ----------------------------------------------------
    // VIGILANCIA DE STOCK (Basado estrictamente en pedidos validados)
    // ----------------------------------------------------
    if (vigilanciaDb && Array.isArray(vigilanciaDb.destacados) && vigilanciaDb.destacados.length > 0) {
      this.productosDestacados = vigilanciaDb.destacados.map((p: any) => ({
        id: p.id,
        nombre: this.formatearNombreProducto(p.nombre),
        sku: p.sku || `PC-${p.id || ''}`,
        ventas: Number(p.ventas ?? 0),
        stock: Number(p.stock ?? 0),
        disponible: Number(p.disponible ?? p.stock ?? 0),
        tipo: p.tipo as ('venta' | 'alerta' | 'agotado')
      }));
    } else {
      // Fallback: Cálculo estricto considerando ÚNICAMENTE pedidos en estado 'validado'
      const ventasPorProducto: Record<string, number> = {};
      pedidosCombinados.forEach(p => {
        const st = (p.estado || '').toLowerCase().trim();
        // FILTRO ESTRICTO: Solo pedidos con estado 'validado' o 'confirmado'
        if (st === 'validado' || st === 'confirmado') {
          if (Array.isArray(p.productosDetalle) && p.productosDetalle.length > 0) {
            p.productosDetalle.forEach((d: any) => {
              const nom = this.formatearNombreProducto(d.nombre || '').toLowerCase().trim();
              ventasPorProducto[nom] = (ventasPorProducto[nom] || 0) + (Number(d.cantidad) || 1);
            });
          } else if (p.producto && typeof p.producto === 'string') {
            const partes = p.producto.split(',');
            partes.forEach((pt: string) => {
              const match = pt.trim().match(/^(.*?)(?:\s*[xX]\s*(\d+))?$/);
              if (match) {
                const nom = this.formatearNombreProducto(match[1] || '').toLowerCase().trim();
                const cant = match[2] ? parseInt(match[2], 10) : 1;
                ventasPorProducto[nom] = (ventasPorProducto[nom] || 0) + cant;
              }
            });
          }
        }
      });

      const productosMapeados = productosFinales.map(p => {
        let nombre = this.formatearNombreProducto(p.nombre || 'Producto');
        if (nombre.toLowerCase().includes('arsilla')) {
          nombre = nombre.replace(/arsilla/gi, 'arcilla');
        }
        const sku = p.sku || (p.id ? `PC-${p.id}` : '-');
        const stock = Number(p.stock ?? 0);
        const nomKey = nombre.toLowerCase().trim();
        const ventas = ventasPorProducto[nomKey] || 0;
        return { id: p.id, nombre, sku, stock, disponible: stock, ventas };
      });

      const destacados: ProductoResumen[] = [];

      // Más vendidos: Ordenados estrictamente por ventas validadas DESCENDENTE (ventas > 0)
      const masVendidos = [...productosMapeados]
        .filter(p => p.ventas > 0)
        .sort((a, b) => b.ventas - a.ventas)
        .slice(0, 3);

      masVendidos.forEach(p => {
        destacados.push({
          id: p.id,
          nombre: p.nombre,
          sku: p.sku,
          ventas: p.ventas,
          stock: p.stock,
          disponible: p.disponible,
          tipo: 'venta'
        });
      });

      // Agotándose: stock > 0 y stock <= 5
      const agotandose = [...productosMapeados]
        .filter(p => p.stock > 0 && p.stock <= 5)
        .sort((a, b) => a.stock - b.stock)
        .slice(0, 3);

      agotandose.forEach(p => {
        destacados.push({
          id: p.id,
          nombre: p.nombre,
          sku: p.sku,
          ventas: p.ventas,
          stock: p.stock,
          disponible: p.disponible,
          tipo: 'alerta'
        });
      });

      // Sin existencias: stock === 0
      const sinExistencias = [...productosMapeados]
        .filter(p => p.stock === 0)
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
        .slice(0, 3);

      sinExistencias.forEach(p => {
        destacados.push({
          id: p.id,
          nombre: p.nombre,
          sku: p.sku,
          ventas: p.ventas,
          stock: 0,
          disponible: 0,
          tipo: 'agotado'
        });
      });

      this.productosDestacados = destacados;
    }
  }

  // Marcar una alerta operativa como leída
  public marcarComoLeida(al: AlertaOperativa, event: Event) {
    event.stopPropagation();
    event.preventDefault();
    if (al.leida) return; // Si ya está leída, no vuelve a decrementar el contador

    al.leida = true;
    this.adminNotificationService.marcarAlertaLeida(al.id);
    this.contadorNotificaciones = this.alertasOperativas.filter(a => !a.leida).length;
  }

  // Navegación directa al hacer clic sobre una alerta
  public navegarAlerta(al: AlertaOperativa, event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (al.pedidoId) {
      this.router.navigate(['/admin/pedidos'], { queryParams: { id: al.pedidoId } });
    } else if (al.ruta) {
      this.router.navigateByUrl(al.ruta);
    }
  }

  // Navegación directa al hacer clic sobre un pedido específico
  public navegarAPedido(pedidoId: string, event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.router.navigate(['/admin/pedidos'], { queryParams: { id: pedidoId } });
  }

  // Navegación desde un evento de la actividad
  public navegarActividad(act: ActividadEvento, event?: Event) {
    if (act.pedidoId) {
      this.navegarAPedido(act.pedidoId, event);
    } else if (act.chatId) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      this.router.navigate(['/admin/chats']);
    } else if (act.movimientoId) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      this.router.navigate(['/admin/inventario']);
    }
  }

  public esFechaHoy(fechaVal: any, refDate: Date = new Date()): boolean {
    if (!fechaVal) return false;

    // 1. Formato ISO YYYY-MM-DD
    if (typeof fechaVal === 'string' && /^\d{4}-\d{2}-\d{2}/.test(fechaVal)) {
      const parts = fechaVal.split(/[-T\s]/);
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return day === refDate.getDate() &&
               month === refDate.getMonth() &&
               year === refDate.getFullYear();
      }
    }

    if (typeof fechaVal === 'string') {
      const lower = fechaVal.toLowerCase().trim();

      const meses: Record<string, number> = {
        ene: 0, jan: 0, feb: 1, mar: 2, abr: 3, apr: 3, may: 4,
        jun: 5, jul: 6, ago: 7, aug: 7, sep: 8, oct: 9, nov: 10, dic: 11, dec: 11
      };

      // 2. Formato numérico con barras o guiones (dd/mm/yyyy o dd-mm-yyyy)
      const partesSlash = lower.split(/[\/\-]/);
      if (partesSlash.length === 3 && partesSlash[0].length <= 2) {
        const dia = parseInt(partesSlash[0], 10);
        const mes = parseInt(partesSlash[1], 10) - 1;
        const anio = parseInt(partesSlash[2].slice(0, 4), 10);
        if (!isNaN(dia) && !isNaN(mes) && !isNaN(anio)) {
          return dia === refDate.getDate() && mes === refDate.getMonth() && anio === refDate.getFullYear();
        }
      }

      // 3. Formato legible en español ("03 Oct 2026", "3 oct. 2026, 11:30 a. m.")
      const partes = lower.replace(/[.,]/g, '').trim().split(/\s+/);
      if (partes.length >= 3) {
        const dia = parseInt(partes[0], 10);
        const mesStr = partes[1].slice(0, 3);
        const mes = meses[mesStr];
        const anio = parseInt(partes[2], 10);
        if (!isNaN(dia) && mes !== undefined && !isNaN(anio)) {
          return dia === refDate.getDate() && mes === refDate.getMonth() && anio === refDate.getFullYear();
        }
      }

      // 4. Cadena explícita "hoy" sin fecha adjunta
      if (lower === 'hoy' || lower.includes('justo ahora') || lower.includes('hace un momento')) {
        const hoyReal = new Date();
        return refDate.getDate() === hoyReal.getDate() &&
               refDate.getMonth() === hoyReal.getMonth() &&
               refDate.getFullYear() === hoyReal.getFullYear();
      }
    }

    // 5. Instancia de Date
    const d = new Date(fechaVal);
    if (!isNaN(d.getTime())) {
      return d.getFullYear() === refDate.getFullYear() &&
             d.getMonth() === refDate.getMonth() &&
             d.getDate() === refDate.getDate();
    }

    return false;
  }

  public calcularTiempoRelativo(fechaVal: any, horaVal?: any, refDate: Date = new Date()): string {
    let eventoDate: Date | null = null;

    // 1. Si fechaVal es Date
    if (fechaVal instanceof Date && !isNaN(fechaVal.getTime())) {
      eventoDate = fechaVal;
    } else if (typeof fechaVal === 'string' && fechaVal.includes('T')) {
      const d = new Date(fechaVal);
      if (!isNaN(d.getTime())) {
        eventoDate = d;
      }
    }

    // 2. Si se proporciona horaVal (ej. '12:30', '12:45:10', '12:45 p. m.', '12:45 PM')
    if (!eventoDate && horaVal && typeof horaVal === 'string') {
      const horaClean = horaVal.toLowerCase().trim();
      if (horaClean !== 'reciente' && horaClean !== 'hoy') {
        const match = horaClean.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm|a\.\s*m\.|p\.\s*m\.)?/i);
        if (match) {
          let horas = parseInt(match[1], 10);
          const minutos = parseInt(match[2], 10);
          const ampm = match[4] ? match[4].toLowerCase().replace(/\s/g, '') : null;
          if (ampm) {
            if ((ampm.includes('p') || ampm.includes('pm')) && horas < 12) horas += 12;
            if ((ampm.includes('a') || ampm.includes('am')) && horas === 12) horas = 0;
          }
          eventoDate = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), horas, minutos, 0);
        }
      }
    }

    // 3. Si fechaVal es string ISO o interpretable
    if (!eventoDate && typeof fechaVal === 'string' && /^\d{4}-\d{2}-\d{2}/.test(fechaVal)) {
      const parts = fechaVal.split(/[-T\s]/);
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        eventoDate = new Date(year, month, day, refDate.getHours(), refDate.getMinutes() - 5, 0);
      }
    }

    // Fallback: si no hay fecha exacta o hora es 'Reciente'
    if (!eventoDate) {
      return 'Hace 5 min';
    }

    const diffMs = refDate.getTime() - eventoDate.getTime();
    if (diffMs <= 0) {
      return 'Hace 1 min';
    }

    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHoras = Math.floor(diffMin / 60);

    if (diffMin <= 1) {
      return 'Hace 1 min';
    } else if (diffMin < 60) {
      return `Hace ${diffMin} min`;
    } else if (diffHoras === 1) {
      return 'Hace 1 hora';
    } else if (diffHoras < 24) {
      return `Hace ${diffHoras} horas`;
    } else {
      const dias = Math.floor(diffHoras / 24);
      return dias === 1 ? 'Hace 1 día' : `Hace ${dias} días`;
    }
  }

  public extraerHora(fechaVal: any): string {
    if (!fechaVal) return 'Hoy';
    if (typeof fechaVal === 'string') {
      if (fechaVal.includes('AM') || fechaVal.includes('PM') || fechaVal.includes('a. m.') || fechaVal.includes('p. m.')) {
        if (fechaVal.includes(',')) {
          return fechaVal.split(',')[1].trim();
        }
        return fechaVal;
      }
    }
    const d = new Date(fechaVal);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    }
    return 'Hoy';
  }
}
