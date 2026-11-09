import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, Subject } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AdminPedidoService } from './admin-pedido.service';

export interface DireccionCliente {
  id: string;
  departamento: string;
  provincia: string;
  distrito: string;
  direccion: string;
  detalleOpcional?: string;
  esPrincipal: boolean;
}

export interface Cliente {
  id?: number | string;
  nombre: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  apellidos?: string;
  nombrePila?: string;
  tipoDocumento?: string;
  numeroDocumento?: string;
  email: string;
  telefono?: string;
  avatarUrl?: string;
  token?: string;
  direcciones?: DireccionCliente[];
}

export interface ProductoFavorito {
  id: number;
  nombre: string;
  precio: number;
  precioAnterior?: number;
  precioOferta?: number;
  imagenPrincipal?: string;
  imageUrl?: string;
  categoria?: string;
}

interface StoredUser extends Cliente {
  password?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ClienteAuthService {
  private readonly SESSION_KEY = 'cliente_session';
  private readonly USERS_KEY = 'cliente_registered_users';
  private readonly FAVORITES_PREFIX = 'cliente_favoritos_';

  // Estado del Cliente
  private currentClienteSubject = new BehaviorSubject<Cliente | null>(null);
  public currentCliente$ = this.currentClienteSubject.asObservable();
  public isLoggedIn$ = this.currentClienteSubject.asObservable().pipe(map(c => !!c));

  // Favoritos reactivos
  private favoritosSubject = new BehaviorSubject<ProductoFavorito[]>([]);
  public favoritos$ = this.favoritosSubject.asObservable();

  // Control de Modales Globales del Cliente
  public modalAuthOpen$ = new BehaviorSubject<boolean>(false);
  public modalAuthTab$ = new BehaviorSubject<'login' | 'register'>('login');
  public modalPerfilOpen$ = new BehaviorSubject<boolean>(false);
  public drawerPerfil$ = new BehaviorSubject<boolean>(false);
  public modalPerfilSeccion$ = new Subject<'compras' | 'datos' | 'direcciones' | 'cupones'>();
  public modalFavoritosOpen$ = new BehaviorSubject<boolean>(false);
  public modalAvisoLoginOpen$ = new BehaviorSubject<boolean>(false);

  constructor(private adminPedidoService: AdminPedidoService) {
    this.inicializarUsuariosSeed();
    this.cargarSesion();
  }

  get drawerPerfilAbierto(): boolean {
    return this.modalPerfilOpen$.value;
  }

  get modalPerfilAbierto(): boolean {
    return this.modalPerfilOpen$.value;
  }

  get isLoggedIn(): boolean {
    return !!this.currentClienteSubject.value;
  }

  get currentCliente(): Cliente | null {
    return this.currentClienteSubject.value;
  }

  get nombreParaMostrar(): string {
    const c = this.currentCliente;
    if (!c) return 'Invitado';
    if (c.nombrePila && c.nombrePila.trim() !== '') {
      return c.nombrePila.trim();
    }
    const partes = (c.nombre || '').trim().split(' ');
    return partes[0] || 'Cliente';
  }

  private inicializarUsuariosSeed(): void {
    try {
      const stored = localStorage.getItem(this.USERS_KEY);
      if (!stored) {
        const seedUsers: StoredUser[] = [
          {
            id: 1,
            nombre: 'Juan',
            apellidos: 'Pérez Gómez',
            nombrePila: 'Juancho',
            email: 'cliente@ejemplo.com',
            password: 'password123',
            token: 'seed-token-1'
          }
        ];
        localStorage.setItem(this.USERS_KEY, JSON.stringify(seedUsers));
      }
    } catch (e) {
      console.warn('No se pudo acceder a localStorage para inicializar usuarios seed', e);
    }
  }

  private cargarSesion(): void {
    try {
      const saved = localStorage.getItem(this.SESSION_KEY);
      if (saved) {
        const cliente: Cliente = JSON.parse(saved);
        this.currentClienteSubject.next(cliente);
        this.cargarFavoritos(cliente.email);
      }
    } catch (e) {
      console.error('Error al cargar la sesión del cliente:', e);
      localStorage.removeItem(this.SESSION_KEY);
    }
  }

  private cargarFavoritos(email?: string): void {
    try {
      const key = email ? `${this.FAVORITES_PREFIX}${email.toLowerCase()}` : `${this.FAVORITES_PREFIX}guest`;
      const saved = localStorage.getItem(key);
      if (saved) {
        this.favoritosSubject.next(JSON.parse(saved));
      } else {
        this.favoritosSubject.next([]);
      }
    } catch (e) {
      console.error('Error al cargar favoritos:', e);
      this.favoritosSubject.next([]);
    }
  }

  private guardarFavoritos(): void {
    try {
      const email = this.currentCliente?.email;
      const key = email ? `${this.FAVORITES_PREFIX}${email.toLowerCase()}` : `${this.FAVORITES_PREFIX}guest`;
      localStorage.setItem(key, JSON.stringify(this.favoritosSubject.value));
    } catch (e) {
      console.error('Error al persistir favoritos:', e);
    }
  }

  // Métodos de Autenticación
  login(email: string, password: string): { success: boolean; message?: string } {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    if (!cleanEmail || !cleanPass) {
      return { success: false, message: 'Ingresa tu correo y contraseña.' };
    }

    try {
      const usersRaw = localStorage.getItem(this.USERS_KEY);
      const users: StoredUser[] = usersRaw ? JSON.parse(usersRaw) : [];
      const found = users.find(u => u.email.toLowerCase() === cleanEmail && u.password === cleanPass);

      if (found) {
        const cliente: Cliente = {
          id: found.id,
          nombre: found.nombre,
          apellidos: found.apellidos,
          nombrePila: found.nombrePila || found.nombre.split(' ')[0],
          email: found.email,
          telefono: found.telefono,
          token: found.token || 'jwt-' + Date.now()
        };

        this.establecerSesion(cliente);
        return { success: true };
      } else {
        return { success: false, message: 'Correo o contraseña incorrectos.' };
      }
    } catch (e) {
      console.error('Error en login:', e);
      return { success: false, message: 'Ocurrió un error al procesar el inicio de sesión.' };
    }
  }

  registro(nombre: string, apellidos: string, email: string, password: string): { success: boolean; message?: string } {
    const cleanNombre = (nombre || '').trim();
    const cleanApellidos = (apellidos || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    if (!cleanNombre || !cleanEmail || !cleanPass) {
      return { success: false, message: 'Por favor completa todos los campos requeridos.' };
    }

    try {
      const usersRaw = localStorage.getItem(this.USERS_KEY);
      const users: StoredUser[] = usersRaw ? JSON.parse(usersRaw) : [];

      if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
        return { success: false, message: 'Este correo electrónico ya se encuentra registrado.' };
      }

      const nuevoUsuario: StoredUser = {
        id: Date.now(),
        nombre: cleanNombre,
        apellidos: cleanApellidos,
        nombrePila: cleanNombre.split(' ')[0],
        email: cleanEmail,
        password: cleanPass,
        token: 'jwt-' + Date.now()
      };

      users.push(nuevoUsuario);
      localStorage.setItem(this.USERS_KEY, JSON.stringify(users));

      const cliente: Cliente = {
        id: nuevoUsuario.id,
        nombre: nuevoUsuario.nombre,
        apellidos: nuevoUsuario.apellidos,
        nombrePila: nuevoUsuario.nombrePila,
        email: nuevoUsuario.email,
        token: nuevoUsuario.token
      };

      this.establecerSesion(cliente);
      return { success: true };
    } catch (e) {
      console.error('Error en registro:', e);
      return { success: false, message: 'Ocurrió un error al registrar la cuenta.' };
    }
  }

  loginConGoogle(): { success: boolean; message: string } {
    return {
      success: false,
      message: 'El inicio de sesión con Google estará disponible próximamente.'
    };
  }

  private establecerSesion(cliente: Cliente): void {
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(cliente));
    this.currentClienteSubject.next(cliente);
    this.cargarFavoritos(cliente.email);
    this.cerrarModalAuth();
  }

