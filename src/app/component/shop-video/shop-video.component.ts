import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ClienteLayoutComponent } from '../cliente-layout/cliente-layout.component';
import { ConfiguracionService } from '../../service/configuracion.service';

interface Product {
  id: string;
  nombre: string;
  precio: number;
  precioAnterior: number;
  imagen: string;
}

interface VideoRow {
  id: number;
  titulo: string;
  duracion: string;
  likes: string;
  comentarios: string;
  videoMiniatura: string;
  productos: Product[];
}

@Component({
  selector: 'app-shop-video',
  standalone: true,
  imports: [CommonModule, RouterLink, ClienteLayoutComponent],
  templateUrl: './shop-video.component.html',
  styleUrl: './shop-video.component.css'
})
export class ShopVideoComponent {
  videos: VideoRow[] = [];

  constructor(public configService: ConfiguracionService) {}
}
