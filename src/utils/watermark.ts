import { AppConfig } from './db';

export interface WatermarkData {
  date: string;
  lat: string;
  lng: string;
  status: string; // "Antes", "Durante", "Después", etc.
  location: string; // e.g. "CITRA DATACENTER"
}

// Helper to load an image URL into an HTMLImageElement
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('Failed to load image: ' + e));
  });
}

// Formatter for coordinates
export function formatDecimalToDMS(decimal: number, isLatitude: boolean): string {
  const absolute = Math.abs(decimal);
  const degrees = Math.floor(absolute);
  const minutesNotTruncated = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesNotTruncated);
  const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(3);
  
  let direction = '';
  if (isLatitude) {
    direction = decimal >= 0 ? 'N' : 'S';
  } else {
    direction = decimal >= 0 ? 'E' : 'W';
  }
  
  return `${degrees}°${minutes}'${seconds}"${direction}`;
}

export function parseGPSCoordinates(latStr: string, lngStr: string): { decLat: number | null, decLng: number | null, dmsLat: string, dmsLng: string } {
  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  if (isNaN(lat) || isNaN(lng)) {
    return {
      decLat: null,
      decLng: null,
      dmsLat: latStr || '',
      dmsLng: lngStr || '',
    };
  }

  return {
    decLat: lat,
    decLng: lng,
    dmsLat: formatDecimalToDMS(lat, true),
    dmsLng: formatDecimalToDMS(lng, false),
  };
}