  actualizarNombrePila(nuevoNombrePila: string): boolean {
    const c = this.currentCliente;
    if (!c) return false;

    const limpio = (nuevoNombrePila || '').trim();
    if (!limpio) return false;

    c.nombrePila = limpio;
    this.establecerSesion({ ...c });

    // Actualizar también en el registro de usuarios
    try {
      const usersRaw = localStorage.getItem(this.USERS_KEY);
      if (usersRaw) {
        const users: StoredUser[] = JSON.parse(usersRaw);
        const idx = users.findIndex(u => u.email.toLowerCase() === c.email.toLowerCase());
        if (idx !== -1) {
          users[idx].nombrePila = limpio;
          localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
        }
      }
    } catch (e) {
      console.error('Error actualizando nombre de pila en users:', e);
    }

    return true;
  }

  logout(): void {
    try {
      localStorage.removeItem(this.SESSION_KEY);
    } catch (e) {
      console.error('Error eliminando sesión:', e);
    }
    this.currentClienteSubject.next(null);
    this.favoritosSubject.next([]);
    this.cerrarModalPerfil();
    this.cerrarModalFavoritos();
    this.cerrarModalAuth();
    this.cerrarAvisoLogin();
  }

  // Métodos de Favoritos
  esFavorito(productoId: number | string): boolean {
    if (!productoId) return false;
    const numId = Number(productoId);
    return this.favoritosSubject.value.some(p => Number(p.id) === numId || p.id === productoId);
  }

