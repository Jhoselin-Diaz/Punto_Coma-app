import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminLayoutComponent } from '../admin-layout/admin-layout.component';
import { ProductosService } from '../../service/productos.service';
import { ModalAlertaService } from '../../service/modal-alerta.service';
import { AdminPedidoService } from '../../service/admin-pedido.service';

export interface InventarioItem {
  id: string;
  nombre: string;
  sku: string;
  categoria: string;
  stock: number;
  estado: 'disponible' | 'bajo' | 'agotado';
  ultimaActualizacion: string;
  imagen: string;
  visible: boolean;
}

export interface MovimientoInventario {
  id?: string | number;
  productoId?: string | number;
  fecha: string;
  fechaObj?: Date;
  producto: string;
  tipo: 'entrada' | 'salida' | 'ajuste';
  tipoMovimiento?: string;
  cantidad: number;
  usuario: string;
  observacion: string;
}

export interface AlertaCritica {
  id: string;
  producto: string;
  sku: string;
  stock: number;
  motivo: string;
  nivel: 'bajo' | 'critico';
}

@Component({
  selector: 'app-admin-inventario',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminLayoutComponent],
  templateUrl: './admin-inventario.component.html',
  styleUrl: './admin-inventario.component.css'
})
export class AdminInventarioComponent implements OnInit {
  // Filtros y Buscador
  searchTerm = '';
  Math = Math;
  filtroStockActivo: 'todos' | 'disponibles' | 'bajo' | 'agotados' = 'todos';
  filtroHistorialActivo: 'hoy' | 'semana' | 'mes' = 'semana';
  isLoading = true;

  limpiarBusqueda(): void {
    this.searchTerm = '';
  }

  get productos(): InventarioItem[] {
    return this.getFilteredStockItems();
  }

  // Modales
  showEditStockModal = false;
  showAddStockModal = false;
  showProductHistoryModal = false;
  selectedProductForHistory: InventarioItem | null = null;
  productMovementsList: MovimientoInventario[] = [];

  // Mock data principal
  stockItems: InventarioItem[] = [];

  // Alertas de Inventario
  criticalAlerts: AlertaCritica[] = [];

  // Historial de Movimientos
  movements: MovimientoInventario[] = [];

  // Producto Estrella de ventas validadas
  productoEstrella: {
    nombre: string;
    sku: string;
    ventas: number;
    disponible?: number;
    imagen?: string;
  } = {
    nombre: 'No hay datos',
    sku: '-',
    ventas: 0
  };

  // Resumen lateral derecho
  summaryData = {
    bestSeller: { nombre: 'No hay datos', sku: '-', ventas: 0, imagen: '' },
    lowestStock: { nombre: 'No hay datos', sku: '-', stock: 0, imagen: '' },
    recentlyModified: [] as { nombre: string; fecha: string; stock: number }[]
  };

  // Objetos para formularios de modales
  editingStockItem = {
    id: '',
    nombre: '',
    sku: '',
    stockActual: 0,
    cantidadMovimiento: 1 as number | null,
    tipoMovimiento: 'entrada' as 'entrada' | 'salida' | 'ajuste',
    observacion: '',
    imagen: ''
  };

  newStockIngreso = {
    productoId: '',
    cantidad: 10 as number | null,
    proveedor: '',
    fechaIngreso: '',
    nota: '',
    tipoMovimiento: 'ENTRADA'
  };

  // Variables calculadas
  statsStock = {
    totalProductos: 0,
    bajoStock: 0,
    agotados: 0,
    movimientosHoy: 0
  };

  constructor(
    private productosService: ProductosService,
    private modalAlertaService: ModalAlertaService,
    private adminPedidoService: AdminPedidoService
  ) {}

  ngOnInit() {
    this.cargarDatos();
    // Poner fecha de hoy por defecto en el selector
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    this.newStockIngreso.fechaIngreso = `${yyyy}-${mm}-${dd}`;
  }

