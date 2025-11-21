'use client';

import { useEffect, useState, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  Canvas, 
  FabricImage, 
  Rect, 
  Textbox,
  Image
} from 'fabric';

interface ImageEditorProps {
  file: {
    name: string;
    path: string;
    type: 'file' | 'directory';
    isPasswordProtected?: boolean;
  } | null;
  onClose: () => void;
  onSave?: () => void;
}

export default function ImageEditor({ file, onClose, onSave }: ImageEditorProps) {
  const { t, language } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<Canvas | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);

  // Initialize Fabric.js canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    // Dispose existing canvas if it exists
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.dispose();
      fabricCanvasRef.current = null;
    }

    try {
      const canvas = new Canvas(canvasRef.current, {
        width: 800,
        height: 600,
        backgroundColor: '#ffffff',
      });

      fabricCanvasRef.current = canvas;

      // Track changes
      canvas.on('object:modified', () => {
        setHasChanges(true);
      });
      canvas.on('object:added', () => {
        setHasChanges(true);
      });
      canvas.on('object:removed', () => {
        setHasChanges(true);
      });
      canvas.on('path:created', () => {
        setHasChanges(true);
      });
      
      // Mark canvas as ready
      setCanvasReady(true);
    } catch (error: any) {
      setError(`Failed to initialize canvas: ${error.message}`);
      setCanvasReady(false);
    }

    return () => {
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
      setCanvasReady(false);
    };
  }, []);

  // Load image
  useEffect(() => {
    if (!file) {
      setLoading(false);
      return;
    }

    if (!canvasReady || !fabricCanvasRef.current) {
      // Wait for canvas to be ready
      return;
    }

    async function loadImage() {
      if (!file) {
        setError('No file provided');
        setLoading(false);
        return;
      }
      
      if (!fabricCanvasRef.current) {
        setError('Canvas not available');
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        setError('');
        
        const previewUrl = `/api/files/preview?path=${encodeURIComponent(file.path)}`;
        const res = await fetch(previewUrl);
        
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Failed to load image: ${res.status} ${errorText}`);
        }
        
        const blob = await res.blob();
        
        // Check if blob is valid
        if (!blob || blob.size === 0) {
          throw new Error('Received empty image');
        }
        
        // Check content type
        const contentType = blob.type;
        if (!contentType.startsWith('image/')) {
          throw new Error(`Invalid image type: ${contentType}`);
        }
        
        const url = URL.createObjectURL(blob);
        setImageUrl(url);

        // Load image using Image.fromURL (Fabric.js v6 uses Image instead of FabricImage for fromURL)
        try {
          const img = await Image.fromURL(url, {
            crossOrigin: 'anonymous',
          });
          
          if (!fabricCanvasRef.current) {
            setError('Canvas was disposed during image load');
            setLoading(false);
            URL.revokeObjectURL(url);
            return;
          }
          
          if (!img) {
            setError('Failed to create image object');
            setLoading(false);
            URL.revokeObjectURL(url);
            return;
          }
          
          const canvas = fabricCanvasRef.current;
          
          // Get image dimensions
          const imgWidth = img.width || 800;
          const imgHeight = img.height || 600;
          const canvasWidth = canvas.width || 800;
          const canvasHeight = canvas.height || 600;
          
          // Scale image to fit canvas while maintaining aspect ratio
          const scale = Math.min(
            (canvasWidth - 40) / imgWidth,
            (canvasHeight - 40) / imgHeight
          );
          
          // Set canvas size to match image if image is smaller
          if (imgWidth * scale < canvasWidth && imgHeight * scale < canvasHeight) {
            canvas.setWidth(Math.max(imgWidth * scale + 40, 400));
            canvas.setHeight(Math.max(imgHeight * scale + 40, 300));
          }
          
          canvas.setBackgroundImage(
            img,
            () => {
              canvas.renderAll();
              setLoading(false);
            },
            {
              scaleX: scale,
              scaleY: scale,
              originX: 'center',
              originY: 'center',
            }
          );
        } catch (err: any) {
          setError(`Error loading image: ${err.message}`);
          setLoading(false);
          URL.revokeObjectURL(url);
        }
      } catch (err: any) {
        setError(err.message || 'Error loading image');
        setLoading(false);
        if (imageUrl) {
          URL.revokeObjectURL(imageUrl);
        }
      }
    }

    loadImage();

    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [file, canvasReady]);

  async function handleSave() {
    if (!fabricCanvasRef.current || !file || !hasChanges) return;

    try {
      setSaving(true);
      setError('');

      const canvas = fabricCanvasRef.current;
      const dataURL = canvas.toDataURL({
        format: 'png',
        quality: 1,
      });

      // Convert data URL to blob
      const response = await fetch(dataURL);
      const blob = await response.blob();

      // Upload the edited image
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
    } catch (err: any) {
      setError(err.message || 'Error saving image');
    } finally {
      setSaving(false);
    }
  }

  function handleCrop() {
    if (!fabricCanvasRef.current) return;
    const canvas = fabricCanvasRef.current;
    const activeObject = canvas.getActiveObject();
    
    if (activeObject && activeObject.type === 'rect') {
      const rect = activeObject as Rect;
      const left = rect.left! - rect.width! / 2;
      const top = rect.top! - rect.height! / 2;
      const width = rect.width!;
      const height = rect.height!;
      
      // Get background image
      const bgImage = canvas.backgroundImage as FabricImage;
      if (bgImage) {
        const cropped = bgImage.toDataURL({
          format: 'png',
          left: left,
          top: top,
          width: width,
          height: height,
        });
        
        // Use Image.fromURL with Promise-based API (Fabric.js v6)
        Image.fromURL(cropped).then((img) => {
          canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas));
          canvas.remove(activeObject);
          canvas.renderAll();
          setHasChanges(true);
        }).catch((err) => {
          console.error('Error loading cropped image:', err);
        });
      }
    } else {
      // Create crop rectangle
      const rect = new Rect({
        left: canvas.width! / 2,
        top: canvas.height! / 2,
        width: 200,
        height: 200,
        fill: 'transparent',
        stroke: '#3b82f6',
        strokeWidth: 2,
        strokeDashArray: [10, 10],
        originX: 'center',
        originY: 'center',
      });
      
      canvas.add(rect);
      canvas.setActiveObject(rect);
      canvas.renderAll();
    }
  }

  function handleRotate(degrees: number) {
    if (!fabricCanvasRef.current) return;
    const canvas = fabricCanvasRef.current;
    const bgImage = canvas.backgroundImage as FabricImage;
    
    if (bgImage) {
      bgImage.rotate((bgImage.angle || 0) + degrees);
      canvas.renderAll();
      setHasChanges(true);
    }
  }

  function handleFlip(axis: 'horizontal' | 'vertical') {
    if (!fabricCanvasRef.current) return;
    const canvas = fabricCanvasRef.current;
    const bgImage = canvas.backgroundImage as FabricImage;
    
    if (bgImage) {
      if (axis === 'horizontal') {
        bgImage.set('flipX', !bgImage.flipX);
      } else {
        bgImage.set('flipY', !bgImage.flipY);
      }
      canvas.renderAll();
      setHasChanges(true);
    }
  }

  function handleAddText() {
    if (!fabricCanvasRef.current) return;
    const canvas = fabricCanvasRef.current;
    
    const text = new Textbox(language === 'de' ? 'Text eingeben' : 'Enter text', {
      left: canvas.width! / 2,
      top: canvas.height! / 2,
      width: 200,
      fontSize: 20,
      fontFamily: 'Arial',
      fill: '#000000',
      originX: 'center',
      originY: 'center',
    });
    
    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
    setHasChanges(true);
  }

  function handleDraw() {
    if (!fabricCanvasRef.current) return;
    const canvas = fabricCanvasRef.current;
    canvas.isDrawingMode = !canvas.isDrawingMode;
    
    if (canvas.isDrawingMode) {
      canvas.freeDrawingBrush.width = 5;
      canvas.freeDrawingBrush.color = '#000000';
    }
  }

  function handleFilter(filterName: string) {
    if (!fabricCanvasRef.current) return;
    const canvas = fabricCanvasRef.current;
    const bgImage = canvas.backgroundImage as FabricImage;
    
    if (!bgImage) return;
    
    // Remove existing filters
    bgImage.filters = [];
    
    // In Fabric.js v6, filters need to be imported from 'fabric/filter-*' modules
    // For now, we'll disable filters until we can properly import them
    // TODO: Implement proper filter imports for Fabric.js v6
    
    bgImage.applyFilters();
    canvas.renderAll();
    setHasChanges(true);
  }

  function handleBrightness(value: number) {
    if (!fabricCanvasRef.current) return;
    const canvas = fabricCanvasRef.current;
    const bgImage = canvas.backgroundImage as FabricImage;
    
    if (!bgImage) return;
    
    // In Fabric.js v6, brightness adjustment needs to be done differently
    // For now, we'll use a simple approach with canvas manipulation
    // TODO: Implement proper brightness filter for Fabric.js v6
    
    bgImage.applyFilters();
    canvas.renderAll();
    setHasChanges(true);
  }

  function handleContrast(value: number) {
    if (!fabricCanvasRef.current) return;
    const canvas = fabricCanvasRef.current;
    const bgImage = canvas.backgroundImage as FabricImage;
    
    if (!bgImage) return;
    
    // In Fabric.js v6, contrast adjustment needs to be done differently
    // For now, we'll use a simple approach with canvas manipulation
    // TODO: Implement proper contrast filter for Fabric.js v6
    
    bgImage.applyFilters();
    canvas.renderAll();
    setHasChanges(true);
  }

  if (!file) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-gray-500 dark:text-gray-400">
            {language === 'de' ? 'Kein Bild zum Bearbeiten ausgewählt' : 'No image selected for editing'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate flex items-center gap-2">
            {file.name}
            {hasChanges && (
              <span className="text-xs text-orange-600 dark:text-orange-400">
                {language === 'de' ? '(Geändert)' : '(Modified)'}
              </span>
            )}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {language === 'de' ? 'Speichern...' : 'Saving...'}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {language === 'de' ? 'Speichern' : 'Save'}
                </>
              )}
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title={t('close')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-wrap overflow-x-auto">
        <button
          onClick={handleCrop}
          className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-2"
          title={language === 'de' ? 'Zuschneiden' : 'Crop'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
          {language === 'de' ? 'Zuschneiden' : 'Crop'}
        </button>
        
        <button
          onClick={() => handleRotate(90)}
          className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-2"
          title={language === 'de' ? 'Drehen' : 'Rotate'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {language === 'de' ? 'Drehen' : 'Rotate'}
        </button>
        
        <button
          onClick={() => handleFlip('horizontal')}
          className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-2"
          title={language === 'de' ? 'Horizontal spiegeln' : 'Flip Horizontal'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
          {language === 'de' ? 'Spiegeln H' : 'Flip H'}
        </button>
        
        <button
          onClick={() => handleFlip('vertical')}
          className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-2"
          title={language === 'de' ? 'Vertikal spiegeln' : 'Flip Vertical'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
          {language === 'de' ? 'Spiegeln V' : 'Flip V'}
        </button>
        
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600"></div>
        
        <button
          onClick={handleAddText}
          className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-2"
          title={language === 'de' ? 'Text hinzufügen' : 'Add Text'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
          {language === 'de' ? 'Text' : 'Text'}
        </button>
        
        <button
          onClick={handleDraw}
          className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-2"
          title={language === 'de' ? 'Zeichnen' : 'Draw'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          {language === 'de' ? 'Zeichnen' : 'Draw'}
        </button>
        
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600"></div>
        
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-700 dark:text-gray-300">
            {language === 'de' ? 'Helligkeit' : 'Brightness'}:
          </label>
          <input
            type="range"
            min="-100"
            max="100"
            defaultValue="0"
            onChange={(e) => handleBrightness(Number(e.target.value))}
            className="w-24"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-700 dark:text-gray-300">
            {language === 'de' ? 'Kontrast' : 'Contrast'}:
          </label>
          <input
            type="range"
            min="-100"
            max="100"
            defaultValue="0"
            onChange={(e) => handleContrast(Number(e.target.value))}
            className="w-24"
          />
        </div>
        
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600"></div>
        
        <select
          onChange={(e) => handleFilter(e.target.value)}
          className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
        >
          <option value="remove">{language === 'de' ? 'Kein Filter' : 'No Filter'}</option>
          <option value="grayscale">{language === 'de' ? 'Graustufen' : 'Grayscale'}</option>
          <option value="sepia">{language === 'de' ? 'Sepia' : 'Sepia'}</option>
          <option value="vintage">{language === 'de' ? 'Vintage' : 'Vintage'}</option>
        </select>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900 p-4 flex items-center justify-center">
        {loading ? (
          <div className="flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">{t('loading')}</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center">
            <div className="text-center">
              <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
              {imageUrl && (
                <img 
                  src={imageUrl} 
                  alt={file.name}
                  className="max-w-full max-h-96 border border-gray-300 dark:border-gray-600 shadow-lg"
                  onLoad={() => {
                    // If image loads successfully, try to load it into canvas
                    if (fabricCanvasRef.current && imageUrl) {
                      // Use Image.fromURL with Promise-based API (Fabric.js v6)
                      Image.fromURL(imageUrl).then((img) => {
                        if (img && fabricCanvasRef.current) {
                          const canvas = fabricCanvasRef.current;
                          const imgWidth = img.width || 800;
                          const imgHeight = img.height || 600;
                          const scale = Math.min(
                            (canvas.width! - 40) / imgWidth,
                            (canvas.height! - 40) / imgHeight
                          );
                          canvas.setBackgroundImage(img, () => {
                            canvas.renderAll();
                            setLoading(false);
                          }, {
                            scaleX: scale,
                            scaleY: scale,
                            originX: 'center',
                            originY: 'center',
                          });
                        }
                      }).catch((err) => {
                        console.error('Error loading image:', err);
                        setLoading(false);
                      });
                    }
                  }}
                />
              )}
            </div>
          </div>
        ) : (
          <canvas ref={canvasRef} className="border border-gray-300 dark:border-gray-600 shadow-lg bg-white" />
        )}
      </div>
    </div>
  );
}

