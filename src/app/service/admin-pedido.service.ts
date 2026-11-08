import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

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
