import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminLayoutComponent } from '../admin-layout/admin-layout.component';
import { CartService } from '../../service/cart.service';

interface PedidoAdmin {
  id: string;
  cliente: string;
  producto: string;
  estado: 'Validado' | 'Pendiente' | 'En revision' | 'Rechazado';
  validacion: string;
  fecha: string;
  hora: string;
  total: string;
  telefono?: string;
  direccion?: string;
  montoDetectado?: string;
  diferencia?: string;
  productosDetalle?: { nombre: string, cantidad: number, precio: number }[];
  metodoPago?: string;
  referenciaPago?: string;
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
export class AdminPedidosComponent implements OnInit {
  constructor(public cartService: CartService) {}

  ngOnInit() {
    // Sincronizar estados de pedidos desde el servicio global
    this.pedidos.forEach(p => {
      p.estado = this.cartService.getOrderStatus(p.id, p.estado);
    });

    // Cargar pedidos dinámicos desde el servicio de forma reactiva
    const pedidosGlobales = this.cartService.getAllOrders();
    pedidosGlobales.forEach(po => {
      const existe = this.pedidos.some(p => p.id === po.id);
      if (!existe) {
        const nuevoPed: PedidoAdmin = {
          id: po.id,
          cliente: 'Juan Pérez',
          telefono: '+51 987 111 222',
          direccion: 'Av. Primavera 123, Surco',
          producto: po.productos.map(p => `${p.nombre} x${p.cantidad}`).join(', '),
          estado: this.cartService.getOrderStatus(po.id, 'Pendiente'),
          validacion: 'Esperando validación',
          fecha: po.fecha.split(', ')[0] || 'Hoy',
          hora: po.fecha.split(', ')[1] || 'Justo ahora',
          total: 'S/ ' + po.total.toFixed(2),
          productosDetalle: po.productos.map(p => ({ nombre: p.nombre, cantidad: p.cantidad, precio: po.total / po.productos.reduce((acc, curr) => acc + curr.cantidad, 0) })),
          metodoPago: 'Yape',
          referenciaPago: 'Yape - ****' + po.id.slice(-4)
        };
        this.pedidos.unshift(nuevoPed);
      }
    });
  }

  validarPagoPedido(pedido: PedidoAdmin) {
    pedido.estado = 'Validado';
    pedido.validacion = 'Pago verificado (Manual)';
    
    // Sincronizar en el servicio global
    this.cartService.setOrderStatus(pedido.id, 'Validado');
    this.mostrarToast(`✓ Pago del pedido ${pedido.id} validado correctamente.`);
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
        const estadoNorm = p.estado.toLowerCase().replace(' ', '-');
        const filtroNorm = this.filtroEstado.toLowerCase().replace(' ', '-');
        if (estadoNorm !== filtroNorm) return false;
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
    // Soporta '12 May 2025', '19 May 2026', etc.
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
    // Sección 1: Cliente
    clienteNombre: '',
    clienteTelefono: '',
    clienteCorreo: '',
    clienteDireccion: '',
    // Sección 3: Pago
    metodoPago: 'Yape',
    estadoPago: 'Pendiente',
    referenciaPago: '',
    // Sección 4: Operativo
    estadoPedido: 'Pendiente' as 'Validado' | 'Pendiente' | 'En revision' | 'Rechazado',
    notas: '',
    observaciones: ''
  };

  lineasProducto: LineaNuevoPedido[] = [
    { productoId: '', nombre: '', precio: 0, cantidad: 1, subtotal: 0 }
  ];

  // ─── CATÁLOGO SIMULADO PARA EL DROPDOWN ───────────────────────────
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

