import { Routes } from '@angular/router';
import { InicioComponent } from './component/inicio/inicio.component';
import { ProductosComponent } from './component/productos/productos.component';
import { DetalleProductoComponent } from './component/detalle-producto/detalle-producto.component';
import { AdminLoginComponent } from './component/admin-login/admin-login.component';
import { AdminCrearCuentaComponent } from './component/admin-crear-cuenta/admin-crear-cuenta.component';
import { AdminPedidosComponent } from './component/admin-pedidos/admin-pedidos.component';
import { AdminChatsComponent } from './component/admin-chats/admin-chats.component';
import { OfertasComponent } from './component/ofertas/ofertas.component';
import { ShopVideoComponent } from './component/shop-video/shop-video.component';
import { ContactoComponent } from './component/contacto/contacto.component';
import { AdminContenidoWebComponent } from './component/admin-contenido-web/admin-contenido-web.component';
import { AdminInventarioComponent } from './component/admin-inventario/admin-inventario.component';
import { AdminDashboardComponent } from './component/admin-dashboard/admin-dashboard.component';
import { AdminReportesComponent } from './component/admin-reportes/admin-reportes.component';
import { AdminConfiguracionComponent } from './component/admin-configuracion/admin-configuracion.component';
import { CarritoComponent } from './component/carrito/carrito.component';
import { AdminCarritoComponent } from './component/admin-contenido-web/admin-carrito/admin-carrito.component';

export const routes: Routes = [
  { path: '', redirectTo: 'inicio', pathMatch: 'full' },
  { path: 'inicio', component: InicioComponent },
  { path: 'productos', component: ProductosComponent },
  { path: 'productos/:id', component: DetalleProductoComponent },
  { path: 'admin/login', component: AdminLoginComponent },
  { path: 'admin/crear-cuenta', component: AdminCrearCuentaComponent },
  { path: 'admin/pedidos', component: AdminPedidosComponent },
  { path: 'admin/chats', component: AdminChatsComponent },
  { path: 'ofertas', component: OfertasComponent },
  { path: 'shop-video', component: ShopVideoComponent },
  { path: 'contacto', component: ContactoComponent },
  { path: 'admin/contenido-web', component: AdminContenidoWebComponent },
  { path: 'admin/inventario', component: AdminInventarioComponent },
  { path: 'admin/dashboard', component: AdminDashboardComponent },
  { path: 'admin/reportes', component: AdminReportesComponent },
  { path: 'admin/configuracion', component: AdminConfiguracionComponent },
  { path: 'carrito', component: CarritoComponent },
  { path: 'admin/carrito', component: AdminCarritoComponent }
];


// Rebuild trigger comment.
