import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { ContentService, HomeBanner } from '../../../service/content.service';

declare var gapi: any;
declare var google: any;

export const GOOGLE_DEVELOPER_KEY = 'AIzaSyD5ZBrYA5bMkL4Ds8IzHV4pXhk0gpDsSss';
export const GOOGLE_CLIENT_ID = '898823253296-uf76fpr6sr435blefbiuongo09g6fk4m.apps.googleusercontent.com';

@Component({
  selector: 'app-admin-inicio',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-inicio.component.html',
  styleUrl: './admin-inicio.component.css'
})
export class AdminInicioComponent implements OnInit {
  // Banner Principal state
  bannerId?: number;
  bannerTitle = '';
  bannerSubtitle = '';
  bannerBtnText = '';
  bannerBtnLink = '';
  bannerImage = '';
  bannerPreviewStyle: any = '';
  bannerVisible = true;
  imagenSeleccionada: File | null = null;
  isBannerLoading = false;

  // Google Picker Configurations
  developerKey = GOOGLE_DEVELOPER_KEY;
  clientId = GOOGLE_CLIENT_ID;
  oauthToken = '';
  pickerApiLoaded = false;

  constructor(
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
    private contentService: ContentService,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    this.cargarBanner();
    this.loadGooglePicker();
  }

  cargarBanner() {
    this.isBannerLoading = true;
    this.contentService.getHomeBanner().subscribe({
      next: (banner) => {
        this.bannerId = banner.id;
        this.bannerTitle = banner.titulo;
        this.bannerSubtitle = banner.subtitulo;
        this.bannerBtnText = banner.textoBoton;
        this.bannerBtnLink = banner.linkBoton;
        this.bannerImage = banner.imagenUrl;
        this.bannerVisible = banner.visible;
        if (this.bannerImage) {
          const renderUrl = this.obtenerUrlRenderizable(this.bannerImage);
          this.bannerPreviewStyle = this.sanitizer.bypassSecurityTrustStyle(`url('${renderUrl}')`);
        } else {
          this.bannerPreviewStyle = '';
        }
        this.isBannerLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al cargar el banner', err);
        this.isBannerLoading = false;
      }
    });
  }

  loadGooglePicker() {
    // Check if scripts are already loaded globally to avoid duplicate script tags
    const hasGapi = typeof window !== 'undefined' && (window as any).gapi;
    const hasGoogle = typeof window !== 'undefined' && (window as any).google;

    if (hasGapi && (window as any).gapi.load) {
      gapi.load('picker', () => {
        this.pickerApiLoaded = true;
        console.log("Picker listo en AdminInicio - Google Picker API cargada con éxito.");
      });
    } else {
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        gapi.load('picker', () => {
          this.pickerApiLoaded = true;
          console.log("Picker listo en AdminInicio - Google Picker API cargada con éxito.");
        });
      };
      document.head.appendChild(script);
    }