  toggleFavorito(producto: any): boolean {
    if (!this.isLoggedIn) {
      this.mostrarAvisoLogin();
      return false;
    }

    if (!producto || !producto.id) return false;

    const actual = [...this.favoritosSubject.value];
    const numId = Number(producto.id);
    const index = actual.findIndex(p => Number(p.id) === numId || p.id === producto.id);

    if (index !== -1) {
      // Quitar de favoritos
      actual.splice(index, 1);
    } else {
      // Agregar a favoritos
      const fav: ProductoFavorito = {
        id: Number(producto.id) || producto.id,
        nombre: producto.nombre,
        precio: producto.precioOferta || producto.precio_oferta || producto.precio || 0,
        precioAnterior: producto.precioAnterior || producto.precioOriginal || producto.precio_original,
        precioOferta: producto.precioOferta || producto.precio_oferta,
        imagenPrincipal: producto.imagenPrincipal || producto.imageUrl || producto.imagenUrl || '',
        imageUrl: producto.imagenPrincipal || producto.imageUrl || producto.imagenUrl || '',
        categoria: producto.categoria
      };
      actual.push(fav);
    }

    this.favoritosSubject.next(actual);
    this.guardarFavoritos();
    return true;
  }

  eliminarFavorito(productoId: number | string): void {
    const numId = Number(productoId);
    const actual = this.favoritosSubject.value.filter(p => Number(p.id) !== numId && p.id !== productoId);
    this.favoritosSubject.next(actual);
    this.guardarFavoritos();
  }

  // Gestión de Pedidos Validados del Cliente (Aislamiento Estricto)
  obtenerPedidosValidadosCliente(): Observable<any[]> {
    const c = this.currentCliente;
    if (!c || !c.email) {
      return of([]);
    }

    const emailCliente = (c.email || '').toLowerCase().trim();
    const clienteId = c.id;

    return this.adminPedidoService.getMisPedidos(emailCliente, clienteId).pipe(
      map(pedidos => {
        if (!Array.isArray(pedidos) || pedidos.length === 0) return [];

        const estadosPermitidos = ['validado', 'concretado', 'entregado', 'completado', 'aprobado', 'en camino', 'en_camino'];

        return pedidos
          .filter(p => {
            // AISLAMIENTO ESTRICTO: Solo pedidos que correspondan expresamente a este usuario
            const pEmail = (p.usuario?.correo || p.usuario?.email || p.email || '').toLowerCase().trim();
            const pUsuarioId = p.usuario?.id || p.usuarioId || p.dbId;

            const coincideEmail = emailCliente && pEmail && pEmail === emailCliente;
            const coincideId = clienteId && pUsuarioId && String(pUsuarioId) === String(clienteId);

            if (pEmail && !coincideEmail && (!clienteId || !coincideId)) {
              return false;
            }

            const estado = (p.estado || '').toLowerCase().trim();
            return estadosPermitidos.some(ep => estado.includes(ep));
          })
          .map(p => ({
            id: p.id,
            numeroOrden: p.numeroOrden || `ORD-${p.id}`,
            fecha: p.fecha || p.fechaPago || 'Reciente',
            total: p.total || 0,
            estado: p.estado || 'Validado',
            metodoPago: p.metodoPago || 'WhatsApp',
            nombreCompleto: p.nombreCompleto || p.cliente || 'Cliente'
          }));
      }),
      catchError(err => {
        console.error('Error obteniendo pedidos validados del cliente:', err);
        return of([]);
      })
    );
  }

