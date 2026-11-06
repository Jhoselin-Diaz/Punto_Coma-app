import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { ContactoService, ContactoBlock, ContactoCierre } from '../../../service/contacto.service';
import { ConfiguracionService } from '../../../service/configuracion.service';
import { ProductosService } from '../../../service/productos.service';

@Component({
  selector: 'app-admin-contacto',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-contacto.component.html',
  styleUrl: './admin-contacto.component.css'
})
export class AdminContactoComponent implements OnInit, OnDestroy {
  contactoBlocks: ContactoBlock[] = [];
  contactoWaBottom: ContactoCierre = {
    btnText: '',
    number: '',
    message: '',
    visible: true
  };

  isContactLoading = false;
  private routeSub?: Subscription;
  pendingEditBlockId: string | null = null;

  // Modals state
  showBlockModal = false;

  editingBlock: ContactoBlock = {
    id: '',
    title: '',
    description: '',
    icon: 'whatsapp',
    btnText: '',
    btnLink: '',
    visible: true
  };

  public inputCierreTitulo: string = '';
  public inputCierreSubtitulo: string = '';
  public inputCierreLink: string = '';

  // Propiedades de validación y configuración de horarios
  phoneError = '';
  emailError = '';
  horarioError = '';

  diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  horasList = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  minutosList = ['00', '15', '30', '45'];
  ampmList = ['am', 'pm'];

  diaInicio = 'Lun';
  diaFin = 'Sáb';
  horaInicio = 10;
  minInicio = '00';
  ampmInicio = 'am';
  horaFin = 7;
  minFin = '00';
  ampmFin = 'pm';

  constructor(
    private contactoService: ContactoService,
    private configService: ConfiguracionService,
    private productosService: ProductosService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.cargarDatos();

    this.routeSub = this.route.queryParams.subscribe(params => {
      if (params['action'] === 'edit' && params['id']) {
        const idStr = String(params['id']);
        this.pendingEditBlockId = idStr;
        this.verificarAperturaModalEdicion(idStr);
      } else {
        this.pendingEditBlockId = null;
        if (this.showBlockModal) {
          this.showBlockModal = false;
        }
      }
    });
  }

  ngOnDestroy() {
    this.routeSub?.unsubscribe();
  }

  private verificarAperturaModalEdicion(id: string): void {
    if (this.contactoBlocks && this.contactoBlocks.length > 0) {
      const block = this.contactoBlocks.find(b => b.id === id);
      if (block) {
        this.openEditBlock(block, false);
      }
    }
  }

  cargarDatos() {
    this.isContactLoading = true;
    this.contactoService.getBloques().subscribe({
      next: (blocks) => {
        const orderMap = {
          'block-wa': 1,
          'block-ig': 2,
          'block-support': 3,
          'block-email': 4,
          'block-info': 5
        };
        this.contactoBlocks = blocks.sort((a, b) => {
          return (orderMap[a.id as keyof typeof orderMap] || 99) - (orderMap[b.id as keyof typeof orderMap] || 99);
        });

        // Limpieza de datos en teléfono para mostrar número limpio si viene con wa.me
        this.contactoBlocks.forEach(b => {
          if (b.id === 'block-wa' && b.btnLink) {
            const match = b.btnLink.match(/\d{9}$/);
            if (match) {
              b.btnLink = match[0];
            }
          }
        });

        if (this.pendingEditBlockId) {
          this.verificarAperturaModalEdicion(this.pendingEditBlockId);
        }

        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al cargar bloques de contacto', err);
      }
    });

    this.contactoService.getCierre().subscribe({
      next: (cierre) => {
        this.contactoWaBottom = cierre;
        this.inputCierreTitulo = cierre.btnText || '';
        this.inputCierreSubtitulo = cierre.message || '';
        this.inputCierreLink = cierre.number || '';
        this.isContactLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al cargar cierre de contacto', err);
        this.isContactLoading = false;
      }
    });
  }