  // ─── CLIENTES CONOCIDOS (AUTOCOMPLETAR) ───────────────────────────
  clientesConocidos: ClienteConocido[] = [
    { telefono: '+51 987 654 321', nombre: 'Maria Lopez',   correo: 'maria@gmail.com', direccion: 'Av. Primavera 123, Surco' },
    { telefono: '+51 912 345 678', nombre: 'Ana Torres',    correo: 'ana@gmail.com',   direccion: 'Jr. Lima 456, Miraflores' },
    { telefono: '+51 923 456 789', nombre: 'Luis Perez',    correo: 'luis@gmail.com',  direccion: 'Ca. Los Pinos 789, San Borja' },
    { telefono: '+51 934 567 890', nombre: 'Camila Ruiz',   correo: '',                direccion: 'Av. Arequipa 321, Lince' },
    { telefono: '+51 945 678 901', nombre: 'Carlos Nuñez',  correo: '',                direccion: '' }
  ];

  // ─── PEDIDOS ──────────────────────────────────────────────────────
  pedidos: PedidoAdmin[] = [];

  private ordenCounter = 6;

  // ─── MODAL NUEVO PEDIDO ───────────────────────────────────────────
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
      estado: 'Pendiente',   // siempre Pendiente hasta validar pago
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

  // ─── DETALLE EXISTENTE ────────────────────────────────────────────
  verDetalle(pedido: PedidoAdmin) { this.pedidoSeleccionado = pedido; this.accionSeleccionada = null; }
  cerrarDetalle()                 { this.pedidoSeleccionado = null;   this.accionSeleccionada = null; }

  seleccionarAccion(accion: string) {
    this.accionSeleccionada = accion;
    if (accion === 'Editar pedido') { this.abrirModalEditar(); return; }
    if (this.pedidoSeleccionado) {
      if (accion === 'Validado') {
        this.pedidoSeleccionado.estado = 'Validado';
        this.cartService.setOrderStatus(this.pedidoSeleccionado.id, 'Validado');
      }
      if (accion === 'Rechazado') {
        this.pedidoSeleccionado.estado = 'Rechazado';
        this.cartService.setOrderStatus(this.pedidoSeleccionado.id, 'Rechazado');
      }
      if (accion === 'Pendiente') {
        this.pedidoSeleccionado.estado = 'Pendiente';
        this.cartService.setOrderStatus(this.pedidoSeleccionado.id, 'Pendiente');
      }
      if (accion === 'En revisión' || accion === 'Solicitar monto faltante') {
        this.pedidoSeleccionado.estado = 'En revision';
        this.cartService.setOrderStatus(this.pedidoSeleccionado.id, 'En revision');
      }
    }
  }

  guardarDecision() { this.cerrarDetalle(); }

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
    // Al modificar productos, el pedido vuelve a Pendiente para nueva validación
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
      // Recalcular total y nombre del producto
      const total = this.calcularTotalEdicion();
      this.pedidoSeleccionado.total = 'S/ ' + total.toFixed(2);
      if (this.pedidoEditando.productosDetalle.length > 0) {
        const extra = this.pedidoEditando.productosDetalle.length > 1 ? ` (+${this.pedidoEditando.productosDetalle.length - 1})` : '';
        this.pedidoSeleccionado.producto = this.pedidoEditando.productosDetalle[0].nombre + extra;
      }
      // Al editar productos el estado siempre vuelve a Pendiente
      this.pedidoSeleccionado.estado = 'Pendiente';
      this.pedidoSeleccionado.validacion = 'Pendiente de revisión';
    }
    this.mostrarModalEditar = false;
    this.pedidoEditando = null;
    this.accionSeleccionada = null;
    this.mostrarToast('✓ Pedido actualizado. Estado restablecido a Pendiente.');
  }

  estadoClase(estado: PedidoAdmin['estado']): string { return estado.toLowerCase().replace(' ', '-'); }

  estadoIcono(estado: PedidoAdmin['estado']): string {
    const m: Record<string, string> = { Validado: '✓', Pendiente: '⏱', 'En revision': '◷', Rechazado: '×' };
    return m[estado] ?? '';
  }
}
