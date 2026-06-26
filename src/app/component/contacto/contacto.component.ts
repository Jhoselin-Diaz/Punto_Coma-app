import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ClienteLayoutComponent } from '../cliente-layout/cliente-layout.component';
import { ContactoService, ContactoBlock, ContactoCierre } from '../../service/contacto.service';

@Component({
  selector: 'app-contacto',
  standalone: true,
  imports: [CommonModule, ClienteLayoutComponent],
  templateUrl: './contacto.component.html',
  styleUrl: './contacto.component.css'
})
export class ContactoComponent implements OnInit {
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

  constructor(private contactoService: ContactoService) {}

  ngOnInit() {
    this.isContactLoading = true;
    this.contactoService.getBloques().subscribe({
      next: (blocks) => {
        this.blockWa = blocks.find(b => b.id === 'block-wa') || this.blockWa;
        this.blockIg = blocks.find(b => b.id === 'block-ig') || this.blockIg;
        this.blockSupport = blocks.find(b => b.id === 'block-support') || this.blockSupport;
        this.blockEmail = blocks.find(b => b.id === 'block-email') || this.blockEmail;
        this.blockInfo = blocks.find(b => b.id === 'block-info') || this.blockInfo;

        this.contactoService.getCierre().subscribe({
          next: (cierre) => {
            this.contactoWaBottom = cierre;
            this.isContactLoading = false;
          },
          error: (err) => {
            console.error('Error al cargar cierre del banner de contacto', err);
            this.isContactLoading = false;
          }
        });
      },
      error: (err) => {
        console.error('Error al cargar bloques de contacto', err);
        this.isContactLoading = false;
      }
    });
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
