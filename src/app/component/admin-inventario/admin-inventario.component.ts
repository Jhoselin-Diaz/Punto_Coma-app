import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminLayoutComponent } from '../admin-layout/admin-layout.component';
import { ProductosService } from '../../service/productos.service';

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

  constructor(private productosService: ProductosService) {}

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
      },
      error: (err) => {
        console.error('Error al cargar productos para inventario:', err);
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

          return {
            fecha: dateStr,
            fechaObj: fechaObj,
            producto: m.productoNombre || 'Producto',
            tipo: tipo,
            tipoMovimiento: m.tipoMovimiento,
            cantidad: m.cantidad || 0,
            usuario: 'Admin Principal',
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
      const cant = this.editingStockItem.cantidadMovimiento;
      const tipo = this.editingStockItem.tipoMovimiento;

      let delta = 0;
      if (tipo === 'entrada') {
        delta = cant;
      } else if (tipo === 'salida') {
        delta = -cant;
      } else {
        delta = cant - item.stock;
      }

      this.productosService.agregarStock(+item.id, {
        cantidad: delta,
        proveedor: 'Ajuste de inventario',
        notes: this.editingStockItem.observacion || `Actualización manual (${tipo})`
      } as any).subscribe({
        next: () => {
          alert('¡Stock actualizado con éxito en el servidor!');
          this.cargarDatos();
        },
        error: (err) => {
          console.error('Error al actualizar stock:', err);
          alert('No se pudo guardar la actualización en el servidor.');
        }
      });
    }
    this.showEditStockModal = false;
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

  saveAddStock() {
    const item = this.stockItems.find(i => i.id === this.newStockIngreso.productoId);
    if (item) {
      const cant = this.newStockIngreso.cantidad;
      const prov = this.newStockIngreso.proveedor || 'Proveedor';
      const nota = this.newStockIngreso.nota || 'Sin notas';

      this.productosService.agregarStock(+item.id, {
        cantidad: cant,
        proveedor: prov,
        notas: nota,
        tipoMovimiento: this.newStockIngreso.tipoMovimiento
      }).subscribe({
        next: () => {
          alert('¡Ingreso de stock registrado con éxito!');
          this.cargarDatos();
        },
        error: (err) => {
          console.error('Error al registrar ingreso de stock:', err);
          alert('No se pudo registrar el ingreso en el servidor.');
        }
      });
    }
    this.showAddStockModal = false;
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
