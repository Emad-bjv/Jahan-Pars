import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

/* ─── SVG Icons ──────────────────────────────────────────────── */
const ScannerIcons = {
  camera: (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  ),
  upload: (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  crop: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M6.13 1L6 16a2 2 0 0 0 2 2h15"/>
      <path d="M1 6.13L16 6a2 2 0 0 1 2 2v15"/>
    </svg>
  ),
  filter: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
    </svg>
  ),
  check: (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  close: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  redo: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <polyline points="23 4 23 10 17 10"/>
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  ),
  rotate: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v5h5" />
      <rect x="10" y="10" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="12.5" cy="12.5" r="0.6" fill="currentColor" />
    </svg>
  ),
  zoomIn: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      <line x1="11" y1="8" x2="11" y2="14"/>
      <line x1="8" y1="11" x2="14" y2="11"/>
    </svg>
  ),
  scan: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
      <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
      <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
      <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
      <line x1="4" y1="12" x2="20" y2="12"/>
    </svg>
  ),
  trash: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg>
  ),
};

/* ─── Filter Processing Functions ──────────────────────────── */
function applyGrayscale(imageData) {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const avg = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    data[i] = data[i + 1] = data[i + 2] = avg;
  }
  return imageData;
}

function applyThreshold(imageData, threshold = 128) {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const avg = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    const val = avg > threshold ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = val;
  }
  return imageData;
}

function applyEnhanced(imageData) {
  const data = imageData.data;
  const contrast = 1.5;
  const brightness = 10;
  for (let i = 0; i < data.length; i += 4) {
    let avg = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    avg = contrast * (avg - 128) + 128 + brightness;
    avg = Math.max(0, Math.min(255, avg));
    data[i] = data[i + 1] = data[i + 2] = avg;
  }
  return imageData;
}

function applySharpen(ctx, canvas) {
  const w = canvas.width, h = canvas.height;
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const copy = new Uint8ClampedArray(data);
  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * w + (x + kx)) * 4 + c;
            sum += copy[idx] * kernel[(ky + 1) * 3 + (kx + 1)];
          }
        }
        data[(y * w + x) * 4 + c] = Math.max(0, Math.min(255, sum));
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

/* ─── Auto-Detect Document Bounds (Background-Adaptive) ──────── */
function autoDetectDocumentBounds(imageElement) {
  const canvas = document.createElement('canvas');
  const maxDim = 400;
  const scale = Math.min(1, maxDim / Math.max(imageElement.naturalWidth, imageElement.naturalHeight));
  const w = Math.floor(imageElement.naturalWidth * scale);
  const h = Math.floor(imageElement.naturalHeight * scale);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(imageElement, 0, 0, w, h);

  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  // 1) Convert to grayscale
  const gray = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] = Math.round(data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114);
  }

  // 2) Sample background brightness from image border strip
  const borderPixels = [];
  const borderW = Math.max(4, Math.floor(Math.min(w, h) * 0.04));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x < borderW || x >= w - borderW || y < borderW || y >= h - borderW) {
        borderPixels.push(gray[y * w + x]);
      }
    }
  }
  borderPixels.sort((a, b) => a - b);
  const bgBrightness = borderPixels[Math.floor(borderPixels.length / 2)]; // median

  // 3) Sample center brightness to decide if document is lighter or darker
  const centerPixels = [];
  const cx1 = Math.floor(w * 0.3), cx2 = Math.floor(w * 0.7);
  const cy1 = Math.floor(h * 0.3), cy2 = Math.floor(h * 0.7);
  for (let y = cy1; y < cy2; y++) {
    for (let x = cx1; x < cx2; x++) {
      centerPixels.push(gray[y * w + x]);
    }
  }
  centerPixels.sort((a, b) => a - b);
  const centerBrightness = centerPixels[Math.floor(centerPixels.length / 2)];

  const docIsLighter = centerBrightness >= bgBrightness;
  const brightnessDiff = Math.abs(centerBrightness - bgBrightness);

  // If not enough contrast between border and center, fall back to near-full frame
  if (brightnessDiff < 15) {
    return { x: 2, y: 2, w: 96, h: 96 };
  }

  // 4) Create binary mask — pixels that belong to the document
  const cutoff = bgBrightness + (docIsLighter ? 1 : -1) * brightnessDiff * 0.35;
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    mask[i] = docIsLighter ? (gray[i] > cutoff ? 1 : 0) : (gray[i] < cutoff ? 1 : 0);
  }

  // 5) Row / column projection — count document pixels per row and column
  const rowCounts = new Float32Array(h);
  const colCounts = new Float32Array(w);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x]) {
        rowCounts[y]++;
        colCounts[x]++;
      }
    }
  }

  // Scan from edges inward: a row/col is "document" when ≥15 % of its length is filled
  const rowTh = w * 0.15;
  const colTh = h * 0.15;

  let top = 0, bottom = h - 1, left = 0, right = w - 1;
  for (let y = 0; y < h; y++)          { if (rowCounts[y] > rowTh) { top    = y; break; } }
  for (let y = h - 1; y >= 0; y--)     { if (rowCounts[y] > rowTh) { bottom = y; break; } }
  for (let x = 0; x < w; x++)          { if (colCounts[x] > colTh) { left   = x; break; } }
  for (let x = w - 1; x >= 0; x--)     { if (colCounts[x] > colTh) { right  = x; break; } }

  // Small padding so the crop doesn't clip the very edge of the paper
  const padX = Math.max(2, (right - left) * 0.01);
  const padY = Math.max(2, (bottom - top) * 0.01);
  left   = Math.max(0,     left   - padX);
  right  = Math.min(w - 1, right  + padX);
  top    = Math.max(0,     top    - padY);
  bottom = Math.min(h - 1, bottom + padY);

  let px = (left / w) * 100;
  let py = (top / h) * 100;
  let pw = ((right - left) / w) * 100;
  let ph = ((bottom - top) / h) * 100;

  // Sanity check — if detected area is unreasonably small, fall back
  if (pw < 20 || ph < 20) {
    return { x: 2, y: 2, w: 96, h: 96 };
  }

  return { x: px, y: py, w: pw, h: ph };
}

