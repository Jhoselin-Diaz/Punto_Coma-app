import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AdminAuthService, AdminUser } from '../../service/admin-auth.service';
import { AdminNotificationService, AlertaNotificacion } from '../../service/admin-notification.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.css'
})
export class AdminLayoutComponent implements OnInit, OnDestroy {
  mostrarMenuCuenta: boolean = false;
  mostrarMenuNotificaciones: boolean = false;
  sidebarMobileAbierto: boolean = false;
  notificacionesCount: number = 0;
  alertas: AlertaNotificacion[] = [];
  private destroy$ = new Subject<void>();

  constructor(
    public authService: AdminAuthService,
    public notifService: AdminNotificationService,
    private router: Router
  ) {}

  toggleSidebarMobile(): void {
    this.sidebarMobileAbierto = !this.sidebarMobileAbierto;
  }

  cerrarSidebarMobile(): void {
    this.sidebarMobileAbierto = false;
  }

  ngOnInit(): void {
    this.notifService.unreadCount$
      .pipe(takeUntil(this.destroy$))
      .subscribe(count => {
        this.notificacionesCount = count;
      });

    this.notifService.alerts$
      .pipe(takeUntil(this.destroy$))
      .subscribe(alerts => {
        this.alertas = alerts;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get adminActual(): AdminUser | null {
    return this.authService.adminActual;
  }

  toggleMenuCuenta(event?: Event): void {
    if (event) event.stopPropagation();
    this.mostrarMenuCuenta = !this.mostrarMenuCuenta;
    if (this.mostrarMenuCuenta) {
      this.mostrarMenuNotificaciones = false;
    }
  }

  toggleMenuNotificaciones(event?: Event): void {
    if (event) event.stopPropagation();
    this.mostrarMenuNotificaciones = !this.mostrarMenuNotificaciones;
    if (this.mostrarMenuNotificaciones) {
      this.mostrarMenuCuenta = false;
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.notif-dropdown-wrapper') && !target.closest('.account-dropdown-wrapper')) {
      this.mostrarMenuNotificaciones = false;
      this.mostrarMenuCuenta = false;
    }
  }

  navegarAlerta(al: AlertaNotificacion, event?: Event): void {
    if (event) event.stopPropagation();
    this.mostrarMenuNotificaciones = false;
    if (al.pedidoId) {
      this.router.navigate(['/admin/pedidos'], { queryParams: { id: al.pedidoId } });
    } else if (al.chatId) {
      this.router.navigate(['/admin/chats']);
    } else if (al.ruta) {
      this.router.navigateByUrl(al.ruta);
    }
  }

  verTodasAlertas(event?: Event): void {
    if (event) event.stopPropagation();
    this.mostrarMenuNotificaciones = false;
    if (this.router.url.includes('/admin/dashboard')) {
      const el = document.querySelector('.dash-alerts-card');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else {
      this.router.navigate(['/admin/dashboard']);
    }
  }

  cerrarSesion(): void {
    this.mostrarMenuCuenta = false;
    this.mostrarMenuNotificaciones = false;
    this.authService.logout(true);
  }
}
