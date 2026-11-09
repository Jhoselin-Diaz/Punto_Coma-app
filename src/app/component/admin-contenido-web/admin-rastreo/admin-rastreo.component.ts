import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminPedidoService, obtenerTimestampReal } from '../../../service/admin-pedido.service';
import { ConfiguracionService } from '../../../service/configuracion.service';
import { ModalAlertaService } from '../../../service/modal-alerta.service';

export interface PedidoValido {
  id: string;
  dbId: number;
  cliente: string;
  telefono: string;
  total: string;
  estado: string;
  fecha?: string;
  hora?: string;
  fechaPago?: string;
  fechaOriginal?: string;
  itemsResumen?: string;
  productosDetalle?: any[];
  direccion?: string;
  agencia?: string;
  numeroGuia?: string;
  codigoOrdenShalom?: string;
  claveRecojo?: string;
  codigoRecojo?: string;
  fleteDestino?: number;
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
  busquedaPedido: string = '';
  agenciaSeleccionada: 'SHALOM' | 'OLVA' | 'MOTORIZADO' = 'SHALOM';

  get pedidosFiltrados(): PedidoValido[] {
    const q = (this.busquedaPedido || '').trim().toLowerCase();
    if (!q) {
      return this.pedidosDisponibles;
    }
    return this.pedidosDisponibles.filter(p => {
      const matchId = (p.id || '').toLowerCase().includes(q);
      const matchCliente = (p.cliente || '').toLowerCase().includes(q);
      const matchTel = (p.telefono || '').replace(/\D/g, '').includes(q.replace(/\D/g, '')) || (p.telefono || '').toLowerCase().includes(q);
      const matchTotal = (p.total || '').toLowerCase().includes(q);
      const matchItems = (p.itemsResumen || '').toLowerCase().includes(q);
      const matchFecha = this.formatearFechaHora(p).toLowerCase().includes(q);
      return matchId || matchCliente || matchTel || matchTotal || matchItems || matchFecha;
    });
  }

  get pedidoSeleccionado(): PedidoValido | undefined {
    if (!this.pedidoSeleccionadoId) return undefined;
    return this.pedidosDisponibles.find(p => p.id === this.pedidoSeleccionadoId || String(p.dbId) === this.pedidoSeleccionadoId);
  }

  seleccionarPedido(pedido: PedidoValido): void {
    if (!pedido) return;
    this.pedidoSeleccionadoId = pedido.id;
    setTimeout(() => {
      const el = document.getElementById('seccionAgencia');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 100);
  }

  onSelectChange(id: string): void {
    this.pedidoSeleccionadoId = id;
    const found = this.pedidosDisponibles.find(p => p.id === id || String(p.dbId) === id);
    if (found) {
      this.seleccionarPedido(found);
    }
  }

  ordenarPedidosDescendente(a: PedidoValido, b: PedidoValido): number {
    const tsA = obtenerTimestampReal(a);
    const tsB = obtenerTimestampReal(b);
    if (tsA !== tsB && !isNaN(tsA) && !isNaN(tsB) && (tsA > 0 || tsB > 0)) {
      return tsB - tsA;
    }

    const numIdA = Number(a.dbId || (String(a.id).replace(/\D/g, ''))) || 0;
    const numIdB = Number(b.dbId || (String(b.id).replace(/\D/g, ''))) || 0;
    if (numIdA !== numIdB) {
      return numIdB - numIdA;
    }

    return (b.id || '').localeCompare(a.id || '');
  }

  formatearFechaHora(p: PedidoValido | null | undefined): string {
    if (!p) return 'Fecha no disponible';

    if (p.fecha && p.hora) {
      const prefijo = p.fecha.toLowerCase() === 'hoy' ? 'Hoy' : p.fecha;
      return `${prefijo}, ${p.hora}`;
    }
    if (p.fecha) {
      return p.fecha;
    }

    const isoDate = p.fechaPago || p.fechaOriginal;
    if (isoDate) {
      try {
        const d = new Date(isoDate);
        if (!isNaN(d.getTime())) {
          const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];
          const dia = String(d.getDate()).padStart(2, '0');
          const mes = meses[d.getMonth()];
          const anio = d.getFullYear();
          let horas = d.getHours();
          const minutos = String(d.getMinutes()).padStart(2, '0');
          const ampm = horas >= 12 ? 'PM' : 'AM';
          horas = horas % 12;
          horas = horas ? horas : 12;
          const strHoras = String(horas).padStart(2, '0');
          return `${dia} ${mes} ${anio}, ${strHoras}:${minutos} ${ampm}`;
        }
      } catch (ignored) {}
    }

    return 'Reciente';
  }

