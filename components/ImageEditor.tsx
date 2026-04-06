'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import ReactCrop, { Crop, PixelCrop, makeAspectCrop, centerCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { useLanguage } from '@/contexts/LanguageContext';
import { useShareToken, appendShareToUrl } from '@/contexts/ShareTokenContext';

interface ImageEditorProps {
  file: {
    name: string;
    path: string;
    type: 'file' | 'directory';
    isPasswordProtected?: boolean;
  } | null;
  verifiedPassword?: string;
  onClose: () => void;
  onSave?: () => void;
}

// No separate Area interface needed, using Crop from react-image-crop

export default function ImageEditor({ file, verifiedPassword, onClose, onSave }: ImageEditorProps) {
  const { t, language } = useLanguage();
  const shareToken = useShareToken();
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [originalImageSrc, setOriginalImageSrc] = useState<string | null>(null); // Keep original image
  const [hasChanges, setHasChanges] = useState(false);
  
  // Transformations
  const [rotation, setRotation] = useState(0);
  const [flipHorizontal, setFlipHorizontal] = useState(false);
  const [flipVertical, setFlipVertical] = useState(false);
  
  // Cropping
  const [cropMode, setCropMode] = useState(false);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [lastAppliedCrop, setLastAppliedCrop] = useState<PixelCrop | null>(null); // Store crop info even after applying
  const [cropAspectRatio, setCropAspectRatio] = useState<number | undefined>(undefined); // undefined = free, number = aspect ratio
  const [useCustomResolution, setUseCustomResolution] = useState(false);
  const [customWidth, setCustomWidth] = useState<number>(1920);
  const [customHeight, setCustomHeight] = useState<number>(1080);
  
  // Drawing
  const [drawingMode, setDrawingMode] = useState(false);
  const [brushSize, setBrushSize] = useState(5);
  const [brushColor, setBrushColor] = useState('#000000');
  const [isDrawing, setIsDrawing] = useState(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  // Load image
  useEffect(() => {
    if (!file) {
      setLoading(false);
      return;
    }

    async function loadImage() {
      if (!file) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');
        
        const previewUrl = appendShareToUrl(
          `/api/files/preview?path=${encodeURIComponent(file.path)}${verifiedPassword ? `&password=${encodeURIComponent(verifiedPassword)}` : ''}`,
          shareToken
        );
        const response = await fetch(previewUrl);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        setImageSrc(blobUrl);
        setOriginalImageSrc(blobUrl); // Store original image
        setLoading(false);
      } catch (err: any) {
        setError(`${t('errorLoadingImage')}: ${err.message}`);
        setLoading(false);
      }
    }

    loadImage();

    return () => {
      if (imageSrc && imageSrc.startsWith('blob:')) {
        URL.revokeObjectURL(imageSrc);
      }
    };
  }, [file?.path, verifiedPassword, shareToken]);

  // Get cropped image
  const getCroppedImg = async (
    imageSrc: string, 
    pixelCrop: PixelCrop,
    useCustom: boolean = false,
    customW: number = 0,
    customH: number = 0
  ): Promise<string> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('No 2d context');
    }

    // PixelCrop coordinates are already in pixels relative to the natural image size
    // But we need to ensure they match the actual image dimensions
    const displayImg = imgRef.current;
    if (!displayImg || !displayImg.complete) {
      throw new Error('Display image not ready');
    }

    // Get the actual image dimensions
    const imageWidth = image.width;
    const imageHeight = image.height;
    const naturalWidth = displayImg.naturalWidth;
    const naturalHeight = displayImg.naturalHeight;

    console.log('[ImageEditor] Crop calculation', {
      pixelCrop,
      imageWidth,
      imageHeight,
      naturalWidth,
      naturalHeight,
      displayWidth: displayImg.width,
      displayHeight: displayImg.height
    });

    // PixelCrop coordinates are already in pixels relative to naturalWidth/naturalHeight
    // If image dimensions match natural dimensions, use crop directly
    // Otherwise, scale if needed
    let cropX = pixelCrop.x;
    let cropY = pixelCrop.y;
    let cropWidth = pixelCrop.width;
    let cropHeight = pixelCrop.height;

    // Only scale if image dimensions differ from natural dimensions
    if (imageWidth !== naturalWidth || imageHeight !== naturalHeight) {
      const scaleX = imageWidth / naturalWidth;
      const scaleY = imageHeight / naturalHeight;
      
      cropX = Math.round(pixelCrop.x * scaleX);
      cropY = Math.round(pixelCrop.y * scaleY);
      cropWidth = Math.round(pixelCrop.width * scaleX);
      cropHeight = Math.round(pixelCrop.height * scaleY);
    }

    // Ensure crop is within image bounds
    const finalCropX = Math.max(0, Math.min(cropX, imageWidth - 1));
    const finalCropY = Math.max(0, Math.min(cropY, imageHeight - 1));
    const finalCropWidth = Math.max(1, Math.min(cropWidth, imageWidth - finalCropX));
    const finalCropHeight = Math.max(1, Math.min(cropHeight, imageHeight - finalCropY));

    // If custom resolution is enabled, use custom dimensions
    let outputWidth = finalCropWidth;
    let outputHeight = finalCropHeight;

    if (useCustom && customW > 0 && customH > 0) {
      outputWidth = customW;
      outputHeight = customH;
    }

    // Set canvas size
    canvas.width = outputWidth;
    canvas.height = outputHeight;

    // Clear with white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw cropped image, scaled to output size
    ctx.drawImage(
      image,
      finalCropX,
      finalCropY,
      finalCropWidth,
      finalCropHeight,
      0,
      0,
      outputWidth,
      outputHeight
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'));
          return;
        }
        resolve(URL.createObjectURL(blob));
      }, 'image/png');
    });
  };

  const createImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.src = url;
    });
  };

  // Initialize crop when entering crop mode
  useEffect(() => {
    if (cropMode && imageSrc && imgRef.current && !crop) {
      const img = imgRef.current;
      if (img.complete && img.naturalWidth > 0) {
        const imageWidth = img.naturalWidth;
        const imageHeight = img.naturalHeight;
        
        // Create initial crop (centered, 80% of image)
        const initialCrop = centerCrop(
          makeAspectCrop(
            {
              unit: '%',
              width: 80,
              height: 80,
            },
            cropAspectRatio || imageWidth / imageHeight,
            imageWidth,
            imageHeight
          ),
          imageWidth,
          imageHeight
        );
        
        setCrop(initialCrop);
      }
    }
  }, [cropMode, imageSrc, cropAspectRatio]);

  // Apply crop
  async function handleApplyCrop() {
    if (!imageSrc || !completedCrop) {
      setError(t('selectAreaFirst'));
      return;
    }

    try {
      console.log('[ImageEditor] Applying crop', {
        completedCrop,
        imageSrc: imageSrc.substring(0, 50),
        hasImgRef: !!imgRef.current,
        imgNaturalWidth: imgRef.current?.naturalWidth,
        imgNaturalHeight: imgRef.current?.naturalHeight,
        imgWidth: imgRef.current?.width,
        imgHeight: imgRef.current?.height
      });

      // Pass custom resolution values explicitly
      const croppedImageUrl = await getCroppedImg(
        imageSrc, 
        completedCrop,
        useCustomResolution,
        customWidth,
        customHeight
      );
      
      // Revoke old URL (but keep original)
      if (imageSrc && imageSrc.startsWith('blob:') && imageSrc !== originalImageSrc) {
        URL.revokeObjectURL(imageSrc);
      }
      
      setImageSrc(croppedImageUrl);
      setLastAppliedCrop(completedCrop); // Save crop info for later use when saving
      setCropMode(false);
      setCrop(undefined);
      setCompletedCrop(undefined);
      setHasChanges(true);
    } catch (err: any) {
      console.error('[ImageEditor] Error applying crop:', err);
      setError(`${t('errorCroppingImage')}: ${err.message}`);
    }
  }

  // Rotate image
  function handleRotate(degrees: number) {
    setRotation((prev) => (prev + degrees) % 360);
    setHasChanges(true);
  }

  // Flip image
  function handleFlip(axis: 'horizontal' | 'vertical') {
    if (axis === 'horizontal') {
      setFlipHorizontal((prev) => !prev);
    } else {
      setFlipVertical((prev) => !prev);
    }
    setHasChanges(true);
  }

  // Draw on canvas
  function startDrawing(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawingMode || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setIsDrawing(true);
    lastPosRef.current = { x, y };
  }

  function draw(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawing || !drawingMode || !canvasRef.current || !lastPosRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(currentX, currentY);
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.stroke();
    
    lastPosRef.current = { x: currentX, y: currentY };
    setHasChanges(true);
  }

  function stopDrawing() {
    setIsDrawing(false);
    lastPosRef.current = null;
  }

  // Initialize canvas for drawing
  useEffect(() => {
    if (drawingMode && imageSrc && canvasRef.current && imgRef.current) {
      const canvas = canvasRef.current;
      const img = imgRef.current;
      
      // Wait for image to load
      if (!img.complete || img.naturalWidth === 0) {
        return;
      }
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Set canvas size to match image
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      
      // Draw image on canvas
      ctx.drawImage(img, 0, 0);
    }
  }, [drawingMode, imageSrc]);

  // Save image - use current imageSrc and apply rotation/flip, then drawing
  async function handleSave() {
    if (!file || !imageSrc) return;

    try {
      setSaving(true);
      setError('');

      // Use current imageSrc (already cropped if crop was applied)
      const currentImg = await createImage(imageSrc);
      
      // Create canvas and apply rotation/flip
      const radians = (rotation * Math.PI) / 180;
      const cos = Math.abs(Math.cos(radians));
      const sin = Math.abs(Math.sin(radians));
      const rotatedWidth = currentImg.width * cos + currentImg.height * sin;
      const rotatedHeight = currentImg.width * sin + currentImg.height * cos;

      let workingCanvas = document.createElement('canvas');
      let workingCtx = workingCanvas.getContext('2d');
      if (!workingCtx) throw new Error('Could not get canvas context');

      workingCanvas.width = rotatedWidth;
      workingCanvas.height = rotatedHeight;

      // Clear with white background
      workingCtx.fillStyle = '#FFFFFF';
      workingCtx.fillRect(0, 0, workingCanvas.width, workingCanvas.height);

      // Apply rotation and flip
      workingCtx.translate(workingCanvas.width / 2, workingCanvas.height / 2);
      workingCtx.rotate((rotation * Math.PI) / 180);
      workingCtx.scale(flipHorizontal ? -1 : 1, flipVertical ? -1 : 1);
      workingCtx.drawImage(currentImg, -currentImg.width / 2, -currentImg.height / 2);

      // Apply drawing if there is any
      if (drawingMode && canvasRef.current) {
        const drawCanvas = canvasRef.current;
        
        // The drawing canvas has the same size as currentImg
        // Apply the same transformation to the drawing
        const finalCanvas = document.createElement('canvas');
        const finalCtx = finalCanvas.getContext('2d');
        if (!finalCtx) throw new Error('Could not get canvas context');

        finalCanvas.width = workingCanvas.width;
        finalCanvas.height = workingCanvas.height;

        // Draw the transformed image
        finalCtx.fillStyle = '#FFFFFF';
        finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
        finalCtx.drawImage(workingCanvas, 0, 0);
        
        // Apply the same transformation to the drawing
        finalCtx.translate(finalCanvas.width / 2, finalCanvas.height / 2);
        finalCtx.rotate((rotation * Math.PI) / 180);
        finalCtx.scale(flipHorizontal ? -1 : 1, flipVertical ? -1 : 1);
        
        // Draw the drawing canvas
        finalCtx.globalCompositeOperation = 'source-over';
        finalCtx.drawImage(
          drawCanvas, 
          -currentImg.width / 2, 
          -currentImg.height / 2,
          currentImg.width,
          currentImg.height
        );

        workingCanvas = finalCanvas;
        workingCtx = finalCtx;
      }

      // Convert to blob and upload
      workingCanvas.toBlob(async (blob) => {
        if (!blob) {
          throw new Error('Failed to create image blob');
        }

        const formData = new FormData();
        formData.append('file', blob, file.name);
        formData.append('path', file.path.split('/').slice(0, -1).join('/'));

        const res = await fetch('/api/files/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Error saving image');
        }

        setHasChanges(false);
        if (onSave) {
          onSave();
        }
        onClose();
      }, 'image/png', 1.0);
    } catch (err: any) {
      console.error('[ImageEditor] Error saving image:', err);
      setError(`${t('errorSavingImage')}: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  if (!file) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full h-full max-w-7xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t('editImage')} - {file.name}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? t('saving') : t('save')}
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-wrap">
          <button
            onClick={() => handleRotate(-90)}
            className="px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600"
            title={t('rotateLeft')}
          >
            ↺
          </button>
          <button
            onClick={() => handleRotate(90)}
            className="px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600"
            title={t('rotateRight')}
          >
            ↻
          </button>
          <button
            onClick={() => handleFlip('horizontal')}
            className="px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600"
            title={t('flipHorizontal')}
          >
            ⇄
          </button>
          <button
            onClick={() => handleFlip('vertical')}
            className="px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600"
            title={t('flipVertical')}
          >
            ⇅
          </button>
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600"></div>
          <button
            onClick={() => {
              if (cropMode) {
                handleApplyCrop();
              } else {
                setCropMode(true);
                setDrawingMode(false);
              }
            }}
            className={`px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 ${
              cropMode
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title={t('crop')}
          >
            {cropMode ? t('apply') : '✂️'}
          </button>
          {cropMode && (
            <>
              <button
                onClick={() => {
                  setCropMode(false);
                  setCrop(undefined);
                  setCompletedCrop(undefined);
                  setCropAspectRatio(undefined);
                  setUseCustomResolution(false);
                }}
                className="px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600"
              >
                {t('cancel')}
              </button>
              <div className="w-px h-6 bg-gray-300 dark:bg-gray-600"></div>
              <span className="text-sm text-gray-600 dark:text-gray-400 px-2">
                {t('aspect')}
              </span>
              <button
                onClick={() => {
                  setCropAspectRatio(undefined);
                  setUseCustomResolution(false);
                }}
                className={`px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm ${
                  cropAspectRatio === undefined && !useCustomResolution
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                title={t('freeCropTooltip')}
              >
                {t('free')}
              </button>
              <button
                onClick={() => {
                  setCropAspectRatio(1);
                  setUseCustomResolution(false);
                }}
                className={`px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm ${
                  cropAspectRatio === 1
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                title="1:1"
              >
                1:1
              </button>
              <button
                onClick={() => {
                  setCropAspectRatio(16 / 9);
                  setUseCustomResolution(false);
                }}
                className={`px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm ${
                  cropAspectRatio === 16 / 9
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                title="16:9"
              >
                16:9
              </button>
              <button
                onClick={() => {
                  setCropAspectRatio(4 / 3);
                  setUseCustomResolution(false);
                }}
                className={`px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm ${
                  cropAspectRatio === 4 / 3
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                title="4:3"
              >
                4:3
              </button>
              <button
                onClick={() => {
                  setCropAspectRatio(3 / 2);
                  setUseCustomResolution(false);
                }}
                className={`px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm ${
                  cropAspectRatio === 3 / 2
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                title="3:2"
              >
                3:2
              </button>
              <button
                onClick={() => {
                  setCropAspectRatio(9 / 16);
                  setUseCustomResolution(false);
                }}
                className={`px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm ${
                  cropAspectRatio === 9 / 16
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                title="9:16 (Portrait)"
              >
                9:16
              </button>
              <button
                onClick={() => {
                  setUseCustomResolution(true);
                  // Bei Custom: freies Cropping (kein festes Aspect Ratio)
                  setCropAspectRatio(undefined);
                }}
                className={`px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm ${
                  useCustomResolution
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                title={t('customCropTooltip')}
              >
                {t('custom')}
              </button>
              {useCustomResolution && (
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 rounded">
                  {t('targetResolution')} {customWidth}×{customHeight} ({t('onSave')})
                </span>
              )}
            </>
          )}
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600"></div>
          <button
            onClick={() => {
              setDrawingMode(!drawingMode);
              setCropMode(false);
            }}
            className={`px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 ${
              drawingMode
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title={t('draw')}
          >
            ✏️
          </button>
          {drawingMode && (
            <>
              <input
                type="range"
                min="1"
                max="50"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-24"
              />
              <input
                type="color"
                value={brushColor}
                onChange={(e) => setBrushColor(e.target.value)}
                className="w-10 h-10 rounded border border-gray-300 dark:border-gray-600"
              />
            </>
          )}
        </div>

        {/* Image Display */}
        <div className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900 p-4 flex items-center justify-center relative">
          {loading && (
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">{t('loading')}</p>
            </div>
          )}

          {error && (
            <div className="text-center text-red-600 dark:text-red-400 p-4">
              {error}
            </div>
          )}

          {!loading && !error && imageSrc && (
            <>
              {cropMode ? (
                <div className="relative w-full h-full flex items-center justify-center p-4">
                  <ReactCrop
                    crop={crop}
                    onChange={(newCrop) => setCrop(newCrop)}
                    onComplete={(c) => setCompletedCrop(c)}
                    aspect={cropAspectRatio}
                    minWidth={10}
                    minHeight={10}
                  >
                    <img
                      ref={imgRef}
                      src={imageSrc}
                      alt={file.name}
                      className="max-w-full max-h-full"
                      style={{
                        maxHeight: '80vh',
                      }}
                      onLoad={(e) => {
                        const img = e.currentTarget;
                        if (!crop && img.complete && img.naturalWidth > 0) {
                          const imageWidth = img.naturalWidth;
                          const imageHeight = img.naturalHeight;
                          
                          const initialCrop = centerCrop(
                            makeAspectCrop(
                              {
                                unit: '%',
                                width: 80,
                                height: 80,
                              },
                              cropAspectRatio || imageWidth / imageHeight,
                              imageWidth,
                              imageHeight
                            ),
                            imageWidth,
                            imageHeight
                          );
                          
                          setCrop(initialCrop);
                        }
                      }}
                      crossOrigin="anonymous"
                    />
                  </ReactCrop>
                </div>
              ) : (
                <div className="relative">
                  <img
                    ref={imgRef}
                    src={imageSrc}
                    alt={file.name}
                    className="max-w-full max-h-full object-contain border border-gray-300 dark:border-gray-600 shadow-lg"
                    style={{
                      transform: `rotate(${rotation}deg) scaleX(${flipHorizontal ? -1 : 1}) scaleY(${flipVertical ? -1 : 1})`,
                    }}
                    crossOrigin="anonymous"
                  />
                  {drawingMode && (
                    <canvas
                      ref={canvasRef}
                      className="absolute top-0 left-0 border border-gray-300 dark:border-gray-600"
                      style={{
                        cursor: 'crosshair',
                        pointerEvents: 'auto',
                      }}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                    />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
