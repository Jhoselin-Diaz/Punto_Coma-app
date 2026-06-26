import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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
}

@Component({
  selector: 'app-admin-shop-video',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-shop-video.component.html',
  styleUrl: './admin-shop-video.component.css'
})
export class AdminShopVideoComponent implements OnInit {
  showAddVideoModal = false;
  showEditVideoModal = false;

  videosAdmin: VideoRow[] = [];

  newVideo = {
    title: '',
    description: '',
    url: '',
    platform: 'TikTok' as 'TikTok' | 'Instagram' | 'YouTube Shorts',
    thumbnail: '',
    visible: true
  };

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

  constructor() {}

  ngOnInit() {
    // Inicializar lógica de videos locales
  }

  toggleVisible(item: { visible: boolean }) {
    item.visible = !item.visible;
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
    this.showAddVideoModal = true;
  }

  openEditVideo(vid: VideoRow) {
    this.editingVideo = {
      id: vid.id,
      title: vid.title,
      description: vid.description || 'Video de demostración de productos.',
      url: vid.url || 'https://www.tiktok.com/',
      platform: vid.platform,
      thumbnail: vid.thumbnail,
      productsCount: vid.productsCount,
      visible: vid.visible,
      views: vid.views || '12,450',
      likes: vid.likes || '1,890',
      clicks: vid.clicks || '432'
    };
    this.showEditVideoModal = true;
  }

  eliminarFila(array: any[], index: number) {
    array.splice(index, 1);
  }
}