  // Campos independientes Shalom / Olva
  numeroGuia: string = '';           // N° de Orden Shalom o Guía Olva
  codigoOrdenShalom: string = '';    // Código de Orden Shalom (web)
  claveRecojo: string = '';          // Clave de Recojo Shalom (física)
  fleteDestino: number | null = null;// Flete a pagar en destino (S/)

  vigenciaDias: number = 5; // 5 días por defecto (Local / Lima)
  guardandoDespacho: boolean = false;

  // Pestaña 3: Monitor de Envíos en Tránsito
  enviosEnTransito: PedidoValido[] = [];
  cargandoPedidos: boolean = false;

  // MODAL CENTRADO ESTILIZADO
  modalVisible: boolean = false;
  modalTipo: 'entregar' | 'editar' | 'anular' | null = null;
  pedidoEnModal: PedidoValido | null = null;
  procesandoModal: boolean = false;

  // Campos para Edición en Modal
  editAgencia: 'SHALOM' | 'OLVA' | 'MOTORIZADO' = 'SHALOM';
  editNumeroGuia: string = '';
  editCodigoOrdenShalom: string = '';
  editClaveRecojo: string = '';
  editFleteDestino: number | null = null;
  editVigenciaDias: number = 5;

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

        // 1. Pedidos para Asignación: estado VALIDADO o EN PREPARACION (orden descendente)
        this.pedidosDisponibles = pedidos
          .filter(p => {
            const est = (p.estado || '').toUpperCase();
            return est === 'VALIDADO' || est === 'PAGO_VALIDADO' || est === 'EN_PREPARACION' || est === 'EN PREPARACION';
          })
          .map(p => this.mapearPedido(p))
          .sort((a, b) => this.ordenarPedidosDescendente(a, b));

        // 2. Pedidos en Tránsito: estado EN_CAMINO (orden descendente)
        this.enviosEnTransito = pedidos
          .filter(p => {
            const est = (p.estado || '').toUpperCase();
            return est === 'EN_CAMINO' || est === 'EN CAMINO';
          })
          .map(p => this.mapearPedido(p))
          .sort((a, b) => this.ordenarPedidosDescendente(a, b));

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

    if (this.agenciaSeleccionada === 'SHALOM') {
      if (!this.numeroGuia || !this.numeroGuia.trim()) {
        this.modalAlertaService.warning('Ingresa el N° de Orden Shalom emitido por la agencia.', 'N° de Orden Requerido');
        return;
      }
      if (!this.codigoOrdenShalom || !this.codigoOrdenShalom.trim()) {
        this.modalAlertaService.warning('Ingresa el Código de Orden Shalom necesario para rastrear en su web.', 'Código de Orden Requerido');
        return;
      }
      if (!this.claveRecojo || !this.claveRecojo.trim()) {
        this.modalAlertaService.warning('Ingresa la Clave de Recojo en Tienda para el retiro presencial.', 'Clave de Recojo Requerida');
        return;
      }
    } else if (this.agenciaSeleccionada === 'OLVA') {
      if (!this.numeroGuia || !this.numeroGuia.trim()) {
        this.modalAlertaService.warning('Ingresa el número de tracking o remito provisto por Olva Courier.', 'N° de Guía Requerido');
        return;
      }
    }

    const pedido = this.pedidosDisponibles.find(p => p.id === this.pedidoSeleccionadoId || String(p.dbId) === this.pedidoSeleccionadoId);
    if (!pedido) return;

    this.guardandoDespacho = true;

    const ahora = new Date();
    const fechaExp = new Date();
    fechaExp.setDate(ahora.getDate() + (Number(this.vigenciaDias) || 5));

    const numGuiaFinal = this.agenciaSeleccionada !== 'MOTORIZADO' ? this.numeroGuia.trim() : 'DIRECTO';
    const codOrdenFinal = this.agenciaSeleccionada === 'SHALOM' ? (this.codigoOrdenShalom || '').trim().toUpperCase() : null;
    const claveFinal = this.agenciaSeleccionada === 'SHALOM' ? (this.claveRecojo || '').trim().toUpperCase() : null;
    const fleteFinal = this.agenciaSeleccionada === 'SHALOM' && this.fleteDestino !== null && this.fleteDestino !== undefined && (this.fleteDestino as any) !== '' ? Number(this.fleteDestino) : null;

