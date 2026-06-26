import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface OfertaAdmin {
  id: number;
  producto: string;
  precioOriginal: number;
  precioOferta: number;
  descuento: number; // Porcentaje auto-calculado
  fechaInicio: string;
  fechaFin: string;
  visible: boolean;
  banner?: string;
}

@Component({
  selector: 'app-admin-ofertas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-ofertas.component.html',
  styleUrl: './admin-ofertas.component.css'
})
export class AdminOfertasComponent implements OnInit {
  showAddOfferModal = false;
  showEditOfferModal = false;

  statsOfertas = {
    activas: 0,
    productosDescuento: 0,
    proximas: 0
  };

  ofertasList: OfertaAdmin[] = [];

  newOffer: OfertaAdmin = {
    id: 0,
    producto: '',
    precioOriginal: 0,
    precioOferta: 0,
    descuento: 0,
    fechaInicio: '',
    fechaFin: '',
    visible: true,
    banner: ''
  };

  editingOffer: OfertaAdmin = {
    id: 0,
    producto: '',
    precioOriginal: 0,
    precioOferta: 0,
    descuento: 0,
    fechaInicio: '',
    fechaFin: '',
    visible: true,
    banner: ''
  };

  constructor() {}

  ngOnInit() {
    // Inicializar lógica de ofertas locales
  }

  getDescuentoPorcentaje(original: number | null, oferta: number | null): number {
    if (!original || !oferta || original <= 0) return 0;
    const diff = original - oferta;
    return Math.max(0, Math.round((diff * 100) / original));
  }

  toggleVisible(item: { visible: boolean }) {
    item.visible = !item.visible;
  }

  openAddOffer() {
    this.newOffer = {
      id: 0,
      producto: 'Taza de vidrio verde',
      precioOriginal: 45,
      precioOferta: 35,
      descuento: 22,
      fechaInicio: '2026-05-20',
      fechaFin: '2026-06-20',
      visible: true,
      banner: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=2874&auto=format&fit=crop'
    };
    this.showAddOfferModal = true;
  }

  openEditOffer(of: OfertaAdmin) {
    this.editingOffer = {...of};
    this.showEditOfferModal = true;
  }

  eliminarFila(array: any[], index: number) {
    array.splice(index, 1);
  }
}
