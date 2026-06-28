import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminLayoutComponent } from '../../admin-layout/admin-layout.component';
import { AdminCarritoService, ConfiguracionCarrito, Cupon } from '../../../service/admin-carrito.service';

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

  // Cupones
  cupones: Cupon[] = [];
  nuevoCupon: Cupon = {
    codigo: '',
    porcentajeDescuento: 10,
    activo: true
  };
  guardandoCupon = false;
  errorCupon = '';

  constructor(private adminCarritoService: AdminCarritoService) {}

  ngOnInit() {
    this.cargarConfiguracion();
    this.cargarCupones();
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
    this.guardandoCupon = true;
    this.errorCupon = '';
    
    this.nuevoCupon.codigo = this.nuevoCupon.codigo.toUpperCase().trim();

    this.adminCarritoService.crearCupon(this.nuevoCupon).subscribe({
      next: (res) => {
        this.cupones.push(res);
        this.nuevoCupon = {
          codigo: '',
          porcentajeDescuento: 10,
          activo: true
        };
        this.guardandoCupon = false;
      },
      error: (err) => {
        console.error('Error al crear cupon:', err);
        this.errorCupon = 'Error al guardar el cupón. Es posible que el código ya exista.';
        this.guardandoCupon = false;
      }
    });
  }

  toggleCuponActivo(cupon: Cupon) {
    cupon.activo = !cupon.activo;
    this.adminCarritoService.actualizarCupon(cupon.id!, cupon).subscribe({
      next: (res) => {
        const idx = this.cupones.findIndex(c => c.id === res.id);
        if (idx !== -1) {
          this.cupones[idx] = res;
        }
      },
      error: (err) => {
        console.error('Error al actualizar cupon:', err);
        cupon.activo = !cupon.activo;
      }
    });
  }

  eliminarCupon(cupon: Cupon) {
    if (confirm(`¿Estás seguro de eliminar el cupón "${cupon.codigo}"?`)) {
      this.adminCarritoService.eliminarCupon(cupon.id!).subscribe({
        next: () => {
          this.cupones = this.cupones.filter(c => c.id !== cupon.id);
        },
        error: (err) => console.error('Error al eliminar cupon:', err)
      });
    }
  }

  cambiarPestana(pestana: 'config' | 'cupones') {
    this.pestanaActiva = pestana;
  }
}
