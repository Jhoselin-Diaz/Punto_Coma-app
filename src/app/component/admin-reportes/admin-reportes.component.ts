import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdminLayoutComponent } from '../admin-layout/admin-layout.component';
import { AdminPedidoService } from '../../service/admin-pedido.service';
import { ProductosService } from '../../service/productos.service';
import { CategoriasDestacadasService } from '../../service/categorias-destacadas.service';
import { forkJoin, of } from 'rxjs';
import { timeout, catchError, take, finalize } from 'rxjs/operators';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface BestsellerReport {
  puesto?: number;
  nombre: string;
  unidades: number;
  ingresos: number;
  categoria: string;
}

export interface DiaCalendario {
  id: string;
  dia: number;
  fecha: Date;
  vacio: boolean;
  esHoy: boolean;
  esInicio: boolean;
  esFin: boolean;
  enRango: boolean;
}

export interface CategoriaItem {
  id: string | number;
  nombre: string;
}

@Component({
  selector: 'app-admin-reportes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AdminLayoutComponent],
  templateUrl: './admin-reportes.component.html',
  styleUrl: './admin-reportes.component.css'
})
export class AdminReportesComponent implements OnInit {
  // Estado de carga inicial y skeleton loader
  isLoading: boolean = true;
  isExportingExcel: boolean = false;
  isExportingPdf: boolean = false;

  // Filtros de Rango de Fechas
  fechaInicio: string = '';
  fechaFin: string = '';
  presetActivo: string = 'todo'; // '30d' | '90d' | 'anio' | 'todo' | 'personalizado'

  // Filtros secundarios
  filtroEstado = 'todos';
  filtroCategoria = '';
  filtroProducto = '';

  // Sincronización dinámica de categorías
  listaCategorias: CategoriaItem[] = [];

  // Autocompletado de productos
  mostrarSugerencias: boolean = false;
  productosSugeridos: any[] = [];

  // Granularidad del gráfico: Días / Meses / Años
  granularidadGrafico: 'dias' | 'meses' | 'anios' = 'meses';
  minWidthGrafico: string = '100%';

  // Almanaque interactivo
  mostrarAlmanaque: boolean = false;
  pasoSeleccion: 1 | 2 = 1;
  almanaqueMes: number = new Date().getMonth();
  almanaqueAnio: number = new Date().getFullYear();
  nombresMeses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  aniosDisponibles: number[] = [2024, 2025, 2026, 2027];
  diasCalendario: DiaCalendario[] = [];

  // Datos del backend
  pedidosDb: any[] = [];
  pedidosFiltrados: any[] = [];
  productosDb: any[] = [];
  mensajeAlerta: string = '';
  esAlertaAdvertencia: boolean = false;

  // Indicadores de Negocio
  metricas = {
    totalPedidos: 0,
    ingresosTotales: 0.00,
    ticketPromedio: 0.00,
    pedidosConfirmados: 0
  };

  comparativas = {
    pedidos: 'En el periodo seleccionado',
    ingresos: 'En el periodo seleccionado',
    ticket: 'Promedio por pedido confirmado',
    confirmados: 'Validación conforme'
  };

  // Gráfico de Ventas
  puntosGrafico: any[] = [];
  svgPathVentas = '';
  subtituloTendencia = 'Progreso de ingresos acumulados de Punto y Coma.';
  trendUpTexto = 'Ventas registradas en el periodo';

  // Pedidos por Estado con colores directos
  estadosPedidos = [
    { nombre: 'Validado', cantidad: 0, porcentaje: 0, color: '#10b981', clase: 'color-conf' },
    { nombre: 'Rechazado', cantidad: 0, porcentaje: 0, color: '#ef4444', clase: 'color-rech' },
    { nombre: 'En revisión', cantidad: 0, porcentaje: 0, color: '#f97316', clase: 'color-rev' },
    { nombre: 'Pendiente', cantidad: 0, porcentaje: 0, color: '#f59e0b', clase: 'color-pend' }
  ];

  // Rankings de Ventas de Catálogo
  bestsellers: BestsellerReport[] = [];

  // Observaciones Estratégicas
  insights: any[] = [];

  constructor(
    private adminPedidoService: AdminPedidoService,
    private productosService: ProductosService,
    private categoriasService: CategoriasDestacadasService
  ) {}

