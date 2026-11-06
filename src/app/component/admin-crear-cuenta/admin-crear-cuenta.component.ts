import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AdminAuthService } from '../../service/admin-auth.service';

@Component({
  selector: 'app-admin-crear-cuenta',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-crear-cuenta.component.html',
  styleUrl: './admin-crear-cuenta.component.css'
})
export class AdminCrearCuentaComponent {
  nombreCompleto: string = '';
  correo: string = '';
  password: string = '';
  confirmarPassword: string = '';
  showPassword: boolean = false;
  showConfirmPassword: boolean = false;
  isLoading: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';

  constructor(
    private authService: AdminAuthService,
    private router: Router
  ) {}

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  registrarse(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.nombreCompleto.trim() || !this.correo.trim() || !this.password) {
      this.errorMessage = 'Por favor, completa todos los campos.';
      return;
    }

    if (this.password.length < 6) {
      this.errorMessage = 'La contraseña debe tener al menos 6 caracteres.';
      return;
    }

    if (this.password !== this.confirmarPassword) {
      this.errorMessage = 'Las contraseñas no coinciden.';
      return;
    }

    this.isLoading = true;

    this.authService.registro(this.nombreCompleto.trim(), this.correo.trim(), this.password).subscribe({
      next: () => {
        this.isLoading = false;
        this.successMessage = '¡Cuenta de Administrador creada con éxito! Redirigiendo al inicio de sesión...';
        setTimeout(() => {
          this.router.navigate(['/admin/login']);
        }, 1500);
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Error al registrar admin:', err);
        if (err.status === 409) {
          this.errorMessage = 'El correo electrónico ya se encuentra registrado.';
        } else if (err.error && err.error.mensaje) {
          this.errorMessage = err.error.mensaje;
        } else {
          this.errorMessage = 'Ocurrió un error al registrar la cuenta en el servidor.';
        }
      }
    });
  }
}
