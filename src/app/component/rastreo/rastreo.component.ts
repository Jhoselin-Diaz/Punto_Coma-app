import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ClienteLayoutComponent } from '../cliente-layout/cliente-layout.component';
import { ClienteAuthService } from '../../service/cliente-auth.service';
import { AdminPedidoService } from '../../service/admin-pedido.service';
import { ConfiguracionService } from '../../service/configuracion.service';

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
  pedidoActivo: PedidoRastreo | null = null;
  encontrado: boolean = false;
  mensajeError: string | null = null;

  get telefonoInput(): string {
    return this.telefonoBusqueda;
  }
  set telefonoInput(val: string) {
    this.telefonoBusqueda = val;
  }

  // Control de pestaña informativa de agencias ('shalom' | 'olva')
  agenciaSeleccionada: 'shalom' | 'olva' = 'shalom';

  // Feedback visual temporal al copiar
  codigoCopiado: boolean = false;
  private copiadoTimeout: any = null;

  constructor(
    private authService: ClienteAuthService,
    private pedidoService: AdminPedidoService,
    public configService: ConfiguracionService,
    private cdr: ChangeDetectorRef
  ) {}

  get urlShalom(): string {
    return this.configService.negocio.url_rastreo_shalom || 'https://rastreo.shalom.pe/';
  }

  get urlOlva(): string {
    return this.configService.negocio.url_rastreo_olva || 'https://tracking.olvacourier.com/';
  }

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
    const rawTel = (this.telefonoBusqueda || this.telefonoInput || '').trim();
    const telLimpio = rawTel.replace(/\D/g, '');

    if (!telLimpio || telLimpio.length < 7) {
      this.mensajeError = 'Por favor, ingresa un número de celular válido de al menos 9 dígitos.';
      this.pedidosEncontrados = [];
      this.pedidoSeleccionado = null;
      this.pedidoActivo = null;
      this.encontrado = false;
      this.busquedaRealizada = true;
      return;
    }

    this.cargando = true;
    this.mensajeError = null;
    this.busquedaRealizada = true;

    // Llamada directa al endpoint público desprotegido /api/public/rastreo/{telefono}
    this.pedidoService.consultarRastreoPublico(telLimpio).subscribe({
      next: (pedidos) => {
        if (!pedidos || pedidos.length === 0) {
          // Si el usuario escribió 9 dígitos y no hubo coincidencia, intentar inmediatamente con el prefijo "51"
          if (telLimpio.length === 9) {
            this.pedidoService.consultarRastreoPublico('51' + telLimpio).subscribe({
              next: (pedidos51) => {
                this.cargando = false;
                this.procesarPedidos(pedidos51 || []);
              },
              error: () => {
                this.cargando = false;
                this.procesarPedidos([]);
              }
            });
            return;
          }
          this.cargando = false;
          this.procesarPedidos([]);
          return;
        }

        this.cargando = false;
        this.procesarPedidos(pedidos);
      },
      error: (err) => {
        this.cargando = false;
        console.error('Error al consultar rastreo público:', err);
        this.mensajeError = 'No se pudo conectar con el servicio de rastreo. Intenta nuevamente en unos instantes.';
        this.pedidosEncontrados = [];
        this.pedidoSeleccionado = null;
        this.pedidoActivo = null;
        this.encontrado = false;
        this.cdr.detectChanges();
      }
    });
  }

  private procesarPedidos(pedidos: any[]): void {
    this.pedidosEncontrados = (pedidos || []).map(p => this.transformarAPedidoRastreo(p));

    if (this.pedidosEncontrados.length > 0) {
      this.seleccionarPedido(this.pedidosEncontrados[0]);
    } else {
      this.pedidoSeleccionado = null;
      this.pedidoActivo = null;
      this.encontrado = false;
    }
    this.cdr.detectChanges();
  }

  seleccionarPedido(pedido: PedidoRastreo): void {
    this.pedidoSeleccionado = pedido;
    this.pedidoActivo = pedido;
    this.encontrado = true;

    const ag = (pedido.agencia || '').toString().toUpperCase();
    if (ag.includes('OLVA')) {
      this.agenciaSeleccionada = 'olva';
    } else if (ag.includes('SHALOM')) {
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
   * Transforma el DTO devuelto por el backend a la estructura requerida para Rastreo,
   * utilizando los datos reales persistidos en la base de datos (agencia_envio, numero_guia).
   */
  private transformarAPedidoRastreo(p: any): PedidoRastreo {
    const idOrden = (p.id || '').toString();
    const dbId = p.dbId || 0;

    // Obtener la agencia asignada desde agenciaEnvio o agencia
    const agenciaRaw = (p.agenciaEnvio || p.agencia || '').toString().trim().toUpperCase();
    let agencia: 'SHALOM' | 'OLVA' | 'MOTORIZADO' = 'SHALOM';

    if (agenciaRaw.includes('OLVA')) {
      agencia = 'OLVA';
    } else if (agenciaRaw.includes('MOTORIZADO') || agenciaRaw.includes('DIRECTO')) {
      agencia = 'MOTORIZADO';
    } else {
      agencia = 'SHALOM';
    }

    // Obtener el número de seguimiento real asignado
    let numeroSeguimiento: string | undefined = undefined;
    if (agencia !== 'MOTORIZADO') {
      const guia = (p.numeroGuia || p.guia || p.numeroSeguimiento || '').toString().trim();
      numeroSeguimiento = (guia && guia !== 'DIRECTO') ? guia : undefined;
    }

    return {
      id: idOrden,
      dbId: dbId,
      cliente: p.cliente || 'Cliente',
      telefono: p.telefono || '',
      fecha: p.fecha || 'Reciente',
      hora: p.hora || '',
      estado: 'En camino',
      total: p.total || 'S/ 0.00',
      agencia: agencia,
      numeroSeguimiento: numeroSeguimiento,
      direccionEnvio: p.direccion || p.direccionEnvio || p.direccionEntrega || 'Dirección registrada',
      productos: p.producto || 'Productos seleccionados'
    };
  }
}

