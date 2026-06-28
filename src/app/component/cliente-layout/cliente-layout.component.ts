import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ConfiguracionService } from '../../service/configuracion.service';
import { CartService } from '../../service/cart.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-cliente-layout',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './cliente-layout.component.html',
  styleUrl: './cliente-layout.component.css'
})
export class ClienteLayoutComponent implements OnInit, OnDestroy {
  cantidadTotal = 0;
  private sub = new Subscription();

  constructor(
    public configService: ConfiguracionService,
    private cartService: CartService
  ) {}

  ngOnInit() {
    this.sub.add(
      this.cartService.items$.subscribe(items => {
        this.cantidadTotal = items.reduce((acc, item) => acc + item.cantidad, 0);
      })
    );
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }
}
