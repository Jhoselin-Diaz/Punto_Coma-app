import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminLayoutComponent } from '../admin-layout/admin-layout.component';
import { CartService } from '../../service/cart.service';
import { AdminPedidoService } from '../../service/admin-pedido.service';
import { ModalAlertaService } from '../../service/modal-alerta.service';

interface PedidoAdmin {
  id: string;
  cliente: string;
  producto: string;
  estado: 'Validado' | '1er Pendiente' | 'Pendiente' | '2do Pendiente' | 'En revision' | 'Rechazado';
  validacion: string;
  fecha: string;
  hora: string;
  total: string;
  telefono?: string;
  dni?: string;
  direccion?: string;
  direccionEnvio?: string;
  direccionEntrega?: string;
  montoDetectado?: string;
  montoOcr?: string;
  diferencia?: string;
  productosDetalle?: { nombre: string, cantidad: number, precio: number }[];
  metodoPago?: string;
  referenciaPago?: string;
  voucherUrl?: string;
  dbId?: number;
  fechaPago?: string;
}

interface LineaNuevoPedido {
  productoId: string;
  nombre: string;
  precio: number;
  cantidad: number;
  subtotal: number;
}

interface ClienteConocido {
  telefono: string;
  nombre: string;
  correo: string;
  direccion: string;
}

@Component({
  selector: 'app-admin-pedidos',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminLayoutComponent],
  templateUrl: './admin-pedidos.component.html',
  styleUrl: './admin-pedidos.component.css'
})
export class AdminPedidosComponent implements OnInit, OnDestroy {
  private pollingInterval: any = null;
  targetPedidoId: string | null = null;

  constructor(
    public cartService: CartService,
    private adminPedidoService: AdminPedidoService,
    private route: ActivatedRoute,
    private router: Router,
    private modalAlertaService: ModalAlertaService
  ) {}

  ngOnInit() {
    this.cargarPedidosReal();

    this.route.queryParams.subscribe(params => {
      const qId = params['id'] || params['pedidoId'];
      if (qId) {
        this.targetPedidoId = qId;
        this.seleccionarPedidoPorId(qId);
      }
    });

    // Polling reactivo cada 2 segundos para sincronizar base de datos Supabase
    this.pollingInterval = setInterval(() => {
      this.cargarPedidosReal();
    }, 2000);
  }

