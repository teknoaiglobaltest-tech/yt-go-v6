import React, { useRef, useEffect, useState, useCallback } from 'react';

interface AspectRatio {
    label: string;
    ratio: number | null;
}

interface ImageCropperProps {
    src: string;
    onCrop: (croppedImageUrl: string) => void;
    onClose: () => void;
    aspectRatios?: AspectRatio[];
    defaultAspectRatio?: number | null;
}

type Rect = { startX: number; startY: number; w: number; h: number; };
type Point = { x: number; y: number };
type Handle = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | null;

const ImageCropper: React.FC<ImageCropperProps> = ({ src, onCrop, onClose, aspectRatios, defaultAspectRatio }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const originalImageRef = useRef<HTMLImageElement | null>(null);
    const rectRef = useRef<Rect>({ startX: 0, startY: 0, w: 0, h: 0 });
    const [activeAspectRatio, setActiveAspectRatio] = useState<number | null>(defaultAspectRatio ?? null);
    
    // Interaction state refs
    const dragRef = useRef(false);
    const isMovingRef = useRef(false);
    const isResizingRef = useRef(false);
    const isPinchingRef = useRef(false);
    const activeHandleRef = useRef<Handle>(null);
    const moveStartPosRef = useRef<Point>({ x: 0, y: 0 });
    const initialPinchDistRef = useRef(0);
    const handleSize = 10;

    const normalizeRect = (r: Rect): Rect => {
        if (!r || typeof r.w === 'undefined') return { startX: 0, startY: 0, w: 0, h: 0 };
        return {
            startX: r.w < 0 ? r.startX + r.w : r.startX,
            startY: r.h < 0 ? r.startY + r.h : r.startY,
            w: Math.abs(r.w),
            h: Math.abs(r.h)
        };
    };
    
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        const img = originalImageRef.current;
        if (!canvas || !ctx || !img) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const normRect = normalizeRect(rectRef.current);
        if (normRect.w > 0 && normRect.h > 0) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.lineWidth = 2;

            ctx.beginPath();
            ctx.rect(0, 0, canvas.width, canvas.height);
            ctx.rect(normRect.startX, normRect.startY, normRect.w, normRect.h);
            ctx.fill('evenodd');

            ctx.setLineDash([6, 6]);
            ctx.strokeRect(normRect.startX, normRect.startY, normRect.w, normRect.h);
            ctx.setLineDash([]);
            
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            const handles = {
                topLeft: { x: normRect.startX, y: normRect.startY },
                topRight: { x: normRect.startX + normRect.w, y: normRect.startY },
                bottomLeft: { x: normRect.startX, y: normRect.startY + normRect.h },
                bottomRight: { x: normRect.startX + normRect.w, y: normRect.startY + normRect.h },
            };
            Object.values(handles).forEach(handle => {
                ctx.fillRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
            });
        }
    }, [handleSize]);

    const setAspectRatio = useCallback((ratio: number | null) => {
        setActiveAspectRatio(ratio);
        const canvas = canvasRef.current;
        if (!canvas || !originalImageRef.current) return;
        
        if (ratio === null) { // Free aspect ratio
            draw();
            return;
        }

        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const canvasRatio = canvasWidth / canvasHeight;
        let newWidth, newHeight;

        if (ratio > canvasRatio) {
            newWidth = canvasWidth * 0.9;
            newHeight = newWidth / ratio;
        } else {
            newHeight = canvasHeight * 0.9;
            newWidth = newHeight * ratio;
        }

        rectRef.current = {
            startX: (canvasWidth - newWidth) / 2,
            startY: (canvasHeight - newHeight) / 2,
            w: newWidth,
            h: newHeight
        };
        draw();
    }, [draw]);
    
    useEffect(() => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            originalImageRef.current = img;
            const canvas = canvasRef.current;
            if (!canvas) return;

            const MAX_WIDTH = window.innerWidth * 0.8;
            const MAX_HEIGHT = window.innerHeight * 0.7;
            let width = img.naturalWidth;
            let height = img.naturalHeight;

            if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
            if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
            
            canvas.width = width;
            canvas.height = height;
            
            setAspectRatio(defaultAspectRatio ?? 9/16);
        };
        img.src = src;
    }, [src, setAspectRatio, defaultAspectRatio]);

    const handleCrop = () => {
        const canvas = canvasRef.current;
        const img = originalImageRef.current;
        const normRect = normalizeRect(rectRef.current);

        if (!canvas || !img || normRect.w <= 1 || normRect.h <= 1) return;

        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        const scaleX = img.naturalWidth / canvas.width;
        const scaleY = img.naturalHeight / canvas.height;
        
        tempCanvas.width = normRect.w * scaleX;
        tempCanvas.height = normRect.h * scaleY;
        
        tempCtx?.drawImage(img, normRect.startX * scaleX, normRect.startY * scaleY, normRect.w * scaleX, normRect.h * scaleY, 0, 0, tempCanvas.width, tempCanvas.height);
        
        onCrop(tempCanvas.toDataURL('image/png'));
    };

    const getPos = (canvas: HTMLCanvasElement, e: MouseEvent | Touch) => {
        const rect = canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const getHandleAt = (pos: Point): Handle => {
             const normRect = normalizeRect(rectRef.current);
             const handles = {
                topLeft: { x: normRect.startX, y: normRect.startY }, topRight: { x: normRect.startX + normRect.w, y: normRect.startY },
                bottomLeft: { x: normRect.startX, y: normRect.startY + normRect.h }, bottomRight: { x: normRect.startX + normRect.w, y: normRect.startY + normRect.h },
            };
            for (const name in handles) {
                const handle = handles[name as keyof typeof handles];
                if (Math.abs(pos.x - handle.x) <= handleSize && Math.abs(pos.y - handle.y) <= handleSize) return name as Handle;
            }
            return null;
        };

        const isPointInRect = (point: Point, r: Rect) => (point.x >= r.startX && point.x <= r.startX + r.w && point.y >= r.startY && point.y <= r.startY + r.h);

        const clampRectToCanvas = () => {
            const normRect = normalizeRect(rectRef.current);
            let { startX, startY } = rectRef.current;
            if (startX < 0) startX = 0;
            if (startY < 0) startY = 0;
            if (startX + normRect.w > canvas.width) startX = canvas.width - normRect.w;
            if (startY + normRect.h > canvas.height) startY = canvas.height - normRect.h;
            rectRef.current.startX = startX;
            rectRef.current.startY = startY;
        };
        
        const handleMouseDown = (e: MouseEvent) => {
            const pos = getPos(canvas, e);
            const handle = getHandleAt(pos);
            activeHandleRef.current = handle;

            if (handle) { isResizingRef.current = true; } 
            else if (isPointInRect(pos, normalizeRect(rectRef.current))) {
                isMovingRef.current = true;
                moveStartPosRef.current = { x: pos.x - rectRef.current.startX, y: pos.y - rectRef.current.startY };
            } else {
                dragRef.current = true;
                rectRef.current = { startX: pos.x, startY: pos.y, w: 0, h: 0 };
                setActiveAspectRatio(null);
            }
        };

        const handleMouseUp = () => { dragRef.current = false; isMovingRef.current = false; isResizingRef.current = false; activeHandleRef.current = null; };

        const handleMouseMove = (e: MouseEvent) => {
            const pos = getPos(canvas, e);
            
            if (dragRef.current) {
                rectRef.current.w = pos.x - rectRef.current.startX;
                rectRef.current.h = activeAspectRatio ? (rectRef.current.w / activeAspectRatio) : (pos.y - rectRef.current.startY);
            } else if (isMovingRef.current) {
                rectRef.current.startX = pos.x - moveStartPosRef.current.x;
                rectRef.current.startY = pos.y - moveStartPosRef.current.y;
                clampRectToCanvas();
            } else if (isResizingRef.current) {
                const oldNormRect = normalizeRect(rectRef.current);
                const anchor = { x: 0, y: 0 };
                switch (activeHandleRef.current) {
                    case 'topLeft': anchor.x = oldNormRect.startX + oldNormRect.w; anchor.y = oldNormRect.startY + oldNormRect.h; break;
                    case 'topRight': anchor.x = oldNormRect.startX; anchor.y = oldNormRect.startY + oldNormRect.h; break;
                    case 'bottomLeft': anchor.x = oldNormRect.startX + oldNormRect.w; anchor.y = oldNormRect.startY; break;
                    case 'bottomRight': anchor.x = oldNormRect.startX; anchor.y = oldNormRect.startY; break;
                }
                let newW = pos.x - anchor.x;
                let newH = pos.y - anchor.y;
                if (activeAspectRatio) { newH = newW / activeAspectRatio * (Math.sign(newH) || 1); }
                rectRef.current = { startX: anchor.x, startY: anchor.y, w: newW, h: newH };
            } else {
                const handle = getHandleAt(pos);
                if (handle) { canvas.style.cursor = (handle === 'topLeft' || handle === 'bottomRight') ? 'nwse-resize' : 'nesw-resize'; } 
                else if (isPointInRect(pos, normalizeRect(rectRef.current))) { canvas.style.cursor = 'move'; } 
                else { canvas.style.cursor = 'crosshair'; }
            }
            draw();
        };

        const getPinchDistance = (e: TouchEvent) => Math.sqrt(Math.pow(e.touches[0].clientX - e.touches[1].clientX, 2) + Math.pow(e.touches[0].clientY - e.touches[1].clientY, 2));

        const handleTouchStart = (e: TouchEvent) => {
            e.preventDefault();
            if (e.touches.length === 2) { isPinchingRef.current = true; initialPinchDistRef.current = getPinchDistance(e); } 
            else if (e.touches.length === 1) { handleMouseDown(e.touches[0] as unknown as MouseEvent); }
        };

        const handleTouchEnd = (e: TouchEvent) => {
            e.preventDefault();
            isPinchingRef.current = false;
            initialPinchDistRef.current = 0;
            if (e.touches.length === 0) handleMouseUp();
        };

        const handleTouchMove = (e: TouchEvent) => {
            e.preventDefault();
            if (isPinchingRef.current && e.touches.length === 2) {
                const currentPinchDist = getPinchDistance(e);
                if (initialPinchDistRef.current <= 0) return;
                const scale = currentPinchDist / initialPinchDistRef.current;
                const oldNormRect = normalizeRect(rectRef.current);
                const centerX = oldNormRect.startX + oldNormRect.w / 2;
                const centerY = oldNormRect.startY + oldNormRect.h / 2;
                let newW = oldNormRect.w * scale;
                let newH = oldNormRect.h * scale;
                if (activeAspectRatio) newH = newW / activeAspectRatio;
                rectRef.current = { startX: centerX - newW / 2, startY: centerY - newH / 2, w: newW, h: newH };
                initialPinchDistRef.current = currentPinchDist;
                draw();
            } else if (!isPinchingRef.current && e.touches.length === 1) {
                handleMouseMove(e.touches[0] as unknown as MouseEvent);
            }
        };

        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseout', handleMouseUp);
        canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
        canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
        canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
        return () => {
            canvas.removeEventListener('mousedown', handleMouseDown);
            canvas.removeEventListener('mouseup', handleMouseUp);
            canvas.removeEventListener('mousemove', handleMouseMove);
            canvas.removeEventListener('mouseout', handleMouseUp);
            canvas.removeEventListener('touchstart', handleTouchStart);
            canvas.removeEventListener('touchend', handleTouchEnd);
            canvas.removeEventListener('touchmove', handleTouchMove);
        };
    }, [draw, activeAspectRatio, handleSize]);

    const defaultArButtons = [
        { label: 'Bebas', ratio: null },
        { label: '9:16', ratio: 9 / 16 },
        { label: '16:9', ratio: 16 / 9 },
        { label: '4:3', ratio: 4 / 3 },
        { label: '3:4', ratio: 3 / 4 },
    ];
    
    const arButtons = aspectRatios || defaultArButtons;

    return (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="w-full max-w-4xl mx-auto bg-gray-800 text-white rounded-xl shadow-lg p-6 md:p-8 flex flex-col gap-6" onClick={(e) => e.stopPropagation()}>
                <div className="relative text-center border border-gray-600 rounded-lg overflow-hidden shadow-md bg-gray-900 flex justify-center items-center">
                    <canvas ref={canvasRef} style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: '0.5rem', cursor: 'crosshair', touchAction: 'none' }} />
                </div>
                <div className="flex flex-col items-center justify-center gap-4">
                    <div className="flex flex-wrap justify-center items-center gap-2">
                        <span className="text-gray-400 text-sm font-medium mr-2">Rasio Aspek:</span>
                        {arButtons.map(({ label, ratio }) => (
                            <button key={label} onClick={() => setAspectRatio(ratio)} className={`px-3 py-1 text-sm rounded-md transition-colors font-medium ${activeAspectRatio === ratio ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                                {label}
                            </button>
                        ))}
                    </div>
                     <div className="flex flex-wrap justify-center gap-4 mt-4">
                        <button onClick={onClose} className="bg-gray-600 text-gray-200 font-semibold py-2 px-6 rounded-lg hover:bg-gray-500 transition-all shadow-sm">
                           Batal
                        </button>
                        <button onClick={handleCrop} className="bg-indigo-600 text-white font-semibold py-2 px-6 rounded-lg hover:bg-indigo-700 transition-all shadow-sm">
                            Potong & Simpan
                        </button>
                     </div>
                 </div>
            </div>
        </div>
    );
};

export default ImageCropper;