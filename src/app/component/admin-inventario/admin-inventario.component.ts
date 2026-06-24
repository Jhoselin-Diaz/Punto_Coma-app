import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminLayoutComponent } from '../admin-layout/admin-layout.component';

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
  fecha: string;
  producto: string;
  tipo: 'entrada' | 'salida' | 'ajuste';
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

  // Modales
  showEditStockModal = false;
  showAddStockModal = false;

  // Mock data principal
  stockItems: InventarioItem[] = [];

  // Alertas de Inventario
  criticalAlerts: AlertaCritica[] = [];

  // Historial de Movimientos
  movements: MovimientoInventario[] = [];

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
    cantidadMovimiento: 1,
    tipoMovimiento: 'entrada' as 'entrada' | 'salida' | 'ajuste',
    observacion: '',
    imagen: ''
  };

  newStockIngreso = {
    productoId: '',
    cantidad: 10,
    proveedor: '',
    fechaIngreso: '',
    nota: ''
  };

  // Variables calculadas
  statsStock = {
    totalProductos: 0,
    bajoStock: 0,
    agotados: 0,
    movimientosHoy: 0
  };

  ngOnInit() {
    this.recalcularEstadisticas();
    // Poner fecha de hoy por defecto en el selector
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    this.newStockIngreso.fechaIngreso = `${yyyy}-${mm}-${dd}`;
  }

  recalcularEstadisticas() {
    const total = this.stockItems.reduce((acc, curr) => acc + curr.stock, 0);
    const bajo = this.stockItems.filter(item => item.stock > 0 && item.stock <= 5).length;
    const agotado = this.stockItems.filter(item => item.stock === 0).length;
    
    // Obtener movimientos de hoy
    const movementsTodayCount = this.movements.filter(mov => mov.fecha.includes('19/05/2026')).length;

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
    return this.movements.filter(mov => {
      if (this.filtroHistorialActivo === 'hoy') {
        return mov.fecha.includes('19/05/2026');
      } else if (this.filtroHistorialActivo === 'semana') {
        return mov.fecha.includes('19/05/2026') || mov.fecha.includes('18/05/2026') || mov.fecha.includes('17/05/2026') || mov.fecha.includes('15/05/2026');
      }
      return true; // mes
    });
  }

  // Control Modales
  openEditStock(item: InventarioItem) {
    this.editingStockItem = {
      id: item.id,
      nombre: item.nombre,
      sku: item.sku,
      stockActual: item.stock,
      cantidadMovimiento: 5,
      tipoMovimiento: 'entrada',
      observacion: '',
      imagen: item.imagen
    };
    this.showEditStockModal = true;
  }

  saveEditStock() {
    const item = this.stockItems.find(i => i.id === this.editingStockItem.id);
    if (item) {
      let finalStock = item.stock;
      const cant = this.editingStockItem.cantidadMovimiento;
      const tipo = this.editingStockItem.tipoMovimiento;

      if (tipo === 'entrada') {
        finalStock += cant;
      } else if (tipo === 'salida') {
        finalStock = Math.max(0, finalStock - cant);
      } else {
        // ajuste manual
        finalStock = Math.max(0, cant); // en este caso cantidad es el valor final deseado
      }

      item.stock = finalStock;
      
      // Actualizar estado del badge
      if (item.stock === 0) {
        item.estado = 'agotado';
      } else if (item.stock <= 5) {
        item.estado = 'bajo';
      } else {
        item.estado = 'disponible';
      }

      const now = new Date();
      const timestamp = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      item.ultimaActualizacion = timestamp;

      // Registrar movimiento
      this.movements.unshift({
        fecha: timestamp,
        producto: item.nombre,
        tipo: tipo,
        cantidad: tipo === 'ajuste' ? finalStock : cant,
        usuario: 'Admin Principal',
        observacion: this.editingStockItem.observacion || `Actualización manual (${tipo})`
      });

      // Registrar en recientemente modificados
      this.summaryData.recentlyModified.unshift({
        nombre: item.nombre,
        fecha: 'Hace un momento',
        stock: item.stock
      });
      if (this.summaryData.recentlyModified.length > 5) {
        this.summaryData.recentlyModified.pop();
      }

      this.recalcularEstadisticas();
    }
    this.showEditStockModal = false;
  }

  openAddStock() {
    this.newStockIngreso = {
      productoId: this.stockItems.length > 0 ? this.stockItems[0].id : '',
      cantidad: 15,
      proveedor: 'Cerámicas Artisan SAC',
      fechaIngreso: new Date().toISOString().split('T')[0],
      nota: ''
    };
    this.showAddStockModal = true;
  }

  saveAddStock() {
    const item = this.stockItems.find(i => i.id === this.newStockIngreso.productoId);
    if (item) {
      const cant = this.newStockIngreso.cantidad;
      item.stock += cant;

      // Actualizar estado del badge
      if (item.stock === 0) {
        item.estado = 'agotado';
      } else if (item.stock <= 5) {
        item.estado = 'bajo';
      } else {
        item.estado = 'disponible';
      }

      const now = new Date();
      const timestamp = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      item.ultimaActualizacion = timestamp;

      // Registrar movimiento
      this.movements.unshift({
        fecha: timestamp,
        producto: item.nombre,
        tipo: 'entrada',
        cantidad: cant,
        usuario: 'Admin Principal',
        observacion: `Reabastecimiento (${this.newStockIngreso.proveedor || 'Proveedor'}) - ${this.newStockIngreso.nota || 'Sin notas'}`
      });

      // Registrar en recientemente modificados
      this.summaryData.recentlyModified.unshift({
        nombre: item.nombre,
        fecha: 'Hace un momento',
        stock: item.stock
      });
      if (this.summaryData.recentlyModified.length > 5) {
        this.summaryData.recentlyModified.pop();
      }

      this.recalcularEstadisticas();
    }
    this.showAddStockModal = false;
  }

  ocultarProducto(item: InventarioItem) {
    item.visible = !item.visible;
    alert(`El producto "${item.nombre}" ahora está ${item.visible ? 'VISIBLE' : 'OCULTO'} en la tienda web del cliente.`);
  }

  exportarInventario() {
    alert('📥 Se ha generado la exportación del inventario en formato CSV/Excel con éxito. Descarga iniciada.');
  }

  verDetalleItem(item: InventarioItem) {
    alert(`🔍 Detalle de Stock:\n\nProducto: ${item.nombre}\nSKU: ${item.sku}\nCategoría: ${item.categoria}\nStock Actual: ${item.stock} unidades\nEstado: ${item.estado.toUpperCase()}\nÚltima Modificación: ${item.ultimaActualizacion}`);
  }

  verHistorialProducto(item: InventarioItem) {
    const list = this.movements.filter(m => m.producto === item.nombre);
    let msg = `⏳ Historial de Movimientos de "${item.nombre}":\n\n`;
    if (list.length === 0) {
      msg += 'No se registran movimientos para este producto hoy.';
    } else {
      list.forEach(m => {
        msg += `• [${m.fecha}] ${m.tipo.toUpperCase()} (${m.cantidad > 0 ? '+' : ''}${m.cantidad}): ${m.observacion} (por ${m.usuario})\n`;
      });
    }
    alert(msg);
  }
}