    if (!hasGoogle || !(window as any).google.accounts) {
      const gsiScript = document.createElement('script');
      gsiScript.src = 'https://accounts.google.com/gsi/client';
      gsiScript.onload = () => {
        console.log("Google Identity Services (GIS) cargada con éxito en AdminInicio.");
      };
      document.head.appendChild(gsiScript);
    } else {
      console.log("Google Identity Services (GIS) ya disponible en AdminInicio.");
    }
  }

  abrirPicker(tipo: 'banner') {
    if (!this.oauthToken) {
      try {
        const client = google.accounts.oauth2.initTokenClient({
          client_id: this.clientId || 'YOUR_CLIENT_ID.apps.googleusercontent.com',
          scope: 'https://www.googleapis.com/auth/drive.readonly',
          callback: (response: any) => {
            if (response.error !== undefined) {
              console.error(response);
              return;
            }
            this.oauthToken = response.access_token;
            this.createPicker(tipo);
          },
        });
        client.requestAccessToken({prompt: 'consent'});
      } catch (err) {
        console.warn('Google GSI Token Client initialization failed, using URL fallback.', err);
        this.fallbackUrlPrompt(tipo);
      }
    } else {
      this.createPicker(tipo);
    }
  }

  createPicker(tipo: 'banner') {
    const isGooglePickerAvailable = typeof window !== 'undefined' && (window as any).google && (window as any).google.picker;
    const isGapiPickerAvailable = typeof window !== 'undefined' && (window as any).gapi && (window as any).gapi.picker;

    if (this.pickerApiLoaded && this.oauthToken && (isGooglePickerAvailable || isGapiPickerAvailable)) {
      try {
        const pickerNamespace = isGooglePickerAvailable ? (window as any).google.picker : (window as any).gapi.picker;
        console.log("Picker listo - Objeto de picker disponible en AdminInicio:", pickerNamespace);

        const view = new pickerNamespace.View(pickerNamespace.ViewId.DOCS);
        view.setMimeTypes('image/png,image/jpeg,image/jpg,image/webp,image/gif');

        const picker = new pickerNamespace.PickerBuilder()
          .enableFeature(pickerNamespace.Feature.NAV_HIDDEN)
          .setDeveloperKey(this.developerKey || 'YOUR_DEVELOPER_KEY')
          .setAppId(this.clientId ? this.clientId.split('-')[0] : 'YOUR_APP_ID')
          .setOAuthToken(this.oauthToken)
          .addView(view)
          .setCallback((data: any) => {
            console.log('Picker Event Completo en AdminInicio:', data);

            if (data[google.picker.Response.ACTION] === google.picker.Action.PICKED) {
              const doc = data[google.picker.Response.DOCUMENTS][0];
              console.log('Documento seleccionado de Drive en AdminInicio:', doc);
              
              const fileId = doc[google.picker.Document.ID];
              const directUrl = `https://docs.google.com/uc?export=view&id=${fileId}`;
              console.log('URL de renderizado directo construida en AdminInicio:', directUrl);

              this.ngZone.run(() => {
                this.handlePickerUrl(tipo, directUrl);
              });
              this.cdr.detectChanges();
            } else if (data[google.picker.Response.ACTION] === google.picker.Action.CANCEL) {
              console.log('El usuario canceló el Picker en AdminInicio');
            }
          })
          .build();
        picker.setVisible(true);
      } catch (err) {
        console.error('Error al crear Google Picker en AdminInicio:', err);
        this.fallbackUrlPrompt(tipo);
      }
    } else {
      console.warn('Google Picker API no está cargada completamente o falta token. Usando fallback.');
      this.fallbackUrlPrompt(tipo);
    }
  }

  extraerGoogleDriveId(input: string): string {
    if (!input) return '';
    const reg1 = /\/file\/d\/([a-zA-Z0-9_-]+)/;
    const reg2 = /[?&]id=([a-zA-Z0-9_-]+)/;
    const reg3 = /\/d\/([a-zA-Z0-9_-]+)/;

    let match = input.match(reg1);
    if (match) return match[1];

    match = input.match(reg2);
    if (match) return match[1];

    match = input.match(reg3);
    if (match) return match[1];

    return input.trim();
  }

  obtenerGoogleDrivePreviewUrl(id: string): string {
    if (!id) return '';
    return `https://docs.google.com/uc?export=view&id=${id}`;
  }

  obtenerUrlRenderizable(url: string): string {
    if (!url) return '';
    if (url.includes('docs.google.com/uc') || url.includes('drive.google.com/uc')) {
      const match = url.match(/[?&]id=([^&]+)/);
      if (match && match[1]) {
        return `https://lh3.googleusercontent.com/d/${match[1]}`;
      }
    }
    return url;
  }

  fallbackUrlPrompt(tipo: 'banner') {
    const input = prompt('Ingresa la URL de la imagen de Google Drive o el ID del archivo:');
    if (input) {
      const fileId = this.extraerGoogleDriveId(input);
      const publicUrl = this.obtenerGoogleDrivePreviewUrl(fileId);
      this.handlePickerUrl(tipo, publicUrl);
    }
  }

  handlePickerUrl(tipo: 'banner', url: string) {
    this.ngZone.run(() => {
      const renderUrl = this.obtenerUrlRenderizable(url);
      if (tipo === 'banner') {
        this.bannerImage = url;
        this.bannerPreviewStyle = this.sanitizer.bypassSecurityTrustStyle(`url('${renderUrl}')`);
        this.imagenSeleccionada = null;
      }
      this.cdr.detectChanges();
    });
  }

  onBannerFileSelected(event: any) {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      if (file.type.startsWith('image/')) {
        this.imagenSeleccionada = file;
        const objectUrl = URL.createObjectURL(file);
        this.bannerImage = objectUrl;
        this.ngZone.run(() => {
          this.bannerPreviewStyle = this.sanitizer.bypassSecurityTrustStyle(`url('${objectUrl}')`);
          this.cdr.detectChanges();
        });
      } else {
        alert('Por favor selecciona un archivo de imagen válido.');
      }
    }
  }

  guardarCambios() {
    const bannerActualizado: HomeBanner = {
      id: this.bannerId,
      titulo: this.bannerTitle,
      subtitulo: this.bannerSubtitle,
      textoBoton: this.bannerBtnText,
      linkBoton: this.bannerBtnLink,
      imagenUrl: this.bannerImage || '',
      visible: this.bannerVisible
    };

    const request$ = this.imagenSeleccionada
      ? this.contentService.updateHomeBannerMultipart(bannerActualizado, this.imagenSeleccionada)
      : this.contentService.updateHomeBannerJson(bannerActualizado);

    request$.subscribe({
      next: (res) => {
        alert('¡Banner guardado exitosamente en la base de datos de Supabase!');
        this.bannerId = res.id;
        this.bannerTitle = res.titulo;
        this.bannerSubtitle = res.subtitulo;
        this.bannerBtnText = res.textoBoton;
        this.bannerBtnLink = res.linkBoton;
        this.bannerImage = res.imagenUrl;
        this.bannerVisible = res.visible;
        this.imagenSeleccionada = null;
        if (this.bannerImage) {
          const renderUrl = this.obtenerUrlRenderizable(this.bannerImage);
          this.bannerPreviewStyle = this.sanitizer.bypassSecurityTrustStyle(`url('${renderUrl}')`);
        } else {
          this.bannerPreviewStyle = '';
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al guardar cambios del banner:', err);
        alert('Ocurrió un error al guardar los cambios en el servidor.');
      }
    });
  }
}
