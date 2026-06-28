import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface MensajeDTO {
  id?: number;
  contenido: string;
  remitente: 'CLIENTE' | 'ADMINISTRADOR';
  fechaEnvio: string; // LocalDateTime ISO format
  wamid?: string;
  chatId?: number;
}

export interface ChatDTO {
  id: number;
  telefonoCliente: string;
  nombreCliente: string;
  ultimoMensaje: string;
  fechaUltimaActualizacion: string; // LocalDateTime ISO format
  unreadCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class AdminChatService {
  private readonly baseUrl = `${environment.apiUrl.replace('/v1', '')}/admin/chats`;

  constructor(private http: HttpClient) {}

  getChats(): Observable<ChatDTO[]> {
    return this.http.get<ChatDTO[]>(this.baseUrl);
  }

  getMensajes(chatId: number): Observable<MensajeDTO[]> {
    return this.http.get<MensajeDTO[]>(`${this.baseUrl}/${chatId}/mensajes`);
  }

  enviarMensaje(chatId: number, texto: string): Observable<MensajeDTO> {
    return this.http.post<MensajeDTO>(`${this.baseUrl}/${chatId}/enviar`, { mensaje: texto });
  }
}