  ngOnDestroy() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
  }

  cargarPedidosReal() {
    this.adminPedidoService.getPedidos().subscribe({
      next: (data) => {
        const dbPedidos: PedidoAdmin[] = (data || []).map(p => ({
          id: p.id,
          cliente: p.cliente,
          telefono: p.telefono,
          direccion: p.direccion,
          direccionEnvio: p.direccionEnvio,
          direccionEntrega: p.direccionEntrega,
          producto: p.producto,
          estado: p.estado,
          validacion: p.validacion,
          fecha: p.fecha,
          hora: p.hora,
          total: p.total,
          productosDetalle: p.productosDetalle,
          metodoPago: p.metodoPago,
          referenciaPago: p.referenciaPago,
          montoDetectado: p.montoDetectado || p.montoOcr || p.monto_detectado || p.monto_ocr,
          montoOcr: p.montoOcr || p.montoDetectado || p.monto_ocr || p.monto_detectado,
          diferencia: p.diferencia,
          voucherUrl: p.voucherUrl,
          dbId: p.dbId,
          fechaPago: p.fechaPago || p.fecha_pago
        }));

        const cartOrders: PedidoAdmin[] = (this.cartService.getAllOrders() || []).map(p => ({
          id: p.id,
          cliente: (p as any).cliente || 'Cliente Web',
          telefono: (p as any).telefono || 'N/A',
          direccion: (p as any).direccion || 'Dirección registrada',
          producto: p.productos ? p.productos.map(pr => `${pr.nombre} x${pr.cantidad}`).join(', ') : ((p as any).producto || 'Producto'),
          estado: (this.cartService.getOrderStatus(p.id, (p as any).estado || 'Pendiente') as any),
          validacion: (p as any).validacion || 'Pendiente de validación',
          fecha: p.fecha || 'Hoy',
          hora: (p as any).hora || 'Reciente',
          total: typeof p.total === 'number' ? `S/ ${p.total.toFixed(2)}` : (p.total || 'S/ 0.00'),
          productosDetalle: p.productos ? p.productos.map(pr => ({ nombre: pr.nombre, cantidad: pr.cantidad, precio: (pr as any).precio || 0 })) : []
        }));

        const manualOrders = this.pedidos.filter(p => p.id.startsWith('#ORD-') && !p.id.startsWith('WSP-'));
        const merged = [...dbPedidos];

        cartOrders.forEach(co => {
          if (!merged.some(d => d.id === co.id)) {
            merged.push(co);
          }
        });

        manualOrders.forEach(m => {
          if (!merged.some(d => d.id === m.id)) {
            merged.push(m);
          }
        });

        this.pedidos = merged;
        if (this.targetPedidoId) {
          this.seleccionarPedidoPorId(this.targetPedidoId);
        }
      },
      error: (err) => {
        console.error('Error al cargar pedidos del backend:', err);
        const cartOrders: PedidoAdmin[] = (this.cartService.getAllOrders() || []).map(p => ({
          id: p.id,
          cliente: (p as any).cliente || 'Cliente Web',
          telefono: (p as any).telefono || 'N/A',
          direccion: (p as any).direccion || 'Dirección registrada',
          producto: p.productos ? p.productos.map(pr => `${pr.nombre} x${pr.cantidad}`).join(', ') : ((p as any).producto || 'Producto'),
          estado: (this.cartService.getOrderStatus(p.id, (p as any).estado || 'Pendiente') as any),
          validacion: (p as any).validacion || 'Pendiente de validación',
          fecha: p.fecha || 'Hoy',
          hora: (p as any).hora || 'Reciente',
          total: typeof p.total === 'number' ? `S/ ${p.total.toFixed(2)}` : (p.total || 'S/ 0.00'),
          productosDetalle: p.productos ? p.productos.map(pr => ({ nombre: pr.nombre, cantidad: pr.cantidad, precio: (pr as any).precio || 0 })) : []
        }));

        const manualOrders = this.pedidos.filter(p => p.id.startsWith('#ORD-') && !p.id.startsWith('WSP-'));
        const merged = [...this.pedidos];

        cartOrders.forEach(co => {
          if (!merged.some(d => d.id === co.id)) {
            merged.push(co);
          }
        });

        manualOrders.forEach(m => {
          if (!merged.some(d => d.id === m.id)) {
            merged.push(m);
          }
        });

        this.pedidos = merged;
        if (this.targetPedidoId) {
          this.seleccionarPedidoPorId(this.targetPedidoId);
        }
      }
    });
  }

  async eliminarPedido(param: any, dbIdParam?: number) {
    const confirmado = await this.modalAlertaService.confirm({
      titulo: '¿Eliminar pedido?',
      mensaje: '¿Estás seguro de que deseas eliminar este pedido pendiente? Esta acción no se puede deshacer.',
      tipo: 'peligro',
      textoConfirmar: 'Sí, eliminar',
      textoCancelar: 'Cancelar'
    });
    if (!confirmado) return;

    let targetId: any = null;
    let idDisplay = '';

    if (param && typeof param === 'object') {
      targetId = param.dbId || param.id;
      idDisplay = param.id || String(targetId);
    } else {
      idDisplay = String(param || '');
      targetId = dbIdParam || param;
    }

    // Si targetId tiene prefijo #ORD-00X, extraer el número primario si es posible
    if (typeof targetId === 'string') {
      const matchOrd = targetId.match(/^#ORD-0*(\d+)$/i);
      if (matchOrd) {
        targetId = parseInt(matchOrd[1], 10);
      }
    }

    console.log('[ADMIN] Eliminando pedido:', { targetId, idDisplay });

    const mostrarExitoEliminacion = () => {
      this.modalAlertaService.success(
        'El pedido ha sido eliminado con éxito y el estado de la conversación asociada ha sido restablecido a INICIAL.',
        'Pedido eliminado'
      );
      this.mostrarToast('El pedido ha sido eliminado con éxito y el estado de la conversación asociada ha sido restablecido a INICIAL.');
      if (idDisplay) {
        this.cartService.removeOrder(idDisplay);
      }
      this.cargarPedidosReal();
    };

    if (targetId) {
      this.adminPedidoService.deletePedido(targetId).subscribe({
        next: () => {
          this.pedidos = this.pedidos.filter(p => p.id !== idDisplay && p.dbId !== targetId);
          mostrarExitoEliminacion();
        },
        error: (err) => {
          console.error('Error al eliminar pedido del servidor:', err);
          if (idDisplay && idDisplay !== String(targetId)) {
            this.adminPedidoService.deletePedido(idDisplay).subscribe({
              next: () => {
                this.pedidos = this.pedidos.filter(p => p.id !== idDisplay);
                mostrarExitoEliminacion();
              },
              error: (err2) => {
                console.error('Error al intentar eliminar pedido con ID alternativo:', err2);
                this.modalAlertaService.error('Hubo un error al eliminar el pedido del servidor.', 'Error');
              }
            });
          } else {
            this.modalAlertaService.error('Hubo un error al eliminar el pedido del servidor.', 'Error');
          }
        }
      });
    } else {
      this.pedidos = this.pedidos.filter(p => p.id !== idDisplay);
      mostrarExitoEliminacion();
    }
  }

  calcularCantidadTotal(pedido: PedidoAdmin): number {
    if (!pedido.productosDetalle || pedido.productosDetalle.length === 0) return 1;
    return pedido.productosDetalle.reduce((acc, curr) => acc + curr.cantidad, 0);
  }

  validarPedido(pedido?: PedidoAdmin) {
    const target = pedido || this.pedidoSeleccionado;
    if (!target) return;

    const idParaValidar = target.dbId || target.id;
    console.log('[ADMIN] Validando pedido:', idParaValidar, target);

    // Actualización optimista inmediata en UI para feedback instantáneo
    target.estado = 'Validado';
    target.validacion = 'Pago verificado (Manual)';
    target.diferencia = 'S/ 0.00';
    if (target.id) {
      this.cartService.setOrderStatus(target.id, 'Validado');
    }

    this.adminPedidoService.validarPedido(idParaValidar).subscribe({
      next: (res) => {
        target.estado = 'Validado';
        target.validacion = 'Pago verificado (Manual)';
        target.diferencia = 'S/ 0.00';
        this.mostrarToast(`✓ Pedido ${target.id} validado correctamente.`);
        this.cargarPedidosReal();
      },
      error: (err) => {
        const errorStock = err?.error?.message || (err?.error?.error === 'STOCK_INSUFICIENTE' ? err?.error?.message : null);
        if (errorStock || err?.status === 400) {
          const mensajeAlerta = errorStock || err?.error?.message || 'No se puede validar el pedido: stock insuficiente.';
          console.error('[ADMIN] Error de validación por stock:', mensajeAlerta);
          alert(mensajeAlerta);
          this.cargarPedidosReal();
          return;
        }

        console.warn('[ADMIN] Falló endpoint dedicado /validar, intentando fallback con updatePedido...', err);
        const data = {
          estado: 'VALIDADO',
          validacion: 'Pago verificado (Manual)',
          montoDetectado: target.montoDetectado ? parseFloat(String(target.montoDetectado).replace(/[^\d.-]/g, '')) : null,
          metodoPago: target.metodoPago,
          referenciaPago: target.referenciaPago
        };
        this.adminPedidoService.updatePedido(idParaValidar, data).subscribe({
          next: () => {
            target.estado = 'Validado';
            target.validacion = 'Pago verificado (Manual)';
            target.diferencia = 'S/ 0.00';
            this.mostrarToast(`✓ Pedido ${target.id} validado correctamente.`);
            this.cargarPedidosReal();
          },
          error: (updateErr) => {
            console.error('Error al validar pedido en servidor:', updateErr);
            const msg = updateErr?.error?.message || updateErr?.error?.error || 'Hubo un error al validar el pedido en el servidor.';
            alert(msg);
            this.cargarPedidosReal();
          }
        });
      }
    });
  }

  validarPagoPedido(pedido: PedidoAdmin) {
    this.validarPedido(pedido);
  }

  // ─── ESTADO GENERAL ──────────────────────────────────────────────
  pedidoSeleccionado: PedidoAdmin | null = null;
  accionSeleccionada: string | null = null;
  mostrarModalEditar = false;
  pedidoEditando: any = null;

  // ─── FILTROS TABLA ────────────────────────────────────────────────
  filtroTexto      = '';
  filtroEstado     = 'todos';          // 'todos' | estado
  filtroFechaDesde = '';               // 'YYYY-MM-DD'
  filtroFechaHasta = '';               // 'YYYY-MM-DD'
  mostrarFiltroFecha = false;          // toggle panel de fechas
  mostrarFiltroEstado = false;         // toggle panel de estados

  get pedidosFiltrados(): PedidoAdmin[] {
    return this.pedidos.filter(p => {
      // 1. Filtro texto libre
      if (this.filtroTexto.trim()) {
        const q = this.filtroTexto.toLowerCase();
        const coincide = p.cliente.toLowerCase().includes(q)
          || p.id.toLowerCase().includes(q)
          || p.producto.toLowerCase().includes(q)
          || (p.telefono ?? '').includes(q);
        if (!coincide) return false;
      }
      // 2. Filtro estado
      if (this.filtroEstado !== 'todos') {
        const estadoNorm = (p.estado || '').toLowerCase().replace(' ', '-');
        const filtroNorm = this.filtroEstado.toLowerCase().replace(' ', '-');
        if (filtroNorm === 'pendiente') {
          if (!estadoNorm.includes('pendiente')) return false;
        } else if (estadoNorm !== filtroNorm) {
          return false;
        }
      }
      // 3. Filtro fecha
      if (this.filtroFechaDesde || this.filtroFechaHasta) {
        const fechaPedido = this.parseFechaPedido(p.fecha);
        if (!fechaPedido) return true;
        if (this.filtroFechaDesde) {
          const desde = new Date(this.filtroFechaDesde + 'T00:00:00');
          if (fechaPedido < desde) return false;
        }
        if (this.filtroFechaHasta) {
          const hasta = new Date(this.filtroFechaHasta + 'T23:59:59');
          if (fechaPedido > hasta) return false;
        }
      }
      return true;
    });
  }

  private parseFechaPedido(fechaStr: string): Date | null {
    const meses: Record<string, number> = {
      ene:0, jan:0, feb:1, mar:2, abr:3, apr:3, may:4,
      jun:5, jul:6, ago:7, aug:7, sep:8, oct:9, nov:10, dic:11, dec:11
    };
    const partes = fechaStr.toLowerCase().replace(',','').trim().split(' ');
    if (partes.length < 3) return null;
    const dia = parseInt(partes[0], 10);
    const mes = meses[partes[1].slice(0, 3)];
    const anio = parseInt(partes[2], 10);
    if (isNaN(dia) || mes === undefined || isNaN(anio)) return null;
    return new Date(anio, mes, dia);
  }

  toggleFiltroEstado() {
    this.mostrarFiltroEstado = !this.mostrarFiltroEstado;
    this.mostrarFiltroFecha = false;
  }

  aplicarFiltroEstado(estado: string) {
    this.filtroEstado = estado;
    this.mostrarFiltroEstado = false;
  }

  toggleFiltroFecha() {
    this.mostrarFiltroFecha = !this.mostrarFiltroFecha;
    this.mostrarFiltroEstado = false;
  }

  limpiarFechas() {
    this.filtroFechaDesde = '';
    this.filtroFechaHasta = '';
  }

  get etiquetaFiltroFecha(): string {
    if (this.filtroFechaDesde && this.filtroFechaHasta) return `${this.filtroFechaDesde} — ${this.filtroFechaHasta}`;
    if (this.filtroFechaDesde) return `Desde ${this.filtroFechaDesde}`;
    if (this.filtroFechaHasta) return `Hasta ${this.filtroFechaHasta}`;
    return 'Rango de fechas';
  }

  get etiquetaFiltroEstado(): string {
    return this.filtroEstado === 'todos' ? 'Estado: todos' : `Estado: ${this.filtroEstado}`;
  }

  // ─── MODAL NUEVO PEDIDO ───────────────────────────────────────────
  mostrarModalNuevo = false;
  toastVisible = false;
  toastMensaje = '';

  nuevoPedido = {
    clienteNombre: '',
    clienteTelefono: '',
    clienteCorreo: '',
    clienteDireccion: '',
    metodoPago: 'Yape',
    estadoPago: 'Pendiente',
    referenciaPago: '',
    estadoPedido: 'Pendiente' as 'Validado' | 'Pendiente' | 'En revision' | 'Rechazado',
    notas: '',
    observaciones: ''
  };

  lineasProducto: LineaNuevoPedido[] = [
    { productoId: '', nombre: '', precio: 0, cantidad: 1, subtotal: 0 }
  ];

  productosDisponibles = [
    { id: 'taza-ceramica-jaspeada', nombre: 'Taza de cerámica jaspeada', precio: 39 },
    { id: 'taza-vidrio-verde',      nombre: 'Taza de vidrio verde',       precio: 45 },
    { id: 'taza-ceramica-rosa',     nombre: 'Taza de cerámica rosa',      precio: 35 },
    { id: 'vaso-ondulado',          nombre: 'Vaso ondulado transparente', precio: 32 },
    { id: 'vaso-iridiscente',       nombre: 'Vaso iridiscente',           precio: 35 },
    { id: 'vaso-cristal-ambar',     nombre: 'Vaso de cristal ámbar',      precio: 25 },
    { id: 'taza-termica',           nombre: 'Taza térmica de cerámica',   precio: 45 },
    { id: 'set-tazas-pastel',       nombre: 'Set de tazas pastel (3 uds.)',precio: 79 }
  ];

  clientesConocidos: ClienteConocido[] = [
    { telefono: '+51 987 654 321', nombre: 'Maria Lopez',   correo: 'maria@gmail.com', direccion: 'Av. Primavera 123, Surco' },
    { telefono: '+51 912 345 678', nombre: 'Ana Torres',    correo: 'ana@gmail.com',   direccion: 'Jr. Lima 456, Miraflores' },
    { telefono: '+51 923 456 789', nombre: 'Luis Perez',    correo: 'luis@gmail.com',  direccion: 'Ca. Los Pinos 789, San Borja' },
    { telefono: '+51 934 567 890', nombre: 'Camila Ruiz',   correo: '',                direccion: 'Av. Arequipa 321, Lince' },
    { telefono: '+51 945 678 901', nombre: 'Carlos Nuñez',  correo: '',                direccion: '' }
  ];

  pedidos: PedidoAdmin[] = [];

  private ordenCounter = 6;

  abrirModalNuevo() {
    this.nuevoPedido = { clienteNombre: '', clienteTelefono: '', clienteCorreo: '', clienteDireccion: '', metodoPago: 'Yape', estadoPago: 'Pendiente', referenciaPago: '', estadoPedido: 'Pendiente', notas: '', observaciones: '' };
    this.lineasProducto = [{ productoId: '', nombre: '', precio: 0, cantidad: 1, subtotal: 0 }];
    this.mostrarModalNuevo = true;
  }

  cerrarModalNuevo() {
    this.mostrarModalNuevo = false;
  }

  buscarClientePorTelefono() {
    const tel = this.nuevoPedido.clienteTelefono.trim();
    const encontrado = this.clientesConocidos.find(c => c.telefono === tel);
    if (encontrado) {
      this.nuevoPedido.clienteNombre    = encontrado.nombre;
      this.nuevoPedido.clienteCorreo    = encontrado.correo;
      this.nuevoPedido.clienteDireccion = encontrado.direccion;
    }
  }

  onProductoSeleccionado(linea: LineaNuevoPedido) {
    const prod = this.productosDisponibles.find(p => p.id === linea.productoId);
    if (prod) {
      linea.nombre = prod.nombre;
      linea.precio = prod.precio;
    } else {
      linea.nombre = '';
      linea.precio = 0;
    }
    this.recalcularLinea(linea);
  }

  recalcularLinea(linea: LineaNuevoPedido) {
    linea.subtotal = linea.precio * linea.cantidad;
  }

  agregarLinea() {
    this.lineasProducto.push({ productoId: '', nombre: '', precio: 0, cantidad: 1, subtotal: 0 });
  }

  eliminarLinea(index: number) {
    this.lineasProducto.splice(index, 1);
  }

  calcularTotal(): number {
    return this.lineasProducto.reduce((acc, l) => acc + l.subtotal, 0);
  }

  crearPedido() {
    if (!this.nuevoPedido.clienteTelefono.trim()) {
      alert('El teléfono del cliente es obligatorio.');
      return;
    }
    if (this.lineasProducto.every(l => !l.productoId)) {
      alert('Agrega al menos un producto al pedido.');
      return;
    }

    const now = new Date();
    const fecha = now.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
    const hora  = now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
    const codigo = `#ORD-00${String(this.ordenCounter).padStart(2, '0')}`;
    this.ordenCounter++;

    const lineasValidas = this.lineasProducto.filter(l => l.productoId);
    const totalNum = this.calcularTotal();
    const primerNombre = lineasValidas[0]?.nombre ?? 'Pedido manual';
    const extra = lineasValidas.length > 1 ? ` (+${lineasValidas.length - 1})` : '';

    const nuevoPedidoObj: PedidoAdmin = {
      id: codigo,
      cliente: this.nuevoPedido.clienteNombre || 'Cliente nuevo',
      telefono: this.nuevoPedido.clienteTelefono,
      direccion: this.nuevoPedido.clienteDireccion,
      producto: primerNombre + extra,
      estado: 'Pendiente',
      validacion: 'Pedido manual',
      fecha,
      hora,
      total: 'S/ ' + totalNum.toFixed(2),
      productosDetalle: lineasValidas.map(l => ({ nombre: l.nombre, cantidad: l.cantidad, precio: l.precio }))
    };

    this.pedidos.unshift(nuevoPedidoObj);
    this.mostrarModalNuevo = false;
    this.mostrarToast(`✓ Pedido ${codigo} creado correctamente.`);
  }

  mostrarToast(msg: string) {
    this.toastMensaje = msg;
    this.toastVisible = true;
    setTimeout(() => this.toastVisible = false, 3500);
  }

  verDetalle(pedido: PedidoAdmin) {
    this.pedidoSeleccionado = pedido;
    console.log("Pedido seleccionado en TS:", this.pedidoSeleccionado);
    this.accionSeleccionada = null;
  }
  cerrarDetalle() {
    this.pedidoSeleccionado = null;
    this.accionSeleccionada = null;
    this.targetPedidoId = null;
    this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  tieneVoucher(p: any): boolean {
    return !!(p && p.voucherUrl);
  }

  esPagoCoincidente(p: any): boolean {
    if (!p) return false;
    const diff = parseFloat(String(p.diferencia || '').replace(/[^\d.-]/g, '')) || 0;
    return diff === 0;
  }

  seleccionarPedidoPorId(id: string) {
    if (!id) return;
    const cleanTarget = String(id).trim().toLowerCase();
    let found = (this.pedidos || []).find(p =>
      String(p.id).trim().toLowerCase() === cleanTarget ||
      String(p.dbId) === cleanTarget ||
      (p.id && cleanTarget.replace('#', '') === p.id.replace('#', ''))
    );

    if (!found) {
      const localOrd = (this.cartService.getAllOrders() || []).find(lo =>
        String(lo.id).trim().toLowerCase() === cleanTarget ||
        String(lo.id).replace('#', '').toLowerCase() === cleanTarget.replace('#', '')
      );
      if (localOrd) {
        found = {
          id: localOrd.id,
          cliente: (localOrd as any).cliente || 'Cliente Web',
          producto: localOrd.productos.map(pr => `${pr.nombre} x${pr.cantidad}`).join(', '),
          estado: (this.cartService.getOrderStatus(localOrd.id, 'Pendiente') as any),
          validacion: 'Pendiente de validación',
          fecha: localOrd.fecha || 'Hoy',
          hora: (localOrd as any).hora || 'Reciente',
          total: `S/ ${localOrd.total.toFixed(2)}`,
          productosDetalle: localOrd.productos.map(pr => ({ nombre: pr.nombre, cantidad: pr.cantidad, precio: 0 }))
        };
        this.pedidos.unshift(found);
      }
    }

    if (found) {
      this.verDetalle(found);
    }
  }

  seleccionarAccion(accion: string) {
    this.accionSeleccionada = accion;
    if (accion === 'Editar pedido') { this.abrirModalEditar(); return; }
    if (this.pedidoSeleccionado) {
      if (accion === 'Validar' || accion === 'Validado') {
        this.pedidoSeleccionado.estado = 'Validado';
        this.pedidoSeleccionado.validacion = 'Pago verificado (Manual)';
        this.pedidoSeleccionado.diferencia = 'S/ 0.00';
        if (this.pedidoSeleccionado.id) {
          this.cartService.setOrderStatus(this.pedidoSeleccionado.id, 'Validado');
        }
      } else if (accion === 'Rechazado') {
        this.pedidoSeleccionado.estado = 'Rechazado';
        this.pedidoSeleccionado.validacion = 'Pago rechazado';
        if (this.pedidoSeleccionado.id) {
          this.cartService.setOrderStatus(this.pedidoSeleccionado.id, 'Rechazado');
        }
      } else if (accion === 'Pendiente') {
        this.pedidoSeleccionado.estado = 'Pendiente';
        this.pedidoSeleccionado.validacion = 'Esperando comprobante de pago';
        if (this.pedidoSeleccionado.id) {
          this.cartService.setOrderStatus(this.pedidoSeleccionado.id, 'Pendiente');
        }
      } else if (accion === 'En revisión' || accion === 'En revision') {
        this.pedidoSeleccionado.estado = 'En revision';
        this.pedidoSeleccionado.validacion = 'Revisión manual pendiente';
        if (this.pedidoSeleccionado.id) {
          this.cartService.setOrderStatus(this.pedidoSeleccionado.id, 'En revision');
        }
      } else if (accion === 'Solicitar monto faltante') {
        this.pedidoSeleccionado.estado = 'En revision';
        if (this.pedidoSeleccionado.id) {
          this.cartService.setOrderStatus(this.pedidoSeleccionado.id, 'En revision');
        }
      }
    }
  }

  guardarDecision() {
    if (!this.pedidoSeleccionado) {
      this.cerrarDetalle();
      return;
    }

    const targetId = this.pedidoSeleccionado.dbId || this.pedidoSeleccionado.id;
    let estadoBackend = 'PENDIENTE';
    let validacionBackend = this.pedidoSeleccionado.validacion;

    if (this.pedidoSeleccionado.estado === 'Validado' || this.accionSeleccionada === 'Validar' || this.accionSeleccionada === 'Validado') {
      estadoBackend = 'VALIDADO';
      validacionBackend = 'Pago verificado (Manual)';
    } else if (this.pedidoSeleccionado.estado === 'Rechazado' || this.accionSeleccionada === 'Rechazado') {
      estadoBackend = 'RECHAZADO';
      validacionBackend = 'Pago rechazado';
    } else if (this.pedidoSeleccionado.estado === 'En revision' || this.accionSeleccionada === 'En revisión' || this.accionSeleccionada === 'Solicitar monto faltante') {
      estadoBackend = 'EN REVISION';
      validacionBackend = this.accionSeleccionada === 'Solicitar monto faltante'
        ? 'Solicitado saldo faltante al cliente'
        : (this.pedidoSeleccionado.validacion || 'Revisión manual pendiente');
    } else {
      estadoBackend = 'PENDIENTE';
      validacionBackend = 'Esperando comprobante de pago';
    }

    const data = {
      estado: estadoBackend,
      validacion: validacionBackend,
      montoDetectado: this.pedidoSeleccionado.montoDetectado ? parseFloat(String(this.pedidoSeleccionado.montoDetectado).replace(/[^\d.-]/g, '')) : null,
      metodoPago: this.pedidoSeleccionado.metodoPago,
      referenciaPago: this.pedidoSeleccionado.referenciaPago
    };

    const pedidoIdStr = this.pedidoSeleccionado.id;

    if (this.pedidoSeleccionado.id) {
      const estadoUI = estadoBackend === 'VALIDADO' ? 'Validado' : (estadoBackend === 'RECHAZADO' ? 'Rechazado' : (estadoBackend === 'EN REVISION' ? 'En revision' : 'Pendiente'));
      this.cartService.setOrderStatus(this.pedidoSeleccionado.id, estadoUI as any);
    }

    this.adminPedidoService.updatePedido(targetId, data).subscribe({
      next: (resp) => {
        this.mostrarToast(`✓ Decisión guardada correctamente para el pedido ${pedidoIdStr}.`);

        if (this.accionSeleccionada === 'Solicitar monto faltante') {
          this.mostrarToast(`⚡ Generando mensaje sugerido para saldo faltante...`);
          this.adminPedidoService.solicitarMontoFaltante(this.pedidoSeleccionado?.dbId || targetId).subscribe({
            next: () => {
              this.mostrarToast(`✓ Mensaje sugerido generado con éxito en el chat.`);
              this.cerrarDetalle();
              this.cargarPedidosReal();
            },
            error: (err) => {
              console.error('Error generando mensaje de saldo faltante:', err);
              this.cerrarDetalle();
              this.cargarPedidosReal();
            }
          });
        } else {
          this.cerrarDetalle();
          this.cargarPedidosReal();
        }
      },
      error: (err) => {
        console.error('Error al guardar la decisión del pedido:', err);
        const errorStock = err?.error?.message || (err?.error?.error === 'STOCK_INSUFICIENTE' ? err?.error?.message : null);
        if (errorStock || err?.status === 400) {
          const msg = errorStock || err?.error?.message || 'No se puede validar el pedido: stock insuficiente.';
          alert(msg);
          this.cargarPedidosReal();
          return;
        }

        if (estadoBackend === 'VALIDADO') {
          this.adminPedidoService.validarPedido(targetId).subscribe({
            next: () => {
              this.mostrarToast(`✓ Pedido ${pedidoIdStr} validado correctamente.`);
              this.cerrarDetalle();
              this.cargarPedidosReal();
            },
            error: (valErr) => {
              console.error('Error al validar pedido en servidor:', valErr);
              const msg = valErr?.error?.message || valErr?.error?.error || 'Hubo un error al guardar la decisión en el servidor.';
              alert(msg);
            }
          });
        } else {
          const msg = err?.error?.message || err?.error?.error || 'Hubo un error al guardar la decisión en el servidor.';
          alert(msg);
        }
      }
    });
  }

  verComprobanteCompleto() {
    if (this.pedidoSeleccionado?.voucherUrl) {
      window.open(this.pedidoSeleccionado.voucherUrl, '_blank');
    } else {
      alert('No hay un comprobante registrado para este pedido.');
    }
  }

  abrirModalEditar() {
    this.mostrarModalEditar = true;
    this.pedidoEditando = {
      ...this.pedidoSeleccionado,
      observaciones: ''
    };
    if (!this.pedidoEditando.productosDetalle || this.pedidoEditando.productosDetalle.length === 0) {
      const p = parseFloat(this.pedidoEditando.total.replace(/[^\d.-]/g, '')) || 0;
      this.pedidoEditando.productosDetalle = [{ nombre: this.pedidoEditando.producto, cantidad: 1, precio: p }];
    } else {
      this.pedidoEditando.productosDetalle = JSON.parse(JSON.stringify(this.pedidoEditando.productosDetalle));
    }
  }

  calcularTotalEdicion(): number {
    if (!this.pedidoEditando?.productosDetalle) return 0;
    return this.pedidoEditando.productosDetalle.reduce((acc: number, p: any) => acc + (p.cantidad * p.precio), 0);
  }

  onEditarProductoCambio() {
    if (this.pedidoSeleccionado) {
      this.pedidoSeleccionado.estado = 'Pendiente';
    }
  }

  cerrarModalEditar() { this.mostrarModalEditar = false; this.pedidoEditando = null; this.accionSeleccionada = null; }

  agregarProducto() { this.pedidoEditando.productosDetalle.push({ nombre: '', cantidad: 1, precio: 0 }); }
  eliminarProducto(i: number) { this.pedidoEditando.productosDetalle.splice(i, 1); }

  guardarEdicion() {
    if (this.pedidoSeleccionado && this.pedidoEditando) {
      this.pedidoSeleccionado.cliente   = this.pedidoEditando.cliente;
      this.pedidoSeleccionado.telefono  = this.pedidoEditando.telefono;
      this.pedidoSeleccionado.direccion = this.pedidoEditando.direccion;
      this.pedidoSeleccionado.productosDetalle = this.pedidoEditando.productosDetalle;
      const total = this.calcularTotalEdicion();
      this.pedidoSeleccionado.total = 'S/ ' + total.toFixed(2);
      if (this.pedidoEditando.productosDetalle.length > 0) {
        const extra = this.pedidoEditando.productosDetalle.length > 1 ? ` (+${this.pedidoEditando.productosDetalle.length - 1})` : '';
        this.pedidoSeleccionado.producto = this.pedidoEditando.productosDetalle[0].nombre + extra;
      }
      this.pedidoSeleccionado.estado = 'Pendiente';
      this.pedidoSeleccionado.validacion = 'Pendiente de revisión';
    }
    this.mostrarModalEditar = false;
    this.pedidoEditando = null;
    this.accionSeleccionada = null;
    this.mostrarToast('✓ Pedido actualizado. Estado restablecido a Pendiente.');
  }

  estadoClase(estado: PedidoAdmin['estado']): string {
    if (estado === '1er Pendiente' || estado === '2do Pendiente') {
      return 'pendiente';
    }
    return estado ? estado.toLowerCase().replace(' ', '-') : 'pendiente';
  }

  estadoIcono(estado: PedidoAdmin['estado']): string {
    const m: Record<string, string> = {
      Validado: '✓',
      '1er Pendiente': '⏳',
      Pendiente: '⏱',
      '2do Pendiente': '⏱',
      'En revision': '◷',
      Rechazado: '×'
    };
    return m[estado] ?? '⏱';
  }
}
