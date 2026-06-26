import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface ContactoBlock {
  id: string;
  title: string;
  description: string;
  icon: 'whatsapp' | 'instagram' | 'support' | 'email' | 'info';
  btnText: string;
  btnLink: string;
  visible: boolean;
}

@Component({
  selector: 'app-admin-contacto',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-contacto.component.html',
  styleUrl: './admin-contacto.component.css'
})
export class AdminContactoComponent implements OnInit {
  contactoBlocks: ContactoBlock[] = [
    {
      id: 'block-wa',
      title: 'WhatsApp Ventas',
      description: 'Escríbenos directamente para consultas rápidas, pedidos mayoristas o dudas de stock.',
      icon: 'whatsapp',
      btnText: 'Iniciar Chat',
      btnLink: 'https://wa.me/51987654321',
      visible: true
    },
    {
      id: 'block-ig',
      title: 'Instagram Oficial',
      description: 'Síguenos en @puntoycoma_art para ver novedades diarias, procesos de producción y sorteos.',
      icon: 'instagram',
      btnText: 'Ir a Perfil',
      btnLink: 'https://instagram.com/puntoycoma_art',
      visible: true
    },
    {
      id: 'block-support',
      title: 'Soporte y Reclamos',
      description: '¿Tuviste algún problema con tu envío? Escríbenos y te daremos respuesta prioritaria.',
      icon: 'support',
      btnText: 'Soporte Técnico',
      btnLink: 'https://wa.me/51987654322',
      visible: true
    },
    {
      id: 'block-email',
      title: 'Correo Electrónico',
      description: 'Para propuestas comerciales, colaboraciones o facturación, envíanos un email.',
      icon: 'email',
      btnText: 'Enviar Email',
      btnLink: 'mailto:contacto@puntoycoma.pe',
      visible: true
    },
    {
      id: 'block-info',
      title: 'Horario de Atención',
      description: 'Lunes a Viernes de 9:00 am a 6:00 pm. Sábados de 9:00 am a 1:00 pm.',
      icon: 'info',
      btnText: 'Ver Preguntas Frecuentes',
      btnLink: '/faq',
      visible: true
    }
  ];

  contactoWaBottom = {
    btnText: '¿Necesitas ayuda? Escríbenos',
    number: '+51 987 654 321',
    message: 'Hola! Deseo recibir información sobre los productos.',
    visible: true
  };

  showBlockModal = false;
  showWaBottomModal = false;

  editingBlock: ContactoBlock = {
    id: '',
    title: '',
    description: '',
    icon: 'whatsapp',
    btnText: '',
    btnLink: '',
    visible: true
  };

  editingWaBottom = {
    btnText: '',
    number: '',
    message: '',
    visible: true
  };

  ngOnInit() {}

  toggleVisible(item: { visible: boolean }) {
    item.visible = !item.visible;
  }

  openEditBlock(block: ContactoBlock) {
    this.editingBlock = { ...block };
    this.showBlockModal = true;
  }

  saveBlock() {
    const idx = this.contactoBlocks.findIndex(b => b.id === this.editingBlock.id);
    if (idx !== -1) {
      this.contactoBlocks[idx] = { ...this.editingBlock };
    }
    this.showBlockModal = false;
    alert('Información de contacto guardada exitosamente (Local).');
  }

  openEditWaBottom() {
    this.editingWaBottom = { ...this.contactoWaBottom };
    this.showWaBottomModal = true;
  }

  saveWaBottom() {
    this.contactoWaBottom = { ...this.editingWaBottom };
    this.showWaBottomModal = false;
    alert('Botón flotante de WhatsApp guardado exitosamente (Local).');
  }
}
