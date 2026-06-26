import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ProductosService } from '../../../service/productos.service';
import { ShopVideoService, ShopVideoDTO } from '../../../service/shop-video.service';

interface VideoRow {
  id: string;
  platform: 'TikTok' | 'Instagram' | 'YouTube Shorts';
  title: string;
  thumbnail: string;
  productsCount: number;
  visible: boolean;
  views?: string;
  likes?: string;
  clicks?: string;
  description?: string;
  url?: string;
  productosIds: number[];
}

@Component({
  selector: 'app-admin-shop-video',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-shop-video.component.html',
  styleUrl: './admin-shop-video.component.css'
})
export class AdminShopVideoComponent implements OnInit {
  videosAdmin: VideoRow[] = [];
  productosDisponibles: any[] = [];
  selectedProductsIds: number[] = [];

  showAddVideoModal = false;
  showEditVideoModal = false;

  // Formulario AGREGAR SHOP VIDEO
  newVideo = {
    title: '',
    description: '',
    url: '',
    platform: 'TikTok' as 'TikTok' | 'Instagram' | 'YouTube Shorts',
    thumbnail: 'https://images.unsplash.com/photo-1511556532299-8f662fc26c06?q=80&w=2940&auto=format&fit=crop',
    visible: true
  };

  // Formulario EDITAR SHOP VIDEO
  editingVideo = {
    id: '',
    title: '',
    description: '',
    url: '',
    platform: 'TikTok' as 'TikTok' | 'Instagram' | 'YouTube Shorts',
    thumbnail: '',
    productsCount: 0,
    visible: true,
    views: '0',
    likes: '0',
    clicks: '0'
  };

  safeVideoPreviewUrl: SafeResourceUrl | null = null;

  constructor(
    private productosService: ProductosService,
    private shopVideoService: ShopVideoService,
    private sanitizer: DomSanitizer
  ) { }

  ngOnInit() {
    this.cargarVideos();
    this.cargarProductos();
  }

  cargarVideos() {
    this.shopVideoService.obtenerTodos().subscribe({
      next: (data) => {
        this.videosAdmin = data.map(v => ({
          id: v.id ? v.id.toString() : '',
          platform: v.plataforma as any,
          title: v.titulo,
          thumbnail: v.miniaturaUrl || 'https://images.unsplash.com/photo-1511556532299-8f662fc26c06?q=80&w=2940&auto=format&fit=crop',
          productsCount: v.productosIds ? v.productosIds.length : 0,
          visible: v.visible !== false,
          views: v.views || '0',
          likes: v.likes || '0',
          clicks: v.clicks || '0',
          description: v.descripcion,
          url: v.videoUrl,
          productosIds: v.productosIds || []
        }));
      },
      error: (err) => {
        console.error('Error al cargar videos:', err);
      }
    });
  }

  cargarProductos() {
    this.productosService.obtenerTodosBackend().subscribe({
      next: (data) => {
        this.productosDisponibles = data;
      },
      error: (err) => {
        console.error('Error al cargar productos:', err);
      }
    });
  }

  toggleVisible(vid: VideoRow) {
    const nuevoEstado = !vid.visible;
    this.shopVideoService.actualizarVisibilidad(+vid.id, nuevoEstado).subscribe({
      next: () => {
        vid.visible = nuevoEstado;
        console.log(`✅ Visibilidad del video "${vid.title}" conmutada a ${nuevoEstado}`);
      },
      error: (err) => {
        console.error('Error al cambiar visibilidad del video:', err);
        alert('No se pudo actualizar la visibilidad en el servidor.');
      }
    });
  }

  eliminarVideo(id: string) {
    if (confirm('¿Estás seguro de que deseas eliminar este video?')) {
      this.shopVideoService.eliminarVideo(+id).subscribe({
        next: () => {
          alert('Video eliminado con éxito.');
          this.cargarVideos();
        },
        error: (err) => {
          console.error('Error al eliminar video:', err);
          alert('No se pudo eliminar el video del servidor.');
        }
      });
    }
  }

  openAddVideo() {
    this.newVideo = {
      title: '',
      description: '',
      url: '',
      platform: 'TikTok',
      thumbnail: 'https://images.unsplash.com/photo-1511556532299-8f662fc26c06?q=80&w=2940&auto=format&fit=crop',
      visible: true
    };
    this.safeVideoPreviewUrl = null;
    this.selectedProductsIds = [];
    this.showAddVideoModal = true;
  }

