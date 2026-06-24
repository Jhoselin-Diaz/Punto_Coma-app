import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ConfiguracionService } from '../../service/configuracion.service';

@Component({
  selector: 'app-cliente-layout',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './cliente-layout.component.html',
  styleUrl: './cliente-layout.component.css'
})
export class ClienteLayoutComponent {
  constructor(public configService: ConfiguracionService) {}
}
