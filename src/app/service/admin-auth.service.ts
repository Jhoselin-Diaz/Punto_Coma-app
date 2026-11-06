import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { ModalAlertaService } from './modal-alerta.service';

export interface AdminUser {
  id?: number | string;
  nombreCompleto: string;
  correo: string;
  rol?: string;
  token?: string;
}

export interface LoginResponse {
  success?: boolean;
  mensaje?: string;
  admin?: AdminUser;
  token?: string;
  id?: number | string;
  nombreCompleto?: string;
  correo?: string;
  rol?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdminAuthService {
  private apiUrl = `${environment.apiUrl}/auth/admin`;
  private readonly STORAGE_KEY = 'puntoycoma_admin_session';

  private currentAdminSubject = new BehaviorSubject<AdminUser | null>(null);
  public currentAdmin$ = this.currentAdminSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router,
    private modalAlertaService: ModalAlertaService
  ) {
    this.cargarSesionGuardada();
  }

  private cargarSesionGuardada(): void {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY) || sessionStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        this.currentAdminSubject.next(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Error al recuperar sesión admin:', e);
    }
  }

  get adminActual(): AdminUser | null {
    return this.currentAdminSubject.value;
  }

  isAuthenticated(): boolean {
    return !!this.currentAdminSubject.value;
  }

  login(correo: string, password: string, recordar: boolean = false): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, { correo, password }).pipe(
      tap((res) => {
        // Normalizar respuesta del backend
        const adminData: AdminUser = res.admin || {
          id: res.id,
          nombreCompleto: res.nombreCompleto || 'Administrador',
          correo: res.correo || correo,
          rol: res.rol || 'ADMIN',
          token: res.token
        };

        const storage = recordar ? localStorage : sessionStorage;
        storage.setItem(this.STORAGE_KEY, JSON.stringify(adminData));
        this.currentAdminSubject.next(adminData);
      })
    );
  }

  registro(nombreCompleto: string, correo: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/registro`, {
      nombreCompleto,
      correo,
      password
    });
  }

  cambiarPassword(correo: string, passwordActual: string, passwordNueva: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/cambiar-password`, {
      correo,
      passwordActual,
      passwordNueva
    });
  }

  async logout(confirmar: boolean = true): Promise<void> {
    if (confirmar) {
      const confirmacion = await this.modalAlertaService.confirm({
        titulo: 'Cerrar Sesión',
        mensaje: '¿Estás seguro de que deseas cerrar sesión del panel de administración?',
        tipo: 'advertencia',
        textoConfirmar: 'Cerrar sesión',
        textoCancelar: 'Cancelar'
      });
      if (!confirmacion) {
        return;
      }
    }
    localStorage.removeItem(this.STORAGE_KEY);
    sessionStorage.removeItem(this.STORAGE_KEY);
    this.currentAdminSubject.next(null);
    this.router.navigate(['/admin/login']);
  }
}
