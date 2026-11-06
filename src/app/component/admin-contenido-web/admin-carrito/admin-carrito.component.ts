import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminLayoutComponent } from '../../admin-layout/admin-layout.component';
import { AdminCarritoService, ConfiguracionCarrito, Cupon, TipoAplicacionCupon } from '../../../service/admin-carrito.service';
import { ModalAlertaService } from '../../../service/modal-alerta.service';
import { ProductosService } from '../../../service/productos.service';

@Component({
  selector: 'app-admin-carrito',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AdminLayoutComponent],
  templateUrl: './admin-carrito.component.html',
  styleUrl: './admin-carrito.component.css'
})
export class AdminCarritoComponent implements OnInit {
  pestanaActiva: 'config' | 'cupones' = 'config';

  // Configuración
  config: ConfiguracionCarrito = {
    id: 1,
    whatsappUrl: '',
    beneficio1: '',
    beneficio2: '',
    beneficio3: '',
    beneficio4: ''
  };

  switchEnvios = false;
  switchPago = false;
  switchEmpaque = false;
  switchCambios = false;
  switchArtesanal = false;

  guardandoConfig = false;
  successConfig = false;

  // Toast Flotante
  toastVisible = false;
  toastTitulo = '';
  toastMensaje = '';
  private toastTimer: any;

  // Cupones
  cupones: Cupon[] = [];
  categoriasDisponibles: string[] = [];
  productosDisponibles: any[] = [];
  productosSeleccionadosNuevo: number[] = [];
  filtroProductosNuevo = '';
  productosSeleccionadosEdit: number[] = [];
  filtroProductosEdit = '';
  errorPorcentajeCuponNuevo = false;
  errorPorcentajeCuponEdit = false;
  nuevoCupon: Cupon = {
    codigo: '',
    porcentajeDescuento: 10,
    activo: true,
    visibleWeb: true,
    tipoAplicacion: 'GENERAL',
    categoriaAplicable: '',
    productoIds: '',
    montoMinimo: null,
    fechaInicio: null,
    fechaFin: null,
    limiteUso: null,
    usosActuales: 0
  };
  mostrarModalEditar = false;
  cuponEditando: Cupon | null = null;
  guardandoEdicion = false;
  errorEdicionCupon = '';
  guardandoCupon = false;
  errorCupon = '';

  constructor(
    private adminCarritoService: AdminCarritoService,
    private modalAlertaService: ModalAlertaService,
    private productosService: ProductosService
  ) {}

  ngOnInit() {
    this.cargarConfiguracion();
    this.cargarCupones();
    this.cargarCategoriasYProductos();
  }