/* ─── Steps ──────────────────────────────────────────────────── */
const STEPS = [
  { key: 'upload', label: 'انتخاب تصویر', icon: ScannerIcons.upload },
  { key: 'crop', label: 'برش تصویر', icon: ScannerIcons.crop },
  { key: 'filter', label: 'فیلتر', icon: ScannerIcons.filter },
  { key: 'preview', label: 'پیش‌نمایش', icon: ScannerIcons.check },
];

/* ─── Main Component ─────────────────────────────────────────── */
const DocumentScanner = ({ isOpen, onClose, onSave, title = 'اسکن سند' }) => {
  const [step, setStep] = useState(0);
  const [imageSrc, setImageSrc] = useState(null);
  const [imgNaturalSize, setImgNaturalSize] = useState({ w: 0, h: 0 });
  const [cropRect, setCropRect] = useState({ x: 10, y: 10, w: 80, h: 80 }); // percentage
  const [activeFilter, setActiveFilter] = useState('original'); // 'original' | 'enhanced'
  const [processedSrc, setProcessedSrc] = useState(null);
  const [closing, setClosing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState(null); // 'move' | 'nw' | 'ne' | 'sw' | 'se'
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, rect: null });

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const cropCanvasRef = useRef(null);
  const cropContainerRef = useRef(null);
  const processCanvasRef = useRef(null);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setStep(0);
      setImageSrc(null);
      setProcessedSrc(null);
      setCropRect({ x: 10, y: 10, w: 80, h: 80 });
      setActiveFilter('original');
      setClosing(false);
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 300);
  }, [onClose]);

  /* ── Image Load ── */
  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        setImgNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
        setImageSrc(ev.target.result);
        
        // Auto-detect crop bounds
        const autoBounds = autoDetectDocumentBounds(img);
        setCropRect(autoBounds);
        
        setStep(1);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  /* ── Crop Handlers ── */
  const getContainerBounds = () => {
    if (!cropContainerRef.current) return { left: 0, top: 0, width: 1, height: 1 };
    return cropContainerRef.current.getBoundingClientRect();
  };

  const handleCropPointerDown = (e, type) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDragType(type);
    const bounds = getContainerBounds();
    setDragStart({
      x: (e.clientX ?? e.touches?.[0]?.clientX) - bounds.left,
      y: (e.clientY ?? e.touches?.[0]?.clientY) - bounds.top,
      rect: { ...cropRect },
    });
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e) => {
      const bounds = getContainerBounds();
      const clientX = e.clientX ?? e.touches?.[0]?.clientX;
      const clientY = e.clientY ?? e.touches?.[0]?.clientY;
      const cx = clientX - bounds.left;
      const cy = clientY - bounds.top;
      const dx = ((cx - dragStart.x) / bounds.width) * 100;
      const dy = ((cy - dragStart.y) / bounds.height) * 100;
      const r = dragStart.rect;

      let newRect = { ...cropRect };

      if (dragType === 'move') {
        let nx = r.x + dx;
        let ny = r.y + dy;
        nx = Math.max(0, Math.min(100 - r.w, nx));
        ny = Math.max(0, Math.min(100 - r.h, ny));
        newRect = { ...r, x: nx, y: ny };
      } else if (dragType === 'se') {
        let nw = Math.max(15, Math.min(100 - r.x, r.w + dx));
        let nh = Math.max(15, Math.min(100 - r.y, r.h + dy));
        newRect = { ...r, w: nw, h: nh };
      } else if (dragType === 'sw') {
        let nx = r.x + dx;
        let nw = r.w - dx;
        if (nx < 0) { nw += nx; nx = 0; }
        if (nw < 15) { nx = r.x + r.w - 15; nw = 15; }
        let nh = Math.max(15, Math.min(100 - r.y, r.h + dy));
        newRect = { x: nx, y: r.y, w: nw, h: nh };
      } else if (dragType === 'ne') {
        let nw = Math.max(15, Math.min(100 - r.x, r.w + dx));
        let ny = r.y + dy;
        let nh = r.h - dy;
        if (ny < 0) { nh += ny; ny = 0; }
        if (nh < 15) { ny = r.y + r.h - 15; nh = 15; }
        newRect = { x: r.x, y: ny, w: nw, h: nh };
      } else if (dragType === 'nw') {
        let nx = r.x + dx;
        let nw = r.w - dx;
        let ny = r.y + dy;
        let nh = r.h - dy;
        if (nx < 0) { nw += nx; nx = 0; }
        if (nw < 15) { nx = r.x + r.w - 15; nw = 15; }
        if (ny < 0) { nh += ny; ny = 0; }
        if (nh < 15) { ny = r.y + r.h - 15; nh = 15; }
        newRect = { x: nx, y: ny, w: nw, h: nh };
      }

      setCropRect(newRect);
    };

    const handleUp = () => {
      setIsDragging(false);
      setDragType(null);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleUp);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [isDragging, dragType, dragStart, cropRect]);

  /* ── Rotate Image ── */
  const handleRotate = (direction) => {
    if (!imageSrc) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalHeight;
      canvas.height = img.naturalWidth;
      const ctx = canvas.getContext('2d');
      
      if (direction === 'right') {
        ctx.translate(canvas.width, 0);
        ctx.rotate(90 * Math.PI / 180);
      } else {
        ctx.translate(0, canvas.height);
        ctx.rotate(-90 * Math.PI / 180);
      }
      
      ctx.drawImage(img, 0, 0);
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      setImgNaturalSize({ w: canvas.width, h: canvas.height });
      setImageSrc(dataUrl);
      
      // Auto-detect crop bounds on rotated image
      const rotatedImg = new Image();
      rotatedImg.onload = () => {
        const autoBounds = autoDetectDocumentBounds(rotatedImg);
        setCropRect(autoBounds);
      };
      rotatedImg.src = dataUrl;
    };
    img.src = imageSrc;
  };

  /* ── Process Image ── */
  const processImage = useCallback((filterType) => {
    if (!imageSrc) return;

    const img = new Image();
    img.onload = () => {
      const sx = (cropRect.x / 100) * img.naturalWidth;
      const sy = (cropRect.y / 100) * img.naturalHeight;
      const sw = (cropRect.w / 100) * img.naturalWidth;
      const sh = (cropRect.h / 100) * img.naturalHeight;

      const canvas = processCanvasRef.current || document.createElement('canvas');
      // Use high quality output
      const scale = Math.min(2, 2400 / Math.max(sw, sh));
      canvas.width = sw * scale;
      canvas.height = sh * scale;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

      if (filterType === 'bw') {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        applyGrayscale(imageData);
        ctx.putImageData(imageData, 0, 0);
        applySharpen(ctx, canvas);
      } else if (filterType === 'threshold') {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        applyThreshold(imageData, 135);
        ctx.putImageData(imageData, 0, 0);
      } else if (filterType === 'enhanced') {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        applyEnhanced(imageData);
        ctx.putImageData(imageData, 0, 0);
        applySharpen(ctx, canvas);
      }
      // 'original' → no filter

      setProcessedSrc(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.src = imageSrc;
  }, [imageSrc, cropRect]);

  const handleApplyCrop = () => {
    setStep(2);
  };

  const handleSelectFilter = (filterType) => {
    setActiveFilter(filterType);
    processImage(filterType);
  };

  const handleConfirmFilter = () => {
    setStep(3);
  };

  useEffect(() => {
    if (step === 2 && imageSrc) {
      processImage(activeFilter);
    }
  }, [step]);

  const handleSave = () => {
    if (processedSrc && onSave) {
      onSave(processedSrc);
    }
    handleClose();
  };

  const handleRetake = () => {
    setStep(0);
    setImageSrc(null);
    setProcessedSrc(null);
    setCropRect({ x: 5, y: 5, w: 90, h: 90 });
  };

  if (!isOpen) return null;

  return createPortal(
    <div className={`scanner-overlay ${closing ? 'scanner-overlay-closing' : ''}`} onClick={handleClose}>
      <div className={`scanner-modal ${closing ? 'scanner-modal-closing' : ''}`} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="scanner-header">
          <div className="scanner-header-title">
            {ScannerIcons.scan}
            <span>{title}</span>
          </div>
          <button className="scanner-close-btn" onClick={handleClose}>
            {ScannerIcons.close}
          </button>
        </div>

        {/* Stepper */}
        <div className="scanner-stepper">
          {STEPS.map((s, i) => (
            <div key={s.key} className={`scanner-step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}>
              <div className="scanner-step-icon">
                {i < step ? ScannerIcons.check : s.icon}
              </div>
              <span className="scanner-step-label">{s.label}</span>
              {i < STEPS.length - 1 && <div className="scanner-step-line" />}
            </div>
          ))}
        </div>

        {/* Content Area */}
        <div className="scanner-content">

          {/* Step 0: Upload */}
          {step === 0 && (
            <div className="scanner-upload-area" key="upload">
              <div className="scanner-upload-inner">
                <div className="scanner-upload-icon-wrap">
                  <div className="scanner-upload-icon-pulse" />
                  {ScannerIcons.scan}
                </div>
                <p className="scanner-upload-title">تصویر سند را انتخاب کنید</p>
                <p className="scanner-upload-subtitle">فرمت‌های JPEG، PNG و WebP پشتیبانی می‌شوند</p>
                <div className="scanner-upload-buttons">
                  <button className="scanner-btn scanner-btn-primary" onClick={() => cameraInputRef.current?.click()}>
                    {ScannerIcons.camera}
                    <span>گرفتن عکس</span>
                  </button>
                  <button className="scanner-btn scanner-btn-secondary" onClick={() => fileInputRef.current?.click()}>
                    {ScannerIcons.upload}
                    <span>انتخاب از فایل</span>
                  </button>
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} hidden />
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleImageSelect} hidden />
            </div>
          )}

          {/* Step 1: Crop */}
          {step === 1 && imageSrc && (
            <div className="scanner-crop-area" key="crop">
              <div className="scanner-crop-container" ref={cropContainerRef}>
                <img src={imageSrc} alt="scan" className="scanner-crop-image" draggable={false} />
                {/* Darkened overlay outside crop */}
                <div className="scanner-crop-overlay-top" style={{ height: `${cropRect.y}%` }} />
                <div className="scanner-crop-overlay-bottom" style={{ height: `${100 - cropRect.y - cropRect.h}%` }} />
                <div className="scanner-crop-overlay-left" style={{ top: `${cropRect.y}%`, height: `${cropRect.h}%`, width: `${cropRect.x}%` }} />
                <div className="scanner-crop-overlay-right" style={{ top: `${cropRect.y}%`, height: `${cropRect.h}%`, width: `${100 - cropRect.x - cropRect.w}%` }} />

                {/* Crop selection */}
                <div
                  className="scanner-crop-selection"
                  style={{
                    left: `${cropRect.x}%`,
                    top: `${cropRect.y}%`,
                    width: `${cropRect.w}%`,
                    height: `${cropRect.h}%`,
                  }}
                  onMouseDown={(e) => handleCropPointerDown(e, 'move')}
                  onTouchStart={(e) => handleCropPointerDown(e, 'move')}
                >
                  {/* Grid lines */}
                  <div className="scanner-crop-grid" />

                  {/* Corner handles */}
                  <div className="scanner-crop-handle nw" onMouseDown={(e) => handleCropPointerDown(e, 'nw')} onTouchStart={(e) => handleCropPointerDown(e, 'nw')} />
                  <div className="scanner-crop-handle ne" onMouseDown={(e) => handleCropPointerDown(e, 'ne')} onTouchStart={(e) => handleCropPointerDown(e, 'ne')} />
                  <div className="scanner-crop-handle sw" onMouseDown={(e) => handleCropPointerDown(e, 'sw')} onTouchStart={(e) => handleCropPointerDown(e, 'sw')} />
                  <div className="scanner-crop-handle se" onMouseDown={(e) => handleCropPointerDown(e, 'se')} onTouchStart={(e) => handleCropPointerDown(e, 'se')} />
                </div>

                {/* Floating Rotate Button (Glassmorphic, Centered Bottom) */}
                <button 
                  type="button" 
                  className="scanner-rotate-btn" 
                  onClick={(e) => { e.stopPropagation(); handleRotate('left'); }} 
                  title="چرخش تصویر"
                >
                  {ScannerIcons.rotate}
                </button>
              </div>

              <div className="scanner-crop-actions">
                <button className="scanner-btn scanner-btn-ghost" onClick={handleRetake}>
                  {ScannerIcons.redo}
                  <span>تصویر دیگر</span>
                </button>
                <button className="scanner-btn scanner-btn-primary" onClick={handleApplyCrop}>
                  {ScannerIcons.check}
                  <span>تأیید برش</span>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Filter */}
          {step === 2 && (
            <div className="scanner-filter-area" key="filter">
              <div className="scanner-filter-preview">
                {processedSrc && <img src={processedSrc} alt="preview" className="scanner-filter-image" />}
              </div>
              <p className="scanner-filter-title">فیلتر مورد نظر را انتخاب کنید</p>
              <div className="scanner-filter-options">
                {[
                  { key: 'original', label: 'اصلی (رنگی)', desc: 'بدون تغییر' },
                  { key: 'enhanced', label: 'بهبود یافته', desc: 'کنتراست بالا' },
                ].map(f => (
                  <button
                    key={f.key}
                    className={`scanner-filter-btn ${activeFilter === f.key ? 'active' : ''}`}
                    onClick={() => handleSelectFilter(f.key)}
                  >
                    <span className="scanner-filter-btn-label">{f.label}</span>
                    <span className="scanner-filter-btn-desc">{f.desc}</span>
                  </button>
                ))}
              </div>
              <div className="scanner-crop-actions">
                <button className="scanner-btn scanner-btn-ghost" onClick={() => setStep(1)}>
                  {ScannerIcons.crop}
                  <span>تغییر برش</span>
                </button>
                <button className="scanner-btn scanner-btn-primary" onClick={handleConfirmFilter}>
                  {ScannerIcons.check}
                  <span>تأیید فیلتر</span>
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 3 && (
            <div className="scanner-preview-area" key="preview">
              <div className="scanner-preview-image-wrap">
                {processedSrc && (
                  <img src={processedSrc} alt="final" className="scanner-preview-image" />
                )}
                <div className="scanner-preview-badge">
                  {ScannerIcons.check}
                  <span>آماده ذخیره</span>
                </div>
              </div>
              <div className="scanner-preview-actions">
                <button className="scanner-btn scanner-btn-ghost" onClick={handleRetake}>
                  {ScannerIcons.redo}
                  <span>اسکن مجدد</span>
                </button>
                <button className="scanner-btn scanner-btn-ghost" onClick={() => setStep(2)}>
                  {ScannerIcons.filter}
                  <span>تغییر فیلتر</span>
                </button>
                <button className="scanner-btn scanner-btn-success" onClick={handleSave}>
                  {ScannerIcons.check}
                  <span>ذخیره تصویر</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <canvas ref={processCanvasRef} style={{ display: 'none' }} />
      </div>
    </div>,
    document.body
  );
};

/* ─── Scan Button + Thumbnail Preview (for use in forms) ───── */
export const ScanButton = ({ label, onScan, scannedImage, onRemove }) => (
  <div className="scan-button-wrap">
    <button type="button" className="scanner-btn scanner-btn-scan" onClick={onScan}>
      {ScannerIcons.scan}
      <span>{label}</span>
    </button>
    {scannedImage && (
      <div className="scan-thumb-wrap">
        <img src={scannedImage} alt="scanned" className="scan-thumb-img" />
        <button type="button" className="scan-thumb-remove" onClick={onRemove} title="حذف تصویر">
          {ScannerIcons.trash}
        </button>
      </div>
    )}
  </div>
);

export default DocumentScanner;