export async function renderWatermark(
  imageSrc: string,
  config: AppConfig,
  logoSrc: string | null,
  data: WatermarkData
): Promise<Blob> {
  // 1. Load the background image
  const bgImage = await loadImage(imageSrc);
  
  // 2. Load the logo if active
  let logoImage: HTMLImageElement | null = null;
  if (logoSrc) {
    try {
      logoImage = await loadImage(logoSrc);
    } catch (e) {
      console.warn('Could not load logo image for canvas, proceeding without it', e);
    }
  }

  // 3. Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = bgImage.naturalWidth;
  canvas.height = bgImage.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get 2D context for canvas');
  }

  // 4. Draw base image
  ctx.drawImage(bgImage, 0, 0);

  // Define scaling factor based on the smaller side of the image
  const imageMinDim = Math.min(canvas.width, canvas.height);
  const padding = imageMinDim * 0.03; // 3% padding from borders
  
  // Determine watermark sizing scalar
  let sizeScalar = 1.0;
  if (config.watermarkSize === 'small') sizeScalar = 0.8;
  else if (config.watermarkSize === 'large') sizeScalar = 1.3;

  // 5. Draw Logo
  if (logoImage) {
    // Logo width defaults to 12% of image width, scaled
    const logoWidth = canvas.width * 0.12 * sizeScalar;
    const aspectRatio = logoImage.naturalHeight / logoImage.naturalWidth;
    const logoHeight = logoWidth * aspectRatio;

    let logoX = padding;
    let logoY = padding;

    if (config.logoPosition === 'top-right') {
      logoX = canvas.width - logoWidth - padding;
    } else if (config.logoPosition === 'bottom-left') {
      logoY = canvas.height - logoHeight - padding;
    } else if (config.logoPosition === 'bottom-right') {
      logoX = canvas.width - logoWidth - padding;
      logoY = canvas.height - logoHeight - padding;
    }

    ctx.drawImage(logoImage, logoX, logoY, logoWidth, logoHeight);
  }

  // 6. Assemble Text Lines
  const { decLat, decLng, dmsLat, dmsLng } = parseGPSCoordinates(data.lat, data.lng);
  const lines: string[] = [];

  const showGPS = config.showGPS && (data.lat || data.lng);
  const showDateTime = config.showDateTime && data.date;

  if (config.watermarkStyle === 'plain') {
    // Style A: Text with shadow (Plain)
    // In L11.08.53.jpeg:
    // Line 1: Date & Time
    // Line 2: GPS Coordinates in DMS (degrees minutes seconds)
    // Line 3: Location Details (e.g., address)
    // Line 4: Additional info/Zone/State (custom details)
    if (showDateTime) {
      lines.push(data.date);
    }
    if (showGPS) {
      if (dmsLat && dmsLng) {
        lines.push(`${dmsLat} ${dmsLng}`);
      } else {
        lines.push(`${data.lat}, ${data.lng}`);
      }
    }
    if (data.status) {
      lines.push(data.status.toUpperCase());
    }
    if (data.location) {
      const locLines = data.location.split('\n');
      locLines.forEach(line => lines.push(line));
    }
  } else {
    // Style B: Dark Card
    // In L11.08.54 AM (1).jpeg:
    // Line 1: Company Name (Bold, e.g. "UNION ELÉCTRICA")
    // Line 2: Play icon ▶ + Status (e.g. "▶ ANTES DEL MANTENIMIENTO")
    // Line 3: Pin icon 📍 + Location (e.g. "📍 CITRA DATACENTER PRINCIPAL › RACK 05")
    // Line 4: Globe icon 🌐 + GPS coordinates in decimal (e.g. "🌐 6.270866, -75.573166")
    // Line 5: Calendar icon 📅 + Date/Time (e.g. "📅 27/05/2026 10:09:34")
    lines.push(config.companyName.toUpperCase());
    
    if (data.status) {
      lines.push(`▶ ${data.status.toUpperCase()}`);
    }
    if (data.location) {
      const locLines = data.location.split('\n');
      locLines.forEach((line, index) => {
        if (index === 0) {
          lines.push(`📍 ${line}`);
        } else {
          lines.push(`   ${line}`);
        }
      });
    }
    if (showGPS) {
      const coordsText = (decLat !== null && decLng !== null) 
        ? `${decLat.toFixed(6)}, ${decLng.toFixed(6)}` 
        : `${data.lat}, ${data.lng}`;
      lines.push(`🌐 ${coordsText}`);
    }
    if (showDateTime) {
      lines.push(`📅 ${data.date}`);
    }
  }

  // Draw lines if any
  if (lines.length > 0) {
    const isRightAligned = config.textPosition === 'top-right' || config.textPosition === 'bottom-right';
    const isBottomAligned = config.textPosition === 'bottom-left' || config.textPosition === 'bottom-right';

    if (config.watermarkStyle === 'plain') {
      // Style A (Plain Text with Shadow)
      const baseFontSize = Math.max(14, Math.floor(imageMinDim * 0.02 * sizeScalar));
      ctx.font = `500 ${baseFontSize}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'top';
      ctx.textAlign = isRightAligned ? 'right' : 'left';

      // Text shadow options (simulated for high quality on Canvas)
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = Math.max(4, baseFontSize * 0.2);
      ctx.shadowOffsetX = Math.max(2, baseFontSize * 0.08);
      ctx.shadowOffsetY = Math.max(2, baseFontSize * 0.08);

      const lineHeight = baseFontSize * 1.35;
      const totalHeight = lines.length * lineHeight;

      const startX = isRightAligned ? canvas.width - padding : padding;
      const startY = isBottomAligned ? canvas.height - totalHeight - padding : padding;

      lines.forEach((line, i) => {
        ctx.fillText(line, startX, startY + i * lineHeight);
      });

      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    } else {
      // Style B (Dark Card Layout)
      const baseFontSize = Math.max(12, Math.floor(imageMinDim * 0.016 * sizeScalar));
      const titleFontSize = Math.max(14, Math.floor(imageMinDim * 0.02 * sizeScalar));
      const lineHeight = titleFontSize * 1.5;
      const cardPadding = imageMinDim * 0.02;
      const borderAccentWidth = Math.max(3, Math.floor(imageMinDim * 0.005));

      // Calculate width and height of the card
      ctx.font = `600 ${titleFontSize}px system-ui, -apple-system, sans-serif`;
      const titleWidth = ctx.measureText(lines[0]).width;

      ctx.font = `400 ${baseFontSize}px system-ui, -apple-system, sans-serif`;
      let maxDetailWidth = 0;
      for (let i = 1; i < lines.length; i++) {
        const w = ctx.measureText(lines[i]).width;
        if (w > maxDetailWidth) {
          maxDetailWidth = w;
        }
      }

      const cardWidth = Math.max(titleWidth, maxDetailWidth) + cardPadding * 2 + borderAccentWidth + 10;
      const cardHeight = lines.length * lineHeight + cardPadding * 2;

      const cardX = isRightAligned ? canvas.width - cardWidth - padding : padding;
      const cardY = isBottomAligned ? canvas.height - cardHeight - padding : padding;

      // Draw Card Background
      ctx.fillStyle = 'rgba(18, 18, 18, 0.85)';
      ctx.fillRect(cardX, cardY, cardWidth, cardHeight);

      // Draw Left Accent Border (Orange/Yellow)
      ctx.fillStyle = '#f59e0b'; // Tailwind Amber-500
      ctx.fillRect(cardX, cardY, borderAccentWidth, cardHeight);

      // Draw Texts inside the card
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';

      const textStartX = cardX + borderAccentWidth + cardPadding;
      const textStartY = cardY + cardPadding;

      lines.forEach((line, i) => {
        const isTitle = i === 0;
        ctx.font = isTitle 
          ? `bold ${titleFontSize}px system-ui, -apple-system, sans-serif` 
          : `500 ${baseFontSize}px system-ui, -apple-system, sans-serif`;
        
        ctx.fillStyle = isTitle ? '#ffffff' : '#e4e4e7'; // Title white, text zinc-200
        ctx.fillText(line, textStartX, textStartY + i * lineHeight);
      });
    }
  }

  // 7. Output Blob
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to convert canvas to blob'));
    }, 'image/jpeg', 0.92); // 92% quality jpeg output
  });
}
