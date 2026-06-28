import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
export class AdminContactoComponent implements OnInit {
  contactoBlocks: ContactoBlock[] = [];
  contactoWaBottom: ContactoCierre = {
    btnText: '',
    number: '',
    message: '',
    visible: true
  };

  isContactLoading = false;

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

  constructor(
    private contactoService: ContactoService,
    private configService: ConfiguracionService,
    private productosService: ProductosService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    this.cargarDatos();
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
        block.visible = !block.visible; // revert on error
        this.cdr.detectChanges();
      }
    });
  }

  openEditBlock(block: ContactoBlock) {
    this.editingBlock = { ...block };
    this.showBlockModal = true;
  }

  saveBlock() {
    this.contactoService.updateBloque(this.editingBlock.id, this.editingBlock).subscribe({
      next: (res) => {
        const idx = this.contactoBlocks.findIndex(b => b.id === this.editingBlock.id);
        if (idx !== -1) {
          this.contactoBlocks[idx] = res;
        }
        this.showBlockModal = false;
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
        // Forzar actualización inteligente y destrucción de cachés viejas para el cliente en segundo plano
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
