import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminPedidoService } from '../../../service/admin-pedido.service';
import { ConfiguracionService } from '../../../service/configuracion.service';
import { ModalAlertaService } from '../../../service/modal-alerta.service';

export interface PedidoValido {
  id: string;
  dbId: number;
  cliente: string;
  telefono: string;
  total: string;
  estado: string;
  direccion?: string;
  agencia?: string;
  numeroGuia?: string;
  fechaDespacho?: string;
  fechaExpiracionRastreo?: string;
}

@Component({
  selector: 'app-admin-rastreo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-rastreo.component.html',
  styleUrl: './admin-rastreo.component.css'
})
export class AdminRastreoComponent implements OnInit {
  tabActiva: 'urls' | 'asignar' | 'monitor' = 'urls';

  // Pestaña 1: Configuración de URLs de Agencias
  urlShalom: string = 'https://rastreo.shalom.pe/';
  urlOlva: string = 'https://tracking.olvacourier.com/';
  guardandoUrls: boolean = false;

  // Pestaña 2: Asignación de Guías
  pedidosDisponibles: PedidoValido[] = [];
  pedidoSeleccionadoId: string = '';
  agenciaSeleccionada: 'SHALOM' | 'OLVA' | 'MOTORIZADO' = 'SHALOM';
  numeroGuia: string = '';
  vigenciaDias: number = 5; // 5 días por defecto (Local / Lima)
  guardandoDespacho: boolean = false;

  // Pestaña 3: Monitor de Envíos en Tránsito
  enviosEnTransito: PedidoValido[] = [];
  cargandoPedidos: boolean = false;

  constructor(
    private configService: ConfiguracionService,
    private adminPedidoService: AdminPedidoService,
    private modalAlertaService: ModalAlertaService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarConfiguracionUrls();
    this.cargarPedidos();
  }

  cargarConfiguracionUrls(): void {
    if (this.configService.negocio) {
      this.urlShalom = this.configService.negocio.url_rastreo_shalom || 'https://rastreo.shalom.pe/';
      this.urlOlva = this.configService.negocio.url_rastreo_olva || 'https://tracking.olvacourier.com/';
    }
    this.configService.config$.subscribe(cfg => {
      if (cfg) {
        if (cfg.url_rastreo_shalom) this.urlShalom = cfg.url_rastreo_shalom;
        if (cfg.url_rastreo_olva) this.urlOlva = cfg.url_rastreo_olva;
        this.cdr.detectChanges();
      }
    });
  }

  guardarUrls(): void {
    this.guardandoUrls = true;
    this.configService.guardarConfiguracion({
      url_rastreo_shalom: (this.urlShalom || '').trim(),
      url_rastreo_olva: (this.urlOlva || '').trim()
    });

    setTimeout(() => {
      this.guardandoUrls = false;
      this.modalAlertaService.success('Las URLs oficiales de rastreo han sido actualizadas y publicadas en la tienda online.', 'Configuración Guardada');
      this.cdr.detectChanges();
    }, 600);
  }

  cargarPedidos(): void {
    this.cargandoPedidos = true;
    this.adminPedidoService.getPedidos().subscribe({
      next: (pedidos) => {
        this.cargandoPedidos = false;
        if (!pedidos) pedidos = [];

        // 1. Pedidos para Asignación: estado VALIDADO o EN PREPARACION
        this.pedidosDisponibles = pedidos
          .filter(p => {
            const est = (p.estado || '').toUpperCase();
            return est === 'VALIDADO' || est === 'PAGO_VALIDADO' || est === 'EN_PREPARACION' || est === 'EN PREPARACION';
          })
          .map(p => this.mapearPedido(p));

        // 2. Pedidos en Tránsito: estado EN_CAMINO
        this.enviosEnTransito = pedidos
          .filter(p => {
            const est = (p.estado || '').toUpperCase();
            return est === 'EN_CAMINO' || est === 'EN CAMINO';
          })
          .map(p => this.mapearPedido(p));

        this.cdr.detectChanges();
      },
      error: (err) => {
        this.cargandoPedidos = false;
        console.error('Error al cargar pedidos para rastreo:', err);
        this.cdr.detectChanges();
      }
    });
  }

  despacharEnvio(): void {
    this.despacharYPublicar();
  }

