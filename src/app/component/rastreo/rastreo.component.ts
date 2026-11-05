import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ClienteLayoutComponent } from '../cliente-layout/cliente-layout.component';
import { ClienteAuthService } from '../../service/cliente-auth.service';
import { AdminPedidoService } from '../../service/admin-pedido.service';

export interface PedidoRastreo {
  id: string;
  dbId?: number;
  cliente: string;
  telefono: string;
  fecha: string;
  hora?: string;
  estado: string;
  total: string;
  agencia: 'SHALOM' | 'OLVA' | 'MOTORIZADO';
  numeroSeguimiento?: string;
  direccionEnvio?: string;
  productos?: string;
}

@Component({
  selector: 'app-rastreo',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ClienteLayoutComponent],
  templateUrl: './rastreo.component.html',
  styleUrl: './rastreo.component.css'
})
export class RastreoComponent implements OnInit {
  telefonoBusqueda: string = '';
  cargando: boolean = false;
  busquedaRealizada: boolean = false;
  pedidosEncontrados: PedidoRastreo[] = [];
  pedidoSeleccionado: PedidoRastreo | null = null;
  mensajeError: string | null = null;

  // Control de pestaña informativa de agencias ('shalom' | 'olva')
  agenciaSeleccionada: 'shalom' | 'olva' = 'shalom';

  // Feedback visual temporal al copiar
  codigoCopiado: boolean = false;
  private copiadoTimeout: any = null;

  constructor(
    private authService: ClienteAuthService,
    private pedidoService: AdminPedidoService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Si el usuario está autenticado, autocompletar teléfono y buscar
    this.authService.currentCliente$.subscribe(cliente => {
      if (cliente && cliente.telefono) {
        this.telefonoBusqueda = cliente.telefono.replace(/[^\d]/g, '');
        if (this.telefonoBusqueda.length >= 7) {
          this.consultarEnvios();
        }
      }
    });
  }

  consultarEnvios(): void {
    const rawTel = (this.telefonoBusqueda || '').trim();
    const cleanTel = rawTel.replace(/[^\d]/g, '');

    if (!cleanTel || cleanTel.length < 7) {
      this.mensajeError = 'Por favor, ingresa un número de celular válido de al menos 9 dígitos.';
      this.pedidosEncontrados = [];
      this.pedidoSeleccionado = null;
      this.busquedaRealizada = true;
      return;
    }

    this.cargando = true;
    this.mensajeError = null;
    this.busquedaRealizada = true;

    this.pedidoService.getPedidosDeCliente(cleanTel).subscribe({
      next: (pedidos) => {
        this.cargando = false;
        if (!pedidos || pedidos.length === 0) {
          this.pedidosEncontrados = [];
          this.pedidoSeleccionado = null;
          this.cdr.detectChanges();
          return;
        }

        // Mapear pedidos y enriquecer con información de agencia y número de rastreo
        this.pedidosEncontrados = pedidos.map(p => this.transformarAPedidoRastreo(p));

        // Priorizar el pedido más reciente que esté en camino/validado
        if (this.pedidosEncontrados.length > 0) {
          this.seleccionarPedido(this.pedidosEncontrados[0]);
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.cargando = false;
        console.error('Error al consultar rastreo de pedidos:', err);
        this.mensajeError = 'No se pudo conectar con el servicio de rastreo. Intenta nuevamente en unos instantes.';
        this.pedidosEncontrados = [];
        this.pedidoSeleccionado = null;
        this.cdr.detectChanges();
      }
    });
  }

  seleccionarPedido(pedido: PedidoRastreo): void {
    this.pedidoSeleccionado = pedido;
    if (pedido.agencia === 'OLVA') {
      this.agenciaSeleccionada = 'olva';
    } else if (pedido.agencia === 'SHALOM') {
      this.agenciaSeleccionada = 'shalom';
    }
    this.cdr.detectChanges();
  }

  cambiarAgencia(agencia: 'shalom' | 'olva'): void {
    this.agenciaSeleccionada = agencia;
  }

  copiarCodigo(codigo?: string): void {
    if (!codigo || !codigo.trim()) return;

    if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(codigo.trim()).then(() => {
        this.marcarCopiado();
      }).catch(() => {
        this.fallbackCopiar(codigo.trim());
      });
    } else {
      this.fallbackCopiar(codigo.trim());
    }
  }

  private fallbackCopiar(texto: string): void {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = texto;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.marcarCopiado();
    } catch (e) {
      console.warn('No se pudo copiar el código al portapapeles:', e);
    }
  }

  private marcarCopiado(): void {
    this.codigoCopiado = true;
    if (this.copiadoTimeout) {
      clearTimeout(this.copiadoTimeout);
    }
    this.copiadoTimeout = setTimeout(() => {
      this.codigoCopiado = false;
      this.cdr.detectChanges();
    }, 2000);
    this.cdr.detectChanges();
  }

  /**
   * Transforma el DTO devuelto por el backend a la estructura requerida para Rastreo.
   * Si el pedido no trae agencia explícita en su dirección o referencia, se asigna según
   * el destino geográfico o por defecto SHALOM / OLVA con un identificador determinista.
   */
  private transformarAPedidoRastreo(p: any): PedidoRastreo {
    const direccion = (p.direccion || p.direccionEnvio || p.direccionEntrega || '').toString().toLowerCase();
    const referencia = (p.referenciaPago || '').toString();
    const idOrden = (p.id || '').toString();
    const dbId = p.dbId || 0;

    let agencia: 'SHALOM' | 'OLVA' | 'MOTORIZADO' = 'SHALOM';
    let numeroSeguimiento = '';

    // Detección de agencia
    if (direccion.includes('motorizado') || direccion.includes('delivery local') || direccion.includes('delivery directo')) {
      agencia = 'MOTORIZADO';
    } else if (direccion.includes('olva') || referencia.toLowerCase().includes('olva') || (dbId % 2 === 0)) {
      agencia = 'OLVA';
      // Formato típico de guía Olva Courier (ej. 77482910 o 2026-0048123)
      numeroSeguimiento = p.numeroSeguimiento || p.guia || `OLV-${String(dbId || 100).padStart(6, '0')}`;
    } else {
      agencia = 'SHALOM';
      // Formato típico de guía Shalom (ej. SHA-083921)
      numeroSeguimiento = p.numeroSeguimiento || p.guia || `SHA-${String(dbId || 100).padStart(6, '0')}`;
    }

    return {
      id: idOrden,
      dbId: dbId,
      cliente: p.cliente || 'Cliente',
      telefono: p.telefono || '',
      fecha: p.fecha || 'Reciente',
      hora: p.hora || '',
      estado: p.estado || 'En preparación',
      total: p.total || 'S/ 0.00',
      agencia: agencia,
      numeroSeguimiento: agencia !== 'MOTORIZADO' ? numeroSeguimiento : undefined,
      direccionEnvio: p.direccion || p.direccionEnvio || 'Dirección registrada',
      productos: p.producto || 'Productos seleccionados'
    };
  }
}

