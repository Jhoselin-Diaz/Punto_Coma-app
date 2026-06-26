import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface ContactoBlock {
  id: string; // block-wa, block-ig, block-support, block-email, block-info
  title: string;
  description: string;
  icon: 'whatsapp' | 'instagram' | 'support' | 'email' | 'info';
  btnText: string;
  btnLink: string;
  visible: boolean;
}

export interface ContactoCierre {
  id?: number;
  btnText: string;
  number: string;
  message: string;
  visible: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ContactoService {
  private readonly baseUrl = 'http://localhost:8080/api/content/contacto';

  private mockBlocks: ContactoBlock[] = [
    {
      id: 'block-wa',
      title: 'WhatsApp',
      description: 'Escríbenos y te respondemos lo antes posible.',
      icon: 'whatsapp',
      btnText: 'Escríbenos por WhatsApp',
      btnLink: 'https://wa.me/51999999999',
      visible: true
    },
    {
      id: 'block-ig',
      title: 'Instagram',
      description: 'Síguenos y descubre nuestras novedades.',
      icon: 'instagram',
      btnText: '@Brandname',
      btnLink: 'https://instagram.com/',
      visible: true
    },
    {
      id: 'block-support',
      title: 'Atención al Cliente',
      description: 'Estamos para ayudarte en lo que necesites.',
      icon: 'support',
      btnText: 'Lun - Sáb: 9:00 am - 6:00 pm',
      btnLink: '',
      visible: true
    },
    {
      id: 'block-email',
      title: 'Email',
      description: 'Escríbenos y te responderemos lo antes posible.',
      icon: 'email',
      btnText: 'hola@brandname.com',
      btnLink: 'mailto:hola@brandname.com',
      visible: true
    },
    {
      id: 'block-info',
      title: 'Información',
      description: 'Resolvemos tus dudas sobre productos, pedidos, envíos y más.',
      icon: 'info',
      btnText: '',
      btnLink: '',
      visible: true
    }
  ];

  private mockCierre: ContactoCierre = {
    id: 1,
    btnText: '¿Dudas sobre tu pedido?',
    number: '51999999999',
    message: 'Hola, tengo una consulta sobre un pedido.',
    visible: true
  };

  constructor(private http: HttpClient) {}

  getBloques(): Observable<ContactoBlock[]> {
    return this.http.get<ContactoBlock[]>(`${this.baseUrl}/bloques`).pipe(
      catchError(error => {
        console.warn('No se pudo conectar con el backend de Spring Boot para obtener bloques de contacto. Usando datos simulados localmente.', error);
        return of(this.mockBlocks);
      })
    );
  }

  updateBloque(id: string, block: ContactoBlock): Observable<ContactoBlock> {
    return this.http.put<ContactoBlock>(`${this.baseUrl}/bloques/${id}`, block).pipe(
      catchError(error => {
        console.warn(`No se pudo actualizar el bloque ${id} en el backend. Actualizando datos localmente.`, error);
        const idx = this.mockBlocks.findIndex(b => b.id === id);
        if (idx !== -1) {
          this.mockBlocks[idx] = { ...block };
        }
        return of(block);
      })
    );
  }

  getCierre(): Observable<ContactoCierre> {
    return this.http.get<ContactoCierre>(`${this.baseUrl}/cierre`).pipe(
      catchError(error => {
        console.warn('No se pudo conectar con el backend de Spring Boot para obtener cierre de contacto. Usando datos simulados localmente.', error);
        return of(this.mockCierre);
      })
    );
  }

  updateCierre(cierre: ContactoCierre): Observable<ContactoCierre> {
    return this.http.put<ContactoCierre>(`${this.baseUrl}/cierre`, cierre).pipe(
      catchError(error => {
        console.warn('No se pudo actualizar el cierre de contacto en el backend. Actualizando datos localmente.', error);
        this.mockCierre = { ...cierre };
        return of(this.mockCierre);
      })
    );
  }
}