  cargarDatos() {
    this.isLoading = true;

    // Cargar producto estrella desde pedidos validados
    this.adminPedidoService.getProductosMasVendidos().subscribe({
      next: (masVendidos) => {
        if (masVendidos && masVendidos.length > 0) {
          const top = masVendidos[0];
          this.productoEstrella = {
            nombre: top.nombre,
            sku: top.sku || `PC-${top.id}`,
            ventas: top.ventas,
            disponible: top.disponible || top.stock
          };
          this.summaryData.bestSeller = {
            nombre: top.nombre,
            sku: top.sku || `PC-${top.id}`,
            ventas: top.ventas,
            imagen: ''
          };
        }
      },
      error: (err) => {
        console.warn('Error al cargar productos más vendidos en inventario:', err);
      }
    });

    // 1. Cargar productos desde el backend
    this.productosService.obtenerTodosBackend().subscribe({
      next: (data) => {
        this.stockItems = data.map(p => {
          let estado: 'disponible' | 'bajo' | 'agotado' = 'disponible';
          const stock = p.stock || 0;
          if (stock === 0) {
            estado = 'agotado';
          } else if (stock <= 5) {
            estado = 'bajo';
          }
          return {
            id: p.id ? p.id.toString() : '',
            nombre: p.nombre || '',
            sku: p.sku || (p.id ? `PC-${p.id}` : '-'),
            categoria: p.categoria || 'Tazas',
            stock: stock,
            estado: estado,
            ultimaActualizacion: 'Hoy',
            imagen: p.imagenPrincipal || p.imageUrl || 'images/prod-jaspeada.png',
            visible: p.visible !== false
          };
        });
        this.recalcularEstadisticas();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error al cargar productos para inventario:', err);
        this.isLoading = false;
      }
    });

    // 2. Cargar movimientos desde el backend
    this.productosService.obtenerMovimientos().subscribe({
      next: (data) => {
        this.movements = data.map(m => {
          let tipo: 'entrada' | 'salida' | 'ajuste' = 'entrada';
          if (m.tipoMovimiento === 'SALIDA') {
            tipo = 'salida';
          } else if (m.tipoMovimiento === 'AJUSTE') {
            tipo = 'ajuste';
          } else if (m.tipoMovimiento === 'ENTRADA') {
            tipo = 'entrada';
          }

          let dateStr = 'Reciente';
          let fechaObj = new Date();
          if (m.fecha) {
            try {
              fechaObj = new Date(m.fecha);
              const day = String(fechaObj.getDate()).padStart(2, '0');
              const month = String(fechaObj.getMonth() + 1).padStart(2, '0');
              const year = fechaObj.getFullYear();
              const hours = String(fechaObj.getHours()).padStart(2, '0');
              const minutes = String(fechaObj.getMinutes()).padStart(2, '0');
              dateStr = `${day}/${month}/${year} ${hours}:${minutes}`;
            } catch (e) {
              dateStr = m.fecha.toString();
            }
          }

          const pId = m.productoId || (m.producto ? m.producto.id : undefined);
          const pNombre = m.productoNombre || (m.producto ? m.producto.nombre : 'Producto');
          const pUser = m.usuario || (m.adminUser ? m.adminUser.nombre : 'Admin Principal');

          return {
            id: m.id,
            productoId: pId,
            fecha: dateStr,
            fechaObj: fechaObj,
            producto: pNombre,
            tipo: tipo,
            tipoMovimiento: m.tipoMovimiento,
            cantidad: m.cantidad || 0,
            usuario: pUser,
            observacion: m.notas || ''
          };
        });
        this.recalcularEstadisticas();
      },
      error: (err) => {
        console.error('Error al cargar movimientos de inventario:', err);
      }
    });
  }

  recalcularEstadisticas() {
    const total = this.stockItems.reduce((acc, curr) => acc + curr.stock, 0);
    const bajo = this.stockItems.filter(item => item.stock > 0 && item.stock <= 5).length;
    const agotado = this.stockItems.filter(item => item.stock === 0).length;
    
    // Obtener movimientos de hoy
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const movementsTodayCount = this.movements.filter(mov => {
      if (!mov.fechaObj) return false;
      const movDate = new Date(mov.fechaObj.getTime());
      movDate.setHours(0, 0, 0, 0);
      return movDate.getTime() === today.getTime();
    }).length;

    this.statsStock = {
      totalProductos: total,
      bajoStock: bajo,
      agotados: agotado,
      movimientosHoy: movementsTodayCount
    };

    // Actualizar alertas criticas
    this.criticalAlerts = [];
    this.stockItems.forEach(item => {
      if (item.stock === 0) {
        this.criticalAlerts.push({
          id: 'alert-' + item.id,
          producto: item.nombre,
          sku: item.sku,
          stock: 0,
          motivo: 'Sin stock disponible para ventas en web.',
          nivel: 'critico'
        });
      } else if (item.stock <= 5) {
        this.criticalAlerts.push({
          id: 'alert-' + item.id,
          producto: item.nombre,
          sku: item.sku,
          stock: item.stock,
          motivo: `Cantidad inferior al stock mínimo (${item.stock} de 5 unidades).`,
          nivel: 'bajo'
        });
      }
    });

    // Actualizar resumen lateral
    const sortedStock = [...this.stockItems].sort((a, b) => a.stock - b.stock);
    if (sortedStock.length > 0) {
      this.summaryData.lowestStock = {
        nombre: sortedStock[0].nombre,
        sku: sortedStock[0].sku,
        stock: sortedStock[0].stock,
        imagen: sortedStock[0].imagen
      };
    }
  }

