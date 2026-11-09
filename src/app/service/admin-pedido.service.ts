import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

export function obtenerTimestampReal(pedido: any): number {
  if (!pedido) return 0;

  // 1. PRIMERO: Extraer el timestamp numérico de 13 dígitos del código del pedido
  // (pedido.id, pedido.numeroOrden, pedido.codigo o pedido.referenciaPago, ej. WSP-1794201984960 -> 1794201984960)
  const codigoStr = String(pedido.id || pedido.numeroOrden || pedido.codigo || pedido.referenciaPago || '');
  const match13 = codigoStr.match(/(?:WSP-)?(\d{13})/i) || codigoStr.match(/\b(1[789]\d{11})\b/);
  if (match13) {
    const ts = parseInt(match13[1], 10);
    if (!isNaN(ts) && ts >= 1700000000000 && ts <= 1950000000000) {
      return ts;
    }
  }

  // 2. SEGUNDO: Si el código no tiene 13 dígitos, parsear directamente el string visible
  // mostrado en la columna "Fecha y Hora" (pedido.fechaHora, pedido.fecha + pedido.hora, ej. "09 Nov 2026 12:26 AM" o "06 Jul 2026, 04:01 PM")
  let texto = '';
  if (pedido.fechaHora) {
    texto = String(pedido.fechaHora).trim();
  } else if (pedido.fecha && pedido.hora) {
    texto = `${pedido.fecha} ${pedido.hora}`.trim();
  } else if (pedido.fecha) {
    texto = String(pedido.fecha).trim();
  }

  if (texto) {
    const lower = texto.toLowerCase();
    if (lower.includes('hoy') || lower.includes('ahora')) return Date.now();
    if (lower.includes('ayer')) return Date.now() - 86400000;

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

    const regexFechaEsp = /(\d{1,2})\s*(?:de)?\s*([a-zA-ZñÑáéíóúÁÉÍÓÚ]{3,12})\.?,?\s*(?:de)?\s*(\d{4})/i;
    const matchEsp = texto.match(regexFechaEsp);
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
        let horas = 12, minutos = 0, segundos = 0;
        const timeMatch = texto.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i);
        if (timeMatch) {
          horas = parseInt(timeMatch[1], 10);
          minutos = parseInt(timeMatch[2], 10);
          if (timeMatch[3]) segundos = parseInt(timeMatch[3], 10);
          const meridiem = (timeMatch[4] || '').toLowerCase();
          if (meridiem === 'pm') {
            if (horas < 12) horas += 12;
          } else if (meridiem === 'am') {
            if (horas === 12) horas = 0;
          }
        }
        const d = new Date(anio, mesIdx, dia, horas, minutos, segundos);
        if (!isNaN(d.getTime())) {
          return d.getTime();
        }
      }
    }

    const t = new Date(texto).getTime();
    if (!isNaN(t) && t > 0) return t;
  }

  // 3. TERCERO (solo como último respaldo): fechaOriginal, fechaPago o dbId
  if (pedido.fechaOriginal) {
    const t = new Date(pedido.fechaOriginal).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  if (pedido.fechaPago) {
    const t = new Date(pedido.fechaPago).getTime();
    if (!isNaN(t) && t > 0) return t;
  }

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
