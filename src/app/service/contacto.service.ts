import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

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
  private readonly baseUrl = `${environment.apiUrl}/content/contacto`;

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

  private blocksSubject = new BehaviorSubject<ContactoBlock[] | null>(null);
  readonly blocks$ = this.blocksSubject.asObservable();

  private cierreSubject = new BehaviorSubject<ContactoCierre | null>(null);
  readonly cierre$ = this.cierreSubject.asObservable();

  constructor(private http: HttpClient) {}

  getBloques(): Observable<ContactoBlock[]> {
    return this.http.get<ContactoBlock[]>(`${this.baseUrl}/bloques`).pipe(
      tap(blocks => {
        const orderMap = {
          'block-wa': 1,
          'block-ig': 2,
          'block-support': 3,
          'block-email': 4,
          'block-info': 5
        };
        const sorted = [...blocks].sort((a, b) => {
          return (orderMap[a.id as keyof typeof orderMap] || 99) - (orderMap[b.id as keyof typeof orderMap] || 99);
        });
        this.blocksSubject.next(sorted);
      }),
      catchError(error => {
        console.warn('No se pudo conectar con el backend de Spring Boot para obtener bloques de contacto. Usando datos simulados localmente.', error);
        this.blocksSubject.next(this.mockBlocks);
        return of(this.mockBlocks);
      })
    );
  }

  updateBloque(id: string, block: ContactoBlock): Observable<ContactoBlock> {
    return this.http.put<ContactoBlock>(`${this.baseUrl}/bloques/${id}`, block).pipe(
      tap(res => {
        const currentBlocks = this.blocksSubject.value;
        if (currentBlocks) {
          const idx = currentBlocks.findIndex(b => b.id === id);
          if (idx !== -1) {
            const updatedList = [...currentBlocks];
            updatedList[idx] = res;
            this.blocksSubject.next(updatedList);
          }
        } else {
          // If not loaded, reload them
          this.getBloques().subscribe();
        }
      }),
      catchError(error => {
        console.warn(`No se pudo actualizar el bloque ${id} en el backend. Actualizando datos localmente.`, error);
        const idx = this.mockBlocks.findIndex(b => b.id === id);
        if (idx !== -1) {
          this.mockBlocks[idx] = { ...block };
        }
        this.blocksSubject.next([...this.mockBlocks]);
        return of(block);
      })
    );
  }

  getCierre(): Observable<ContactoCierre> {
    return this.http.get<ContactoCierre>(`${this.baseUrl}/cierre`).pipe(
      tap(cierre => this.cierreSubject.next(cierre)),
      catchError(error => {
        console.warn('No se pudo conectar con el backend de Spring Boot para obtener cierre de contacto. Usando datos simulados localmente.', error);
        this.cierreSubject.next(this.mockCierre);
        return of(this.mockCierre);
      })
    );
  }

  updateCierre(cierre: ContactoCierre): Observable<ContactoCierre> {
    return this.http.put<ContactoCierre>(`${this.baseUrl}/cierre`, cierre).pipe(
      tap(res => this.cierreSubject.next(res)),
      catchError(error => {
        console.warn('No se pudo actualizar el cierre de contacto en el backend. Actualizando datos localmente.', error);
        this.mockCierre = { ...cierre };
        this.cierreSubject.next(this.mockCierre);
        return of(this.mockCierre);
      })
    );
  }
}
