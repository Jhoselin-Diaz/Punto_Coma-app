import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AdminPedidoService {
  private readonly baseUrl = `${environment.apiUrl.replace('/v1', '')}/admin/pedidos`;

  constructor(private http: HttpClient) {}

  getPedidos(): Observable<any[]> {
    return this.http.get<any[]>(this.baseUrl);
  }

  deletePedido(id: number | string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  getPedidosDeCliente(telefono: string): Observable<any[]> {
    const cleanTelefono = telefono.replace(/[^\d]/g, '');
    return this.http.get<any[]>(`${this.baseUrl}/cliente/${cleanTelefono}`);
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
    const url = `${environment.apiUrl.replace('/v1', '')}/admin/dashboard/vigilancia-stock`;
    return this.http.get<any>(url);
  }

  getProductosMasVendidos(): Observable<any[]> {
    const url = `${environment.apiUrl.replace('/v1', '')}/admin/dashboard/mas-vendidos`;
    return this.http.get<any[]>(url);
  }
}
