import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdminLayoutComponent } from '../admin-layout/admin-layout.component';

export interface ActividadEvento {
  id: string;
  tipo: 'confirmado' | 'pago' | 'nuevo_cliente' | 'agotado' | 'enviado' | 'incompleto';
  titulo: string;
  descripcion: string;
  tiempo: string;
  badgeClass: string;
}

export interface AlertaOperativa {
  id: string;
  nivel: 'urgente' | 'moderado';
  titulo: string;
  detalles: string;
  accionLabel: string;
  ruta: string;
}

export interface ProductoResumen {
  nombre: string;
  sku: string;
  ventas: number;
  stock: number;
  tipo: 'venta' | 'alerta' | 'agotado';
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AdminLayoutComponent],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css'
})
export class AdminDashboardComponent implements OnInit {
  fechaHoy = '';

  // Resumen Rápido de hoy (Operativo)
  stats = {
    pedidosHoy: 0,
    ventasHoy: 0.00,
    chatsPendientes: 0,
    pedidosConfirmados: 0,
    stockBajo: 0
  };

  // Alertas Operativas Críticas (¡Qué resolver AHORA!)
  alertasOperativas: AlertaOperativa[] = [];

  // Actividad Reciente del Día (Lenguaje comercial)
  actividades: ActividadEvento[] = [];

  // Resumen de Pedidos (Estados Rápidos de Operación)
  resumenEstados = [
    { nombre: 'Pendientes', cantidad: 0, porcentaje: 0, clase: 'state-pend' },
    { nombre: 'Confirmados', cantidad: 0, porcentaje: 0, clase: 'state-conf' },
    { nombre: 'En preparación', cantidad: 0, porcentaje: 0, clase: 'state-prep' },
    { nombre: 'Enviados hoy', cantidad: 0, porcentaje: 0, clase: 'state-env' }
  ];

  // Bloque: Productos Claves a Vigilar
  productosDestacados: ProductoResumen[] = [];

  // Beneficios del Asistente (IA Invisible)
  beneficios = [
    {
      titulo: 'Menos tiempo organizando pedidos',
      desc: 'El sistema ordena automáticamente las tazas y vasos elegidos por el cliente según prioridad de entrega.',
      icono: '⏱️'
    },
    {
      titulo: 'Menos errores manuales',
      desc: 'Las alertas inteligentes detectan si falta una dirección o un pago antes de procesar el despacho físico.',
      icono: '🛡️'
    }
  ];

  ngOnInit() {
    const opciones: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    this.fechaHoy = new Date().toLocaleDateString('es-ES', opciones);
  }
}
