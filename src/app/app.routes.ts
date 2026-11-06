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
import { AdminWhatsappComponent } from './component/admin-whatsapp/admin-whatsapp.component';
import { CarritoComponent } from './component/carrito/carrito.component';
import { AdminCarritoComponent } from './component/admin-contenido-web/admin-carrito/admin-carrito.component';
import { RastreoComponent } from './component/rastreo/rastreo.component';

export const routes: Routes = [
  { path: '', redirectTo: 'inicio', pathMatch: 'full' },
  { path: 'inicio', component: InicioComponent },
  { path: 'productos', component: ProductosComponent },
  { path: 'productos/:id', component: DetalleProductoComponent },
  { path: 'rastreo', component: RastreoComponent },
  { path: 'admin/login', component: AdminLoginComponent },
  { path: 'admin/crear-cuenta', component: AdminCrearCuentaComponent },
  { path: 'admin/pedidos', component: AdminPedidosComponent },
  { path: 'admin/chats', component: AdminChatsComponent },
  { path: 'ofertas', component: OfertasComponent },
  { path: 'shop-video', component: ShopVideoComponent },
  { path: 'contacto', component: ContactoComponent },
  { path: 'admin/contenido-web', component: AdminContenidoWebComponent },
  { path: 'admin/contenido-web/inicio', component: AdminContenidoWebComponent },
  { path: 'admin/contenido-web/inicio/banner-principal', component: AdminContenidoWebComponent },
  { path: 'admin/contenido-web/inicio/categorias-destacadas', component: AdminContenidoWebComponent },
  { path: 'admin/contenido-web/inicio/productos-destacados', component: AdminContenidoWebComponent },
  { path: 'admin/contenido-web/inicio/configuracion-visual', component: AdminContenidoWebComponent },
  { path: 'admin/contenido-web/inicio/:tab', component: AdminContenidoWebComponent },
  { path: 'admin/contenido-web/inicio/:tab/:action/:id', component: AdminContenidoWebComponent },
  { path: 'admin/contenido-web/productos', component: AdminContenidoWebComponent },
  { path: 'admin/contenido-web/ofertas', component: AdminContenidoWebComponent },
  { path: 'admin/contenido-web/shop-video', component: AdminContenidoWebComponent },
  { path: 'admin/contenido-web/contacto', component: AdminContenidoWebComponent },
  { path: 'admin/contenido-web/rastreo', component: AdminContenidoWebComponent },
  { path: 'admin/productos', redirectTo: 'admin/contenido-web/productos', pathMatch: 'full' },
  { path: 'admin/inventario', component: AdminInventarioComponent },
  { path: 'admin/dashboard', component: AdminDashboardComponent },
  { path: 'admin/reportes', component: AdminReportesComponent },
  { path: 'admin/configuracion', component: AdminConfiguracionComponent },
  { path: 'admin/configuracion/whatsapp', component: AdminWhatsappComponent },
  { path: 'carrito', component: CarritoComponent },
  { path: 'admin/carrito', component: AdminCarritoComponent },
  { path: '**', redirectTo: 'productos' }
];


// Rebuild trigger comment.