  // Métodos de navegación y filtros
  setFiltroStock(tab: 'todos' | 'disponibles' | 'bajo' | 'agotados') {
    this.filtroStockActivo = tab;
  }

  setFiltroHistorial(filtro: 'hoy' | 'semana' | 'mes') {
    this.filtroHistorialActivo = filtro;
  }

  getFilteredStockItems(): InventarioItem[] {
    return this.stockItems.filter(item => {
      const matchSearch = item.nombre.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
                          item.sku.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
                          item.categoria.toLowerCase().includes(this.searchTerm.toLowerCase());
      
      if (!matchSearch) return false;

      if (this.filtroStockActivo === 'disponibles') {
        return item.stock > 5;
      } else if (this.filtroStockActivo === 'bajo') {
        return item.stock > 0 && item.stock <= 5;
      } else if (this.filtroStockActivo === 'agotados') {
        return item.stock === 0;
      }
      return true;
    });
  }

  getFilteredMovements(): MovimientoInventario[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.movements.filter(mov => {
      if (!mov.fechaObj) return false;
      const movDate = new Date(mov.fechaObj.getTime());
      movDate.setHours(0, 0, 0, 0);

      if (this.filtroHistorialActivo === 'hoy') {
        return movDate.getTime() === today.getTime();
      } else if (this.filtroHistorialActivo === 'semana') {
        const limitDate = new Date(today);
        limitDate.setDate(today.getDate() - 7);
        return movDate.getTime() >= limitDate.getTime() && movDate.getTime() <= today.getTime();
      } else if (this.filtroHistorialActivo === 'mes') {
        const limitDate = new Date(today);
        limitDate.setDate(today.getDate() - 30);
        return movDate.getTime() >= limitDate.getTime() && movDate.getTime() <= today.getTime();
      }
      return true;
    });
  }

  // Control Modales
  openEditStock(item: InventarioItem) {
    this.editingStockItem = {
      id: item.id,
      nombre: item.nombre,
      sku: item.sku,
      stockActual: item.stock,
      cantidadMovimiento: 1,
      tipoMovimiento: 'entrada',
      observacion: '',
      imagen: item.imagen
    };
    this.showEditStockModal = true;
  }

  validarSoloEnterosMovimiento(event: KeyboardEvent): void {
    const allowedKeys = [
      'Backspace',
      'Delete',
      'Tab',
      'Escape',
      'Enter',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End'
    ];

    if (allowedKeys.includes(event.key)) {
      if (
        event.key === 'ArrowDown' &&
        (this.editingStockItem.cantidadMovimiento === null ||
          this.editingStockItem.cantidadMovimiento === undefined ||
          this.editingStockItem.cantidadMovimiento <= 1)
      ) {
        event.preventDefault();
      }
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      return;
    }

    // Bloquear el 0 como primer dígito (no permitir valores menores o iguales a 0)
    if (event.key === '0') {
      const input = event.target as HTMLInputElement;
      if (
        !input.value ||
        (input.selectionStart === 0 && input.selectionEnd === input.value.length) ||
        input.value === '0'
      ) {
        event.preventDefault();
        return;
      }
    }

    // Bloquear signos (+, -), puntos (.), comas (,), exponentes (e, E) y cualquier carácter que no sea 0-9
    if (!/^[0-9]$/.test(event.key)) {
      event.preventDefault();
    }
  }

  sanitizarCantidadMovimiento(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input) return;

    let val = input.value;
    val = val.replace(/[^0-9]/g, '');

    if (val.length > 1 && val.startsWith('0')) {
      val = val.replace(/^0+/, '') || '';
    }

    if (val === '0') {
      val = '';
    }

    input.value = val;