  guardarNuevoVideo() {
    if (!this.newVideo.title || !this.newVideo.url) {
      alert('Por favor complete el título y la URL del video.');
      return;
    }

    const payload: ShopVideoDTO = {
      titulo: this.newVideo.title,
      descripcion: this.newVideo.description,
      plataforma: this.newVideo.platform,
      videoUrl: this.newVideo.url,
      miniaturaUrl: this.newVideo.thumbnail,
      visible: this.newVideo.visible,
      productosIds: this.selectedProductsIds
    };

    this.shopVideoService.crearVideo(payload).subscribe({
      next: () => {
        alert('¡Video publicado y guardado en la base de datos!');
        this.showAddVideoModal = false;
        this.cargarVideos();
      },
      error: (err) => {
        console.error('Error al guardar nuevo video:', err);
        alert('Ocurrió un error al guardar el video en el servidor.');
      }
    });
  }

  openEditVideo(vid: VideoRow) {
    this.editingVideo = {
      id: vid.id,
      title: vid.title,
      description: vid.description || '',
      url: vid.url || '',
      platform: vid.platform,
      thumbnail: vid.thumbnail,
      productsCount: vid.productsCount,
      visible: vid.visible,
      views: vid.views || '0',
      likes: vid.likes || '0',
      clicks: vid.clicks || '0'
    };
    this.selectedProductsIds = [...vid.productosIds];
    this.actualizarSafePreview(this.editingVideo.url);
    this.showEditVideoModal = true;
  }

  guardarCambiosVideo() {
    if (!this.editingVideo.title || !this.editingVideo.url) {
      alert('Por favor complete los campos obligatorios.');
      return;
    }

    const payload: ShopVideoDTO = {
      id: +this.editingVideo.id,
      titulo: this.editingVideo.title,
      descripcion: this.editingVideo.description,
      plataforma: this.editingVideo.platform,
      videoUrl: this.editingVideo.url,
      miniaturaUrl: this.editingVideo.thumbnail,
      visible: this.editingVideo.visible,
      productosIds: this.selectedProductsIds
    };

    this.shopVideoService.actualizarVideo(+this.editingVideo.id, payload).subscribe({
      next: () => {
        alert('¡Cambios guardados con éxito en el servidor!');
        this.showEditVideoModal = false;
        this.cargarVideos();
      },
      error: (err) => {
        console.error('Error al guardar cambios de video:', err);
        alert('Ocurrió un error al actualizar el video.');
      }
    });
  }

  obtenerEmbedUrl(url: string): string {
    if (!url) return '';
    let cleanUrl = url.trim().split('?')[0];

    // TikTok
    if (cleanUrl.includes('tiktok.com')) {
      const match = cleanUrl.match(/\/video\/([0-9]{19})/) || cleanUrl.match(/\/video\/([0-9]+)/);
      if (match) {
        return `https://www.tiktok.com/embed/v2/${match[1]}`;
      }
    }

    // Instagram
    if (cleanUrl.includes('instagram.com/reel/') || cleanUrl.includes('instagram.com/p/')) {
      let baseUrl = cleanUrl.replace(/\/captioned\/?$/, '');
      baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      if (!baseUrl.endsWith('/embed')) {
        baseUrl = `${baseUrl}/embed`;
      }
      return `${baseUrl}/`;
    }

    // YouTube Shorts / standard YouTube
    if (cleanUrl.includes('youtube.com/shorts/')) {
      const match = cleanUrl.match(/\/shorts\/([a-zA-Z0-9_-]+)/);
      if (match) {
        return `https://www.youtube.com/embed/${match[1]}`;
      }
    }
    if (cleanUrl.includes('youtube.com/watch')) {
      const match = url.match(/[?&]v=([a-zA-Z0-9_-]+)/);
      if (match) {
        return `https://www.youtube.com/embed/${match[1]}`;
      }
    }
    if (cleanUrl.includes('youtu.be/')) {
      const match = cleanUrl.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
      if (match) {
        return `https://www.youtube.com/embed/${match[1]}`;
      }
    }

    return cleanUrl;
  }

  actualizarSafePreview(url: string) {
    if (!url) {
      this.safeVideoPreviewUrl = null;
      return;
    }
    const embedUrl = this.obtenerEmbedUrl(url);
    this.safeVideoPreviewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
  }

  isProductSelected(id: number): boolean {
    return this.selectedProductsIds.includes(id);
  }

  toggleProductSelection(id: number) {
    const idx = this.selectedProductsIds.indexOf(id);
    if (idx > -1) {
      this.selectedProductsIds.splice(idx, 1);
    } else {
      this.selectedProductsIds.push(id);
    }
  }

  obtenerPortadaVideo(vid: any): string {
    const thumb = vid.thumbnail || vid.miniaturaUrl;
    if (thumb && thumb.startsWith('http') && !thumb.includes('photo-1511556532299-8f662fc26c06')) {
      return thumb;
    }

    const platform = vid.platform || vid.plataforma;
    if (platform === 'TikTok') {
      return 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=600&auto=format&fit=crop';
    } else if (platform === 'Instagram') {
      return 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?q=80&w=600&auto=format&fit=crop';
    } else {
      return 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?q=80&w=600&auto=format&fit=crop';
    }
  }
}