  despacharYPublicar(): void {
    if (!this.pedidoSeleccionadoId) {
      this.modalAlertaService.warning('Selecciona un pedido validado para asignar el despacho.', 'Campo Requerido');
      return;
    }

    if (this.agenciaSeleccionada !== 'MOTORIZADO' && (!this.numeroGuia || !this.numeroGuia.trim())) {
      this.modalAlertaService.warning('Ingresa el número de guía o tracking provisto por la agencia.', 'Guía Requerida');
      return;
    }

    const pedido = this.pedidosDisponibles.find(p => p.id === this.pedidoSeleccionadoId || String(p.dbId) === this.pedidoSeleccionadoId);
    if (!pedido) return;

    this.guardandoDespacho = true;

    const ahora = new Date();
    const fechaExp = new Date();
    fechaExp.setDate(ahora.getDate() + (Number(this.vigenciaDias) || 5));

    const payload = {
      estado: 'EN_CAMINO',
      agencia: this.agenciaSeleccionada,
      agenciaEnvio: this.agenciaSeleccionada,
      numeroGuia: this.agenciaSeleccionada !== 'MOTORIZADO' ? this.numeroGuia.trim() : 'DIRECTO',
      guia: this.agenciaSeleccionada !== 'MOTORIZADO' ? this.numeroGuia.trim() : 'DIRECTO',
      fechaDespacho: ahora.toISOString(),
      fechaExpiracionRastreo: fechaExp.toISOString()
    };

    const targetId = pedido.dbId || pedido.id;
    this.adminPedidoService.updatePedido(targetId, payload).subscribe({
      next: (resp) => {
        this.guardandoDespacho = false;

        // 1. Decrementar de la lista de pedidos pendientes
        this.pedidosDisponibles = this.pedidosDisponibles.filter(p => p.id !== pedido.id && p.dbId !== pedido.dbId);

        // 2. Crear el objeto actualizado y agregarlo al monitor de tránsito
        const pedidoActualizado: PedidoValido = {
          ...pedido,
          estado: 'EN_CAMINO',
          agencia: this.agenciaSeleccionada,
          numeroGuia: payload.numeroGuia,
          fechaDespacho: payload.fechaDespacho,
          fechaExpiracionRastreo: payload.fechaExpiracionRastreo
        };
        if (resp && typeof resp === 'object') {
          if (resp.agenciaEnvio || resp.agencia) pedidoActualizado.agencia = resp.agenciaEnvio || resp.agencia;
          if (resp.numeroGuia || resp.guia) pedidoActualizado.numeroGuia = resp.numeroGuia || resp.guia;
          if (resp.fechaDespacho) pedidoActualizado.fechaDespacho = resp.fechaDespacho;
          if (resp.fechaExpiracionRastreo) pedidoActualizado.fechaExpiracionRastreo = resp.fechaExpiracionRastreo;
        }

        this.enviosEnTransito = [pedidoActualizado, ...this.enviosEnTransito.filter(p => p.id !== pedido.id && p.dbId !== pedido.dbId)];

        // 3. Reset del formulario
        this.pedidoSeleccionadoId = '';
        this.numeroGuia = '';
        this.agenciaSeleccionada = 'SHALOM';
        this.vigenciaDias = 5;

        // 4. Feedback visual claro
        this.modalAlertaService.success(`Pedido despachado con éxito. El pedido ${pedido.id} está ahora en tránsito con ${pedidoActualizado.agencia}.`, 'Pedido Despachado con Éxito');

        this.tabActiva = 'monitor';
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.guardandoDespacho = false;
        console.error('Error al despachar pedido:', err);
        const detalleError = (err && err.error && (err.error.message || err.error.mensaje || err.error.error))
          ? (err.error.message || err.error.mensaje || err.error.error)
          : (err.statusText || 'Error de comunicación con el servidor');
        this.modalAlertaService.error(`No se pudo despachar el pedido: ${detalleError}`, 'Error al Despachar');
        this.cdr.detectChanges();
      }
    });
  }

  marcarComoEntregado(pedido: PedidoValido): void {
    const confirmar = confirm(`¿Confirmas que el pedido ${pedido.id} ha sido entregado exitosamente al cliente ${pedido.cliente}?`);
    if (!confirmar) return;

    const targetId = pedido.dbId || pedido.id;
    const payload = {
      estado: 'ENTREGADO'
    };

    this.adminPedidoService.updatePedido(targetId, payload).subscribe({
      next: () => {
        this.modalAlertaService.success(`Pedido ${pedido.id} marcado como ENTREGADO. La guía se ha desactivado del rastreo activo.`, 'Entrega Confirmada');
        this.cargarPedidos();
      },
      error: (err) => {
        console.error('Error al marcar entrega:', err);
        this.modalAlertaService.error('No se pudo actualizar el pedido a ENTREGADO.', 'Error');
      }
    });
  }

  calcularDiasRestantes(fechaExp?: string): string {
    if (!fechaExp) return 'Indefinido';
    try {
      const exp = new Date(fechaExp).getTime();
      const ahora = new Date().getTime();
      const diffMs = exp - ahora;
      const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (diffDias <= 0) return 'Vence hoy';
      return `${diffDias} día${diffDias > 1 ? 's' : ''}`;
    } catch {
      return 'Vigente';
    }
  }

  private mapearPedido(p: any): PedidoValido {
    return {
      id: p.id || '',
      dbId: p.dbId || p.id,
      cliente: p.cliente || 'Cliente',
      telefono: p.telefono || '',
      total: p.total || 'S/ 0.00',
      estado: p.estado || '',
      direccion: p.direccion || p.direccionEnvio || '',
      agencia: p.agencia || p.agenciaEnvio || 'SHALOM',
      numeroGuia: p.numeroGuia || p.guia || '',
      fechaDespacho: p.fechaDespacho || '',
      fechaExpiracionRastreo: p.fechaExpiracionRastreo || ''
    };
  }
}

