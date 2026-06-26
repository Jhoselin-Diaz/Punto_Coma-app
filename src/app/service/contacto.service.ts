import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface ContactoBlock {
  id: string;
  title: string;
  description: string;
  icon: string;
  btnText: string;
  btnLink: string;
  visible: boolean;
}

export interface ContactoCierre {
  btnText: string;
  number: string;
  message: string;
  visible: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ContactoService {
  private apiUrl = `${environment.apiUrl}/contacto`;

  // Valores por defecto para el bloque de contacto
  private defaultBlocks: ContactoBlock[] = [
    {
      id: 'block-wa',
      title: 'WhatsApp',
      description: 'Escríbenos directamente y te atenderemos al instante.',
      icon: 'whatsapp',
      btnText: 'Abrir WhatsApp',
      btnLink: '',
      visible: true
    },
    {
      id: 'block-ig',
      title: 'Instagram',
      description: 'Síguenos y descubre nuestras últimas colecciones.',
      icon: 'instagram',
      btnText: 'Ver Instagram',
      btnLink: '',
      visible: true
    },
    {
      id: 'block-support',
      title: 'Soporte',
      description: 'Tenemos un equipo listo para resolver tus dudas.',
      icon: 'support',
      btnText: 'Contactar Soporte',
      btnLink: '',
      visible: true
    },
    {
      id: 'block-email',
      title: 'Correo',
      description: 'Envíanos un correo y te responderemos en breve.',
      icon: 'email',
      btnText: 'Enviar Correo',
      btnLink: '',
      visible: true
    },
    {
      id: 'block-info',
      title: 'Información',
      description: 'Conoce más sobre nosotros y nuestra tienda.',
      icon: 'info',
      btnText: 'Ver más',
      btnLink: '',
      visible: true
    }
  ];

  private defaultCierre: ContactoCierre = {
    btnText: 'Escríbenos por WhatsApp',
    number: '',
    message: 'Hola, me gustaría saber más sobre sus productos.',
    visible: true
  };

  constructor(private http: HttpClient) {}

  getBloques(): Observable<ContactoBlock[]> {
    return this.http.get<ContactoBlock[]>(`${this.apiUrl}/bloques`).pipe(
      catchError(() => {
        // Si el backend no responde, usamos los defaults
        return of(this.defaultBlocks);
      })
    );
  }

  getCierre(): Observable<ContactoCierre> {
    return this.http.get<ContactoCierre>(`${this.apiUrl}/cierre`).pipe(
      catchError(() => {
        return of(this.defaultCierre);
      })
    );
  }

  guardarBloques(blocks: ContactoBlock[]): Observable<ContactoBlock[]> {
    return this.http.put<ContactoBlock[]>(`${this.apiUrl}/bloques`, blocks);
  }

  guardarCierre(cierre: ContactoCierre): Observable<ContactoCierre> {
    return this.http.put<ContactoCierre>(`${this.apiUrl}/cierre`, cierre);
  }
}
