import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type WhatsappStatus = 'DISCONNECTED' | 'QR_READY' | 'CONNECTING' | 'CONNECTED';

export interface WhatsappStateDTO {
  status: WhatsappStatus;
  qrCodeBase64?: string | null;
  phoneNumber?: string | null;
  connectedAt?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class WhatsappService {
  private readonly baseUrl = 'https://puntoycoma-puente-whatsapp.azurewebsites.net';

  constructor(private http: HttpClient) {}

  getStatus(): Observable<WhatsappStateDTO> {
    return this.http.get<WhatsappStateDTO>(`${this.baseUrl}/status`);
  }

  desconectar(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/reset`);
  }
}
