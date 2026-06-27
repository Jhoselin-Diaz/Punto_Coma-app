import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ClienteLayoutComponent } from '../cliente-layout/cliente-layout.component';
import { ContactoService, ContactoBlock, ContactoCierre } from '../../service/contacto.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-contacto',
  standalone: true,
  imports: [CommonModule, ClienteLayoutComponent],
  templateUrl: './contacto.component.html',
  styleUrl: './contacto.component.css'
})
export class ContactoComponent implements OnInit, OnDestroy {
  blockWa: ContactoBlock = {
    id: 'block-wa',
    title: '',
    description: '',
    icon: 'whatsapp',
    btnText: '',
    btnLink: '',
    visible: true
  };
  blockIg: ContactoBlock = {
    id: 'block-ig',
    title: '',
    description: '',
    icon: 'instagram',
    btnText: '',
    btnLink: '',
    visible: true
  };
  blockSupport: ContactoBlock = {
    id: 'block-support',
    title: '',
    description: '',
    icon: 'support',
    btnText: '',
    btnLink: '',
    visible: true
  };
  blockEmail: ContactoBlock = {
    id: 'block-email',
    title: '',
    description: '',
    icon: 'email',
    btnText: '',
    btnLink: '',
    visible: true
  };
  blockInfo: ContactoBlock = {
    id: 'block-info',
    title: '',
    description: '',
    icon: 'info',
    btnText: '',
    btnLink: '',
    visible: true
  };
  contactoWaBottom: ContactoCierre = {
    btnText: '',
    number: '',
    message: '',
    visible: true
  };

  isContactLoading = true;
  private subBlocks?: Subscription;
  private subCierre?: Subscription;

  constructor(private contactoService: ContactoService) {}

  ngOnInit() {
    this.isContactLoading = true;

    // Subscribe to reactive blocks channel
    this.subBlocks = this.contactoService.blocks$.subscribe({
      next: (blocks) => {
        if (blocks) {
          this.blockWa = blocks.find(b => b.id === 'block-wa') || this.blockWa;
          this.blockIg = blocks.find(b => b.id === 'block-ig') || this.blockIg;
          this.blockSupport = blocks.find(b => b.id === 'block-support') || this.blockSupport;
          this.blockEmail = blocks.find(b => b.id === 'block-email') || this.blockEmail;
          this.blockInfo = blocks.find(b => b.id === 'block-info') || this.blockInfo;
        }
      }
    });

    // Subscribe to reactive cierre channel
    this.subCierre = this.contactoService.cierre$.subscribe({
      next: (cierre) => {
        if (cierre) {
          this.contactoWaBottom = cierre;
          this.isContactLoading = false;
        }
      }
    });

    // Trigger initial load from backend
    this.contactoService.getBloques().subscribe({
      error: () => this.isContactLoading = false
    });
    this.contactoService.getCierre().subscribe({
      error: () => this.isContactLoading = false
    });
  }

  ngOnDestroy() {
    if (this.subBlocks) {
      this.subBlocks.unsubscribe();
    }
    if (this.subCierre) {
      this.subCierre.unsubscribe();
    }
  }

  irAlEnlace(enlace: string) {
    if (!enlace) return;
    window.open(enlace, '_blank');
  }

  irAWhatsApp(numero: string, mensaje: string) {
    if (!numero) return;
    const cleanNum = numero.replace(/\s+/g, '');
    const url = `https://wa.me/${cleanNum}?text=${encodeURIComponent(mensaje || '')}`;
    window.open(url, '_blank');
  }
}
