import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

export function obtenerTimestampReal(pedido: any): number {
  if (!pedido) return 0;

  // 1. Si tiene fechaOriginal (formato ISO o parseable directamente)
  if (pedido.fechaOriginal) {
    const t = new Date(pedido.fechaOriginal).getTime();
    if (!isNaN(t) && t > 0) return t;
  }

  // 2. Si tiene fechaPago
  if (pedido.fechaPago) {
    const t = new Date(pedido.fechaPago).getTime();
    if (!isNaN(t) && t > 0) return t;
  }

  // 3. Si tiene fecha y/o hora (ej. "08 Nov 2026", "08 nov 2026", "08-11-2026", "2026-11-08", etc.)
  const fechaStr = (pedido.fecha || '').toString().trim();
  const horaStr = (pedido.hora || '').toString().trim();

  if (fechaStr) {
    if (fechaStr.toLowerCase().includes('hoy') || fechaStr.toLowerCase().includes('ahora')) {
      return Date.now();
    }
    if (fechaStr.toLowerCase().includes('ayer')) {
      return Date.now() - 86400000;
    }

    // Mapeo de meses en español
    const mesesMap: { [key: string]: number } = {
      ene: 0, enero: 0, jan: 0, january: 0,
      feb: 1, febrero: 1, february: 1,
      mar: 2, marzo: 2, march: 2,
      abr: 3, abril: 3, apr: 3, april: 3,
      may: 4, mayo: 4,
      jun: 5, junio: 5, june: 5,
      jul: 6, julio: 6, july: 6,
      ago: 7, agosto: 7, aug: 7, august: 7,
      set: 8, sep: 8, sept: 8, setiembre: 8, septiembre: 8, september: 8,
      oct: 9, octubre: 9, october: 9,
      nov: 10, noviembre: 10, november: 10,
      dic: 11, diciembre: 11, dec: 11, december: 11
    };

    const regexEsp = /^(\d{1,2})\s*(?:de)?\s*([a-zA-ZñÑáéíóúÁÉÍÓÚ]{3,12})\.?,?\s*(?:de)?\s*(\d{4})/i;
    const matchEsp = fechaStr.match(regexEsp);
    if (matchEsp) {
      const dia = parseInt(matchEsp[1], 10);
      const mesNombre = matchEsp[2].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const anio = parseInt(matchEsp[3], 10);

      let mesIdx = -1;
      for (const k in mesesMap) {
        if (mesNombre.startsWith(k)) {
          mesIdx = mesesMap[k];
          break;
        }
      }

      if (mesIdx !== -1) {
        let horas = 12, minutos = 0;
        if (horaStr) {
          const mHora = horaStr.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i);
          if (mHora) {
            horas = parseInt(mHora[1], 10);
            minutos = parseInt(mHora[2], 10);
            const meridiem = (mHora[4] || '').toLowerCase();
            if (meridiem === 'pm' && horas < 12) horas += 12;
            if (meridiem === 'am' && horas === 12) horas = 0;
          }
        }
        const d = new Date(anio, mesIdx, dia, horas, minutos);
        if (!isNaN(d.getTime())) {
          return d.getTime();
        }
      }
    }

    const t = new Date(fechaStr + (horaStr ? ' ' + horaStr : '')).getTime();
    if (!isNaN(t) && t > 0) return t;
  }

  // 4. Buscar timestamp de milisegundos en id o numeroOrden
  const idStr = String(pedido.numeroOrden || pedido.id || pedido.referenciaPago || '');
  const digitsMatch = idStr.match(/\b(17\d{11,12})\b/);
  if (digitsMatch) {
    const ts = parseInt(digitsMatch[1], 10);
    if (ts > 1500000000000 && ts < 2500000000000) {
      return ts;
    }
  }

  // 5. Fallback por dbId o id numérico
  const numericId = Number(pedido.dbId || String(pedido.id).replace(/\D/g, ''));
  if (!isNaN(numericId) && numericId > 0) {
    return numericId;
  }

  return 0;
}

@Injectable({
  providedIn: 'root'
})
export class AdminPedidoService {
  private readonly baseUrl = `${environment.apiUrl.replace(/\/v1$/, '')}/admin/pedidos`;
  private readonly pedidosUrl = `${environment.apiUrl.replace(/\/v1$/, '')}/pedidos`;

  constructor(private http: HttpClient) {}

  consultarRastreoPublico(telefono: string): Observable<any[]> {
    const cleanTelefono = telefono.replace(/[^\d]/g, '');
    const cleanApi = environment.apiUrl.replace(/\/v1$/, '');
    return this.http.get<any[]>(`${cleanApi}/pedidos/cliente/${cleanTelefono}`).pipe(
      map(pedidos => {
        if (!pedidos || !Array.isArray(pedidos)) return [];
        const ahora = new Date();
        return pedidos.filter(p => {
          const est = (p.estado || p.estadoRaw || '').toString().trim().toUpperCase();
          const esEnCamino = est === 'EN CAMINO' || est === 'EN_CAMINO' || est.includes('CAMINO');
          const guia = (p.numeroGuia || p.guia || '').toString().trim();
          const tieneGuia = guia.length > 0 && guia !== 'DIRECTO';
          const noFinalizado = est !== 'ENTREGADO' && est !== 'RECHAZADO' && est !== 'CANCELADO';

          if (p.fechaExpiracionRastreo) {
            try {
              const expDate = new Date(p.fechaExpiracionRastreo);
              if (expDate < ahora) return false;
            } catch (ignored) {}
          }

          return (esEnCamino || tieneGuia) && noFinalizado;
        });
      })
    );
  }

  getMisPedidos(email?: string, usuarioId?: number | string): Observable<any[]> {
    const cleanApi = environment.apiUrl.replace(/\/v1$/, '');
    let params: any = {};
    if (email) params.email = email;
    if (usuarioId) params.usuarioId = usuarioId;
    return this.http.get<any[]>(`${cleanApi}/pedidos/mis-pedidos`, { params });
  }

  getPedidos(): Observable<any[]> {
    return this.http.get<any[]>(this.baseUrl);
  }

  deletePedido(id: number | string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  eliminarPedidosMultiples(ids: (number | string)[]): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/eliminar-multiple`, ids);
  }

  getPedidosDeCliente(telefono: string): Observable<any[]> {
    const cleanTelefono = telefono.replace(/[^\d]/g, '');
    return this.http.get<any[]>(`${this.pedidosUrl}/cliente/${cleanTelefono}`);
  }

  validarPedido(id: number | string): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/${id}/validar`, {});
  }

  updatePedido(id: number | string, data: any): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/${id}`, data);
  }

  solicitarMontoFaltante(pedidoId: number | string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/${pedidoId}/solicitar-monto-faltante`, {});
  }

  getVigilanciaStock(): Observable<any> {
    const url = `${environment.apiUrl.replace(/\/v1$/, '')}/admin/dashboard/vigilancia-stock`;
    return this.http.get<any>(url);
  }

  getProductosMasVendidos(): Observable<any[]> {
    const url = `${environment.apiUrl.replace(/\/v1$/, '')}/admin/dashboard/mas-vendidos`;
    return this.http.get<any[]>(url);
  }
}