  cargarCategoriasYProductos() {
    const raw = localStorage.getItem('admin_categorias_productos');
    let lista: string[] = [];
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          lista = parsed.map(c => String(c).trim()).filter(c => c.length > 0);
        }
      } catch (e) {}
    }
    if (lista.length === 0) {
      lista = ['Tazas', 'Vasos', 'Sets de Cerámica', 'Accesorios'];
    }
    this.categoriasDisponibles = lista;

    this.productosService.obtenerTodosBackend().subscribe({
      next: (prods) => {
        this.productosDisponibles = prods || [];
        this.productosDisponibles.forEach(p => {
          if (p.categoria && typeof p.categoria === 'string') {
            const cat = p.categoria.trim();
            if (cat && !this.categoriasDisponibles.some(c => c.toLowerCase() === cat.toLowerCase())) {
              this.categoriasDisponibles.push(cat);
            }
          }
        });
      },
      error: (err) => console.error('Error al cargar productos en administración de cupones:', err)
    });
  }

  cargarConfiguracion() {
    this.adminCarritoService.obtenerConfiguracion().subscribe({
      next: (res) => {
        this.config = res;
        const backendVals = [res.beneficio1, res.beneficio2, res.beneficio3, res.beneficio4].filter(v => v && v.trim() !== '');
        this.switchEnvios = backendVals.includes('Envíos a todo el Perú');
        this.switchPago = backendVals.includes('Pago seguro coordinado por WhatsApp');
        this.switchEmpaque = backendVals.includes('Empaque cuidadoso para productos frágiles');
        this.switchCambios = backendVals.includes('Cambios y devoluciones dentro de 48 horas');
        this.switchArtesanal = backendVals.includes('Productos 100% artesanales y seleccionados');
      },
      error: (err) => console.error('Error al cargar configuracion de carrito:', err)
    });
  }

  toggleBeneficio(tipo: string) {
    let count = 0;
    if (this.switchEnvios) count++;
    if (this.switchPago) count++;
    if (this.switchEmpaque) count++;
    if (this.switchCambios) count++;
    if (this.switchArtesanal) count++;

    if (tipo === 'envios') {
      if (!this.switchEnvios && count >= 4) {
        alert('Solo puedes activar un máximo de 4 beneficios.');
        return;
      }
      this.switchEnvios = !this.switchEnvios;
    } else if (tipo === 'pago') {
      if (!this.switchPago && count >= 4) {
        alert('Solo puedes activar un máximo de 4 beneficios.');
        return;
      }
      this.switchPago = !this.switchPago;
    } else if (tipo === 'empaque') {
      if (!this.switchEmpaque && count >= 4) {
        alert('Solo puedes activar un máximo de 4 beneficios.');
        return;
      }
      this.switchEmpaque = !this.switchEmpaque;
    } else if (tipo === 'cambios') {
      if (!this.switchCambios && count >= 4) {
        alert('Solo puedes activar un máximo de 4 beneficios.');
        return;
      }
      this.switchCambios = !this.switchCambios;
    } else if (tipo === 'artesanal') {
      if (!this.switchArtesanal && count >= 4) {
        alert('Solo puedes activar un máximo de 4 beneficios.');
        return;
      }
      this.switchArtesanal = !this.switchArtesanal;
    }
  }

  guardarConfiguracion() {
    this.guardandoConfig = true;
    this.successConfig = false;

    this.config.id = 1;
    this.config.whatsappUrl = (this.config.whatsappUrl || '').trim();

    let activos: string[] = [];
    if (this.switchEnvios) activos.push("Envíos a todo el Perú");
    if (this.switchPago) activos.push("Pago seguro coordinado por WhatsApp");
    if (this.switchEmpaque) activos.push("Empaque cuidadoso para productos frágiles");
    if (this.switchCambios) activos.push("Cambios y devoluciones dentro de 48 horas");
    if (this.switchArtesanal) activos.push("Productos 100% artesanales y seleccionados");

    this.config.beneficio1 = activos[0] || '';
    this.config.beneficio2 = activos[1] || '';
    this.config.beneficio3 = activos[2] || '';
    this.config.beneficio4 = activos[3] || '';

    console.log("Iniciando guardado de configuración...", this.config);

    this.adminCarritoService.guardarConfiguracion(this.config).subscribe({
      next: (res) => {
        console.log("Guardado con éxito en Supabase:", res);
        this.config = res;
        const backendVals = [res.beneficio1, res.beneficio2, res.beneficio3, res.beneficio4].filter(v => v && v.trim() !== '');
        this.switchEnvios = backendVals.includes('Envíos a todo el Perú');
        this.switchPago = backendVals.includes('Pago seguro coordinado por WhatsApp');
        this.switchEmpaque = backendVals.includes('Empaque cuidadoso para productos frágiles');
        this.switchCambios = backendVals.includes('Cambios y devoluciones dentro de 48 horas');
        this.switchArtesanal = backendVals.includes('Productos 100% artesanales y seleccionados');
        
        this.guardandoConfig = false;
        this.successConfig = true;
        setTimeout(() => this.successConfig = false, 3000);
      },
      error: (err) => {
        console.error("Error al guardar en el backend:", err);
        this.guardandoConfig = false;
      }
    });
  }

  cargarCupones() {
    this.adminCarritoService.listarCupones().subscribe({
      next: (res) => {
        this.cupones = res;
      },
      error: (err) => console.error('Error al cargar cupones:', err)
    });
  }

  crearCupon() {
    if (!this.nuevoCupon.codigo || this.nuevoCupon.codigo.trim() === '') {
      this.errorCupon = 'El código del cupón es obligatorio.';
      return;
    }
    const desc = Number(this.nuevoCupon.porcentajeDescuento);
    if (this.nuevoCupon.porcentajeDescuento == null || this.nuevoCupon.porcentajeDescuento === ('' as any) || isNaN(desc) || desc < 1 || desc > 99) {
      this.errorPorcentajeCuponNuevo = true;
      this.modalAlertaService.warning(
        'El descuento debe situarse entre el 1% y el 99%, y el precio no puede ser negativo.',
        'Alerta de validación'
      );
      return;
    }
    this.errorPorcentajeCuponNuevo = false;

    // Validación según Tipo de Aplicación
    if (this.nuevoCupon.tipoAplicacion === 'BIENVENIDA') {
      const existeBienvenidaActivo = this.cupones.some(c => c.activo && (c.tipoAplicacion === 'BIENVENIDA' || (c.codigo || '').toUpperCase().includes('BIENVENID')));
      if (existeBienvenidaActivo) {
        this.modalAlertaService.warning(
          'Ya existe un cupón de bienvenida activo. Debes desactivar o editar el cupón actual antes de crear uno nuevo.',
          'Cupón de bienvenida duplicado'
        );
        return;
      }
    } else if (this.nuevoCupon.tipoAplicacion === 'CATEGORIA') {
      if (!this.nuevoCupon.categoriaAplicable || !this.nuevoCupon.categoriaAplicable.trim()) {
        this.modalAlertaService.warning('Debes seleccionar una categoría para este cupón.', 'Alerta de validación');
        return;
      }
    } else if (this.nuevoCupon.tipoAplicacion === 'LIQUIDACION') {
      if (!this.productosSeleccionadosNuevo || this.productosSeleccionadosNuevo.length === 0) {
        this.modalAlertaService.warning('Debes seleccionar al menos un producto para la aplicación de liquidación / específica.', 'Alerta de validación');
        return;
      }
    }

    if (this.nuevoCupon.montoMinimo != null && this.nuevoCupon.montoMinimo < 0) {
      this.errorCupon = 'El monto mínimo no puede ser negativo.';
      return;
    }
    if (this.nuevoCupon.fechaInicio && this.nuevoCupon.fechaFin && this.nuevoCupon.fechaInicio > this.nuevoCupon.fechaFin) {
      this.errorCupon = 'La fecha de inicio no puede ser posterior a la fecha de fin.';
      return;
    }
    if (this.nuevoCupon.limiteUso != null && this.nuevoCupon.limiteUso < 1) {
      this.errorCupon = 'El límite de usos debe ser como mínimo 1.';
      return;
    }

    this.guardandoCupon = true;
    this.errorCupon = '';

    const payload: Cupon = {
      codigo: this.nuevoCupon.codigo.toUpperCase().trim(),
      porcentajeDescuento: this.nuevoCupon.porcentajeDescuento,
      activo: this.nuevoCupon.activo,
      visibleWeb: this.nuevoCupon.visibleWeb !== false,
      tipoAplicacion: this.nuevoCupon.tipoAplicacion || 'GENERAL',
      categoriaAplicable: this.nuevoCupon.tipoAplicacion === 'CATEGORIA' ? this.nuevoCupon.categoriaAplicable : null,
      productoIds: this.nuevoCupon.tipoAplicacion === 'LIQUIDACION' ? this.productosSeleccionadosNuevo.join(',') : null,
      montoMinimo: (this.nuevoCupon.montoMinimo != null && !isNaN(Number(this.nuevoCupon.montoMinimo)) && Number(this.nuevoCupon.montoMinimo) > 0)
        ? Number(this.nuevoCupon.montoMinimo)
        : null,
      fechaInicio: this.nuevoCupon.fechaInicio?.trim() || null,
      fechaFin: this.nuevoCupon.fechaFin?.trim() || null,
      limiteUso: (this.nuevoCupon.limiteUso != null && !isNaN(Number(this.nuevoCupon.limiteUso)) && Number(this.nuevoCupon.limiteUso) > 0)
        ? Math.floor(Number(this.nuevoCupon.limiteUso))
        : null,
      usosActuales: 0
    };

    this.adminCarritoService.crearCupon(payload).subscribe({
      next: (res) => {
        this.cupones.unshift(res);
        this.nuevoCupon = {
          codigo: '',
          porcentajeDescuento: 10,
          activo: true,
          visibleWeb: true,
          tipoAplicacion: 'GENERAL',
          categoriaAplicable: '',
          productoIds: '',
          montoMinimo: null,
          fechaInicio: null,
          fechaFin: null,
          limiteUso: null,
          usosActuales: 0
        };
        this.productosSeleccionadosNuevo = [];
        this.filtroProductosNuevo = '';
        this.guardandoCupon = false;
        this.cargarCupones();
        this.mostrarToast('El cupón ha sido creado y registrado exitosamente en el sistema.', 'Cupón registrado');
      },
      error: (err) => {
        console.error('Error al crear cupon:', err);
        if (err?.status === 409 || err?.error?.message?.includes('bienvenida')) {
          this.modalAlertaService.warning(
            'Ya existe un cupón de bienvenida activo. Debes desactivar o editar el cupón actual antes de crear uno nuevo.',
            'Cupón de bienvenida duplicado'
          );
        } else {
          this.errorCupon = 'Error al guardar el cupón. Es posible que el código ya exista.';
        }
        this.guardandoCupon = false;
      }
    });
  }

  esCuponAgotado(cupon: Cupon): boolean {
    if (cupon.limiteUso != null && cupon.limiteUso > 0) {
      return (cupon.usosActuales ?? 0) >= cupon.limiteUso;
    }
    return false;
  }

  abrirModalEditar(cupon: Cupon) {
    this.cuponEditando = {
      ...cupon,
      tipoAplicacion: (cupon.tipoAplicacion as TipoAplicacionCupon) || 'GENERAL',
      categoriaAplicable: cupon.categoriaAplicable || '',
      productoIds: cupon.productoIds || '',
      visibleWeb: cupon.visibleWeb !== false
    };
    this.productosSeleccionadosEdit = [];
    if (this.cuponEditando.productoIds) {
      this.productosSeleccionadosEdit = this.cuponEditando.productoIds
        .split(',')
        .map(id => Number(id.trim()))
        .filter(id => !isNaN(id) && id > 0);
    }
    this.filtroProductosEdit = '';
    this.errorEdicionCupon = '';
    this.errorPorcentajeCuponEdit = false;
    this.mostrarModalEditar = true;
  }

  cerrarModalEditar() {
    this.mostrarModalEditar = false;
    this.cuponEditando = null;
    this.productosSeleccionadosEdit = [];
    this.filtroProductosEdit = '';
    this.errorEdicionCupon = '';
    this.errorPorcentajeCuponEdit = false;
  }

  guardarEdicionCupon() {
    if (!this.cuponEditando || !this.cuponEditando.id) return;

    if (!this.cuponEditando.codigo || this.cuponEditando.codigo.trim() === '') {
      this.errorEdicionCupon = 'El código del cupón es obligatorio.';
      return;
    }
    const desc = Number(this.cuponEditando.porcentajeDescuento);
    if (this.cuponEditando.porcentajeDescuento == null || this.cuponEditando.porcentajeDescuento === ('' as any) || isNaN(desc) || desc < 1 || desc > 99) {
      this.errorPorcentajeCuponEdit = true;
      this.modalAlertaService.warning(
        'El descuento debe situarse entre el 1% y el 99%, y el precio no puede ser negativo.',
        'Alerta de validación'
      );
      return;
    }
    this.errorPorcentajeCuponEdit = false;

    // Validación de Tipo de Aplicación en Edición
    if (this.cuponEditando.tipoAplicacion === 'BIENVENIDA' && this.cuponEditando.activo) {
      const existeOtroBienvenidaActivo = this.cupones.some(c => c.id !== this.cuponEditando?.id && c.activo && (c.tipoAplicacion === 'BIENVENIDA' || (c.codigo || '').toUpperCase().includes('BIENVENID')));
      if (existeOtroBienvenidaActivo) {
        this.modalAlertaService.warning(
          'Ya existe un cupón de bienvenida activo. Debes desactivar o editar el cupón actual antes de crear uno nuevo.',
          'Cupón de bienvenida duplicado'
        );
        return;
      }
    } else if (this.cuponEditando.tipoAplicacion === 'CATEGORIA') {
      if (!this.cuponEditando.categoriaAplicable || !this.cuponEditando.categoriaAplicable.trim()) {
        this.modalAlertaService.warning('Debes seleccionar una categoría para este cupón.', 'Alerta de validación');
        return;
      }
    } else if (this.cuponEditando.tipoAplicacion === 'LIQUIDACION') {
      if (!this.productosSeleccionadosEdit || this.productosSeleccionadosEdit.length === 0) {
        this.modalAlertaService.warning('Debes seleccionar al menos un producto para la aplicación de liquidación / específica.', 'Alerta de validación');
        return;
      }
      this.cuponEditando.productoIds = this.productosSeleccionadosEdit.join(',');
    }

    if (this.cuponEditando.montoMinimo != null && this.cuponEditando.montoMinimo < 0) {
      this.errorEdicionCupon = 'El monto mínimo no puede ser negativo.';
      return;
    }
    if (this.cuponEditando.fechaInicio && this.cuponEditando.fechaFin && this.cuponEditando.fechaInicio > this.cuponEditando.fechaFin) {
      this.errorEdicionCupon = 'La fecha de inicio no puede ser posterior a la fecha de fin.';
      return;
    }
    if (this.cuponEditando.limiteUso != null && this.cuponEditando.limiteUso < 1) {
      this.errorEdicionCupon = 'El límite de usos debe ser como mínimo 1.';
      return;
    }

    this.guardandoEdicion = true;
    this.errorEdicionCupon = '';

    const payload: Cupon = {
      ...this.cuponEditando,
      codigo: this.cuponEditando.codigo.toUpperCase().trim(),
      porcentajeDescuento: this.cuponEditando.porcentajeDescuento,
      activo: this.cuponEditando.activo,
      visibleWeb: this.cuponEditando.visibleWeb !== false,
      tipoAplicacion: this.cuponEditando.tipoAplicacion || 'GENERAL',
      categoriaAplicable: this.cuponEditando.tipoAplicacion === 'CATEGORIA' ? this.cuponEditando.categoriaAplicable : null,
      productoIds: this.cuponEditando.tipoAplicacion === 'LIQUIDACION' ? this.cuponEditando.productoIds : null,
      montoMinimo: (this.cuponEditando.montoMinimo != null && !isNaN(Number(this.cuponEditando.montoMinimo)) && Number(this.cuponEditando.montoMinimo) > 0)
        ? Number(this.cuponEditando.montoMinimo)
        : null,
      fechaInicio: this.cuponEditando.fechaInicio?.trim() || null,
      fechaFin: this.cuponEditando.fechaFin?.trim() || null,
      limiteUso: (this.cuponEditando.limiteUso != null && !isNaN(Number(this.cuponEditando.limiteUso)) && Number(this.cuponEditando.limiteUso) > 0)
        ? Math.floor(Number(this.cuponEditando.limiteUso))
        : null,
      usosActuales: this.cuponEditando.usosActuales ?? 0
    };

    this.adminCarritoService.actualizarCupon(this.cuponEditando.id, payload).subscribe({
      next: (res) => {
        const idx = this.cupones.findIndex(c => c.id === res.id);
        if (idx !== -1) {
          this.cupones[idx] = res;
        }
        this.cargarCupones();
        this.guardandoEdicion = false;
        this.cerrarModalEditar();
        this.mostrarToast('Cambios guardados exitosamente', 'Cupón actualizado');
      },
      error: (err) => {
        console.error('Error al actualizar cupon:', err);
        if (err?.status === 409 || err?.error?.message?.includes('bienvenida')) {
          this.modalAlertaService.warning(
            'Ya existe un cupón de bienvenida activo. Debes desactivar o editar el cupón actual antes de crear uno nuevo.',
            'Cupón de bienvenida duplicado'
          );
        } else {
          this.errorEdicionCupon = 'Error al actualizar el cupón. Verifica que el código no esté repetido.';
        }
        this.guardandoEdicion = false;
      }
    });
  }

  esCuponExpirado(cupon: Cupon): boolean {
    if (!cupon.fechaFin) return false;
    const hoy = new Date().toISOString().split('T')[0];
    return hoy > cupon.fechaFin;
  }

  toggleCuponEstado(cupon: Cupon) {
    const nuevoEstado = !cupon.activo;
    if (nuevoEstado && (cupon.tipoAplicacion === 'BIENVENIDA' || (cupon.codigo || '').toUpperCase().includes('BIENVENID'))) {
      const existeOtroActivo = this.cupones.some(c => c.id !== cupon.id && c.activo && (c.tipoAplicacion === 'BIENVENIDA' || (c.codigo || '').toUpperCase().includes('BIENVENID')));
      if (existeOtroActivo) {
        this.modalAlertaService.warning(
          'Ya existe un cupón de bienvenida activo. Debes desactivar o editar el cupón actual antes de crear uno nuevo.',
          'Cupón de bienvenida duplicado'
        );
        return;
      }
    }

    cupon.activo = nuevoEstado;
    const payload: Cupon = {
      ...cupon,
      activo: nuevoEstado,
      visibleWeb: cupon.visibleWeb !== false
    };

    this.adminCarritoService.actualizarCupon(cupon.id!, payload).subscribe({
      next: (res) => {
        const idx = this.cupones.findIndex(c => c.id === res.id);
        if (idx !== -1) {
          this.cupones[idx] = res;
        }
      },
      error: (err) => {
        console.error('Error al actualizar estado del cupón:', err);
        cupon.activo = !nuevoEstado;
        if (err?.status === 409 || err?.error?.message?.includes('bienvenida')) {
          this.modalAlertaService.warning(
            'Ya existe un cupón de bienvenida activo. Debes desactivar o editar el cupón actual antes de crear uno nuevo.',
            'Cupón de bienvenida duplicado'
          );
        }
      }
    });
  }

  toggleCuponActivo(cupon: Cupon) {
    this.toggleCuponEstado(cupon);
  }

  toggleProductoNuevo(id: number) {
    const idx = this.productosSeleccionadosNuevo.indexOf(id);
    if (idx >= 0) {
      this.productosSeleccionadosNuevo.splice(idx, 1);
    } else {
      this.productosSeleccionadosNuevo.push(id);
    }
  }

  toggleProductoEdit(id: number) {
    const idx = this.productosSeleccionadosEdit.indexOf(id);
    if (idx >= 0) {
      this.productosSeleccionadosEdit.splice(idx, 1);
    } else {
      this.productosSeleccionadosEdit.push(id);
    }
  }

  esProductoSeleccionadoNuevo(id: any): boolean {
    return this.productosSeleccionadosNuevo.includes(Number(id));
  }

  esProductoSeleccionadoEdit(id: any): boolean {
    return this.productosSeleccionadosEdit.includes(Number(id));
  }

  obtenerProductosFiltradosNuevo(): any[] {
    if (!this.filtroProductosNuevo.trim()) return this.productosDisponibles;
    const f = this.filtroProductosNuevo.toLowerCase().trim();
    return this.productosDisponibles.filter(p => (p.nombre || '').toLowerCase().includes(f));
  }

  obtenerProductosFiltradosEdit(): any[] {
    if (!this.filtroProductosEdit.trim()) return this.productosDisponibles;
    const f = this.filtroProductosEdit.toLowerCase().trim();
    return this.productosDisponibles.filter(p => (p.nombre || '').toLowerCase().includes(f));
  }

  obtenerEtiquetaTipo(cupon: Cupon): string {
    const tipo = (cupon.tipoAplicacion || '').toUpperCase().trim();
    switch (tipo) {
      case 'BIENVENIDA':
        return 'Bienvenida';
      case 'CATEGORIA':
        return `Cat: ${cupon.categoriaAplicable || 'General'}`;
      case 'OFERTAS':
      case 'OFERTA':
        return 'Solo Ofertas';
      case 'LIQUIDACION':
        return 'Liquidación';
      case 'GENERAL':
      default:
        return 'General';
    }
  }

  mostrarToast(mensaje: string, titulo: string = '') {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
    this.toastTitulo = titulo;
    this.toastMensaje = mensaje;
    this.toastVisible = true;
    this.toastTimer = setTimeout(() => {
      this.toastVisible = false;
    }, 2800);
  }

  toggleCuponVisibleWeb(cupon: Cupon) {
    const nuevoValor = cupon.visibleWeb === false;
    cupon.visibleWeb = nuevoValor;
    const payload: Cupon = {
      ...cupon,
      visibleWeb: nuevoValor,
      activo: cupon.activo
    };

    this.adminCarritoService.actualizarCupon(cupon.id!, payload).subscribe({
      next: (res) => {
        const idx = this.cupones.findIndex(c => c.id === res.id);
        if (idx !== -1) {
          this.cupones[idx] = res;
        }
      },
      error: (err) => {
        console.error('Error al actualizar visibilidad de cupón:', err);
        cupon.visibleWeb = !nuevoValor;
      }
    });
  }

  async eliminarCupon(cupon: Cupon) {
    const confirmado = await this.modalAlertaService.confirm({
      titulo: '¿Eliminar cupón?',
      mensaje: `¿Estás seguro de eliminar el cupón "${cupon.codigo}"?`,
      tipo: 'peligro',
      textoConfirmar: 'Sí, eliminar',
      textoCancelar: 'Cancelar'
    });
    if (confirmado) {
      this.adminCarritoService.eliminarCupon(cupon.id!).subscribe({
        next: () => {
          this.cupones = this.cupones.filter(c => c.id !== cupon.id);
        },
        error: (err) => {
          console.error('Error al eliminar cupon:', err);
          this.modalAlertaService.error('Ocurrió un error al intentar eliminar el cupón.');
        }
      });
    }
  }

  cambiarPestana(pestana: 'config' | 'cupones') {
    this.pestanaActiva = pestana;
  }
}
