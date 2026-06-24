import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdminLayoutComponent } from '../admin-layout/admin-layout.component';

export interface BestsellerReport {
  nombre: string;
  unidades: number;
  ingresos: number;
  categoria: string;
}

@Component({
  selector: 'app-admin-reportes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AdminLayoutComponent],
  templateUrl: './admin-reportes.component.html',
  styleUrl: './admin-reportes.component.css'
})
export class AdminReportesComponent implements OnInit {
  // Filtros Analíticos e Históricos
  filtroRango = 'mes';
  filtroEstado = 'todos';
  filtroCategoria = 'todas';
  filtroProducto = '';

  // Indicadores de Negocio
  metricas = {
    totalPedidos: 0,
    ingresosTotales: 0.00,
    ticketPromedio: 0.00,
    pedidosConfirmados: 0
  };

  comparativas = {
    pedidos: 'Sin datos comparativos',
    ingresos: 'Sin datos comparativos',
    ticket: 'Sin datos comparativos',
    confirmados: 'Sin datos comparativos'
  };

  // Gráfico de Ventas Diarias Ampliado (Coordenadas extendidas para mayor visualización)
  puntosGrafico: any[] = [];

  svgPathVentas = '';

  // Pedidos por Estado
  estadosPedidos = [
    { nombre: 'Validado', cantidad: 0, porcentaje: 0, clase: 'color-conf' },
    { nombre: 'Rechazado', cantidad: 0, porcentaje: 0, clase: 'color-rech' },
    { nombre: 'En revisión', cantidad: 0, porcentaje: 0, clase: 'color-rev' },
    { nombre: 'Pendiente', cantidad: 0, porcentaje: 0, clase: 'color-pend' }
  ];

  // Rankings de Ventas de Catálogo
  bestsellers: BestsellerReport[] = [];

  // Observaciones Estratégicas
  insights: any[] = [];

  ngOnInit() {
    this.generarTrazadoGrafico();
  }

  generarTrazadoGrafico() {
    if (this.puntosGrafico.length > 0) {
      this.svgPathVentas = this.puntosGrafico.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    } else {
      this.svgPathVentas = '';
    }
  }

  ejecutarGeneracionReporte() {
    alert(`📊 Generando reporte analítico... \n\nFiltros aplicados:\n- Rango: ${this.filtroRango}\n- Estado: ${this.filtroEstado}\n- Categoría: ${this.filtroCategoria}`);
    this.metricas.totalPedidos = 0;
    this.metricas.ingresosTotales = 0.00;
    this.metricas.ticketPromedio = 0.00;
    this.metricas.pedidosConfirmados = 0;
  }

  exportarExcel() {
    alert('📥 Descargando archivo "Reporte_Ventas_Mayo_2026.xlsx"... \n\n¡Exportación realizada con éxito!');
  }

  exportarPDF() {
    alert('📥 Generando PDF "Informe_Rendimiento_PuntoYComa.pdf"... \n\n¡Informe listo para imprimir!');
  }
}
