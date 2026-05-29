/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Image as ImageIcon, 
  Upload, 
  MapPin, 
  ArrowUp, 
  ArrowDown, 
  Trash2, 
  Plus, 
  Check, 
  Download, 
  Eye, 
  Info, 
  RefreshCw,
  Sparkles
} from 'lucide-react';
import exifr from 'exifr';
import JSZip from 'jszip';
import { 
  getConfig, 
  saveConfig, 
  getAllLogos, 
  saveLogo, 
  deleteLogo, 
  AppConfig, 
  LogoRecord 
} from '../utils/db';
import { 
  renderWatermark 
} from '../utils/watermark';
import DateTimePicker from '../components/DateTimePicker';

// Photo interface for the upload queue
interface PhotoItem {
  id: string;
  file: File;
  previewUrl: string;
  date: string;       // Formatted date string (DD/MM/YYYY HH:MM:SS)
  lat: string;        // Latitude string
  lng: string;        // Longitude string
  status: string;     // e.g. "Antes del Mantenimiento"
  location: string;   // e.g. "CITRA DATACENTER PRINCIPAL › RACK 05"
  originalMetadata: {
    date: string;
    lat: string;
    lng: string;
  };
}

// Default helper to format Date to Style B: DD/MM/YYYY HH:MM:SS
function formatDate(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// Convert DD/MM/YYYY HH:MM:SS to input compatible ISO date-time string
function parseDateStringToInput(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split(' ');
  if (parts.length < 2) return '';
  const dateParts = parts[0].split('/');
  if (dateParts.length < 3) return '';
  const timeParts = parts[1].split(':');
  if (timeParts.length < 2) return '';
  
  // Format: YYYY-MM-DDTHH:MM
  const year = dateParts[2];
  const month = dateParts[1].padStart(2, '0');
  const day = dateParts[0].padStart(2, '0');
  const hours = timeParts[0].padStart(2, '0');
  const minutes = timeParts[1].padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Parse input datetime-local string to DD/MM/YYYY HH:MM:SS
function parseInputToDateString(val: string): string {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '';
  return formatDate(d);
}

export default function Home() {
  // Navigation active tab
  const [activeTab, setActiveTab] = useState<'processor' | 'config'>('processor');

  // App configurations
  const [config, setConfig] = useState<AppConfig>({
    companyName: 'UNION ELÉCTRICA',
    logoPosition: 'top-left',
    textPosition: 'bottom-right',
    watermarkSize: 'small',
    showGPS: true,
    showDateTime: true,
    watermarkStyle: 'card',
    activeLogoId: null,
  });

  // Logo list
  const [logos, setLogos] = useState<LogoRecord[]>([]);
  const [logoUrls, setLogoUrls] = useState<Record<string, string>>({});

  // Photos queue
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [useMetadata, setUseMetadata] = useState<boolean>(true);

  // Manual date-time range state
  const [startDateRange, setStartDateRange] = useState<string>('');
  const [endDateRange, setEndDateRange] = useState<string>('');

  // Universal batch settings
  const [batchStatus, setBatchStatus] = useState<string>('Antes del Mantenimiento');
  const [batchLocation, setBatchLocation] = useState<string>('');

  // Processing state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [processingMessage, setProcessingMessage] = useState<string>('');

  // Preview modal states
  const [previewPhoto, setPreviewPhoto] = useState<PhotoItem | null>(null);
  const [previewImageSrc, setPreviewImageSrc] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);

  // Drag and Drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Initial load
  useEffect(() => {
    async function loadData() {
      const savedConfig = await getConfig();
      setConfig(savedConfig);

      const dbLogos = await getAllLogos();
      setLogos(dbLogos);

      // Create object URLs for logo blobs
      const urls: Record<string, string> = {};
      dbLogos.forEach((logo) => {
        urls[logo.id] = URL.createObjectURL(logo.blob);
      });
      setLogoUrls(urls);
    }
    loadData();

    // Cleanup URLs
    return () => {
      Object.values(logoUrls).forEach(url => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update Config
  const handleSaveConfig = async (newConfig: AppConfig) => {
    setConfig(newConfig);
    await saveConfig(newConfig);
  };

  // Add Logo
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const id = Date.now().toString();
    const newLogo: LogoRecord = {
      id,
      name: file.name,
      blob: file,
    };

    await saveLogo(newLogo);
    
    // Revoke previous url if any and generate new
    const url = URL.createObjectURL(file);
    setLogoUrls(prev => ({ ...prev, [id]: url }));
    setLogos(prev => [...prev, newLogo]);

    // Auto set as active logo if none active
    if (!config.activeLogoId) {
      handleSaveConfig({ ...config, activeLogoId: id });
    }
  };

  // Delete Logo
  const handleDeleteLogo = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteLogo(id);
    
    if (logoUrls[id]) {
      URL.revokeObjectURL(logoUrls[id]);
      const newUrls = { ...logoUrls };
      delete newUrls[id];
      setLogoUrls(newUrls);
    }

    setLogos(prev => prev.filter(l => l.id !== id));

    if (config.activeLogoId === id) {
      const remainingLogos = logos.filter(l => l.id !== id);
      handleSaveConfig({ 
        ...config, 
        activeLogoId: remainingLogos.length > 0 ? remainingLogos[0].id : null 
      });
    }
  };

  // Photo Upload and Parsing
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newPhotos: PhotoItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const previewUrl = URL.createObjectURL(file);
      
      let date = '';
      let lat = '';
      let lng = '';

      try {
        // Exifr parsing
        const meta = await exifr.parse(file, { tiff: true, gps: true });
        
        if (meta?.DateTimeOriginal) {
          date = formatDate(new Date(meta.DateTimeOriginal));
        } else {
          // Fallback to file date
          date = formatDate(new Date(file.lastModified));
        }

        if (meta?.latitude) lat = meta.latitude.toString();
        if (meta?.longitude) lng = meta.longitude.toString();
      } catch (err) {
        console.warn('Could not extract metadata for file:', file.name, err);
        date = formatDate(new Date(file.lastModified));
      }

      newPhotos.push({
        id: Math.random().toString(36).substring(2, 9),
        file,
        previewUrl,
        date,
        lat,
        lng,
        status: batchStatus || 'Antes del Mantenimiento',
        location: batchLocation || '',
        originalMetadata: { date, lat, lng }
      });
    }

    setPhotos(prev => {
      const combined = [...prev, ...newPhotos];
      if (!useMetadata) {
        if (startDateRange && endDateRange && combined.length > 0) {
          const start = new Date(startDateRange);
          const end = new Date(endDateRange);
          if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
            const startMs = start.getTime();
            const endMs = end.getTime();
            const diff = endMs - startMs;
            const step = combined.length > 1 ? diff / (combined.length - 1) : 0;
            return combined.map((photo, idx) => ({
              ...photo,
              date: formatDate(new Date(startMs + idx * step)),
            }));
          }
        }
      }
      return combined;
    });
  };

  // Drag and Drop Handlers for Photo Grid
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (index: number) => {
    if (draggedIndex === null) return;
    const reordered = [...photos];
    const [draggedItem] = reordered.splice(draggedIndex, 1);
    reordered.splice(index, 0, draggedItem);
    setPhotos(reordered);
    setDraggedIndex(null);

    // If manual mode, recalculate dates on reordering
    if (!useMetadata) {
      applyManualDateInterpolation(reordered);
    }
  };

  // Move buttons (alternative to drag and drop)
  const movePhoto = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= photos.length) return;

    const reordered = [...photos];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;
    setPhotos(reordered);

    if (!useMetadata) {
      applyManualDateInterpolation(reordered);
    }
  };

  // Delete single photo
  const deletePhoto = (id: string, url: string) => {
    URL.revokeObjectURL(url);
    const updated = photos.filter(p => p.id !== id);
    setPhotos(updated);

    if (!useMetadata) {
      applyManualDateInterpolation(updated);
    }
  };

  // Apply manual date range interpolation
  const applyManualDateInterpolation = (
    itemsList = photos,
    startVal = startDateRange,
    endVal = endDateRange
  ) => {
    if (!startVal || !endVal || itemsList.length === 0) return itemsList;

    const start = new Date(startVal);
    const end = new Date(endVal);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return itemsList;

    const startMs = start.getTime();
    const endMs = end.getTime();
    const totalPhotos = itemsList.length;
    const diff = endMs - startMs;
    const step = totalPhotos > 1 ? diff / (totalPhotos - 1) : 0;

    const updated = itemsList.map((photo, i) => {
      const interpolatedTime = new Date(startMs + i * step);
      return {
        ...photo,
        date: formatDate(interpolatedTime),
      };
    });

    setPhotos(updated);
    return updated;
  };

  const handleToggleMetadata = (useMeta: boolean) => {
    setUseMetadata(useMeta);
    if (useMeta) {
      setPhotos(prev => prev.map(p => ({
        ...p,
        date: p.originalMetadata.date
      })));
    } else {
      applyManualDateInterpolation(photos, startDateRange, endDateRange);
    }
  };

  const handleStartDateChange = (val: string) => {
    setStartDateRange(val);
    if (!useMetadata) {
      applyManualDateInterpolation(photos, val, endDateRange);
    }
  };

  const handleEndDateChange = (val: string) => {
    setEndDateRange(val);
    if (!useMetadata) {
      applyManualDateInterpolation(photos, startDateRange, val);
    }
  };

  // Apply batch status or location to all current photos
  const applyBatchStatusToAll = (statusVal: string) => {
    setBatchStatus(statusVal);
    setPhotos(prev => prev.map(p => ({ ...p, status: statusVal })));
  };

  const applyBatchLocationToAll = (locVal: string) => {
    setBatchLocation(locVal);
    setPhotos(prev => prev.map(p => ({ ...p, location: locVal })));
  };

  const handleResetProcessor = () => {
    photos.forEach(photo => URL.revokeObjectURL(photo.previewUrl));
    setPhotos([]);
    setBatchStatus('Antes del Mantenimiento');
    setBatchLocation('');
    setStartDateRange('');
    setEndDateRange('');
    setUseMetadata(true);
  };

  // Single Photo Watermark Preview
  const handlePreviewPhoto = async (photo: PhotoItem) => {
    setPreviewPhoto(photo);
    setIsPreviewLoading(true);
    
    try {
      const activeLogoSrc = config.activeLogoId ? logoUrls[config.activeLogoId] : null;
      
      const blob = await renderWatermark(
        photo.previewUrl,
        config,
        activeLogoSrc,
        {
          date: photo.date,
          lat: photo.lat,
          lng: photo.lng,
          status: photo.status,
          location: photo.location
        }
      );

      if (previewImageSrc) {
        URL.revokeObjectURL(previewImageSrc);
      }

      const watermarkedUrl = URL.createObjectURL(blob);
      setPreviewImageSrc(watermarkedUrl);
    } catch (err) {
      console.error('Failed to render preview', err);
      alert('Error al generar la vista previa.');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setPreviewPhoto(null);
    if (previewImageSrc) {
      URL.revokeObjectURL(previewImageSrc);
      setPreviewImageSrc(null);
    }
  };

  // Batch Process and Download ZIP
  const handleProcessAll = async () => {
    if (photos.length === 0) {
      alert('Por favor, sube al menos una foto para procesar.');
      return;
    }

    setIsProcessing(true);
    setProcessingProgress(0);
    setProcessingMessage('Preparando el procesamiento por lotes...');

    const zip = new JSZip();
    const activeLogoSrc = config.activeLogoId ? logoUrls[config.activeLogoId] : null;

    try {
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        setProcessingMessage(`Procesando foto ${i + 1} de ${photos.length}: ${photo.file.name}...`);
        
        // SECUENTIAL RENDER to prevent browser tab crash (OOM)
        const blob = await renderWatermark(
          photo.previewUrl,
          config,
          activeLogoSrc,
          {
            date: photo.date,
            lat: photo.lat,
            lng: photo.lng,
            status: photo.status,
            location: photo.location
          }
        );

        // Add to ZIP (rename with index and status for ordering clarity)
        const fileExt = photo.file.name.split('.').pop() || 'jpg';
        const statusClean = photo.status ? `_${photo.status.toLowerCase().replace(/[^a-z0-9]/g, '_')}` : '';
        const zipFileName = `${(i + 1).toString().padStart(3, '0')}${statusClean}.${fileExt}`;
        
        zip.file(zipFileName, blob);
        setProcessingProgress(Math.round(((i + 1) / photos.length) * 100));
      }

      setProcessingMessage('Comprimiendo fotos procesadas...');
      const content = await zip.generateAsync({ type: 'blob' }, (metadata) => {
        setProcessingMessage(`Comprimiendo: ${Math.round(metadata.percent)}%`);
      });

      setProcessingMessage('Iniciando descarga del archivo ZIP...');
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `fotos_marca_agua_${new Date().toISOString().slice(0,10)}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setProcessingMessage('¡Descarga completada con éxito!');
      setTimeout(() => {
        setIsProcessing(false);
      }, 2000);

    } catch (err) {
      console.error('Error during batch processing', err);
      alert('Ocurrió un error al procesar el lote: ' + err);
      setIsProcessing(false);
    }
  };

  // Helper for checking if logo position is selected
  const isLogoPos = (pos: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right') => 
    config.logoPosition === pos;

  // Helper for checking if text position is selected
  const isTextPos = (pos: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right') => 
    config.textPosition === pos;

  return (
    <div className="flex flex-1 min-h-screen bg-slate-900 text-slate-100 font-sans">
      
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="bg-red-600 text-white p-2 rounded-lg font-bold shadow-md shadow-red-900/30 flex items-center justify-center">
            <Sparkles size={20} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-wide">Marca de Agua</h1>
            <span className="text-xs text-slate-400">Pro Studio (Local)</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase px-3 mb-2 tracking-wider">Principal</p>
          <button 
            onClick={() => setActiveTab('processor')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium ${
              activeTab === 'processor' 
                ? 'bg-red-600 text-white shadow-md shadow-red-600/10' 
                : 'text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <ImageIcon size={18} />
            <span>Procesador de Fotos</span>
          </button>
          
          <p className="text-xs font-semibold text-slate-500 uppercase px-3 mt-6 mb-2 tracking-wider">Consola Admin</p>
          <button 
            onClick={() => setActiveTab('config')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium ${
              activeTab === 'config' 
                ? 'bg-red-600 text-white shadow-md shadow-red-600/10' 
                : 'text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <Settings size={18} />
            <span>Configuración Visual</span>
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800 text-center">
          <p className="text-xs text-slate-500 leading-normal">
            Todo el procesamiento ocurre localmente. Ninguna foto se sube a Internet.
          </p>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-900 overflow-y-auto">
        <header className="h-20 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold tracking-tight">
              {activeTab === 'processor' ? 'Carga y Edición de Fotos' : 'Ajustes Visuales y Marca de Agua'}
            </h2>
            {activeTab === 'processor' && photos.length > 0 && (
              <span className="bg-red-950/50 text-red-400 border border-red-900/50 text-xs px-2.5 py-1 rounded-full font-semibold">
                {photos.length} foto{photos.length !== 1 ? 's' : ''} cargada{photos.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {activeTab === 'processor' && photos.length > 0 && (
              <button
                onClick={handleProcessAll}
                disabled={isProcessing}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg shadow-emerald-950/20 disabled:opacity-50 transition-colors"
              >
                <Download size={18} />
                Procesar y Descargar ZIP
              </button>
            )}
          </div>
        </header>

        {/* CONTAINER CONTENT */}
        <div className="p-8 max-w-7xl mx-auto w-full flex-1 flex flex-col gap-8">
          
          {/* TAB 1: PROCESSOR / WORKFLOW */}
          {activeTab === 'processor' && (
            <div className="space-y-8 flex-1 flex flex-col">
              
              {/* UPLOAD & BATCH SETTINGS CARD */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* 1. Upload trigger */}
                <div className="lg:col-span-2 bg-slate-950 border border-slate-800 rounded-3xl p-6 flex flex-col items-center justify-center min-h-[220px] transition-all hover:border-slate-700 relative overflow-hidden group">
                  <input 
                    type="file" 
                    multiple 
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                  />
                  <div className="flex flex-col items-center text-center p-4">
                    <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 group-hover:text-red-500 group-hover:border-red-950/50 transition-all duration-300 shadow-inner mb-4">
                      <Upload size={28} />
                    </div>
                    <h3 className="font-semibold text-lg text-slate-200">Subir imágenes para procesar</h3>
                    <p className="text-sm text-slate-500 mt-1 max-w-sm">
                      Arrastra tus fotos aquí o haz clic para buscarlas en tu equipo. Soporta carga masiva.
                    </p>
                  </div>
                </div>

                {/* 2. Global Batch Controls */}
                <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <Settings size={16} className="text-slate-500" />
                      Valores Rápidos del Lote
                    </h3>
                    <button
                      onClick={handleResetProcessor}
                      className="text-xs font-semibold text-slate-500 hover:text-red-500 flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Restablecer todos los valores del procesador (incluyendo fotos)"
                    >
                      <RefreshCw size={12} />
                      Limpiar Procesador
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5">Fase Predeterminada</label>
                      <select 
                        value={batchStatus} 
                        onChange={(e) => applyBatchStatusToAll(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-red-600 transition-colors"
                      >
                        <option value="Antes del Mantenimiento">Antes del Mantenimiento</option>
                        <option value="Durante el Mantenimiento">Durante el Mantenimiento</option>
                        <option value="Después del Mantenimiento">Después del Mantenimiento</option>
                        <option value="">Ninguno (Ocultar línea)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5">Ubicación / Descripción Global</label>
                      <textarea 
                        value={batchLocation} 
                        placeholder="Ej. CITRA DATACENTER&#10;RACK 05"
                        onChange={(e) => applyBatchLocationToAll(e.target.value)}
                        rows={2}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-red-600 transition-colors resize-y min-h-[68px]"
                      />
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-normal">
                    * Al modificar estos valores, se aplicarán inmediatamente a todas las fotos que tengas cargadas en la lista inferior.
                  </p>
                </div>
              </div>

              {/* METADATA MODE CONTROL CARD */}
              <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <h3 className="font-semibold text-lg text-slate-200">Fecha y Hora de la Marca de Agua</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Elige si deseas leer la fecha de la metadata de cada archivo o asignarla tú manualmente en un rango.
                    </p>
                  </div>
                  
                  {/* Selector Mode Toggle */}
                  <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 shrink-0 self-start md:self-center">
                    <button
                      onClick={() => handleToggleMetadata(true)}
                      className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                        useMetadata 
                          ? 'bg-red-600 text-white shadow-md' 
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Usar Metadata (EXIF)
                    </button>
                    <button
                      onClick={() => handleToggleMetadata(false)}
                      className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                        !useMetadata 
                          ? 'bg-red-600 text-white shadow-md' 
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Asignar Rango Manual
                    </button>
                  </div>
                </div>

                {/* Manual date inputs */}
                {!useMetadata && (
                  <div className="mt-6 p-5 bg-slate-900/60 border border-slate-800 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5">Fecha y Hora de Inicio (Foto 1)</label>
                      <DateTimePicker 
                        value={startDateRange}
                        onChange={(val) => handleStartDateChange(val)}
                        placeholder="Seleccionar fecha y hora de inicio"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5">Fecha y Hora de Fin (Foto Final)</label>
                      <DateTimePicker 
                        value={endDateRange}
                        onChange={(val) => handleEndDateChange(val)}
                        placeholder="Seleccionar fecha y hora de fin"
                      />
                    </div>
                    <div className="md:col-span-2 flex items-center justify-between text-xs text-slate-500 pt-2">
                      <span className="flex items-center gap-1.5">
                        <Info size={14} className="text-slate-400 shrink-0" />
                        Las fechas se calcularán proporcionalmente de inicio a fin según el orden de las fotos.
                      </span>
                      {photos.length > 0 && (
                        <button
                          onClick={() => applyManualDateInterpolation()}
                          className="text-red-500 hover:text-red-400 font-semibold flex items-center gap-1"
                        >
                          <RefreshCw size={12} />
                          Recalcular Ahora
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* PHOTO QUEUE LIST */}
              {photos.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm text-slate-400 uppercase tracking-wider">
                      Lista de Fotos ({photos.length}) - Ordena y configura cada una
                    </h3>
                    <button 
                      onClick={() => {
                        photos.forEach(p => URL.revokeObjectURL(p.previewUrl));
                        setPhotos([]);
                      }}
                      className="text-xs font-semibold text-slate-500 hover:text-red-500 flex items-center gap-1 transition-colors"
                    >
                      <Trash2 size={14} />
                      Limpiar lista
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {photos.map((photo, index) => (
                      <div 
                        key={photo.id}
                        draggable
                        onDragStart={() => handleDragStart(index)}
                        onDragEnd={() => setDraggedIndex(null)}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(index)}
                        className={`bg-slate-950 border rounded-2xl p-4 flex flex-col md:flex-row items-center gap-5 transition-all relative ${
                          draggedIndex === index 
                            ? 'border-red-600 bg-red-950/5 opacity-50 scale-[0.98]' 
                            : 'border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {/* Drag Handle & Ordering Tools */}
                        <div className="flex md:flex-col items-center gap-2 shrink-0 text-slate-500">
                          <button 
                            onClick={() => movePhoto(index, 'up')}
                            disabled={index === 0}
                            className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg hover:text-white disabled:opacity-30 disabled:hover:text-slate-500 transition-colors"
                            title="Subir posición"
                          >
                            <ArrowUp size={14} />
                          </button>
                          
                          {/* Drag visual indicator */}
                          <div 
                            className="cursor-grab active:cursor-grabbing px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg font-mono text-xs font-bold text-slate-400"
                            title="Arrastra para reordenar"
                          >
                            {index + 1}
                          </div>

                          <button 
                            onClick={() => movePhoto(index, 'down')}
                            disabled={index === photos.length - 1}
                            className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg hover:text-white disabled:opacity-30 disabled:hover:text-slate-500 transition-colors"
                            title="Bajar posición"
                          >
                            <ArrowDown size={14} />
                          </button>
                        </div>

                        {/* Image Preview Thumbnail */}
                        <div className="relative w-36 h-24 rounded-lg bg-slate-900 border border-slate-800 overflow-hidden shrink-0 group/img">
                          <img 
                            src={photo.previewUrl} 
                            alt={photo.file.name}
                            className="w-full h-full object-cover transition-transform group-hover/img:scale-105"
                          />
                          <button
                            onClick={() => handlePreviewPhoto(photo)}
                            className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover/img:opacity-100 flex items-center justify-center gap-1.5 text-white text-xs font-semibold transition-opacity duration-200"
                          >
                            <Eye size={14} />
                            Ver Previa
                          </button>
                        </div>

                        {/* Config columns */}
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                          
                          {/* File Details */}
                          <div className="space-y-1">
                            <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Nombre del Archivo</span>
                            <p className="text-sm font-semibold text-slate-300 truncate max-w-[200px]" title={photo.file.name}>
                              {photo.file.name}
                            </p>
                            <span className="block text-[11px] text-slate-500">
                              {(photo.file.size / (1024 * 1024)).toFixed(2)} MB
                            </span>
                          </div>

                          {/* Phase/Status */}
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Estado / Grupo</label>
                            <select 
                              value={photo.status}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, status: val } : p));
                              }}
                              className="w-full bg-slate-900 border border-slate-850 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-red-600 transition-colors"
                            >
                              <option value="Antes del Mantenimiento">Antes del Mantenimiento</option>
                              <option value="Durante el Mantenimiento">Durante el Mantenimiento</option>
                              <option value="Después del Mantenimiento">Después del Mantenimiento</option>
                              <option value="">Ninguno</option>
                            </select>
                          </div>

                          {/* Location details */}
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Locación / Detalles</label>
                            <textarea 
                              value={photo.location}
                              placeholder="Ubicación"
                              onChange={(e) => {
                                const val = e.target.value;
                                setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, location: val } : p));
                              }}
                              rows={2}
                              className="w-full bg-slate-900 border border-slate-850 rounded-xl px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-red-600 transition-colors resize-y min-h-[46px] leading-normal"
                            />
                          </div>

                          {/* Date and Time */}
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1 flex justify-between">
                              <span>Fecha y Hora</span>
                              {photo.date !== photo.originalMetadata.date && (
                                <button
                                  onClick={() => {
                                    setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, date: p.originalMetadata.date } : p));
                                  }}
                                  className="text-[10px] text-slate-500 hover:text-red-500 font-bold transition-colors"
                                  title="Restaurar metadata EXIF"
                                >
                                  Reset
                                </button>
                              )}
                            </label>
                            <DateTimePicker 
                              value={parseDateStringToInput(photo.date)}
                              onChange={(val) => {
                                const formattedVal = parseInputToDateString(val);
                                setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, date: formattedVal } : p));
                              }}
                              className="!px-2.5 !py-1.5 !text-xs !bg-slate-900 border-slate-850"
                              placeholder="Fecha"
                            />
                          </div>

                        </div>

                        {/* GPS Coords inputs */}
                        <div className="flex flex-row md:flex-col gap-2 shrink-0 w-full md:w-36">
                          <div className="w-1/2 md:w-full">
                            <label className="block text-[9px] font-semibold text-slate-500 uppercase mb-0.5">Latitud</label>
                            <input 
                              type="text"
                              value={photo.lat}
                              placeholder="0.000000"
                              onChange={(e) => {
                                const val = e.target.value;
                                setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, lat: val } : p));
                              }}
                              className="w-full bg-slate-900 border border-slate-850 rounded-xl px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-red-600 transition-colors"
                            />
                          </div>
                          <div className="w-1/2 md:w-full">
                            <label className="block text-[9px] font-semibold text-slate-500 uppercase mb-0.5">Longitud</label>
                            <input 
                              type="text"
                              value={photo.lng}
                              placeholder="0.000000"
                              onChange={(e) => {
                                const val = e.target.value;
                                setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, lng: val } : p));
                              }}
                              className="w-full bg-slate-900 border border-slate-850 rounded-xl px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-red-600 transition-colors"
                            />
                          </div>
                        </div>

                        {/* Delete action */}
                        <button
                          onClick={() => deletePhoto(photo.id, photo.previewUrl)}
                          className="p-2.5 bg-slate-900 border border-slate-800 hover:border-red-950 text-slate-400 hover:text-red-500 rounded-xl shrink-0 transition-colors"
                          title="Eliminar foto"
                        >
                          <Trash2 size={16} />
                        </button>

                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-center bg-slate-950/40 border border-dashed border-slate-800 rounded-3xl">
                  <ImageIcon className="text-slate-700 w-16 h-16 mb-4" />
                  <h4 className="font-semibold text-slate-300 text-base">La cola de fotos está vacía</h4>
                  <p className="text-sm text-slate-500 max-w-xs mt-1">
                    Sube fotos arriba para comenzar a reordenarlas y aplicarles la marca de agua.
                  </p>
                </div>
              )}

            </div>
          )}

          {/* TAB 2: WATERMARK CONFIGURATIONS */}
          {activeTab === 'config' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              
              {/* Left Config Panel */}
              <div className="lg:col-span-2 space-y-8">
                
                {/* 1. Main Texts & Toggles */}
                <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-6">
                  <h3 className="font-semibold text-lg text-slate-200 border-b border-slate-800 pb-3 flex items-center gap-2">
                    <ImageIcon size={18} className="text-red-500" />
                    Texto de Marca de Agua
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                        Texto Empresarial / Organización
                      </label>
                      <input 
                        type="text" 
                        value={config.companyName}
                        onChange={(e) => handleSaveConfig({ ...config, companyName: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-red-600 transition-colors font-medium"
                        placeholder="UNION ELÉCTRICA"
                      />
                    </div>

                    <div className="pt-2 space-y-3">
                      <div className="flex items-center justify-between p-3 bg-slate-900/60 rounded-2xl border border-slate-850">
                        <div>
                          <label className="text-sm font-semibold text-slate-300 block">Mostrar Coordenadas GPS</label>
                          <span className="text-xs text-slate-550">Ubicación geográfica en la foto</span>
                        </div>
                        <input 
                          type="checkbox"
                          checked={config.showGPS}
                          onChange={(e) => handleSaveConfig({ ...config, showGPS: e.target.checked })}
                          className="w-10 h-5 bg-slate-950 border-slate-800 checked:bg-red-600 checked:border-red-600 rounded-full appearance-none relative cursor-pointer before:content-[''] before:absolute before:w-4 before:h-4 before:bg-slate-400 checked:before:bg-white before:rounded-full before:top-[2px] before:left-[2px] checked:before:left-[22px] before:transition-all transition-colors duration-200"
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 bg-slate-900/60 rounded-2xl border border-slate-850">
                        <div>
                          <label className="text-sm font-semibold text-slate-300 block">Mostrar Fecha y Hora</label>
                          <span className="text-xs text-slate-550">Timestamp de captura</span>
                        </div>
                        <input 
                          type="checkbox"
                          checked={config.showDateTime}
                          onChange={(e) => handleSaveConfig({ ...config, showDateTime: e.target.checked })}
                          className="w-10 h-5 bg-slate-950 border-slate-800 checked:bg-red-600 checked:border-red-600 rounded-full appearance-none relative cursor-pointer before:content-[''] before:absolute before:w-4 before:h-4 before:bg-slate-400 checked:before:bg-white before:rounded-full before:top-[2px] before:left-[2px] checked:before:left-[22px] before:transition-all transition-colors duration-200"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Position Visual Matrices */}
                <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-6">
                  <h3 className="font-semibold text-lg text-slate-200 border-b border-slate-800 pb-3 flex items-center gap-2">
                    <MapPin size={18} className="text-red-500" />
                    Posición de los Elementos
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* Logo Position Selector */}
                    <div className="space-y-3">
                      <label className="block text-sm font-semibold text-slate-300">Posición del Logo</label>
                      <div className="aspect-[4/3] bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between relative">
                        
                        {/* Top corner options */}
                        <div className="flex justify-between w-full">
                          <button
                            onClick={() => handleSaveConfig({ ...config, logoPosition: 'top-left' })}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                              isLogoPos('top-left') 
                                ? 'bg-red-600 text-white border border-red-500 scale-105' 
                                : 'bg-slate-950 border border-slate-850 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            S.Izq
                          </button>
                          <button
                            onClick={() => handleSaveConfig({ ...config, logoPosition: 'top-right' })}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                              isLogoPos('top-right') 
                                ? 'bg-red-600 text-white border border-red-500 scale-105' 
                                : 'bg-slate-950 border border-slate-850 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            S.Der
                          </button>
                        </div>

                        {/* Decorative Center Camera Icon */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
                          <ImageIcon size={64} className="text-slate-400" />
                        </div>

                        {/* Bottom corner options */}
                        <div className="flex justify-between w-full">
                          <button
                            onClick={() => handleSaveConfig({ ...config, logoPosition: 'bottom-left' })}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                              isLogoPos('bottom-left') 
                                ? 'bg-red-600 text-white border border-red-500 scale-105' 
                                : 'bg-slate-950 border border-slate-850 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            I.Izq
                          </button>
                          <button
                            onClick={() => handleSaveConfig({ ...config, logoPosition: 'bottom-right' })}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                              isLogoPos('bottom-right') 
                                ? 'bg-red-600 text-white border border-red-500 scale-105' 
                                : 'bg-slate-950 border border-slate-850 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            I.Der
                          </button>
                        </div>

                      </div>
                    </div>

                    {/* Text Position Selector */}
                    <div className="space-y-3">
                      <label className="block text-sm font-semibold text-slate-300">Posición del Texto</label>
                      <div className="aspect-[4/3] bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between relative">
                        
                        {/* Top corner options */}
                        <div className="flex justify-between w-full">
                          <button
                            onClick={() => handleSaveConfig({ ...config, textPosition: 'top-left' })}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                              isTextPos('top-left') 
                                ? 'bg-red-600 text-white border border-red-500 scale-105' 
                                : 'bg-slate-950 border border-slate-850 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            S.Izq
                          </button>
                          <button
                            onClick={() => handleSaveConfig({ ...config, textPosition: 'top-right' })}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                              isTextPos('top-right') 
                                ? 'bg-red-600 text-white border border-red-500 scale-105' 
                                : 'bg-slate-950 border border-slate-850 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            S.Der
                          </button>
                        </div>

                        {/* Decorative Center Icon */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
                          <ImageIcon size={64} className="text-slate-400" />
                        </div>

                        {/* Bottom corner options */}
                        <div className="flex justify-between w-full">
                          <button
                            onClick={() => handleSaveConfig({ ...config, textPosition: 'bottom-left' })}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                              isTextPos('bottom-left') 
                                ? 'bg-red-600 text-white border border-red-500 scale-105' 
                                : 'bg-slate-950 border border-slate-850 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            I.Izq
                          </button>
                          <button
                            onClick={() => handleSaveConfig({ ...config, textPosition: 'bottom-right' })}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                              isTextPos('bottom-right') 
                                ? 'bg-red-600 text-white border border-red-500 scale-105' 
                                : 'bg-slate-950 border border-slate-850 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            I.Der
                          </button>
                        </div>

                      </div>
                    </div>

                  </div>
                </div>

                {/* 3. Watermark Size */}
                <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-6">
                  <h3 className="font-semibold text-lg text-slate-200 border-b border-slate-800 pb-3">
                    Tamaño de Marca de Agua
                  </h3>
                  
                  <div className="grid grid-cols-3 gap-4">
                    {(['small', 'medium', 'large'] as const).map((size) => {
                      const label = size === 'small' ? 'Pequeño' : size === 'medium' ? 'Mediano' : 'Grande';
                      const isSelected = config.watermarkSize === size;
                      return (
                        <button
                          key={size}
                          onClick={() => handleSaveConfig({ ...config, watermarkSize: size })}
                          className={`flex flex-col items-center justify-center p-5 rounded-2xl border text-center transition-all ${
                            isSelected
                              ? 'bg-red-950/20 border-red-600 text-white'
                              : 'bg-slate-900 border-slate-850 text-slate-400 hover:text-slate-300'
                          }`}
                        >
                          <span className={`font-bold transition-all ${
                            size === 'small' ? 'text-sm' : size === 'medium' ? 'text-lg' : 'text-2xl'
                          }`}>A</span>
                          <span className="text-xs mt-2 font-semibold">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Style selector */}
                <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-6">
                  <h3 className="font-semibold text-lg text-slate-200 border-b border-slate-800 pb-3">
                    Estilo de Diseño
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Style A Option */}
                    <button
                      onClick={() => handleSaveConfig({ ...config, watermarkStyle: 'plain' })}
                      className={`p-5 rounded-2xl border text-left space-y-3 transition-all ${
                        config.watermarkStyle === 'plain'
                          ? 'bg-red-950/20 border-red-600 text-white'
                          : 'bg-slate-900 border-slate-850 text-slate-400 hover:text-slate-300 hover:border-slate-800'
                      }`}
                    >
                      <h4 className="font-bold text-sm">Estilo A: Texto Sencillo</h4>
                      <p className="text-xs text-slate-500 leading-normal">
                        Texto blanco sin contenedor con una sombra paralela negra. Formato en DMS de coordenadas GPS (ej. 11.08.53.jpeg).
                      </p>
                    </button>

                    {/* Style B Option */}
                    <button
                      onClick={() => handleSaveConfig({ ...config, watermarkStyle: 'card' })}
                      className={`p-5 rounded-2xl border text-left space-y-3 transition-all ${
                        config.watermarkStyle === 'card'
                          ? 'bg-red-950/20 border-red-600 text-white'
                          : 'bg-slate-900 border-slate-850 text-slate-400 hover:text-slate-300 hover:border-slate-800'
                      }`}
                    >
                      <h4 className="font-bold text-sm">Estilo B: Tarjeta Oscura</h4>
                      <p className="text-xs text-slate-500 leading-normal">
                        Caja gris oscura con un borde decorativo amarillo a la izquierda e iconos dedicados (▶, 📍, 🌐, 📅) (ej. 11.08.54 AM (1).jpeg).
                      </p>
                    </button>

                  </div>
                </div>

              </div>

              {/* Right Panel - Logos Management */}
              <div className="space-y-8">
                <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h3 className="font-semibold text-lg text-slate-200 flex items-center gap-2">
                      <Plus size={18} className="text-red-500" />
                      Logos Asociados
                    </h3>
                    <div className="relative cursor-pointer bg-slate-900 hover:bg-slate-800 text-slate-300 p-2 rounded-xl border border-slate-800 transition-colors">
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      <Plus size={16} />
                    </div>
                  </div>

                  {logos.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4">
                      {logos.map((logo) => {
                        const isSelected = config.activeLogoId === logo.id;
                        return (
                          <div
                            key={logo.id}
                            onClick={() => handleSaveConfig({ ...config, activeLogoId: logo.id })}
                            className={`group relative aspect-square bg-slate-900 rounded-2xl border p-4 flex flex-col items-center justify-center cursor-pointer transition-all ${
                              isSelected
                                ? 'border-red-600 bg-red-950/5'
                                : 'border-slate-850 hover:border-slate-800'
                            }`}
                          >
                            <img 
                              src={logoUrls[logo.id]} 
                              alt={logo.name}
                              className="max-w-full max-h-[70%] object-contain"
                            />
                            
                            <span className="text-[10px] text-slate-500 mt-2 truncate w-full text-center px-1">
                              {logo.name}
                            </span>

                            {/* Checkmark indicator */}
                            {isSelected && (
                              <div className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full">
                                <Check size={10} />
                              </div>
                            )}

                            {/* Delete button */}
                            <button
                              onClick={(e) => handleDeleteLogo(logo.id, e)}
                              className="absolute top-2 left-2 p-1.5 bg-slate-950 border border-slate-800 text-slate-500 hover:text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Eliminar logo"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="border border-dashed border-slate-850 rounded-2xl py-10 px-4 text-center">
                      <ImageIcon className="text-slate-800 w-10 h-10 mx-auto mb-2" />
                      <p className="text-xs text-slate-500">
                        No hay logotipos guardados. Presiona el botón + arriba para agregar uno.
                      </p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

        </div>
      </main>

      {/* PREVIEW MODAL */}
      {previewPhoto && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden shadow-2xl relative">
            <header className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
              <div>
                <h3 className="font-bold text-slate-200">Previsualización de Marca de Agua</h3>
                <p className="text-xs text-slate-550 truncate max-w-[400px]">
                  {previewPhoto.file.name}
                </p>
              </div>
              <button 
                onClick={closePreview}
                className="text-xs bg-slate-900 hover:bg-slate-850 text-slate-400 px-3 py-1.5 rounded-lg border border-slate-800 transition-colors"
              >
                Cerrar
              </button>
            </header>

            <div className="flex-1 bg-slate-950 p-6 flex items-center justify-center min-h-[300px] overflow-auto">
              {isPreviewLoading ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-4 border-red-600/30 border-t-red-600 rounded-full animate-spin"></div>
                  <span className="text-xs text-slate-450 font-medium">Generando marca de agua en Canvas...</span>
                </div>
              ) : (
                previewImageSrc && (
                  <img 
                    src={previewImageSrc} 
                    alt="Watermark preview"
                    className="max-w-full max-h-[60vh] object-contain rounded-xl border border-slate-800 shadow-lg"
                  />
                )
              )}
            </div>

            <footer className="px-6 py-4 border-t border-slate-800 flex justify-end gap-3 bg-slate-950">
              <button 
                onClick={closePreview}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-850 text-slate-300 rounded-xl border border-slate-800 text-sm font-semibold transition-colors"
              >
                Cerrar
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* BATCH PROCESSING PROGRESS MODAL */}
      {isProcessing && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-6 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-8 flex flex-col items-center text-center shadow-2xl space-y-6">
            <div className="relative flex items-center justify-center">
              {/* Spinning outer circle */}
              <div className="w-20 h-20 border-4 border-red-600/20 border-t-red-600 rounded-full animate-spin"></div>
              {/* Progress text in middle */}
              <div className="absolute font-mono text-sm font-bold text-red-500">
                {processingProgress}%
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-lg text-slate-200">Procesando lote de fotos</h3>
              <p className="text-xs text-slate-450 leading-relaxed font-mono max-w-xs truncate">
                {processingMessage}
              </p>
            </div>

            {/* Progress bar container */}
            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-850">
              <div 
                className="bg-red-600 h-full transition-all duration-300 shadow-md shadow-red-500/50"
                style={{ width: `${processingProgress}%` }}
              ></div>
            </div>
            
            <p className="text-[10px] text-slate-550 leading-normal">
              Por favor, no cierres esta pestaña. Las imágenes se están combinando usando tu CPU local.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