    if (val === '') {
      this.editingStockItem.cantidadMovimiento = null;
    } else {
      this.editingStockItem.cantidadMovimiento = parseInt(val, 10);
    }
  }

  validarPegadoMovimiento(event: ClipboardEvent): void {
    event.preventDefault();
    const clipboardData = event.clipboardData;
    if (!clipboardData) return;

    const pastedText = clipboardData.getData('text');
    let cleanDigits = pastedText.replace(/[^0-9]/g, '');
    if (cleanDigits) {
      if (cleanDigits.length > 1 && cleanDigits.startsWith('0')) {
        cleanDigits = cleanDigits.replace(/^0+/, '') || '';
      }
      if (cleanDigits === '0') {
        cleanDigits = '';
      }
      const input = event.target as HTMLInputElement;
      const start = input.selectionStart ?? 0;
      const end = input.selectionEnd ?? 0;
      const current = input.value || '';
      let finalVal = current.slice(0, start) + cleanDigits + current.slice(end);
      finalVal = finalVal.replace(/^0+/, '');
      input.value = finalVal;
      this.editingStockItem.cantidadMovimiento = finalVal ? parseInt(finalVal, 10) : null;
    }
  }

  saveEditStock() {
    const item = this.stockItems.find(i => i.id === this.editingStockItem.id);
    if (!item) {
      this.modalAlertaService.warning('No se pudo encontrar el producto seleccionado.', 'Producto no encontrado');
      return;
    }

    const rawCant = this.editingStockItem.cantidadMovimiento;
    const cant = rawCant !== null && rawCant !== undefined ? Number(rawCant) : 0;

    // Validación 1: Sólo números enteros superiores a 0
    if (!cant || isNaN(cant) || cant <= 0 || !Number.isInteger(cant)) {
      this.modalAlertaService.warning(
        'La cantidad a mover debe ser un número entero superior a 0.',
        'Cantidad inválida'
      );
      return;
    }

    const tipo = this.editingStockItem.tipoMovimiento;

    // Validación 2: Si la cantidad a mover supera el stock actual en salida
    if (tipo === 'salida' && cant > item.stock) {
      this.modalAlertaService.warning(
        `No se puede realizar el movimiento porque la cantidad a mover (${cant} ${cant === 1 ? 'unidad' : 'unidades'}) supera el stock actual disponible (${item.stock} ${item.stock === 1 ? 'unidad' : 'unidades'}).`,
        'Stock insuficiente'
      );
      return;
    }

    let delta = 0;
    let tipoMovimientoReq = 'AJUSTE';
    if (tipo === 'entrada') {
      delta = cant;
      tipoMovimientoReq = 'ENTRADA';
    } else if (tipo === 'salida') {
      delta = -cant;
      tipoMovimientoReq = 'SALIDA';
    } else {
      delta = cant - item.stock;
      tipoMovimientoReq = 'AJUSTE';
    }

    this.productosService.agregarStock(+item.id, {
      cantidad: delta,
      proveedor: 'Ajuste de inventario',
      notas: this.editingStockItem.observacion || `Actualización manual (${tipo})`,
      tipoMovimiento: tipoMovimientoReq
    }).subscribe({
      next: () => {
        this.modalAlertaService.success('¡Stock actualizado con éxito en el servidor!');
        this.cargarDatos();
        this.showEditStockModal = false;
      },
      error: (err) => {
        console.error('Error al actualizar stock:', err);
        this.modalAlertaService.error('No se pudo guardar la actualización en el servidor.');
      }
    });
  }

  openAddStock() {
    this.newStockIngreso = {
      productoId: this.stockItems.length > 0 ? this.stockItems[0].id : '',
      cantidad: 15,
      proveedor: 'Cerámicas Artisan SAC',
      fechaIngreso: new Date().toISOString().split('T')[0],
      nota: '',
      tipoMovimiento: 'ENTRADA'
    };
    this.showAddStockModal = true;
  }

  validarSoloEnteros(event: KeyboardEvent): void {
    const allowedKeys = [
      'Backspace',
      'Delete',
      'Tab',
      'Escape',
      'Enter',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End'
    ];

    if (allowedKeys.includes(event.key)) {
      if (
        event.key === 'ArrowDown' &&
        (this.newStockIngreso.cantidad === null ||
          this.newStockIngreso.cantidad === undefined ||
          this.newStockIngreso.cantidad <= 1)
      ) {
        event.preventDefault();
      }
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      return;
    }

    // Bloquear el 0 como primer dígito
    if (event.key === '0') {
      const input = event.target as HTMLInputElement;
      if (
        !input.value ||
        (input.selectionStart === 0 && input.selectionEnd === input.value.length) ||
        input.value === '0'
      ) {
        event.preventDefault();
        return;
      }
    }

    // Bloquear puntos, signos, exponentes, símbolos y cualquier carácter que no sea un número 0-9
    if (!/^[0-9]$/.test(event.key)) {
      event.preventDefault();
    }
  }

  sanitizarCantidad(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input) return;

    let val = input.value;
    val = val.replace(/[^0-9]/g, '');

    if (val.length > 1 && val.startsWith('0')) {
      val = val.replace(/^0+/, '') || '';
    }

    if (val === '0') {
      val = '';
    }

    input.value = val;

    if (val === '') {
      this.newStockIngreso.cantidad = null;
    } else {
      this.newStockIngreso.cantidad = parseInt(val, 10);
    }
  }

  validarPegado(event: ClipboardEvent): void {
    event.preventDefault();
    const clipboardData = event.clipboardData;
    if (!clipboardData) return;

    const pastedText = clipboardData.getData('text');
    let cleanDigits = pastedText.replace(/[^0-9]/g, '');
    if (cleanDigits) {
      if (cleanDigits.length > 1 && cleanDigits.startsWith('0')) {
        cleanDigits = cleanDigits.replace(/^0+/, '') || '';
      }
      if (cleanDigits === '0') {
        cleanDigits = '';
      }
      const input = event.target as HTMLInputElement;
      const start = input.selectionStart ?? 0;
      const end = input.selectionEnd ?? 0;
      const current = input.value || '';
      let finalVal = current.slice(0, start) + cleanDigits + current.slice(end);
      finalVal = finalVal.replace(/^0+/, '');
      input.value = finalVal;
      this.newStockIngreso.cantidad = finalVal ? parseInt(finalVal, 10) : null;
    }
  }

  saveAddStock() {
    const cant =
      this.newStockIngreso.cantidad !== null && this.newStockIngreso.cantidad !== undefined
        ? Number(this.newStockIngreso.cantidad)
        : 0;

    if (!cant || isNaN(cant) || cant <= 0 || !Number.isInteger(cant)) {
      this.modalAlertaService.warning('Debe ingresar una cantidad entera superior a 0.', 'Cantidad requerida');
      return;
    }

    const item = this.stockItems.find(i => i.id === this.newStockIngreso.productoId);
    if (!item) {
      this.modalAlertaService.warning('Por favor seleccione un producto.', 'Producto requerido');
      return;
    }

    const prov = this.newStockIngreso.proveedor || 'Proveedor';
    const nota = this.newStockIngreso.nota || 'Sin notas';

    this.productosService.agregarStock(+item.id, {
      cantidad: cant,
      proveedor: prov,
      notas: nota,
      tipoMovimiento: this.newStockIngreso.tipoMovimiento
    }).subscribe({
      next: () => {
        this.modalAlertaService.success('¡Ingreso de stock registrado con éxito!');
        this.cargarDatos();
        this.showAddStockModal = false;
      },
      error: (err) => {
        console.error('Error al registrar ingreso de stock:', err);
        this.modalAlertaService.error('No se pudo registrar el ingreso en el servidor.');
      }
    });
  }

  ocultarProducto(item: InventarioItem) {
    const nuevoEstado = !item.visible;
    this.productosService.actualizarVisibilidadProducto(+item.id, nuevoEstado).subscribe({
      next: () => {
        item.visible = nuevoEstado;
        alert(`El producto "${item.nombre}" ahora está ${nuevoEstado ? 'VISIBLE' : 'OCULTO'} en la tienda web.`);
        this.cargarDatos();
      },
      error: (err) => {
        console.error('Error al cambiar visibilidad:', err);
        alert('No se pudo actualizar la visibilidad en el servidor.');
      }
    });
  }

  private escapeXml(unsafe: string | number | null | undefined): string {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  exportarInventario(): void {
    if (!this.stockItems || this.stockItems.length === 0) {
      this.modalAlertaService.warning('No hay productos en el inventario para exportar.', 'Sin datos');
      return;
    }

    const now = new Date();
    const dateFormatted = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const dateFileStr = now.toISOString().split('T')[0];

    const totalStock = this.stockItems.reduce((acc, curr) => acc + curr.stock, 0);
    const bajoStock = this.stockItems.filter(p => p.stock > 0 && p.stock <= 5).length;
    const agotados = this.stockItems.filter(p => p.stock === 0).length;

    let rowsXml = '';
    this.stockItems.forEach((p, idx) => {
      const isAlt = idx % 2 === 1;
      const rowStyle = isAlt ? 'DataCellAlt' : 'DataCell';
      
      let estadoStyle = 'TypeIn';
      if (p.estado === 'bajo') estadoStyle = 'TypeAdj';
      else if (p.estado === 'agotado') estadoStyle = 'TypeOut';

      rowsXml += `
    <Row ss:Height="22">
     <Cell ss:StyleID="${rowStyle}"><Data ss:Type="String">${this.escapeXml(p.id)}</Data></Cell>
     <Cell ss:StyleID="${rowStyle}"><Data ss:Type="String">${this.escapeXml(p.nombre)}</Data></Cell>
     <Cell ss:StyleID="${rowStyle}"><Data ss:Type="String">${this.escapeXml(p.sku)}</Data></Cell>
     <Cell ss:StyleID="${rowStyle}"><Data ss:Type="String">${this.escapeXml(p.categoria)}</Data></Cell>
     <Cell ss:StyleID="DateCell"><Data ss:Type="Number">${p.stock}</Data></Cell>
     <Cell ss:StyleID="${estadoStyle}"><Data ss:Type="String">${p.estado.toUpperCase()}</Data></Cell>
     <Cell ss:StyleID="${p.visible ? 'TypeIn' : 'TypeOut'}"><Data ss:Type="String">${p.visible ? 'VISIBLE' : 'OCULTO'}</Data></Cell>
     <Cell ss:StyleID="${rowStyle}"><Data ss:Type="String">${this.escapeXml(p.ultimaActualizacion)}</Data></Cell>
    </Row>`;
    });

    const xmlTemplate = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>Inventario General - Punto y Coma</Title>
  <Author>Punto y Coma</Author>
  <Created>${now.toISOString()}</Created>
  <Company>Punto y Coma</Company>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#1F2937"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="BannerTitle">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#C2410C"/>
   </Borders>
   <Font ss:FontName="Georgia" ss:Size="14" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#DF6C1B" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="InfoKey">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#6B7280" ss:Bold="1"/>
   <Interior ss:Color="#FFF7ED" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="InfoVal">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#1F2937" ss:Bold="1"/>
   <Interior ss:Color="#FFF7ED" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="ColHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#7C2D12"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EA580C"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EA580C"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EA580C"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#C2410C" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="DataCell">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#1F2937"/>
  </Style>
  <Style ss:ID="DataCellAlt">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#1F2937"/>
   <Interior ss:Color="#FDFBF9" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="DateCell">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#1F2937" ss:Bold="1"/>
  </Style>
  <Style ss:ID="TypeIn">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BBF7D0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BBF7D0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BBF7D0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BBF7D0"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#15803D" ss:Bold="1"/>
   <Interior ss:Color="#DCFCE7" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="TypeOut">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FECACA"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FECACA"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FECACA"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FECACA"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#B91C1C" ss:Bold="1"/>
   <Interior ss:Color="#FEE2E2" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="TypeAdj">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DDD6FE"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DDD6FE"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DDD6FE"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DDD6FE"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#6D28D9" ss:Bold="1"/>
   <Interior ss:Color="#EDE9FE" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="FooterNote">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="8.5" ss:Color="#9CA3AF" ss:Italic="1"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Inventario General">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="50"/>
   <Column ss:Width="230"/>
   <Column ss:Width="95"/>
   <Column ss:Width="130"/>
   <Column ss:Width="95"/>
   <Column ss:Width="110"/>
   <Column ss:Width="105"/>
   <Column ss:Width="140"/>

   <Row ss:Height="32">
    <Cell ss:MergeAcross="7" ss:StyleID="BannerTitle">
     <Data ss:Type="String">PUNTO Y COMA - CATÁLOGO GENERAL DE INVENTARIO</Data>
    </Cell>
   </Row>

   <Row ss:Height="22">
    <Cell ss:StyleID="InfoKey"><Data ss:Type="String">EMISIÓN:</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="InfoVal"><Data ss:Type="String">${dateFormatted}</Data></Cell>
    <Cell ss:StyleID="InfoKey"><Data ss:Type="String">TOTAL STOCK:</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="InfoVal"><Data ss:Type="String">${totalStock} unidades en almacén</Data></Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:StyleID="InfoKey"><Data ss:Type="String">PRODUCTOS:</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="InfoVal"><Data ss:Type="String">${this.stockItems.length} registrados</Data></Cell>
    <Cell ss:StyleID="InfoKey"><Data ss:Type="String">ESTADO CRÍTICO:</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="InfoVal"><Data ss:Type="String">${bajoStock} bajo stock | ${agotados} agotados</Data></Cell>
   </Row>

   <Row ss:Height="12"/>

   <Row ss:Height="26">
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">ID</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">PRODUCTO</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">SKU</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">CATEGORÍA</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">STOCK ACTUAL</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">ESTADO</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">VISIBILIDAD</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">ACTUALIZACIÓN</Data></Cell>
   </Row>

   ${rowsXml}

   <Row ss:Height="14"/>
   <Row ss:Height="18">
    <Cell ss:MergeAcross="7" ss:StyleID="FooterNote">
     <Data ss:Type="String">* Inventario oficial de Punto y Coma descargado en formato Excel.</Data>
    </Cell>
   </Row>
  </Table>
 </Worksheet>
</Workbook>`;

    const blob = new Blob([xmlTemplate], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Inventario_PuntoYComa_${dateFileStr}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    this.modalAlertaService.success(
      'El catálogo completo de inventario se descargó con éxito en formato Excel con diseño personalizado.',
      '¡Exportación Exitosa!'
    );
  }

  verDetalleItem(item: InventarioItem) {
    this.modalAlertaService.info(
      `Producto: ${item.nombre}\nSKU: ${item.sku}\nCategoría: ${item.categoria}\nStock Actual: ${item.stock} unidades\nEstado: ${item.estado.toUpperCase()}\nÚltima Modificación: ${item.ultimaActualizacion}`,
      'Detalle del Producto'
    );
  }

  verHistorialProducto(item: InventarioItem) {
    this.selectedProductForHistory = item;
    this.productMovementsList = this.movements
      .filter(m => m.producto === item.nombre || (m.productoId && String(m.productoId) === String(item.id)))
      .sort((a, b) => {
        const timeA = a.fechaObj ? a.fechaObj.getTime() : 0;
        const timeB = b.fechaObj ? b.fechaObj.getTime() : 0;
        return timeB - timeA;
      });
    this.showProductHistoryModal = true;
  }

  cerrarModalHistorial(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.showProductHistoryModal = false;
    }
  }

  getTotalEntradas(): number {
    return this.productMovementsList
      .filter(m => m.tipo === 'entrada' || (m.cantidad && m.cantidad > 0))
      .reduce((acc, curr) => acc + Math.abs(curr.cantidad), 0);
  }

  getTotalSalidas(): number {
    return this.productMovementsList
      .filter(m => m.tipo === 'salida' || (m.cantidad && m.cantidad < 0))
      .reduce((acc, curr) => acc + Math.abs(curr.cantidad), 0);
  }

  exportarHistorialProductoExcel(): void {
    if (!this.selectedProductForHistory || this.productMovementsList.length === 0) {
      this.modalAlertaService.warning('No hay movimientos registrados para exportar.', 'Sin datos');
      return;
    }

    const item = this.selectedProductForHistory;
    const now = new Date();
    const dateFormatted = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const dateFileStr = now.toISOString().split('T')[0];

    const totalEntradas = this.getTotalEntradas();
    const totalSalidas = this.getTotalSalidas();
    const totalMovs = this.productMovementsList.length;

    let rowsXml = '';
    this.productMovementsList.forEach((mov, idx) => {
      const isAlt = idx % 2 === 1;
      const rowStyle = isAlt ? 'DataCellAlt' : 'DataCell';
      const dateStyle = isAlt ? 'DateCellAlt' : 'DateCell';
      
      let typeStyle = 'TypeAdj';
      let typeText = 'AJUSTE';
      if (mov.tipo === 'entrada') {
        typeStyle = 'TypeIn';
        typeText = 'ENTRADA';
      } else if (mov.tipo === 'salida') {
        typeStyle = 'TypeOut';
        typeText = 'SALIDA';
      }

      const qtyStyle = mov.cantidad > 0 ? 'QtyIn' : 'QtyOut';
      const qtyText = `${mov.cantidad > 0 ? '+' : ''}${mov.cantidad} u.`;

      rowsXml += `
    <Row ss:Height="22">
     <Cell ss:StyleID="${dateStyle}"><Data ss:Type="String">${this.escapeXml(mov.fecha)}</Data></Cell>
     <Cell ss:StyleID="${typeStyle}"><Data ss:Type="String">${typeText}</Data></Cell>
     <Cell ss:StyleID="${qtyStyle}"><Data ss:Type="String">${qtyText}</Data></Cell>
     <Cell ss:StyleID="${rowStyle}"><Data ss:Type="String">${this.escapeXml(mov.usuario || 'Admin Principal')}</Data></Cell>
     <Cell ss:StyleID="${rowStyle}"><Data ss:Type="String">${this.escapeXml(mov.observacion || 'Sin notas adicionales')}</Data></Cell>
    </Row>`;
    });

    const xmlTemplate = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>Historial de Movimientos - ${this.escapeXml(item.nombre)}</Title>
  <Author>Punto y Coma</Author>
  <Created>${now.toISOString()}</Created>
  <Company>Punto y Coma</Company>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#1F2937"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="BannerTitle">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#C2410C"/>
   </Borders>
   <Font ss:FontName="Georgia" ss:Size="14" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#DF6C1B" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="InfoKey">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#6B7280" ss:Bold="1"/>
   <Interior ss:Color="#FFF7ED" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="InfoVal">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#1F2937" ss:Bold="1"/>
   <Interior ss:Color="#FFF7ED" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="KpiLabel">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#4B5563" ss:Bold="1"/>
   <Interior ss:Color="#F3F4F6" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="KpiChip">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#374151" ss:Bold="1"/>
   <Interior ss:Color="#F3F4F6" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="KpiInVal">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BBF7D0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BBF7D0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BBF7D0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BBF7D0"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#15803D" ss:Bold="1"/>
   <Interior ss:Color="#DCFCE7" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="KpiOutVal">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FECACA"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FECACA"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FECACA"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FECACA"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#B91C1C" ss:Bold="1"/>
   <Interior ss:Color="#FEE2E2" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="ColHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#7C2D12"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EA580C"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EA580C"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EA580C"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#C2410C" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="DataCell">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#1F2937"/>
  </Style>
  <Style ss:ID="DataCellAlt">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#1F2937"/>
   <Interior ss:Color="#FDFBF9" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="DateCell">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#374151" ss:Bold="1"/>
   <NumberFormat ss:Format="@"/>
  </Style>
  <Style ss:ID="DateCellAlt">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#374151" ss:Bold="1"/>
   <Interior ss:Color="#FDFBF9" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="@"/>
  </Style>
  <Style ss:ID="TypeIn">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BBF7D0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BBF7D0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BBF7D0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BBF7D0"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#15803D" ss:Bold="1"/>
   <Interior ss:Color="#DCFCE7" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="TypeOut">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FECACA"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FECACA"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FECACA"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FECACA"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#B91C1C" ss:Bold="1"/>
   <Interior ss:Color="#FEE2E2" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="TypeAdj">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DDD6FE"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DDD6FE"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DDD6FE"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DDD6FE"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#6D28D9" ss:Bold="1"/>
   <Interior ss:Color="#EDE9FE" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="QtyIn">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#15803D" ss:Bold="1"/>
  </Style>
  <Style ss:ID="QtyOut">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#B91C1C" ss:Bold="1"/>
  </Style>
  <Style ss:ID="FooterNote">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="8.5" ss:Color="#9CA3AF" ss:Italic="1"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Historial Movimientos">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="160"/>
   <Column ss:Width="130"/>
   <Column ss:Width="105"/>
   <Column ss:Width="160"/>
   <Column ss:Width="280"/>

   <!-- BANNER DE TÍTULO -->
   <Row ss:Height="32">
    <Cell ss:MergeAcross="4" ss:StyleID="BannerTitle">
     <Data ss:Type="String">PUNTO Y COMA - HISTORIAL DE MOVIMIENTOS DE STOCK</Data>
    </Cell>
   </Row>

   <!-- DATOS DEL PRODUCTO -->
   <Row ss:Height="22">
    <Cell ss:StyleID="InfoKey"><Data ss:Type="String">PRODUCTO:</Data></Cell>
    <Cell ss:MergeAcross="1" ss:StyleID="InfoVal"><Data ss:Type="String">${this.escapeXml(item.nombre)}</Data></Cell>
    <Cell ss:StyleID="InfoKey"><Data ss:Type="String">FECHA EMISIÓN:</Data></Cell>
    <Cell ss:StyleID="InfoVal"><Data ss:Type="String">${dateFormatted}</Data></Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:StyleID="InfoKey"><Data ss:Type="String">CÓDIGO SKU:</Data></Cell>
    <Cell ss:MergeAcross="1" ss:StyleID="InfoVal"><Data ss:Type="String">${this.escapeXml(item.sku)}</Data></Cell>
    <Cell ss:StyleID="InfoKey"><Data ss:Type="String">STOCK ACTUAL:</Data></Cell>
    <Cell ss:StyleID="InfoVal"><Data ss:Type="String">${item.stock} unidades</Data></Cell>
   </Row>

   <!-- RESUMEN KPI -->
   <Row ss:Height="24">
    <Cell ss:StyleID="KpiLabel"><Data ss:Type="String">Total Movimientos</Data></Cell>
    <Cell ss:StyleID="KpiChip"><Data ss:Type="String">${totalMovs} registros</Data></Cell>
    <Cell ss:StyleID="KpiInVal"><Data ss:Type="String">+${totalEntradas} u. (Entradas)</Data></Cell>
    <Cell ss:StyleID="KpiOutVal"><Data ss:Type="String">-${totalSalidas} u. (Salidas)</Data></Cell>
    <Cell ss:StyleID="Default"/>
   </Row>

   <Row ss:Height="12"/>

   <!-- ENCABEZADOS DE COLUMNA -->
   <Row ss:Height="26">
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">FECHA Y HORA</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">TIPO DE MOVIMIENTO</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">CANTIDAD</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">RESPONSABLE</Data></Cell>
    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">MOTIVO / NOTA</Data></Cell>
   </Row>

   <!-- FILAS DE MOVIMIENTOS -->
   ${rowsXml}

   <Row ss:Height="14"/>
   <Row ss:Height="18">
    <Cell ss:MergeAcross="4" ss:StyleID="FooterNote">
     <Data ss:Type="String">* Reporte oficial generado automáticamente desde el Sistema Administrativo de Punto y Coma.</Data>
    </Cell>
   </Row>
  </Table>
 </Worksheet>
</Workbook>`;

    const blob = new Blob([xmlTemplate], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const safeSku = item.sku.replace(/[^a-zA-Z0-9_-]/g, '_');
    link.setAttribute('download', `Historial_${safeSku}_${dateFileStr}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    this.modalAlertaService.success(
      `El reporte en Excel de "${item.nombre}" se generó con éxito con formato y columnas ajustadas.`,
      '¡Descarga Exitosa!'
    );
  }
}