  // Métodos de Gestión de Datos Personales y Direcciones
  actualizarDatosPersonales(datos: {
    nombre: string;
    apellidoPaterno: string;
    apellidoMaterno?: string;
    tipoDocumento: string;
    numeroDocumento: string;
    telefono: string;
  }): boolean {
    const c = this.currentCliente;
    if (!c) return false;

    c.nombre = (datos.nombre || '').trim();
    c.apellidoPaterno = (datos.apellidoPaterno || '').trim();
    c.apellidoMaterno = (datos.apellidoMaterno || '').trim();
    c.apellidos = `${c.apellidoPaterno} ${c.apellidoMaterno}`.trim();
    c.tipoDocumento = datos.tipoDocumento;
    c.numeroDocumento = (datos.numeroDocumento || '').trim();
    c.telefono = (datos.telefono || '').trim();

    if (!c.nombrePila) {
      c.nombrePila = c.nombre.split(' ')[0];
    }

    this.establecerSesion({ ...c });

    try {
      const usersRaw = localStorage.getItem(this.USERS_KEY);
      if (usersRaw) {
        const users: StoredUser[] = JSON.parse(usersRaw);
        const idx = users.findIndex(u => u.email.toLowerCase() === c.email.toLowerCase());
        if (idx !== -1) {
          users[idx] = { ...users[idx], ...c };
          localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
        }
      }
    } catch (e) {
      console.error('Error guardando datos personales en storage:', e);
    }

    return true;
  }

  obtenerDirecciones(): DireccionCliente[] {
    const c = this.currentCliente;
    if (!c) return [];
    if (!c.direcciones || !Array.isArray(c.direcciones)) {
      c.direcciones = [];
    }
    return c.direcciones;
  }

  guardarDireccion(dir: Omit<DireccionCliente, 'id'> & { id?: string }): void {
    const c = this.currentCliente;
    if (!c) return;
    if (!c.direcciones) c.direcciones = [];

    const esPrincipal = dir.esPrincipal || c.direcciones.length === 0;

    if (esPrincipal) {
      c.direcciones.forEach(d => d.esPrincipal = false);
    }

    if (dir.id) {
      const idx = c.direcciones.findIndex(d => d.id === dir.id);
      if (idx !== -1) {
        c.direcciones[idx] = { ...dir, id: dir.id, esPrincipal };
      }
    } else {
      const nueva: DireccionCliente = {
        ...dir,
        id: 'dir-' + Date.now(),
        esPrincipal
      };
      c.direcciones.push(nueva);
    }

    this.establecerSesion({ ...c });
  }

  eliminarDireccion(id: string): void {
    const c = this.currentCliente;
    if (!c || !c.direcciones) return;
    const eraPrincipal = c.direcciones.find(d => d.id === id)?.esPrincipal;
    c.direcciones = c.direcciones.filter(d => d.id !== id);
    if (eraPrincipal && c.direcciones.length > 0) {
      c.direcciones[0].esPrincipal = true;
    }
    this.establecerSesion({ ...c });
  }

  establecerDireccionPrincipal(id: string): void {
    const c = this.currentCliente;
    if (!c || !c.direcciones) return;
    c.direcciones.forEach(d => {
      d.esPrincipal = (d.id === id);
    });
    this.establecerSesion({ ...c });
  }

  // Modales
  abrirModalAuth(tab: 'login' | 'register' = 'login'): void {
    this.cerrarModalPerfil();
    this.cerrarModalFavoritos();
    this.cerrarAvisoLogin();
    this.modalAuthTab$.next(tab);
    this.modalAuthOpen$.next(true);
  }

  cerrarModalAuth(): void {
    this.modalAuthOpen$.next(false);
  }

  abrirModalPerfil(seccion: 'compras' | 'datos' | 'direcciones' | 'cupones' = 'compras'): void {
    if (!this.isLoggedIn) {
      this.abrirModalAuth('login');
      return;
    }
    this.cerrarModalAuth();
    this.cerrarModalFavoritos();
    this.cerrarAvisoLogin();
    this.modalPerfilSeccion$.next(seccion);
    this.modalPerfilOpen$.next(true);
    this.drawerPerfil$.next(true);
  }

  cerrarModalPerfil(): void {
    this.modalPerfilOpen$.next(false);
    this.drawerPerfil$.next(false);
  }

  abrirModalFavoritos(): void {
    if (!this.isLoggedIn) {
      this.mostrarAvisoLogin();
      return;
    }
    this.cerrarModalAuth();
    this.cerrarModalPerfil();
    this.cerrarAvisoLogin();
    this.modalFavoritosOpen$.next(true);
  }

  cerrarModalFavoritos(): void {
    this.modalFavoritosOpen$.next(false);
  }

  mostrarAvisoLogin(): void {
    this.cerrarModalAuth();
    this.cerrarModalPerfil();
    this.cerrarModalFavoritos();
    this.modalAvisoLoginOpen$.next(true);
  }

  cerrarAvisoLogin(): void {
    this.modalAvisoLoginOpen$.next(false);
  }

  irAlRegistroDesdeAviso(): void {
    this.cerrarAvisoLogin();
    this.abrirModalAuth('register');
  }
}
