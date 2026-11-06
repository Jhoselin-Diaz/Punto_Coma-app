import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface AlertaNotificacion {
  id: string;
  tipo: string;
  nivel: 'urgente' | 'moderado';
  titulo: string;
  detalles: string;
  tiempo: string;
  ruta?: string;
  pedidoId?: string;
  chatId?: string;
  leida?: boolean;
}

const STORAGE_KEY = 'punto_coma_alertas_leidas';

@Injectable({
  providedIn: 'root'
})
export class AdminNotificationService {
  private alertasLeidasSet: Set<string> = new Set<string>();
  private allAlerts: AlertaNotificacion[] = [];

  private unreadCountSubject = new BehaviorSubject<number>(0);
  public unreadCount$: Observable<number> = this.unreadCountSubject.asObservable();

  private alertsSubject = new BehaviorSubject<AlertaNotificacion[]>([]);
  public alerts$: Observable<AlertaNotificacion[]> = this.alertsSubject.asObservable();

  constructor() {
    this.cargarAlertasLeidas();
  }

  private cargarAlertasLeidas(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const ids: string[] = JSON.parse(raw);
        if (Array.isArray(ids)) {
          this.alertasLeidasSet = new Set<string>(ids);
        }
      }
    } catch (e) {
      console.warn('Error al cargar alertas leídas de localStorage:', e);
      this.alertasLeidasSet = new Set<string>();
    }
  }

  private guardarAlertasLeidas(): void {
    try {
      const arr = Array.from(this.alertasLeidasSet);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    } catch (e) {
      console.warn('Error al guardar alertas leídas en localStorage:', e);
    }
  }

  public esAlertaLeida(id: string): boolean {
    return this.alertasLeidasSet.has(id);
  }

  public getAlertasLeidasIds(): Set<string> {
    return this.alertasLeidasSet;
  }

  public marcarAlertaLeida(id: string): void {
    if (!id) return;
    this.alertasLeidasSet.add(id);
    this.guardarAlertasLeidas();

    this.allAlerts = this.allAlerts.map(a => a.id === id ? { ...a, leida: true } : a);
    const unreadAlerts = this.allAlerts.filter(a => !this.alertasLeidasSet.has(a.id));
    this.alertsSubject.next(unreadAlerts);
    this.setUnreadCount(unreadAlerts.length);
  }

  public limpiarAlertasLeidas(): void {
    this.alertasLeidasSet.clear();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      // ignore
    }
    this.allAlerts = this.allAlerts.map(a => ({ ...a, leida: false }));
    const unreadAlerts = this.allAlerts.filter(a => !this.alertasLeidasSet.has(a.id));
    this.alertsSubject.next(unreadAlerts);
    this.setUnreadCount(unreadAlerts.length);
  }

  setUnreadCount(count: number): void {
    this.unreadCountSubject.next(Math.max(0, count));
  }

  get unreadCount(): number {
    return this.unreadCountSubject.value;
  }

  setAlerts(rawAlerts: AlertaNotificacion[]): void {
    this.allAlerts = rawAlerts.map(a => ({
      ...a,
      leida: this.alertasLeidasSet.has(a.id)
    }));
    const unreadAlerts = this.allAlerts.filter(a => !this.alertasLeidasSet.has(a.id));
    this.alertsSubject.next(unreadAlerts);
    this.setUnreadCount(unreadAlerts.length);
  }

  get alerts(): AlertaNotificacion[] {
    return this.alertsSubject.value;
  }
}