    const payload = {
      estado: 'EN_CAMINO',
      agencia: this.agenciaSeleccionada,
      agenciaEnvio: this.agenciaSeleccionada,
      numeroGuia: numGuiaFinal,
      guia: numGuiaFinal,
      codigoOrdenShalom: codOrdenFinal,
      claveRecojo: claveFinal,
      codigoRecojo: claveFinal, // retrocompatibilidad
      fleteDestino: fleteFinal,
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
          numeroGuia: numGuiaFinal,
          codigoOrdenShalom: codOrdenFinal || '',
          claveRecojo: claveFinal || '',
          codigoRecojo: claveFinal || '',
          fleteDestino: fleteFinal || 0,
          fechaDespacho: payload.fechaDespacho,
          fechaExpiracionRastreo: payload.fechaExpiracionRastreo
        };
        if (resp && typeof resp === 'object') {
          if (resp.agenciaEnvio || resp.agencia) pedidoActualizado.agencia = resp.agenciaEnvio || resp.agencia;
          if (resp.numeroGuia || resp.guia) pedidoActualizado.numeroGuia = resp.numeroGuia || resp.guia;
          if (resp.codigoOrdenShalom !== undefined) pedidoActualizado.codigoOrdenShalom = resp.codigoOrdenShalom;
          if (resp.claveRecojo !== undefined) pedidoActualizado.claveRecojo = resp.claveRecojo;
          if (resp.fleteDestino !== undefined) pedidoActualizado.fleteDestino = Number(resp.fleteDestino);
          if (resp.fechaDespacho) pedidoActualizado.fechaDespacho = resp.fechaDespacho;
          if (resp.fechaExpiracionRastreo) pedidoActualizado.fechaExpiracionRastreo = resp.fechaExpiracionRastreo;
        }

        this.enviosEnTransito = [pedidoActualizado, ...this.enviosEnTransito.filter(p => p.id !== pedido.id && p.dbId !== pedido.dbId)];

        // 3. Reset del formulario
        this.pedidoSeleccionadoId = '';
        this.numeroGuia = '';
        this.codigoOrdenShalom = '';
        this.claveRecojo = '';
        this.fleteDestino = null;
        this.agenciaSeleccionada = 'SHALOM';
        this.vigenciaDias = 5;

        // 4. Feedback visual claro
        this.modalAlertaService.success(`Pedido despachado con éxito. El pedido ${pedido.id} (${this.formatearFechaHora(pedido)}) está ahora en tránsito con ${pedidoActualizado.agencia}.`, 'Pedido Despachado con Éxito');

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

  // GESTIÓN DEL MODAL CENTRADO ESTILIZADO
  abrirModalEntregar(pedido: PedidoValido): void {
    this.modalTipo = 'entregar';
    this.pedidoEnModal = pedido;
    this.modalVisible = true;
  }

  abrirModalEditar(pedido: PedidoValido): void {
    this.modalTipo = 'editar';
    this.pedidoEnModal = pedido;

    const agRaw = (pedido.agencia || '').toString().toUpperCase();
    if (agRaw.includes('OLVA')) {
      this.editAgencia = 'OLVA';
    } else if (agRaw.includes('MOTORIZADO') || agRaw.includes('DIRECTO')) {
      this.editAgencia = 'MOTORIZADO';
    } else {
      this.editAgencia = 'SHALOM';
    }

    const guia = (pedido.numeroGuia || '').trim();
    this.editNumeroGuia = (guia && guia !== 'Directo' && guia !== 'DIRECTO') ? guia : '';
    this.editCodigoOrdenShalom = (pedido.codigoOrdenShalom || '').trim();
    this.editClaveRecojo = (pedido.claveRecojo || pedido.codigoRecojo || '').trim();
    this.editFleteDestino = (pedido.fleteDestino !== undefined && pedido.fleteDestino !== null && pedido.fleteDestino > 0) ? pedido.fleteDestino : null;
    this.editVigenciaDias = 5;
    this.modalVisible = true;
  }

  abrirModalAnular(pedido: PedidoValido): void {
    this.modalTipo = 'anular';
    this.pedidoEnModal = pedido;
    this.modalVisible = true;
  }

  cerrarModal(): void {
    if (this.procesandoModal) return;
    this.modalVisible = false;
    this.modalTipo = null;
    this.pedidoEnModal = null;
    this.procesandoModal = false;
  }

