import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AdminAuthService } from '../../service/admin-auth.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-login.component.html',
  styleUrl: './admin-login.component.css'
})
export class AdminLoginComponent {
  correo: string = '';
  password: string = '';
  recordarme: boolean = true;
  showPassword: boolean = false;
  isLoading: boolean = false;
  errorMessage: string = '';

  constructor(
    private authService: AdminAuthService,
    private router: Router
  ) {}

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  iniciarSesion(): void {
    this.errorMessage = '';

    if (!this.correo.trim()) {
      this.errorMessage = 'Por favor, ingresa tu correo electrónico.';
      return;
    }

    if (!this.password) {
      this.errorMessage = 'Por favor, ingresa tu contraseña.';
      return;
    }

    this.isLoading = true;

    this.authService.login(this.correo.trim(), this.password, this.recordarme).subscribe({
      next: () => {
        this.isLoading = false;
        this.router.navigate(['/admin/dashboard']);
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Error al iniciar sesión:', err);
        if (err.status === 401 || err.status === 403) {
          this.errorMessage = 'Credenciales incorrectas. Verifica tu correo y contraseña.';
        } else if (err.error && err.error.mensaje) {
          this.errorMessage = err.error.mensaje;
        } else {
          this.errorMessage = 'No se pudo conectar con el servidor de autenticación.';
        }
      }
    });
  }
}