  ngOnInit() {
    this.inicializarFechas();
    this.generarDiasMes();
    this.cargarDatos();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.date-range-group')) {
      this.mostrarAlmanaque = false;
      this.pasoSeleccion = 1;
    }
    if (!target.closest('.product-autocomplete-box')) {
      this.mostrarSugerencias = false;
    }
  }

  private inicializarFechas() {
    const hoy = new Date();
    // Default: desde el inicio del año actual hasta hoy para asegurar cobertura
    const inicio = new Date(hoy.getFullYear(), 0, 1);
    this.fechaFin = this.formatDateToInput(hoy);
    this.fechaInicio = this.formatDateToInput(inicio);
    this.presetActivo = 'todo';
  }

  cargarDatos() {
    this.isLoading = true;
    forkJoin({
      pedidos: this.adminPedidoService.getPedidos().pipe(
        take(1),
        timeout(6000),
        catchError(err => {
          console.warn('Error al cargar pedidos en reportes:', err);
          return of([]);
        })
      ),
      productos: this.productosService.obtenerTodosBackend().pipe(
        take(1),
        timeout(6000),
        catchError(err => {
          console.warn('Error al cargar productos en reportes:', err);
          return of([]);
        })
      ),
      categorias: this.categoriasService.obtenerTodas().pipe(
        take(1),
        timeout(4000),
        catchError(err => {
          console.warn('Error al cargar categorías en reportes:', err);
          return of([]);
        })
      )
    }).pipe(
      finalize(() => {
        this.isLoading = false;
      })
    ).subscribe(({ pedidos, productos, categorias }) => {
      this.pedidosDb = pedidos || [];
      this.productosDb = productos || [];
      this.sincronizarCategorias(categorias, this.productosDb);

      // Si el preset activo es 'todo' y hay pedidos, ajustar la fechaInicio al pedido más antiguo
      if (this.presetActivo === 'todo' && this.pedidosDb.length > 0) {
        let minDate: Date | null = null;
        this.pedidosDb.forEach(p => {
          const ms = this.obtenerFechaPedidoMs(p);
          if (ms) {
            const d = new Date(ms);
            if (!minDate || d < minDate) minDate = d;
          }
        });
        if (minDate) {
          this.fechaInicio = this.formatDateToInput(minDate);
        }
      }

      const dRef = this.parsearFecha(this.fechaInicio) || new Date();
      this.almanaqueMes = dRef.getMonth();
      this.almanaqueAnio = dRef.getFullYear();
      this.generarDiasMes();
      this.aplicarFiltros();
    });
  }

  private sincronizarCategorias(catDestacadas: any[], prods: any[]) {
    const catSet = new Set<string>();

    if (Array.isArray(catDestacadas)) {
      catDestacadas.forEach(c => {
        const nom = (c.nombreCategoria || c.nombre || '').trim();
        if (nom) catSet.add(nom);
      });
    }

    if (Array.isArray(prods)) {
      prods.forEach(p => {
        const nom = (p.categoria || '').trim();
        if (nom) catSet.add(nom);
      });
    }

    try {
      const raw = localStorage.getItem('admin_categorias_productos');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((c: any) => {
            if (typeof c === 'string' && c.trim()) catSet.add(c.trim());
          });
        }
      }
    } catch (e) {
      // ignore
    }

    if (catSet.size === 0) {
      catSet.add('Tazas');
      catSet.add('Vasos');
      catSet.add('Sets de Cerámica');
      catSet.add('Accesorios');
    }

    this.listaCategorias = Array.from(catSet).map((catName, index) => ({
      id: index + 1,
      nombre: catName
    }));
  }

  aplicarPreset(preset: '30d' | '90d' | 'anio' | 'todo') {
    const hoy = new Date();
    this.presetActivo = preset;
    this.fechaFin = this.formatDateToInput(hoy);

    if (preset === '30d') {
      const d = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000);
      this.fechaInicio = this.formatDateToInput(d);
    } else if (preset === '90d') {
      const d = new Date(hoy.getTime() - 90 * 24 * 60 * 60 * 1000);
      this.fechaInicio = this.formatDateToInput(d);
    } else if (preset === 'anio') {
      const d = new Date(hoy.getFullYear(), 0, 1);
      this.fechaInicio = this.formatDateToInput(d);
    } else if (preset === 'todo') {
      let minDate: Date | null = null;
      (this.pedidosDb || []).forEach(p => {
        const ms = this.obtenerFechaPedidoMs(p);
        if (ms) {
          const d = new Date(ms);
          if (!minDate || d < minDate) minDate = d;
        }
      });
      this.fechaInicio = minDate ? this.formatDateToInput(minDate) : `${hoy.getFullYear()}-01-01`;
    }

    const dRef = this.parsearFecha(this.fechaInicio) || hoy;
    this.almanaqueMes = dRef.getMonth();
    this.almanaqueAnio = dRef.getFullYear();
    this.generarDiasMes();
    this.aplicarFiltros();
  }

  limpiarRangoFechas() {
    this.aplicarPreset('todo');
    this.mensajeAlerta = 'Filtro de fechas restablecido al historial completo.';
    setTimeout(() => {
      this.mensajeAlerta = '';
    }, 3000);
  }

  alCambiarFechaManual() {
    this.presetActivo = 'personalizado';
    if (this.fechaInicio && this.fechaFin && this.fechaInicio > this.fechaFin) {
      const tmp = this.fechaInicio;
      this.fechaInicio = this.fechaFin;
      this.fechaFin = tmp;
    }
    this.generarDiasMes();
    this.aplicarFiltros();
  }

  cambiarGranularidad(tipo: 'dias' | 'meses' | 'anios') {
    this.granularidadGrafico = tipo;
    this.aplicarFiltros();
  }

  toggleAlmanaque(event?: Event) {
    if (event) event.stopPropagation();
    this.mostrarAlmanaque = !this.mostrarAlmanaque;
    if (this.mostrarAlmanaque) {
      const d = this.parsearFecha(this.fechaInicio) || new Date();
      this.almanaqueMes = d.getMonth();
      this.almanaqueAnio = d.getFullYear();
      this.pasoSeleccion = 1;
      this.generarDiasMes();
    }
  }

  cerrarAlmanaque() {
    this.mostrarAlmanaque = false;
    this.pasoSeleccion = 1;
  }

  mesAnterior() {
    if (this.almanaqueMes === 0) {
      this.almanaqueMes = 11;
      this.almanaqueAnio--;
    } else {
      this.almanaqueMes--;
    }
    this.generarDiasMes();
  }

  mesSiguiente() {
    if (this.almanaqueMes === 11) {
      this.almanaqueMes = 0;
      this.almanaqueAnio++;
    } else {
      this.almanaqueMes++;
    }
    this.generarDiasMes();
  }

  generarDiasMes() {
    const anio = this.almanaqueAnio;
    const mes = this.almanaqueMes;
    const primerDiaSemana = (new Date(anio, mes, 1).getDay() + 6) % 7; // Lunes = 0
    const diasEnMes = new Date(anio, mes + 1, 0).getDate();
    const hoyStr = this.formatDateToInput(new Date());

    const dInicio = this.parsearFecha(this.fechaInicio);
    const dFin = this.parsearFecha(this.fechaFin);
    if (dInicio) dInicio.setHours(0, 0, 0, 0);
    if (dFin) dFin.setHours(0, 0, 0, 0);

    const dias: DiaCalendario[] = [];

    // Celdas vacías antes del 1er día
    for (let i = 0; i < primerDiaSemana; i++) {
      dias.push({
        id: `vacio-${i}`,
        dia: 0,
        fecha: new Date(anio, mes, 1),
        vacio: true,
        esHoy: false,
        esInicio: false,
        esFin: false,
        enRango: false
      });
    }

    // Días del mes
    for (let dia = 1; dia <= diasEnMes; dia++) {
      const f = new Date(anio, mes, dia);
      f.setHours(0, 0, 0, 0);
      const fStr = this.formatDateToInput(f);

      const esInicio = dInicio ? f.getTime() === dInicio.getTime() : false;
      const esFin = dFin ? f.getTime() === dFin.getTime() : false;
      const enRango = dInicio && dFin ? (f.getTime() >= dInicio.getTime() && f.getTime() <= dFin.getTime()) : false;

      dias.push({
        id: `dia-${anio}-${mes}-${dia}`,
        dia,
        fecha: f,
        vacio: false,
        esHoy: fStr === hoyStr,
        esInicio,
        esFin,
        enRango
      });
    }

    this.diasCalendario = dias;
  }

  seleccionarDiaAlmanaque(d: DiaCalendario) {
    if (d.vacio) return;
    const fechaStr = this.formatDateToInput(d.fecha);

    if (this.pasoSeleccion === 1) {
      this.fechaInicio = fechaStr;
      if (this.fechaFin && this.fechaFin < fechaStr) {
        this.fechaFin = fechaStr;
      }
      this.pasoSeleccion = 2;
    } else {
      if (fechaStr < this.fechaInicio) {
        this.fechaFin = this.fechaInicio;
        this.fechaInicio = fechaStr;
      } else {
        this.fechaFin = fechaStr;
      }
      this.pasoSeleccion = 1;
      this.presetActivo = 'personalizado';
      this.aplicarFiltros();
    }
    this.generarDiasMes();
  }

  // Métodos del buscador con autocompletado
  alEscribirBusqueda() {
    const q = (this.filtroProducto || '').toLowerCase().trim();
    if (!q) {
      this.productosSugeridos = [];
      this.mostrarSugerencias = false;
      this.aplicarFiltros();
      return;
    }

    const matches: any[] = [];
    const seen = new Set<string>();

    (this.productosDb || []).forEach(p => {
      const nom = (p.nombre || p.name || '').trim();
      const sku = String(p.sku || p.id || '').trim();
      const cat = (p.categoria || '').trim();
      if (nom.toLowerCase().includes(q) || sku.toLowerCase().includes(q) || cat.toLowerCase().includes(q)) {
        if (!seen.has(nom.toLowerCase())) {
          seen.add(nom.toLowerCase());
          matches.push({
            id: p.id,
            nombre: this.formatearNombreProducto(nom),
            sku: p.sku || `ID-${p.id}`,
            categoria: cat || 'Catálogo',
            precio: p.precio
          });
        }
      }
    });

    this.bestsellers.forEach(b => {
      if (b.nombre.toLowerCase().includes(q) && !seen.has(b.nombre.toLowerCase())) {
        seen.add(b.nombre.toLowerCase());
        matches.push({
          id: b.nombre,
          nombre: b.nombre,
          sku: 'BESTSELLER',
          categoria: b.categoria,
          precio: b.unidades > 0 ? b.ingresos / b.unidades : 0
        });
      }
    });

    this.productosSugeridos = matches.slice(0, 6);
    this.mostrarSugerencias = this.productosSugeridos.length > 0;
    this.aplicarFiltros();
  }

  alFocoBusqueda() {
    if (this.filtroProducto.trim()) {
      this.alEscribirBusqueda();
    }
  }

  seleccionarProductoSugerido(prod: any) {
    this.filtroProducto = prod.nombre;
    this.mostrarSugerencias = false;
    this.aplicarFiltros();
  }

  limpiarBuscador() {
    this.filtroProducto = '';
    this.mostrarSugerencias = false;
    this.aplicarFiltros();
  }

  aplicarFiltros() {
    const dInicio = this.parsearFecha(this.fechaInicio);
    const dFin = this.parsearFecha(this.fechaFin);

    // Normalizar inicio a las 00:00:00.000 y fin a las 23:59:59.999
    const inicioMs = dInicio
      ? new Date(dInicio.getFullYear(), dInicio.getMonth(), dInicio.getDate(), 0, 0, 0, 0).getTime()
      : 0;
    const finMs = dFin
      ? new Date(dFin.getFullYear(), dFin.getMonth(), dFin.getDate(), 23, 59, 59, 999).getTime()
      : Number.MAX_SAFE_INTEGER;

    // 1. Filtrar pedidos por rango numérico en milisegundos
    let filtrados = (this.pedidosDb || []).filter(p => {
      const pMs = this.obtenerFechaPedidoMs(p);
      if (pMs !== null) {
        if (pMs < inicioMs || pMs > finMs) return false;
      }
      return true;
    });

    // 2. Filtrar por estado
    if (this.filtroEstado !== 'todos') {
      filtrados = filtrados.filter(p => {
        const st = (p.estado || '').toLowerCase().trim();
        if (this.filtroEstado === 'validado') {
          return st === 'validado' || st === 'confirmado';
        } else if (this.filtroEstado === 'rechazado') {
          return st === 'rechazado';
        } else if (this.filtroEstado === 'revision') {
          return st === 'en revision' || st === 'en revisión';
        } else if (this.filtroEstado === 'pendiente') {
          return st === 'pendiente';
        }
        return true;
      });
    }

    // 3. Filtrar por categoría
    if (this.filtroCategoria && this.filtroCategoria !== 'todas') {
      const catBuscada = this.filtroCategoria.toLowerCase().trim();
      filtrados = filtrados.filter(p => {
        const prodStr = (p.producto || '').toLowerCase();
        if (Array.isArray(p.productosDetalle) && p.productosDetalle.length > 0) {
          return p.productosDetalle.some((d: any) => {
            const nom = (d.nombre || '').toLowerCase();
            if (catBuscada.includes('taza') && nom.includes('taza')) return true;
            if (catBuscada.includes('vaso') && nom.includes('vaso')) return true;
            if (catBuscada.includes('cerámica') && (nom.includes('juego') || nom.includes('cerámica'))) return true;
            if (catBuscada.includes('accesorio') && nom.includes('arcilla')) return true;
            return nom.includes(catBuscada);
          });
        }
        if (catBuscada.includes('taza')) return prodStr.includes('taza');
        if (catBuscada.includes('vaso')) return prodStr.includes('vaso');
        if (catBuscada.includes('cerámica')) return prodStr.includes('juego') || prodStr.includes('cerámica');
        if (catBuscada.includes('accesorio')) return prodStr.includes('arcilla');
        return prodStr.includes(catBuscada);
      });
    }

    // 4. Filtrar por producto específico
    if (this.filtroProducto.trim()) {
      const q = this.filtroProducto.toLowerCase().trim();
      filtrados = filtrados.filter(p => {
        const prodStr = (p.producto || '').toLowerCase();
        const idStr = String(p.id || '').toLowerCase();
        return prodStr.includes(q) || idStr.includes(q);
      });
    }

    this.pedidosFiltrados = filtrados;
    this.calcularMetricas(filtrados);
    this.calcularGraficoVentas(filtrados);
    this.calcularDistribucion(filtrados);
    this.calcularRanking(filtrados);
    this.calcularInsights(filtrados);
  }

  private calcularMetricas(pedidosFiltrados: any[]) {
    this.metricas.totalPedidos = pedidosFiltrados.length;

    // Pedidos confirmados (Validado o Confirmado)
    const pedidosConfirmados = pedidosFiltrados.filter(p => {
      const st = (p.estado || '').toLowerCase().trim();
      return st === 'validado' || st === 'confirmado';
    });
    this.metricas.pedidosConfirmados = pedidosConfirmados.length;

    // Ingresos totales
    this.metricas.ingresosTotales = pedidosConfirmados.reduce((acc, p) => {
      let m = 0;
      if (typeof p.total === 'number') m = p.total;
      else if (typeof p.total === 'string') {
        m = parseFloat(p.total.replace(/[^\d.-]/g, '')) || 0;
      }
      return acc + m;
    }, 0);

    // Ticket promedio
    this.metricas.ticketPromedio = this.metricas.pedidosConfirmados > 0
      ? this.metricas.ingresosTotales / this.metricas.pedidosConfirmados
      : 0;
  }

  private calcularGraficoVentas(pedidosFiltrados: any[]) {
    const confirmados = pedidosFiltrados.filter(p => {
      const st = (p.estado || '').toLowerCase().trim();
      return st === 'validado' || st === 'confirmado';
    });

    const mesesAbrev = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];
    const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    interface ItemGrupo {
      sortKey: string;
      label: string;
      total: number;
    }

    const grupos: Record<string, ItemGrupo> = {};

    confirmados.forEach(p => {
      const ms = this.obtenerFechaPedidoMs(p);
      const f = ms ? new Date(ms) : new Date();

      let m = 0;
      if (typeof p.total === 'number') m = p.total;
      else if (typeof p.total === 'string') {
        m = parseFloat(p.total.replace(/[^\d.-]/g, '')) || 0;
      }

      let sortKey = '';
      let label = '';

      if (this.granularidadGrafico === 'meses') {
        sortKey = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`;
        label = `${mesesAbrev[f.getMonth()]} ${f.getFullYear()}`;
      } else if (this.granularidadGrafico === 'anios') {
        sortKey = `${f.getFullYear()}`;
        label = `${f.getFullYear()}`;
      } else { // 'dias'
        const diaNum = String(f.getDate()).padStart(2, '0');
        const mesNum = String(f.getMonth() + 1).padStart(2, '0');
        sortKey = `${f.getFullYear()}-${mesNum}-${diaNum}`;
        label = `${diasSemana[f.getDay()]} ${diaNum}/${mesNum}`;
      }

      if (!grupos[sortKey]) {
        grupos[sortKey] = { sortKey, label, total: 0 };
      }
      grupos[sortKey].total += m;
    });

    const itemsOrdenados = Object.keys(grupos).sort().map(k => grupos[k]);

    if (itemsOrdenados.length === 0) {
      this.puntosGrafico = [];
      this.svgPathVentas = '';
      this.minWidthGrafico = '100%';
      this.subtituloTendencia = 'Sin pedidos confirmados para graficar en este periodo.';
      this.trendUpTexto = 'Sin ventas confirmadas';
    } else if (itemsOrdenados.length === 1) {
      const gTxt = this.granularidadGrafico === 'dias' ? 'días' : this.granularidadGrafico === 'meses' ? 'meses' : 'años';
      this.subtituloTendencia = `Ingresos agrupados por ${gTxt} en el periodo.`;
      this.puntosGrafico = [
        { x: 350, y: 75, dia: itemsOrdenados[0].label, ventas: itemsOrdenados[0].total.toFixed(0) }
      ];
      this.svgPathVentas = 'M 350 75';
      this.minWidthGrafico = '100%';
      this.trendUpTexto = `S/ ${itemsOrdenados[0].total.toFixed(2)} recaudados`;
    } else {
      const gTxt = this.granularidadGrafico === 'dias' ? 'días' : this.granularidadGrafico === 'meses' ? 'meses' : 'años';
      this.subtituloTendencia = `Ingresos agrupados por ${gTxt} en el periodo.`;
      const maxVentas = Math.max(...itemsOrdenados.map(d => d.total), 1);
      const paddingX = itemsOrdenados.length > 5 ? 40 : 70;
      const usableWidth = 700 - paddingX * 2;
      const stepX = usableWidth / (itemsOrdenados.length - 1);

      this.puntosGrafico = itemsOrdenados.map((d, idx) => {
        const x = Math.round(paddingX + idx * stepX);
        const baselineY = 140;
        const topY = 40;
        const heightSpan = baselineY - topY;
        const ratio = d.total / maxVentas;
        const y = Math.round(baselineY - ratio * heightSpan);
        return {
          x,
          y,
          dia: d.label,
          ventas: d.total.toFixed(0)
        };
      });

      this.svgPathVentas = this.puntosGrafico.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      const sumaTotal = itemsOrdenados.reduce((a, b) => a + b.total, 0);
      this.trendUpTexto = `S/ ${sumaTotal.toFixed(2)} recaudados en ${itemsOrdenados.length} ${gTxt}`;

      // Min-width dinámico para scroll horizontal cuando hay muchos puntos
      const anchoDinamico = Math.max(650, itemsOrdenados.length * 55);
      this.minWidthGrafico = `${anchoDinamico}px`;
    }
  }

  private calcularDistribucion(pedidosFiltrados: any[]) {
    const cantValidados = pedidosFiltrados.filter(p => {
      const st = (p.estado || '').toLowerCase().trim();
      return st === 'validado' || st === 'confirmado';
    }).length;

    const cantRechazados = pedidosFiltrados.filter(p => (p.estado || '').toLowerCase().trim() === 'rechazado').length;

    const cantRevision = pedidosFiltrados.filter(p => {
      const st = (p.estado || '').toLowerCase().trim();
      return st === 'en revision' || st === 'en revisión';
    }).length;

    const cantPendientes = pedidosFiltrados.filter(p => (p.estado || '').toLowerCase().trim() === 'pendiente').length;

    const totalDist = cantValidados + cantRechazados + cantRevision + cantPendientes;

    this.estadosPedidos = [
      {
        nombre: 'Validado',
        cantidad: cantValidados,
        porcentaje: totalDist > 0 ? Math.round((cantValidados / totalDist) * 100) : 0,
        color: '#10b981',
        clase: 'color-conf'
      },
      {
        nombre: 'Rechazado',
        cantidad: cantRechazados,
        porcentaje: totalDist > 0 ? Math.round((cantRechazados / totalDist) * 100) : 0,
        color: '#ef4444',
        clase: 'color-rech'
      },
      {
        nombre: 'En revisión',
        cantidad: cantRevision,
        porcentaje: totalDist > 0 ? Math.round((cantRevision / totalDist) * 100) : 0,
        color: '#f97316',
        clase: 'color-rev'
      },
      {
        nombre: 'Pendiente',
        cantidad: cantPendientes,
        porcentaje: totalDist > 0 ? Math.round((cantPendientes / totalDist) * 100) : 0,
        color: '#f59e0b',
        clase: 'color-pend'
      }
    ];
  }

  private calcularRanking(pedidosFiltrados: any[]) {
    const confirmados = pedidosFiltrados.filter(p => {
      const st = (p.estado || '').toLowerCase().trim();
      return st === 'validado' || st === 'confirmado';
    });

    const rankingMap: Record<string, { nombre: string; unidades: number; ingresos: number; categoria: string }> = {};

    confirmados.forEach(p => {
      if (Array.isArray(p.productosDetalle) && p.productosDetalle.length > 0) {
        p.productosDetalle.forEach((d: any) => {
          let nom = this.formatearNombreProducto(d.nombre || 'Producto');
          const u = Number(d.cantidad) || 1;
          const precio = Number(d.precio) || (nom.includes('Juego') ? 87 : nom.includes('Nube') ? 40 : 25);
          const cat = nom.toLowerCase().includes('vaso') ? 'Vasos' : (nom.includes('Juego') ? 'Sets de Cerámica' : 'Tazas');

          if (!rankingMap[nom]) {
            rankingMap[nom] = { nombre: nom, unidades: 0, ingresos: 0, categoria: cat };
          }
          rankingMap[nom].unidades += u;
          rankingMap[nom].ingresos += u * precio;
        });
      } else if (p.producto && typeof p.producto === 'string') {
        const partes = p.producto.split(',');
        partes.forEach((pt: string) => {
          const match = pt.trim().match(/^(.*?)(?:\s*[xX]\s*(\d+))?$/);
          if (match) {
            let nom = this.formatearNombreProducto(match[1] || '').trim();
            const u = match[2] ? parseInt(match[2], 10) : 1;
            const precio = nom.includes('Juego') ? 87 : nom.includes('Nube') ? 40 : 25;
            const cat = nom.toLowerCase().includes('vaso') ? 'Vasos' : (nom.includes('Juego') ? 'Sets de Cerámica' : 'Tazas');

            if (!rankingMap[nom]) {
              rankingMap[nom] = { nombre: nom, unidades: 0, ingresos: 0, categoria: cat };
            }
            rankingMap[nom].unidades += u;
            rankingMap[nom].ingresos += u * precio;
          }
        });
      }
    });

    let listaRanking = Object.values(rankingMap).sort((a, b) => b.ingresos - a.ingresos);

    // Filtros de búsqueda
    if (this.filtroProducto.trim()) {
      const q = this.filtroProducto.toLowerCase().trim();
      listaRanking = listaRanking.filter(r => r.nombre.toLowerCase().includes(q));
    }
    if (this.filtroCategoria && this.filtroCategoria !== 'todas') {
      const catBuscada = this.filtroCategoria.toLowerCase().trim();
      listaRanking = listaRanking.filter(r => {
        const catR = r.categoria.toLowerCase();
        const nomR = r.nombre.toLowerCase();
        if (catBuscada.includes('taza')) return catR.includes('taza') || nomR.includes('taza');
        if (catBuscada.includes('vaso')) return catR.includes('vaso') || nomR.includes('vaso');
        if (catBuscada.includes('cerámica')) return catR.includes('cerámica') || nomR.includes('juego');
        if (catBuscada.includes('accesorio')) return catR.includes('accesorio') || nomR.includes('arcilla');
        return catR.includes(catBuscada) || nomR.includes(catBuscada);
      });
    }

    this.bestsellers = listaRanking;
  }

  private calcularInsights(pedidosFiltrados: any[]) {
    const insightsList = [];
    const totalPed = pedidosFiltrados.length;

    // 1. Producto estrella
    if (this.bestsellers.length > 0) {
      const top = this.bestsellers[0];
      insightsList.push({
        titulo: 'Producto Estrella',
        valor: top.nombre,
        desc: `Líder en facturación con S/ ${top.ingresos.toFixed(2)} recaudados y ${top.unidades} unidades vendidas.`
      });
    } else {
      insightsList.push({
        titulo: 'Catálogo de Artículos',
        valor: 'Sin ventas registradas',
        desc: 'No se registran compras confirmadas para los filtros activos.'
      });
    }

    // 2. Canal predominante
    const wspCount = pedidosFiltrados.filter(p => String(p.id).startsWith('WSP-')).length;
    const wspPct = totalPed > 0 ? Math.round((wspCount / totalPed) * 100) : 0;
    insightsList.push({
      titulo: 'Canal de Conversión',
      valor: wspPct >= 50 ? 'WhatsApp Store' : 'Web Store',
      desc: `${wspPct}% de los pedidos (${wspCount} órdenes) provienen de interacciones conversacionales.`
    });

    // 3. Tasa de efectividad de validación
    const pctConfirmados = totalPed > 0 ? Math.round((this.metricas.pedidosConfirmados / totalPed) * 100) : 0;
    insightsList.push({
      titulo: 'Efectividad Logística',
      valor: `${pctConfirmados}% confirmados`,
      desc: `${this.metricas.pedidosConfirmados} de ${totalPed} pedidos cuentan con validación de pago conforme.`
    });

    this.insights = insightsList;
  }

  ejecutarGeneracionReporte() {
    this.aplicarFiltros();
    this.mensajeAlerta = 'Reporte analítico generado con los datos actuales.';
    setTimeout(() => {
      this.mensajeAlerta = '';
    }, 3000);
  }

  public obtenerTextoPeriodo(): string {
    const presetNombres: Record<string, string> = {
      '30d': 'Últimos 30 días',
      '90d': 'Últimos 90 días',
      'anio': 'Este Año (2026)',
      'todo': 'Todo el Historial',
      'personalizado': 'Rango Personalizado'
    };
    const presetLabel = presetNombres[this.presetActivo] || '';
    if (this.fechaInicio && this.fechaFin) {
      return `${this.fechaInicio} al ${this.fechaFin}${presetLabel ? ` (${presetLabel})` : ''}`;
    }
    return presetLabel || 'Todo el Historial';
  }

  public obtenerTextoCategoria(): string {
    if (!this.filtroCategoria || this.filtroCategoria === 'todas') {
      return 'Todas las categorías';
    }
    const cat = this.listaCategorias.find(c => String(c.id) === String(this.filtroCategoria));
    return cat ? cat.nombre : this.filtroCategoria;
  }

  public obtenerTextoEstado(): string {
    if (!this.filtroEstado || this.filtroEstado === 'todos') {
      return 'Todos los estados';
    }
    return this.filtroEstado.charAt(0).toUpperCase() + this.filtroEstado.slice(1);
  }

  public mostrarNotificacion(mensaje: string, esAdvertencia = false, duracionMs = 6000) {
    this.mensajeAlerta = mensaje;
    this.esAlertaAdvertencia = esAdvertencia;
    setTimeout(() => {
      if (this.mensajeAlerta === mensaje) {
        this.mensajeAlerta = '';
        this.esAlertaAdvertencia = false;
      }
    }, duracionMs);
  }

  public obtenerMontoPedido(p: any): number {
    if (!p) return 0;
    if (typeof p.total === 'number') return p.total;
    if (typeof p.total === 'string') {
      return parseFloat(p.total.replace(/[^\d.-]/g, '')) || 0;
    }
    return 0;
  }

  public formatearDetalleProductos(p: any): string {
    if (!p) return '-';
    if (Array.isArray(p.productosDetalle) && p.productosDetalle.length > 0) {
      return p.productosDetalle.map((d: any) => `${this.formatearNombreProducto(d.nombre || 'Item')} (x${d.cantidad || 1})`).join(', ');
    }
    if (p.producto && typeof p.producto === 'string') {
      return this.formatearNombreProducto(p.producto.trim());
    }
    if (p.variantesEspecificas) {
      return p.variantesEspecificas;
    }
    return 'Artículos de cerámica';
  }

  public formatearFechaCorta(p: any): string {
    if (!p) return '-';
    const ms = this.obtenerFechaPedidoMs(p);
    if (ms) {
      const d = new Date(ms);
      const dia = String(d.getDate()).padStart(2, '0');
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const anio = d.getFullYear();
      return `${dia}/${mes}/${anio}`;
    }
    if (typeof p.fecha === 'string' && p.fecha.trim()) {
      return p.fecha.trim();
    }
    return '-';
  }

  async exportarExcel() {
    // 1. Validación previa a la exportación (Prevención de descargas vacías)
    if (!this.pedidosFiltrados || this.pedidosFiltrados.length === 0 || this.metricas.totalPedidos === 0) {
      this.isExportingExcel = false;
      this.mostrarNotificacion(
        'No existen datos registrados en el rango seleccionado para generar el reporte. Por favor, amplía el rango de fechas o restablece los filtros para continuar.',
        true,
        7000
      );
      return;
    }

    if (this.isExportingExcel) return;
    this.isExportingExcel = true;

    try {
      const fechaHoy = new Date().toISOString().slice(0, 10);
      const nombreArchivo = `Reporte_Ventas_PuntoYComa_${fechaHoy}.xlsx`;
      const fechaEmision = new Date().toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' });

      // Instancia del libro de trabajo ExcelJS con metadatos
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Punto y Coma';
      workbook.lastModifiedBy = 'Punto y Coma';
      workbook.created = new Date();
      workbook.modified = new Date();

      // Paleta de Color e Identidad Visual (Punto y Coma)
      const COLOR_CAFE = 'FF2C1810';
      const COLOR_TERRACOTA = 'FFC25E2E';
      const COLOR_BEIGE_KPI = 'FFFFF8F5';
      const COLOR_BORDER_KPI = 'FFE2E8F0';
      const COLOR_ZEBRA_BLANCO = 'FFFFFFFF';
      const COLOR_ZEBRA_GRIS = 'FFF9FAFB';
      const COLOR_BORDER_TABLA = 'FFD1D5DB';
      const COLOR_TOTAL_BG = 'FFF3F4F6';
      const COLOR_TEXTO_TITULO = 'FF111827';
      const COLOR_TEXTO_MUTED = 'FF6B7280';

      const borderFino: Partial<ExcelJS.Borders> = {
        top: { style: 'thin', color: { argb: COLOR_BORDER_TABLA } },
        left: { style: 'thin', color: { argb: COLOR_BORDER_TABLA } },
        bottom: { style: 'thin', color: { argb: COLOR_BORDER_TABLA } },
        right: { style: 'thin', color: { argb: COLOR_BORDER_TABLA } }
      };

      const borderCardKpi: Partial<ExcelJS.Borders> = {
        top: { style: 'thin', color: { argb: COLOR_BORDER_KPI } },
        left: { style: 'thin', color: { argb: COLOR_BORDER_KPI } },
        bottom: { style: 'thin', color: { argb: COLOR_BORDER_KPI } },
        right: { style: 'thin', color: { argb: COLOR_BORDER_KPI } }
      };

      const aplicarBannerCabecera = (
        ws: ExcelJS.Worksheet,
        rangoMerge: string,
        titulo: string,
        colMax: number
      ) => {
        ws.mergeCells(rangoMerge);
        ws.getRow(1).height = 24;
        ws.getRow(2).height = 24;
        for (let r = 1; r <= 2; r++) {
          for (let c = 1; c <= colMax; c++) {
            const cell = ws.getCell(r, c);
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: COLOR_CAFE }
            };
          }
        }
        const bannerCell = ws.getCell('A1');
        bannerCell.value = titulo;
        bannerCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
        bannerCell.alignment = { vertical: 'middle', horizontal: 'center' };
      };

      // =========================================================================
      // HOJA 1: RESUMEN EJECUTIVO
      // =========================================================================
      const ws1 = workbook.addWorksheet('Resumen Ejecutivo', { views: [{ showGridLines: true }] });
      aplicarBannerCabecera(ws1, 'A1:E2', 'PUNTO Y COMA  •  REPORTE EJECUTIVO DE RENDIMIENTO Y VENTAS', 5);

      ws1.getRow(3).height = 12;

      // Bloque de Filtros (Filas 4 a 8)
      const filtros: [string, string][] = [
        ['Periodo Analizado:', this.obtenerTextoPeriodo()],
        ['Fecha de Emisión:', fechaEmision],
        ['Categoría Filtrada:', this.obtenerTextoCategoria()],
        ['Estado de Pedidos:', this.obtenerTextoEstado()],
        ['Filtro por Producto:', this.filtroProducto.trim() || 'Todos los artículos']
      ];

      filtros.forEach((f, idx) => {
        const rowNum = 4 + idx;
        ws1.getRow(rowNum).height = 18;
        const cA = ws1.getCell(rowNum, 1);
        const cB = ws1.getCell(rowNum, 2);
        cA.value = f[0];
        cA.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF374151' } };
        cA.alignment = { vertical: 'middle', horizontal: 'left' };
        cB.value = f[1];
        cB.font = { name: 'Segoe UI', size: 10, color: { argb: COLOR_TEXTO_TITULO } };
        cB.alignment = { vertical: 'middle', horizontal: 'left' };
      });

      ws1.getRow(9).height = 14;

      // Bloque de Tarjetas KPIs (Filas 10 a 13)
      const kpis = [
        {
          col: 1,
          title: 'TOTAL PEDIDOS',
          value: Number(this.metricas.totalPedidos || 0),
          numFmt: '#,##0',
          sub: 'Órdenes en periodo'
        },
        {
          col: 2,
          title: 'CONFIRMADOS',
          value: Number(this.metricas.pedidosConfirmados || 0),
          numFmt: '#,##0',
          sub: 'Validados / Pagados'
        },
        {
          col: 3,
          title: 'INGRESOS TOTALES',
          value: Number(this.metricas.ingresosTotales || 0),
          numFmt: '"S/ "#,##0.00',
          sub: 'Venta neta acumulada'
        },
        {
          col: 4,
          title: 'TICKET PROMEDIO',
          value: Number(this.metricas.ticketPromedio || 0),
          numFmt: '"S/ "#,##0.00',
          sub: 'Por orden confirmada'
        }
      ];

      ws1.getRow(10).height = 18;
      ws1.getRow(11).height = 28;
      ws1.getRow(12).height = 16;
      ws1.getRow(13).height = 14;

      kpis.forEach(k => {
        // Título de la tarjeta (9pt gris oscuro)
        const cellT = ws1.getCell(10, k.col);
        cellT.value = k.title;
        cellT.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLOR_TEXTO_MUTED } };
        cellT.alignment = { vertical: 'middle', horizontal: 'center' };
        cellT.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_BEIGE_KPI } };
        cellT.border = { top: borderCardKpi.top, left: borderCardKpi.left, right: borderCardKpi.right };

        // Valor principal de la tarjeta (14pt negrita)
        const cellV = ws1.getCell(11, k.col);
        cellV.value = k.value;
        if (k.numFmt) cellV.numFmt = k.numFmt;
        cellV.font = {
          name: 'Segoe UI',
          size: 14,
          bold: true,
          color: { argb: k.col === 3 ? COLOR_TERRACOTA : COLOR_CAFE }
        };
        cellV.alignment = { vertical: 'middle', horizontal: 'center' };
        cellV.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_BEIGE_KPI } };
        cellV.border = { left: borderCardKpi.left, right: borderCardKpi.right };

        // Subtítulo contextual de la tarjeta
        const cellS = ws1.getCell(12, k.col);
        cellS.value = k.sub;
        cellS.font = { name: 'Segoe UI', size: 8, italic: true, color: { argb: 'FF9CA3AF' } };
        cellS.alignment = { vertical: 'middle', horizontal: 'center' };
        cellS.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_BEIGE_KPI } };
        cellS.border = { bottom: borderCardKpi.bottom, left: borderCardKpi.left, right: borderCardKpi.right };
      });

      // Distribución Logística (Filas 14 en adelante)
      let curRow = 14;
      ws1.getRow(curRow).height = 22;
      const titDist = ws1.getCell(curRow, 1);
      titDist.value = 'DISTRIBUCIÓN LOGÍSTICA DE PEDIDOS';
      titDist.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: COLOR_TERRACOTA } };
      titDist.alignment = { vertical: 'middle', horizontal: 'left' };

      curRow++;
      ws1.getRow(curRow).height = 24;
      const distHeaders = ['Estado', 'Cantidad de Órdenes', 'Porcentaje (%)'];
      distHeaders.forEach((dh, idx) => {
        const c = ws1.getCell(curRow, idx + 1);
        c.value = dh;
        c.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        c.alignment = { vertical: 'middle', horizontal: idx === 0 ? 'left' : 'right' };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_CAFE } };
        c.border = borderFino;
      });

      let sumCantDist = 0;
      this.estadosPedidos.forEach((ep, idx) => {
        curRow++;
        sumCantDist += ep.cantidad;
        ws1.getRow(curRow).height = 20;
        const bg = idx % 2 === 0 ? COLOR_ZEBRA_BLANCO : COLOR_ZEBRA_GRIS;

        const c1 = ws1.getCell(curRow, 1);
        c1.value = ep.nombre;
        c1.alignment = { vertical: 'middle', horizontal: 'left' };

        const c2 = ws1.getCell(curRow, 2);
        c2.value = ep.cantidad;
        c2.numFmt = '#,##0';
        c2.alignment = { vertical: 'middle', horizontal: 'right' };

        const c3 = ws1.getCell(curRow, 3);
        c3.value = (ep.porcentaje || 0) / 100;
        c3.numFmt = '0.0%';
        c3.alignment = { vertical: 'middle', horizontal: 'right' };

        [c1, c2, c3].forEach(cell => {
          cell.font = { name: 'Segoe UI', size: 10, color: { argb: COLOR_TEXTO_TITULO } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
          cell.border = borderFino;
        });
      });

      // Fila Total Distribución
      curRow++;
      ws1.getRow(curRow).height = 22;
      const td1 = ws1.getCell(curRow, 1);
      td1.value = 'TOTAL GENERAL';
      td1.alignment = { vertical: 'middle', horizontal: 'left' };

      const td2 = ws1.getCell(curRow, 2);
      td2.value = sumCantDist;
      td2.numFmt = '#,##0';
      td2.alignment = { vertical: 'middle', horizontal: 'right' };

      const td3 = ws1.getCell(curRow, 3);
      td3.value = 1.0;
      td3.numFmt = '0.0%';
      td3.alignment = { vertical: 'middle', horizontal: 'right' };

      [td1, td2, td3].forEach(c => {
        c.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLOR_TEXTO_TITULO } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TOTAL_BG } };
        c.border = borderFino;
      });

      // Spacer
      curRow++;
      ws1.getRow(curRow).height = 14;

      // Ranking de Ventas por Producto
      curRow++;
      ws1.getRow(curRow).height = 22;
      const titRank = ws1.getCell(curRow, 1);
      titRank.value = 'RANKING DE VENTAS POR PRODUCTO';
      titRank.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: COLOR_TERRACOTA } };
      titRank.alignment = { vertical: 'middle', horizontal: 'left' };

      curRow++;
      ws1.getRow(curRow).height = 24;
      const rankHeaders = ['Puesto', 'Producto', 'Categoría', 'Unidades Vendidas', 'Total Recaudado'];
      rankHeaders.forEach((rh, idx) => {
        const c = ws1.getCell(curRow, idx + 1);
        c.value = rh;
        c.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        c.alignment = {
          vertical: 'middle',
          horizontal: idx === 0 ? 'center' : (idx === 1 || idx === 2 ? 'left' : 'right')
        };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TERRACOTA } };
        c.border = borderFino;
      });

      const totalUnidades = this.bestsellers.reduce((acc, item) => acc + item.unidades, 0);
      const totalRecaudado = this.bestsellers.reduce((acc, item) => acc + item.ingresos, 0);

      if (this.bestsellers.length > 0) {
        this.bestsellers.forEach((item, idx) => {
          curRow++;
          ws1.getRow(curRow).height = 20;
          const bg = idx % 2 === 0 ? COLOR_ZEBRA_BLANCO : COLOR_ZEBRA_GRIS;

          const c1 = ws1.getCell(curRow, 1);
          c1.value = `#${idx + 1}`;
          c1.alignment = { vertical: 'middle', horizontal: 'center' };

          const c2 = ws1.getCell(curRow, 2);
          c2.value = item.nombre;
          c2.alignment = { vertical: 'middle', horizontal: 'left' };

          const c3 = ws1.getCell(curRow, 3);
          c3.value = item.categoria;
          c3.alignment = { vertical: 'middle', horizontal: 'left' };

          const c4 = ws1.getCell(curRow, 4);
          c4.value = item.unidades;
          c4.numFmt = '#,##0';
          c4.alignment = { vertical: 'middle', horizontal: 'right' };

          const c5 = ws1.getCell(curRow, 5);
          c5.value = Number(item.ingresos.toFixed(2));
          c5.numFmt = '"S/ "#,##0.00';
          c5.alignment = { vertical: 'middle', horizontal: 'right' };

          [c1, c2, c3, c4, c5].forEach(c => {
            c.font = { name: 'Segoe UI', size: 10, color: { argb: COLOR_TEXTO_TITULO } };
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
            c.border = borderFino;
          });
        });
      } else {
        curRow++;
        ws1.getRow(curRow).height = 20;
        const c1 = ws1.getCell(curRow, 1);
        c1.value = '-';
        c1.alignment = { vertical: 'middle', horizontal: 'center' };
        const c2 = ws1.getCell(curRow, 2);
        c2.value = 'Sin ventas registradas en el periodo';
        c2.alignment = { vertical: 'middle', horizontal: 'left' };
        const c3 = ws1.getCell(curRow, 3);
        c3.value = '-';
        c3.alignment = { vertical: 'middle', horizontal: 'center' };
        const c4 = ws1.getCell(curRow, 4);
        c4.value = 0;
        c4.numFmt = '#,##0';
        c4.alignment = { vertical: 'middle', horizontal: 'right' };
        const c5 = ws1.getCell(curRow, 5);
        c5.value = 0;
        c5.numFmt = '"S/ "#,##0.00';
        c5.alignment = { vertical: 'middle', horizontal: 'right' };

        [c1, c2, c3, c4, c5].forEach(c => {
          c.font = { name: 'Segoe UI', size: 10, color: { argb: COLOR_TEXTO_MUTED } };
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ZEBRA_BLANCO } };
          c.border = borderFino;
        });
      }

      // Fila TOTAL CONSOLIDADO Ranking
      curRow++;
      ws1.getRow(curRow).height = 24;
      const tr1 = ws1.getCell(curRow, 1);
      tr1.value = '-';
      tr1.alignment = { vertical: 'middle', horizontal: 'center' };

      const tr2 = ws1.getCell(curRow, 2);
      tr2.value = 'TOTAL CONSOLIDADO';
      tr2.alignment = { vertical: 'middle', horizontal: 'left' };

      const tr3 = ws1.getCell(curRow, 3);
      tr3.value = '-';
      tr3.alignment = { vertical: 'middle', horizontal: 'center' };

      const tr4 = ws1.getCell(curRow, 4);
      tr4.value = totalUnidades;
      tr4.numFmt = '#,##0';
      tr4.alignment = { vertical: 'middle', horizontal: 'right' };

      const tr5 = ws1.getCell(curRow, 5);
      tr5.value = Number(totalRecaudado.toFixed(2));
      tr5.numFmt = '"S/ "#,##0.00';
      tr5.alignment = { vertical: 'middle', horizontal: 'right' };

      [tr1, tr2, tr3, tr4, tr5].forEach(c => {
        c.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLOR_TEXTO_TITULO } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TOTAL_BG } };
        c.border = borderFino;
      });

      // Anchos generosos y holgados Hoja 1 (Col A >= 32 caracteres)
      ws1.columns = [
        { width: 34 },
        { width: 44 },
        { width: 26 },
        { width: 22 },
        { width: 24 }
      ];

      // =========================================================================
      // HOJA 2: DETALLE DE PEDIDOS
      // =========================================================================
      const ws2 = workbook.addWorksheet('Detalle de Pedidos', { views: [{ showGridLines: true }] });
      aplicarBannerCabecera(ws2, 'A1:H2', 'PUNTO Y COMA  •  DETALLE DE PEDIDOS Y AUDITORÍA', 8);

      ws2.getRow(3).height = 10;
      ws2.getRow(4).height = 18;

      const pA4 = ws2.getCell('A4');
      pA4.value = 'Periodo Analizado:';
      pA4.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF374151' } };
      const pB4 = ws2.getCell('B4');
      pB4.value = this.obtenerTextoPeriodo();
      pB4.font = { name: 'Segoe UI', size: 10, color: { argb: COLOR_TEXTO_TITULO } };

      const pE4 = ws2.getCell('E4');
      pE4.value = 'Fecha de Emisión:';
      pE4.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF374151' } };
      const pF4 = ws2.getCell('F4');
      pF4.value = fechaEmision;
      pF4.font = { name: 'Segoe UI', size: 10, color: { argb: COLOR_TEXTO_TITULO } };

      ws2.getRow(5).height = 10;
      ws2.getRow(6).height = 24;

      const pedHeaders = ['ID Pedido', 'Cliente', 'Teléfono', 'Productos', 'Fecha', 'Estado', 'Validación OCR', 'Importe (S/)'];
      pedHeaders.forEach((ph, idx) => {
        const c = ws2.getCell(6, idx + 1);
        c.value = ph;
        c.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        c.alignment = {
          vertical: 'middle',
          horizontal: (idx === 0 || idx === 2 || idx === 4 || idx === 5 || idx === 6) ? 'center' : (idx === 7 ? 'right' : 'left')
        };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_CAFE } };
        c.border = borderFino;
      });

      let pRow = 6;
      let totalMontoDetalle = 0;
      this.pedidosFiltrados.forEach((p, idx) => {
        pRow++;
        const monto = this.obtenerMontoPedido(p);
        totalMontoDetalle += monto;
        ws2.getRow(pRow).height = 20;
        const bg = idx % 2 === 0 ? COLOR_ZEBRA_BLANCO : COLOR_ZEBRA_GRIS;

        const rowCells = [
          { v: String(p.id), a: 'center' as const, bold: false, numFmt: undefined },
          { v: p.cliente || p.nombreCompleto || 'Cliente', a: 'left' as const, bold: false, numFmt: undefined },
          { v: p.telefono || p.telefonoContacto || '-', a: 'center' as const, bold: false, numFmt: undefined },
          { v: this.formatearDetalleProductos(p), a: 'left' as const, bold: false, numFmt: undefined },
          { v: this.formatearFechaCorta(p), a: 'center' as const, bold: false, numFmt: undefined },
          { v: (p.estado || '').toUpperCase(), a: 'center' as const, bold: true, numFmt: undefined },
          { v: p.validacion || p.ocr || p.resultadoConciliacion || 'Conforme OCR', a: 'center' as const, bold: false, numFmt: undefined },
          { v: Number(monto.toFixed(2)), a: 'right' as const, bold: false, numFmt: '"S/ "#,##0.00' }
        ];

        rowCells.forEach((rc, cIdx) => {
          const cell = ws2.getCell(pRow, cIdx + 1);
          cell.value = rc.v;
          if (rc.numFmt) cell.numFmt = rc.numFmt;
          cell.font = { name: 'Segoe UI', size: 10, bold: rc.bold, color: { argb: COLOR_TEXTO_TITULO } };
          cell.alignment = { vertical: 'middle', horizontal: rc.a };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
          cell.border = borderFino;
        });
      });

      // Fila TOTAL CONSOLIDADO Pedidos
      pRow++;
      ws2.getRow(pRow).height = 24;
      const tp1 = ws2.getCell(pRow, 1);
      tp1.value = '-';
      tp1.alignment = { vertical: 'middle', horizontal: 'center' };

      const tp2 = ws2.getCell(pRow, 2);
      tp2.value = 'TOTAL CONSOLIDADO';
      tp2.alignment = { vertical: 'middle', horizontal: 'left' };

      const tp3 = ws2.getCell(pRow, 3);
      tp3.value = '-';
      tp3.alignment = { vertical: 'middle', horizontal: 'center' };

      const tp4 = ws2.getCell(pRow, 4);
      tp4.value = `${this.pedidosFiltrados.length} órdenes registradas`;
      tp4.alignment = { vertical: 'middle', horizontal: 'left' };

      const tp5 = ws2.getCell(pRow, 5);
      tp5.value = '-';
      tp5.alignment = { vertical: 'middle', horizontal: 'center' };

      const tp6 = ws2.getCell(pRow, 6);
      tp6.value = '-';
      tp6.alignment = { vertical: 'middle', horizontal: 'center' };

      const tp7 = ws2.getCell(pRow, 7);
      tp7.value = '-';
      tp7.alignment = { vertical: 'middle', horizontal: 'center' };

      const tp8 = ws2.getCell(pRow, 8);
      tp8.value = Number(totalMontoDetalle.toFixed(2));
      tp8.numFmt = '"S/ "#,##0.00';
      tp8.alignment = { vertical: 'middle', horizontal: 'right' };

      [tp1, tp2, tp3, tp4, tp5, tp6, tp7, tp8].forEach(c => {
        c.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLOR_TEXTO_TITULO } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TOTAL_BG } };
        c.border = borderFino;
      });

      // Anchos generosos Hoja 2
      ws2.columns = [
        { width: 18 },
        { width: 30 },
        { width: 18 },
        { width: 48 },
        { width: 16 },
        { width: 18 },
        { width: 24 },
        { width: 20 }
      ];

      // =========================================================================
      // HOJA 3: BALANCE DE INVENTARIO
      // =========================================================================
      const ws3 = workbook.addWorksheet('Balance de Inventario', { views: [{ showGridLines: true }] });
      aplicarBannerCabecera(ws3, 'A1:F2', 'PUNTO Y COMA  •  BALANCE GENERAL DE INVENTARIO Y STOCK', 6);

      ws3.getRow(3).height = 10;
      ws3.getRow(4).height = 18;

      const iA4 = ws3.getCell('A4');
      iA4.value = 'Fecha de Consulta:';
      iA4.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF374151' } };
      const iB4 = ws3.getCell('B4');
      iB4.value = fechaEmision;
      iB4.font = { name: 'Segoe UI', size: 10, color: { argb: COLOR_TEXTO_TITULO } };

      const iD4 = ws3.getCell('D4');
      iD4.value = 'Control Logístico:';
      iD4.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF374151' } };
      const iE4 = ws3.getCell('E4');
      iE4.value = 'Existencias físicas registradas en catálogo';
      iE4.font = { name: 'Segoe UI', size: 10, color: { argb: COLOR_TEXTO_TITULO } };

      ws3.getRow(5).height = 10;
      ws3.getRow(6).height = 24;

      const invHeaders = ['SKU', 'Producto', 'Categoría', 'Stock Físico', 'Estado Stock', 'Precio Unitario (S/)'];
      invHeaders.forEach((ih, idx) => {
        const c = ws3.getCell(6, idx + 1);
        c.value = ih;
        c.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        c.alignment = {
          vertical: 'middle',
          horizontal: (idx === 0 || idx === 4) ? 'center' : (idx === 1 || idx === 2 ? 'left' : 'right')
        };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_CAFE } };
        c.border = borderFino;
      });

      let iRow = 6;
      let totalStockFisico = 0;
      const catalogo = this.productosDb && this.productosDb.length > 0 ? this.productosDb : [];

      catalogo.forEach((p, idx) => {
        iRow++;
        const stock = Number(p.stock ?? 0);
        totalStockFisico += stock;
        ws3.getRow(iRow).height = 20;
        const bg = idx % 2 === 0 ? COLOR_ZEBRA_BLANCO : COLOR_ZEBRA_GRIS;

        let cond = 'Óptimo';
        let condColor = 'FF059669';
        if (stock === 0) {
          cond = 'Agotado (Crítico)';
          condColor = 'FFDC2626';
        } else if (stock <= 5) {
          cond = 'Bajo stock (Alerta)';
          condColor = 'FFD97706';
        }

        const precio = Number(p.precio ?? 0);

        const c1 = ws3.getCell(iRow, 1);
        c1.value = p.sku || `PC-${String(idx + 1).padStart(3, '0')}`;
        c1.alignment = { vertical: 'middle', horizontal: 'center' };

        const c2 = ws3.getCell(iRow, 2);
        c2.value = this.formatearNombreProducto(p.nombre);
        c2.alignment = { vertical: 'middle', horizontal: 'left' };

        const c3 = ws3.getCell(iRow, 3);
        c3.value = p.categoria || 'General';
        c3.alignment = { vertical: 'middle', horizontal: 'left' };

        const c4 = ws3.getCell(iRow, 4);
        c4.value = stock;
        c4.numFmt = '#,##0';
        c4.alignment = { vertical: 'middle', horizontal: 'right' };

        const c5 = ws3.getCell(iRow, 5);
        c5.value = cond;
        c5.alignment = { vertical: 'middle', horizontal: 'center' };

        const c6 = ws3.getCell(iRow, 6);
        c6.value = Number(precio.toFixed(2));
        c6.numFmt = '"S/ "#,##0.00';
        c6.alignment = { vertical: 'middle', horizontal: 'right' };

        [c1, c2, c3, c4, c6].forEach(c => {
          c.font = { name: 'Segoe UI', size: 10, color: { argb: COLOR_TEXTO_TITULO } };
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
          c.border = borderFino;
        });

        c5.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: condColor } };
        c5.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        c5.border = borderFino;
      });

      // Fila TOTAL CONSOLIDADO Inventario
      iRow++;
      ws3.getRow(iRow).height = 24;
      const ti1 = ws3.getCell(iRow, 1);
      ti1.value = '-';
      ti1.alignment = { vertical: 'middle', horizontal: 'center' };

      const ti2 = ws3.getCell(iRow, 2);
      ti2.value = 'TOTAL CONSOLIDADO';
      ti2.alignment = { vertical: 'middle', horizontal: 'left' };

      const ti3 = ws3.getCell(iRow, 3);
      ti3.value = `${catalogo.length} artículos en catálogo`;
      ti3.alignment = { vertical: 'middle', horizontal: 'left' };

      const ti4 = ws3.getCell(iRow, 4);
      ti4.value = totalStockFisico;
      ti4.numFmt = '#,##0';
      ti4.alignment = { vertical: 'middle', horizontal: 'right' };

      const ti5 = ws3.getCell(iRow, 5);
      ti5.value = '-';
      ti5.alignment = { vertical: 'middle', horizontal: 'center' };

      const ti6 = ws3.getCell(iRow, 6);
      ti6.value = '-';
      ti6.alignment = { vertical: 'middle', horizontal: 'center' };

      [ti1, ti2, ti3, ti4, ti5, ti6].forEach(c => {
        c.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLOR_TEXTO_TITULO } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TOTAL_BG } };
        c.border = borderFino;
      });

      // Anchos generosos Hoja 3
      ws3.columns = [
        { width: 18 },
        { width: 38 },
        { width: 26 },
        { width: 18 },
        { width: 24 },
        { width: 22 }
      ];

      // Generar buffer nativo y disparar descarga mediante saveAs (FileSaver)
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      saveAs(blob, nombreArchivo);

      this.mostrarNotificacion(`Reporte Excel corporativo generado con éxito: ${nombreArchivo}`, false, 4000);
    } catch (err) {
      console.error('Error al generar Excel nativo con ExcelJS, aplicando fallback CSV:', err);
      this.exportarCsvFallback();
    } finally {
      this.isExportingExcel = false;
    }
  }

    private exportarCsvFallback() {
    const fechaHoy = new Date().toISOString().slice(0, 10);
    const nombreArchivo = `Reporte_Ventas_PuntoYComa_${fechaHoy}.csv`;
    const lineas: string[] = [];
    lineas.push('PUNTO Y COMA - REPORTE EJECUTIVO DE RENDIMIENTO Y VENTAS');
    lineas.push(`Periodo Analizado;${this.obtenerTextoPeriodo()}`);
    lineas.push(`Fecha de Emisión;${new Date().toLocaleString('es-PE')}`);
    lineas.push(`Categoría;${this.obtenerTextoCategoria()}`);
    lineas.push(`Estado;${this.obtenerTextoEstado()}`);
    lineas.push('');
    lineas.push('RESUMEN EJECUTIVO (KPIS CLAVE)');
    lineas.push(`Total Pedidos;${this.metricas.totalPedidos}`);
    lineas.push(`Pedidos Confirmados;${this.metricas.pedidosConfirmados}`);
    lineas.push(`Ingresos Totales (S/);${this.metricas.ingresosTotales.toFixed(2)}`);
    lineas.push(`Ticket Promedio (S/);${this.metricas.ticketPromedio.toFixed(2)}`);
    lineas.push('');
    lineas.push('DISTRIBUCIÓN LOGÍSTICA');
    lineas.push('Estado;Cantidad;Porcentaje');
    this.estadosPedidos.forEach(e => lineas.push(`${e.nombre};${e.cantidad};${e.porcentaje}%`));
    lineas.push('');
    lineas.push('RANKING DE VENTAS POR PRODUCTO');
    lineas.push('Puesto;Producto;Categoría;Unidades Vendidas;Total Recaudado (S/)');
    const totalUnidades = this.bestsellers.reduce((acc, item) => acc + item.unidades, 0);
    const totalRecaudado = this.bestsellers.reduce((acc, item) => acc + item.ingresos, 0);
    this.bestsellers.forEach((item, idx) => {
      lineas.push(`#${idx + 1};${item.nombre};${item.categoria};${item.unidades};${item.ingresos.toFixed(2)}`);
    });
    lineas.push(`TOTAL;TOTAL CONSOLIDADO;-;${totalUnidades};${totalRecaudado.toFixed(2)}`);
    lineas.push('');
    lineas.push('DETALLE DE PEDIDOS');
    lineas.push('ID Pedido;Cliente;Teléfono;Productos;Fecha;Estado;Validación;Importe');
    this.pedidosFiltrados.forEach(p => {
      lineas.push(`${p.id};${p.cliente || p.nombreCompleto};${p.telefono || '-'};${this.formatearDetalleProductos(p)};${this.formatearFechaCorta(p)};${p.estado};${p.validacion || 'Conforme'};${this.obtenerMontoPedido(p).toFixed(2)}`);
    });

    const csvString = '\uFEFF' + lineas.join('\r\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  exportarPDF() {
    // 1. Validación previa a la exportación (Prevención de descargas vacías)
    if (!this.pedidosFiltrados || this.pedidosFiltrados.length === 0 || this.metricas.totalPedidos === 0) {
      this.isExportingPdf = false;
      this.mostrarNotificacion(
        'No existen datos registrados en el rango seleccionado para generar el reporte. Por favor, amplía el rango de fechas o restablece los filtros para continuar.',
        true,
        7000
      );
      return;
    }

    if (this.isExportingPdf) return;
    this.isExportingPdf = true;

    setTimeout(() => {
      try {
        const fechaHoy = new Date().toISOString().slice(0, 10);
        const nombreArchivo = `Reporte_Ventas_PuntoYComa_${fechaHoy}.pdf`;
        const fechaEmision = new Date().toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });

        const doc = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 14;
        const contentWidth = pageWidth - margin * 2;

        // 1. Cabecera Corporativa Punto y Coma
        doc.setFillColor(44, 24, 16); // #2C1810 marrón café
        doc.rect(0, 0, pageWidth, 5, 'F');

        doc.setFillColor(194, 94, 46); // #C25E2E terracota
        doc.rect(0, 5, pageWidth, 1.5, 'F');

        let currentY = 16;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(44, 24, 16);
        doc.text('Punto y Coma', margin, currentY);

        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(139, 94, 60);
        doc.text('ARTESANÍA & CERÁMICA CONTEMPORÁNEA', margin + 46, currentY - 1);

        currentY += 6;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(50, 50, 50);
        doc.text('Reporte Ejecutivo de Rendimiento y Ventas', margin, currentY);

        // Fecha de emisión alineada a la derecha
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(100, 100, 100);
        doc.text(`Emisión: ${fechaEmision}`, pageWidth - margin, currentY - 6, { align: 'right' });
        doc.text('Sistema de Gestión Punto y Coma', pageWidth - margin, currentY, { align: 'right' });

        // Línea divisoria
        currentY += 4;
        doc.setDrawColor(220, 210, 200);
        doc.setLineWidth(0.5);
        doc.line(margin, currentY, pageWidth - margin, currentY);

        // 2. Metadatos y Filtros Aplicados (Caja sutil con 2 líneas para máxima legibilidad)
        currentY += 5;
        const filterBoxHeight = 17;
        doc.setFillColor(250, 248, 245);
        doc.setDrawColor(230, 222, 212);
        doc.roundedRect(margin, currentY, contentWidth, filterBoxHeight, 2, 2, 'FD');

        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(110, 80, 60);
        doc.text('PARÁMETROS Y FILTROS APLICADOS:', margin + 4, currentY + 4.8);

        // Fila 1: Periodo analizado completo
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(70, 70, 70);
        doc.text('Periodo Analizado:', margin + 4, currentY + 9.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40, 40, 40);
        const txtPeriodo = this.obtenerTextoPeriodo();
        doc.text(txtPeriodo.length > 55 ? txtPeriodo.slice(0, 53) + '...' : txtPeriodo, margin + 30, currentY + 9.5);

        // Fila 2: Categoría, Estado y Búsqueda
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(70, 70, 70);
        doc.text('Categoría:', margin + 4, currentY + 14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40, 40, 40);
        const txtCat = this.obtenerTextoCategoria();
        doc.text(txtCat.length > 25 ? txtCat.slice(0, 23) + '...' : txtCat, margin + 18, currentY + 14);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(70, 70, 70);
        doc.text('Estado:', margin + 70, currentY + 14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40, 40, 40);
        const txtEst = this.obtenerTextoEstado();
        doc.text(txtEst.length > 20 ? txtEst.slice(0, 18) + '...' : txtEst, margin + 81, currentY + 14);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(70, 70, 70);
        doc.text('Búsqueda:', margin + 125, currentY + 14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40, 40, 40);
        const txtBusq = this.filtroProducto.trim() || 'Todos los artículos';
        doc.text(txtBusq.length > 20 ? txtBusq.slice(0, 18) + '...' : txtBusq, margin + 141, currentY + 14);

        // 3. Resumen Ejecutivo (KPIs Clave)
        currentY += filterBoxHeight + 5;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(44, 24, 16);
        doc.text('RESUMEN EJECUTIVO (KPIS)', margin, currentY);

        currentY += 3;
        const cardGap = 3;
        const cardWidth = (contentWidth - cardGap * 3) / 4;
        const cardHeight = 19;

        const kpis = [
          { label: 'TOTAL PEDIDOS', valor: String(this.metricas.totalPedidos), sub: 'Órdenes en periodo', color: [44, 24, 16] },
          { label: 'CONFIRMADOS', valor: String(this.metricas.pedidosConfirmados), sub: 'Validación conforme', color: [16, 185, 129] },
          { label: 'INGRESOS TOTALES', valor: `S/ ${this.metricas.ingresosTotales.toFixed(2)}`, sub: 'Recaudación neta', color: [194, 94, 46] },
          { label: 'TICKET PROMEDIO', valor: `S/ ${this.metricas.ticketPromedio.toFixed(2)}`, sub: 'Por orden confirmada', color: [139, 94, 60] }
        ];

        kpis.forEach((kpi, i) => {
          const x = margin + i * (cardWidth + cardGap);
          doc.setFillColor(252, 250, 248);
          doc.setDrawColor(230, 222, 212);
          doc.roundedRect(x, currentY, cardWidth, cardHeight, 1.5, 1.5, 'FD');

          doc.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2]);
          doc.rect(x, currentY, 1.8, cardHeight, 'F');

          doc.setFontSize(6.8);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(120, 110, 100);
          doc.text(kpi.label, x + 4, currentY + 4.8);

          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
          doc.text(kpi.valor, x + 4, currentY + 11.5);

          doc.setFontSize(6.5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(140, 130, 120);
          doc.text(kpi.sub, x + 4, currentY + 16);
        });

        // 4. Desglose de Distribución Logística
        currentY += cardHeight + 6;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(44, 24, 16);
        doc.text('DISTRIBUCIÓN LOGÍSTICA POR ESTADO', margin, currentY);

        currentY += 3;
        const colorPalette: Record<string, { bg: number[], border: number[], text: number[] }> = {
          'validado': { bg: [236, 253, 245], border: [167, 243, 208], text: [6, 95, 70] },
          'en revisión': { bg: [255, 247, 237], border: [254, 215, 170], text: [154, 52, 18] },
          'rechazado': { bg: [254, 242, 242], border: [254, 202, 202], text: [153, 27, 27] },
          'pendiente': { bg: [254, 243, 199], border: [253, 230, 138], text: [146, 64, 14] }
        };

        this.estadosPedidos.forEach((d, i) => {
          const x = margin + i * (cardWidth + cardGap);
          const stKey = d.nombre.toLowerCase().trim();
          const theme = colorPalette[stKey] || { bg: [245, 245, 245], border: [220, 220, 220], text: [60, 60, 60] };

          doc.setFillColor(theme.bg[0], theme.bg[1], theme.bg[2]);
          doc.setDrawColor(theme.border[0], theme.border[1], theme.border[2]);
          doc.roundedRect(x, currentY, cardWidth, 12, 1.5, 1.5, 'FD');

          doc.setFontSize(7.5);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(theme.text[0], theme.text[1], theme.text[2]);
          doc.text(d.nombre, x + 3.5, currentY + 5);

          doc.setFontSize(8.5);
          doc.text(`${d.cantidad} órdenes (${d.porcentaje}%)`, x + 3.5, currentY + 9.5);
        });

        // 5. Tabla Detallada del Ranking de Ventas por Producto
        currentY += 18;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(44, 24, 16);
        doc.text('RANKING DE VENTAS POR ARTÍCULO / PRODUCTO', margin, currentY);

        const totalUnidades = this.bestsellers.reduce((acc, item) => acc + item.unidades, 0);
        const totalRecaudado = this.bestsellers.reduce((acc, item) => acc + item.ingresos, 0);

        const tableBody = this.bestsellers.length > 0
          ? this.bestsellers.map((b, idx) => [
              `#${idx + 1}`,
              b.nombre,
              b.categoria,
              String(b.unidades),
              `S/ ${b.ingresos.toFixed(2)}`
            ])
          : [['-', 'Sin ventas registradas en el periodo', '-', '0', 'S/ 0.00']];

        autoTable(doc, {
          startY: currentY + 3,
          margin: { left: margin, right: margin },
          head: [['Puesto', 'Producto', 'Categoría', 'Unidades Vendidas', 'Total Recaudado (S/)']],
          body: tableBody,
          foot: [['TOTAL', 'TOTAL CONSOLIDADO', '-', String(totalUnidades), `S/ ${totalRecaudado.toFixed(2)}`]],
          theme: 'plain',
          headStyles: {
            fillColor: [44, 24, 16],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 8.5,
            halign: 'left'
          },
          columnStyles: {
            0: { cellWidth: 16, halign: 'center' },
            1: { cellWidth: 70, halign: 'left', fontStyle: 'bold' },
            2: { cellWidth: 36, halign: 'left' },
            3: { cellWidth: 30, halign: 'center' },
            4: { cellWidth: 30, halign: 'right', fontStyle: 'bold' }
          },
          footStyles: {
            fillColor: [242, 237, 230],
            textColor: [44, 24, 16],
            fontStyle: 'bold',
            fontSize: 9,
            halign: 'left'
          },
          styles: {
            fontSize: 8.5,
            cellPadding: 3,
            textColor: [50, 50, 50],
            lineColor: [230, 222, 212],
            lineWidth: 0.2
          },
          alternateRowStyles: {
            fillColor: [252, 250, 248]
          }
        });

        // Helper para agregar títulos de sección con gestión de salto de página
        const agregarTituloSeccion = (titulo: string): number => {
          const lastY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : currentY;
          if (lastY + 35 > pageHeight - margin) {
            doc.addPage();
            currentY = 18;
          } else {
            currentY = lastY + 10;
          }
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(44, 24, 16);
          doc.text(titulo, margin, currentY);
          return currentY + 3;
        };

        // ==========================================
        // TABLA 1: DETALLE DE PEDIDOS CONFIRMADOS / VALIDADOS
        // ==========================================
        let nextY = agregarTituloSeccion('1. DETALLE DE PEDIDOS CONFIRMADOS / VALIDADOS');
        const confirmados = this.pedidosFiltrados.filter(p => {
          const st = (p.estado || '').toLowerCase().trim();
          return st === 'validado' || st === 'confirmado';
        });
        const totalConfirmados = confirmados.reduce((a, b) => a + this.obtenerMontoPedido(b), 0);

        const confirmadosBody = confirmados.length > 0
          ? confirmados.map(p => [
              String(p.id),
              p.cliente || p.nombreCompleto || 'Cliente',
              p.telefono || p.telefonoContacto || '-',
              this.formatearDetalleProductos(p),
              this.formatearFechaCorta(p),
              p.validacion || p.ocr || p.resultadoConciliacion || 'Conforme OCR',
              `S/ ${this.obtenerMontoPedido(p).toFixed(2)}`
            ])
          : [['-', 'No se registran pedidos confirmados en el periodo', '-', '-', '-', '-', 'S/ 0.00']];

        autoTable(doc, {
          startY: nextY,
          margin: { left: margin, right: margin },
          head: [['ID Pedido', 'Cliente', 'Teléfono', 'Productos / Detalle', 'Fecha', 'Validación OCR', 'Total (S/)']],
          body: confirmadosBody,
          foot: [['TOTAL', 'TOTAL CONFIRMADOS', '-', '-', '-', `${confirmados.length} órdenes`, `S/ ${totalConfirmados.toFixed(2)}`]],
          theme: 'plain',
          headStyles: { fillColor: [6, 95, 70], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
          columnStyles: {
            0: { cellWidth: 32, fontStyle: 'bold' },
            1: { cellWidth: 26 },
            2: { cellWidth: 22 },
            3: { cellWidth: 40 },
            4: { cellWidth: 20, halign: 'center' },
            5: { cellWidth: 24 },
            6: { cellWidth: 18, halign: 'right', fontStyle: 'bold' }
          },
          footStyles: { fillColor: [236, 253, 245], textColor: [6, 95, 70], fontStyle: 'bold', fontSize: 8.5 },
          styles: { fontSize: 7.8, cellPadding: 2.5, textColor: [50, 50, 50], lineColor: [230, 222, 212], lineWidth: 0.2 },
          alternateRowStyles: { fillColor: [250, 252, 250] }
        });

        // ==========================================
        // TABLA 2: PEDIDOS EN REVISIÓN E INCIDENCIAS
        // ==========================================
        nextY = agregarTituloSeccion('2. PEDIDOS EN REVISIÓN E INCIDENCIAS PENDIENTES');
        const enRevision = this.pedidosFiltrados.filter(p => {
          const st = (p.estado || '').toLowerCase().trim();
          return st === 'en revision' || st === 'en revisión';
        });

        const revisionBody = enRevision.length > 0
          ? enRevision.map(p => [
              String(p.id),
              p.cliente || p.nombreCompleto || 'Cliente',
              p.telefono || p.telefonoContacto || '-',
              p.motivo || this.formatearDetalleProductos(p) || 'Validación de comprobante requerida',
              this.formatearFechaCorta(p),
              `S/ ${this.obtenerMontoPedido(p).toFixed(2)}`
            ])
          : [['-', 'Sin pedidos en revisión en este periodo', '-', '-', '-', 'S/ 0.00']];

        autoTable(doc, {
          startY: nextY,
          margin: { left: margin, right: margin },
          head: [['ID Pedido', 'Cliente', 'Teléfono', 'Detalle / Motivo', 'Fecha', 'Monto Esperado (S/)']],
          body: revisionBody,
          theme: 'plain',
          headStyles: { fillColor: [154, 52, 18], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
          columnStyles: {
            0: { cellWidth: 32, fontStyle: 'bold' },
            1: { cellWidth: 30 },
            2: { cellWidth: 25 },
            3: { cellWidth: 50 },
            4: { cellWidth: 20, halign: 'center' },
            5: { cellWidth: 25, halign: 'right', fontStyle: 'bold' }
          },
          styles: { fontSize: 7.8, cellPadding: 2.5, textColor: [50, 50, 50], lineColor: [230, 222, 212], lineWidth: 0.2 },
          alternateRowStyles: { fillColor: [255, 250, 245] }
        });

        // ==========================================
        // TABLA 3: PEDIDOS RECHAZADOS
        // ==========================================
        nextY = agregarTituloSeccion('3. PEDIDOS RECHAZADOS');
        const rechazados = this.pedidosFiltrados.filter(p => (p.estado || '').toLowerCase().trim() === 'rechazado');

        const rechazadosBody = rechazados.length > 0
          ? rechazados.map(p => [
              String(p.id),
              p.cliente || p.nombreCompleto || 'Cliente',
              this.formatearFechaCorta(p),
              p.motivoRechazo || p.motivo || 'Comprobante no válido / Operación rechazada',
              `S/ ${this.obtenerMontoPedido(p).toFixed(2)}`
            ])
          : [['-', 'No se registran pedidos rechazados en el periodo seleccionado', '-', '-', 'S/ 0.00']];

        autoTable(doc, {
          startY: nextY,
          margin: { left: margin, right: margin },
          head: [['ID Pedido', 'Cliente', 'Fecha', 'Motivo de Rechazo', 'Monto (S/)']],
          body: rechazadosBody,
          theme: 'plain',
          headStyles: { fillColor: [153, 27, 27], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
          columnStyles: {
            0: { cellWidth: 32, fontStyle: 'bold' },
            1: { cellWidth: 36 },
            2: { cellWidth: 24, halign: 'center' },
            3: { cellWidth: 62 },
            4: { cellWidth: 28, halign: 'right', fontStyle: 'bold' }
          },
          styles: { fontSize: 7.8, cellPadding: 2.5, textColor: [50, 50, 50], lineColor: [230, 222, 212], lineWidth: 0.2 },
          alternateRowStyles: { fillColor: [255, 248, 248] }
        });

        // ==========================================
        // TABLA 4: BALANCE DE INVENTARIO Y STOCK FÍSICO
        // ==========================================
        nextY = agregarTituloSeccion('4. BALANCE DE INVENTARIO Y STOCK FÍSICO');
        const catalogo = this.productosDb && this.productosDb.length > 0 ? this.productosDb : [];

        const invBody = catalogo.map((p, idx) => {
          const s = Number(p.stock ?? 0);
          let cond = 'Óptimo';
          if (s === 0) cond = 'Agotado (Crítico)';
          else if (s <= 5) cond = 'Bajo stock (Alerta)';
          return [
            p.sku || `PC-${idx + 1}`,
            this.formatearNombreProducto(p.nombre),
            p.categoria || 'General',
            `${s} u.`,
            cond
          ];
        });

        autoTable(doc, {
          startY: nextY,
          margin: { left: margin, right: margin },
          head: [['SKU', 'Producto', 'Categoría', 'Stock Físico', 'Estado del Stock']],
          body: invBody.length > 0 ? invBody : [['-', 'Sin artículos en catálogo', '-', '0 u.', 'Agotado']],
          theme: 'plain',
          headStyles: { fillColor: [44, 24, 16], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
          columnStyles: {
            0: { cellWidth: 20, fontStyle: 'bold', halign: 'center' },
            1: { cellWidth: 65, fontStyle: 'bold' },
            2: { cellWidth: 37 },
            3: { cellWidth: 25, halign: 'center' },
            4: { cellWidth: 35, fontStyle: 'bold' }
          },
          styles: { fontSize: 7.8, cellPadding: 2.5, textColor: [50, 50, 50], lineColor: [230, 222, 212], lineWidth: 0.2 },
          alternateRowStyles: { fillColor: [252, 250, 248] },
          didParseCell: (data: any) => {
            if (data.section === 'body' && (data.column.index === 3 || data.column.index === 4)) {
              const rowText = String(data.row.raw[4] || '');
              if (rowText.includes('Crítico') || rowText.includes('Agotado')) {
                data.cell.styles.textColor = [185, 28, 28]; // Rojo suave
                data.cell.styles.fillColor = [254, 242, 242];
              } else if (rowText.includes('Alerta') || rowText.includes('Bajo')) {
                data.cell.styles.textColor = [194, 94, 46]; // Naranja terracota
                data.cell.styles.fillColor = [255, 247, 237];
              }
            }
          }
        });

        // 6. Pie de Página Corporativo en todas las páginas generadas
        const pageCount = doc.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          doc.setDrawColor(220, 210, 200);
          doc.setLineWidth(0.3);
          doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

          doc.setFontSize(7.5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(140, 130, 120);
          doc.text('Punto y Coma · Reporte de Auditoría Ejecutiva - Confidencial', margin, pageHeight - 7);
          doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
        }

        doc.save(nombreArchivo);
        this.mostrarNotificacion(`Reporte PDF generado y descargado con éxito: ${nombreArchivo}`, false, 4000);
      } catch (err) {
        console.error('Error al generar PDF con jsPDF, aplicando fallback de impresión:', err);
        window.print();
      } finally {
        this.isExportingPdf = false;
      }
    }, 100);
  }

  // Helpers de fechas
  public normalizarFechaEspanol(val: string): Date | null {
    if (!val) return null;
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) return d;
    }
    const meses: Record<string, number> = {
      ene: 0, jan: 0, feb: 1, mar: 2, abr: 3, apr: 3, may: 4,
      jun: 5, jul: 6, ago: 7, aug: 7, sep: 8, set: 8, oct: 9, nov: 10, dic: 11, dec: 11
    };
    const cleaned = trimmed.toLowerCase().replace(/[.,]/g, '');
    const parts = cleaned.split(/\s+/);
    if (parts.length >= 3) {
      const dia = parseInt(parts[0], 10);
      const mesKey = parts[1].slice(0, 3);
      const anio = parseInt(parts[2], 10);
      if (!isNaN(dia) && meses[mesKey] !== undefined && !isNaN(anio)) {
        return new Date(anio, meses[mesKey], dia, 12, 0, 0, 0);
      }
    }
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }

  public obtenerFechaPedidoMs(p: any): number | null {
    if (!p) return null;
    // 1. created_at o fechaIso
    const isoCand = p.created_at || p.fechaIso;
    if (isoCand) {
      const d = new Date(isoCand);
      if (!isNaN(d.getTime())) return d.getTime();
    }
    // 2. fecha formateada en texto (ej. "07 set. 2026")
    if (p.fecha) {
      const d = this.normalizarFechaEspanol(p.fecha);
      if (d && !isNaN(d.getTime())) return d.getTime();
    }
    // 3. Fallback a fechaPago / fecha_pago si no hay fecha principal
    const pagoCand = p.fechaPago || p.fecha_pago;
    if (pagoCand) {
      const d = this.normalizarFechaEspanol(pagoCand);
      if (d && !isNaN(d.getTime())) return d.getTime();
    }
    return null;
  }

  public parsearFecha(fechaVal: any): Date | null {
    if (!fechaVal) return null;
    if (fechaVal instanceof Date && !isNaN(fechaVal.getTime())) return fechaVal;

    if (typeof fechaVal === 'string') {
      const trimmed = fechaVal.trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        const parts = trimmed.split(/[-T\s]/);
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        return new Date(y, m, d);
      }
      return this.normalizarFechaEspanol(trimmed);
    }
    return null;
  }

  public formatDateToInput(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  public formatearNombreProducto(nombre: string | null | undefined): string {
    if (!nombre) return '';
    let res = String(nombre);
    res = res.replace(/Juegod\s*etazas/gi, 'Juego de tazas');
    res = res.replace(/Juego\s*detazas/gi, 'Juego de tazas');
    if (res.toLowerCase().includes('arsilla')) {
      res = res.replace(/arsilla/gi, 'arcilla');
    }
    return res;
  }
}