  toggleVisible(block: ContactoBlock) {
    block.visible = !block.visible;
    this.contactoService.updateBloque(block.id, block).subscribe({
      next: (res) => {
        const idx = this.contactoBlocks.findIndex(b => b.id === block.id);
        if (idx !== -1) {
          this.contactoBlocks[idx] = res;
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al actualizar visibilidad del block', err);
        block.visible = !block.visible;
        this.cdr.detectChanges();
      }
    });
  }

  openEditBlock(block: ContactoBlock, updateUrl = true) {
    this.editingBlock = { ...block };
    this.phoneError = '';
    this.emailError = '';
    this.horarioError = '';

    if (block.id === 'block-wa') {
      const raw = (block.btnLink || '').trim();
      const match = raw.match(/\d{9}$/);
      this.editingBlock.btnLink = match ? match[0] : raw;
    } else if (block.id === 'block-support') {
      this.parseHorario(block.btnText);
      this.actualizarHorarioGenerado();
    }

    this.showBlockModal = true;
    if (updateUrl && block.id) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { action: 'edit', id: block.id },
        queryParamsHandling: 'merge'
      });
    }
  }

  closeBlockModal() {
    this.showBlockModal = false;
    this.pendingEditBlockId = null;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { action: null, id: null },
      queryParamsHandling: 'merge'
    });
    this.cdr.detectChanges();
  }

  parseHorario(text: string) {
    if (!text) {
      this.diaInicio = 'Lun';
      this.diaFin = 'Sáb';
      this.horaInicio = 10;
      this.minInicio = '00';
      this.ampmInicio = 'am';
      this.horaFin = 7;
      this.minFin = '00';
      this.ampmFin = 'pm';
      return;
    }

    const match = text.match(/^([A-Za-záéíóúÁÉÍÓÚ]+)(?:\s+a\s+([A-Za-záéíóúÁÉÍÓÚ]+))?\s+(\d{1,2}):(\d{2})\s*(am|pm)\s*-\s*(\d{1,2}):(\d{2})\s*(am|pm)/i);
    if (match) {
      this.diaInicio = match[1];
      this.diaFin = match[2] || match[1];
      this.horaInicio = Number(match[3]);
      this.minInicio = match[4];
      this.ampmInicio = match[5].toLowerCase();
      this.horaFin = Number(match[6]);
      this.minFin = match[7];
      this.ampmFin = match[8].toLowerCase();
    }
  }

  onHorarioChange() {
    this.actualizarHorarioGenerado();
  }

  actualizarHorarioGenerado() {
    const diaStr = this.diaInicio === this.diaFin ? this.diaInicio : `${this.diaInicio} a ${this.diaFin}`;
    const timeStr = `${this.horaInicio}:${this.minInicio} ${this.ampmInicio} - ${this.horaFin}:${this.minFin} ${this.ampmFin}`;
    this.editingBlock.btnText = `${diaStr} ${timeStr}`;
    this.horarioError = '';
  }

  validarTelefonoWa(): boolean {
    const phone = (this.editingBlock.btnLink || '').trim();
    if (!phone) {
      this.phoneError = 'El número de teléfono es obligatorio.';
      return false;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 9) {
      this.phoneError = 'El teléfono debe contener exactamente 9 dígitos.';
      return false;
    }
    this.phoneError = '';
    return true;
  }

  validarEmail(): boolean {
    const email = (this.editingBlock.btnText || '').trim();
    if (!email) {
      this.emailError = 'El correo electrónico es obligatorio.';
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      this.emailError = 'Ingresa un correo electrónico válido.';
      return false;
    }
    this.emailError = '';
    return true;
  }

  saveBlock() {
    if (this.editingBlock.id === 'block-wa') {
      if (!this.validarTelefonoWa()) return;
      const phone = (this.editingBlock.btnLink || '').trim().replace(/\D/g, '');
      this.editingBlock.btnLink = `https://wa.me/51${phone}`;
    } else if (this.editingBlock.id === 'block-email') {
      if (!this.validarEmail()) return;
      this.editingBlock.btnLink = `mailto:${this.editingBlock.btnText.trim()}`;
    } else if (this.editingBlock.id === 'block-support') {
      this.editingBlock.btnLink = '';
    }

    this.contactoService.updateBloque(this.editingBlock.id, this.editingBlock).subscribe({
      next: (res) => {
        const idx = this.contactoBlocks.findIndex(b => b.id === this.editingBlock.id);
        if (idx !== -1) {
          this.contactoBlocks[idx] = res;
        }
        this.closeBlockModal();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al guardar bloque de contacto', err);
        alert('Ocurrió un error al intentar guardar los cambios.');
      }
    });
  }

  guardarCierreDirecto() {
    const payload: ContactoCierre = {
      id: this.contactoWaBottom.id,
      btnText: this.inputCierreTitulo,
      message: this.inputCierreSubtitulo,
      number: this.inputCierreLink,
      visible: this.contactoWaBottom.visible
    };
    this.contactoService.updateCierre(payload).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          this.contactoWaBottom = res;
          this.inputCierreTitulo = res.btnText || '';
          this.inputCierreSubtitulo = res.message || '';
          this.inputCierreLink = res.number || '';
        });
        this.configService.cargarDesdeBackend(true).subscribe();
        this.productosService.obtenerProductosPublicos(true).subscribe();

        alert('Cambios del banner de cierre guardados correctamente.');
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al guardar cierre de contacto', err);
        alert('Ocurrió un error al intentar guardar los cambios.');
      }
    });
  }
}
