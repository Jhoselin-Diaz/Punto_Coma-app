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

  deletePedido(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  getPedidosDeCliente(telefono: string): Observable<any[]> {
    const cleanTelefono = telefono.replace(/[^\d]/g, '');
    return this.http.get<any[]>(`${this.baseUrl}/cliente/${cleanTelefono}`);
  }

  updatePedido(id: number, data: any): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/${id}`, data);
  }

  solicitarMontoFaltante(pedidoId: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/${pedidoId}/solicitar-monto-faltante`, {});
  }
}