  confirmarAccionModal(): void {
    if (!this.pedidoEnModal || !this.modalTipo) return;

    if (this.modalTipo === 'entregar') {
      this.ejecutarEntrega();
    } else if (this.modalTipo === 'editar') {
      this.ejecutarEdicion();
    } else if (this.modalTipo === 'anular') {
      this.ejecutarAnulacion();
    }
  }

  private ejecutarEntrega(): void {
    if (!this.pedidoEnModal) return;
    const pedido = this.pedidoEnModal;
    const targetId = pedido.dbId || pedido.id;
    this.procesandoModal = true;

    const payload = {
      estado: 'ENTREGADO'
    };

    this.adminPedidoService.updatePedido(targetId, payload).subscribe({
      next: () => {
        this.procesandoModal = false;
        this.cerrarModal();
        this.enviosEnTransito = this.enviosEnTransito.filter(p => p.id !== pedido.id && p.dbId !== pedido.dbId);
        this.modalAlertaService.success(`Pedido ${pedido.id} marcado como ENTREGADO exitosamente.`, 'Entrega Confirmada');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.procesandoModal = false;
        console.error('Error al marcar entrega:', err);
        this.modalAlertaService.error('No se pudo actualizar el pedido a ENTREGADO.', 'Error');
        this.cdr.detectChanges();
      }
    });
  }

  private ejecutarEdicion(): void {
    if (!this.pedidoEnModal) return;

    if (this.editAgencia === 'SHALOM') {
      if (!this.editNumeroGuia || !this.editNumeroGuia.trim()) {
        this.modalAlertaService.warning('Ingresa el N° de Orden Shalom.', 'Campo Requerido');
        return;
      }
      if (!this.editCodigoOrdenShalom || !this.editCodigoOrdenShalom.trim()) {
        this.modalAlertaService.warning('Ingresa el Código de Orden Shalom para rastreo en su web.', 'Campo Requerido');
        return;
      }
      if (!this.editClaveRecojo || !this.editClaveRecojo.trim()) {
        this.modalAlertaService.warning('Ingresa la Clave de Recojo en Tienda para entrega física.', 'Campo Requerido');
        return;
      }
    } else if (this.editAgencia === 'OLVA') {
      if (!this.editNumeroGuia || !this.editNumeroGuia.trim()) {
        this.modalAlertaService.warning('Ingresa el número de guía o tracking de Olva Courier.', 'Guía Requerida');
        return;
      }
    }

    const pedido = this.pedidoEnModal;
    const targetId = pedido.dbId || pedido.id;
    this.procesandoModal = true;

    const ahora = new Date();
    const fechaExp = new Date();
    fechaExp.setDate(ahora.getDate() + (Number(this.editVigenciaDias) || 5));

    const numGuiaFinal = this.editAgencia !== 'MOTORIZADO' ? this.editNumeroGuia.trim() : 'DIRECTO';
    const codOrdenFinal = this.editAgencia === 'SHALOM' ? (this.editCodigoOrdenShalom || '').trim().toUpperCase() : null;
    const claveFinal = this.editAgencia === 'SHALOM' ? (this.editClaveRecojo || '').trim().toUpperCase() : null;
    const fleteFinal = this.editAgencia === 'SHALOM' && this.editFleteDestino !== null && this.editFleteDestino !== undefined && (this.editFleteDestino as any) !== '' ? Number(this.editFleteDestino) : null;

    const payload = {
      estado: 'EN_CAMINO',
      agencia: this.editAgencia,
      agenciaEnvio: this.editAgencia,
      numeroGuia: numGuiaFinal,
      guia: numGuiaFinal,
      codigoOrdenShalom: codOrdenFinal,
      claveRecojo: claveFinal,
      codigoRecojo: claveFinal,
      fleteDestino: fleteFinal,
      fechaExpiracionRastreo: fechaExp.toISOString()
    };

    this.adminPedidoService.updatePedido(targetId, payload).subscribe({
      next: () => {
        this.procesandoModal = false;
        this.cerrarModal();

        const index = this.enviosEnTransito.findIndex(p => p.id === pedido.id || p.dbId === pedido.dbId);
        if (index !== -1) {
          this.enviosEnTransito[index] = {
            ...this.enviosEnTransito[index],
            agencia: this.editAgencia,
            numeroGuia: numGuiaFinal,
            codigoOrdenShalom: codOrdenFinal || '',
            claveRecojo: claveFinal || '',
            codigoRecojo: claveFinal || '',
            fleteDestino: fleteFinal || 0,
            fechaExpiracionRastreo: payload.fechaExpiracionRastreo
          };
        }

        this.modalAlertaService.success(`La información de despacho para el pedido ${pedido.id} se actualizó correctamente.`, 'Cambios Guardados');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.procesandoModal = false;
        console.error('Error al editar despacho:', err);
        this.modalAlertaService.error('No se pudieron guardar los cambios del despacho.', 'Error al Editar');
        this.cdr.detectChanges();
      }
    });
  }

  private ejecutarAnulacion(): void {
    if (!this.pedidoEnModal) return;
    const pedido = this.pedidoEnModal;
    const targetId = pedido.dbId || pedido.id;
    this.procesandoModal = true;

    const payload = {
      estado: 'VALIDADO',
      agencia: null,
      agenciaEnvio: null,
      numeroGuia: null,
      guia: null,
      codigoOrdenShalom: null,
      claveRecojo: null,
      codigoRecojo: null,
      fleteDestino: null,
      fechaDespacho: null,
      fechaExpiracionRastreo: null
    };

    this.adminPedidoService.updatePedido(targetId, payload).subscribe({
      next: () => {
        this.procesandoModal = false;
        this.cerrarModal();

        // 1. Quitar de Envíos en Tránsito
        this.enviosEnTransito = this.enviosEnTransito.filter(p => p.id !== pedido.id && p.dbId !== pedido.dbId);

        // 2. Devolver a la lista de Pedidos Disponibles para asignación
        const pedidoRevertido: PedidoValido = {
          ...pedido,
          estado: 'VALIDADO',
          agencia: undefined,
          numeroGuia: undefined,
          codigoOrdenShalom: undefined,
          claveRecojo: undefined,
          codigoRecojo: undefined,
          fleteDestino: undefined,
          fechaDespacho: undefined,
          fechaExpiracionRastreo: undefined
        };
        this.pedidosDisponibles = [pedidoRevertido, ...this.pedidosDisponibles.filter(p => p.id !== pedido.id && p.dbId !== pedido.dbId)]
          .sort((a, b) => this.ordenarPedidosDescendente(a, b));

        this.modalAlertaService.success(`Despacho anulado. El pedido ${pedido.id} ha vuelto a la lista de pedidos pendientes para asignarle una nueva guía.`, 'Despacho Anulado');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.procesandoModal = false;
        console.error('Error al anular despacho:', err);
        this.modalAlertaService.error('No se pudo anular el despacho del pedido.', 'Error');
        this.cdr.detectChanges();
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
    let itemsResumen = '';
    if (p.productosDetalle && Array.isArray(p.productosDetalle) && p.productosDetalle.length > 0) {
      const nombres = p.productosDetalle.map((d: any) => `${d.cantidad || 1}x ${d.nombre || 'Producto'}`);
      itemsResumen = nombres.slice(0, 2).join(', ');
      if (p.productosDetalle.length > 2) {
        itemsResumen += ` y +${p.productosDetalle.length - 2} más`;
      }
    }

    return {
      id: p.id || '',
      dbId: p.dbId || p.id,
      cliente: p.cliente || 'Cliente',
      telefono: p.telefono || '',
      total: p.total || 'S/ 0.00',
      estado: p.estado || '',
      fecha: p.fecha || '',
      hora: p.hora || '',
      fechaPago: p.fechaPago || p.fecha_pago || '',
      fechaOriginal: p.fechaOriginal || p.createdAt || p.fechaPago || p.fecha_pago || '',
      itemsResumen: itemsResumen,
      productosDetalle: p.productosDetalle || [],
      direccion: p.direccion || p.direccionEnvio || '',
      agencia: p.agencia || p.agenciaEnvio || 'SHALOM',
      numeroGuia: p.numeroGuia || p.guia || '',
      codigoOrdenShalom: p.codigoOrdenShalom || '',
      claveRecojo: p.claveRecojo || p.codigoRecojo || '',
      codigoRecojo: p.claveRecojo || p.codigoRecojo || '',
      fleteDestino: (p.fleteDestino !== undefined && p.fleteDestino !== null) ? Number(p.fleteDestino) : 0,
      fechaDespacho: p.fechaDespacho || '',
      fechaExpiracionRastreo: p.fechaExpiracionRastreo || ''
    };
  }
}
