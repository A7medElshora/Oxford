import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Check, X } from "lucide-react";
import { fileToDataUrl } from "@/lib/image";

type Props = {
  file: File;
  onCancel: () => void;
  onComplete: (dataUrl: string) => void;
};

export default function ImageCropDialog({ file, onCancel, onComplete }: Props) {
  const [source, setSource] = useState("");
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ pointerId: number; x: number; y: number; startX: number; startY: number } | null>(null);

  const getLayout = () => {
    const frameSize = frameRef.current?.clientWidth || 360;
    const image = imageRef.current;
    if (!image?.naturalWidth || !image.naturalHeight) return null;
    const coverScale = Math.max(frameSize / image.naturalWidth, frameSize / image.naturalHeight);
    const scale = coverScale * zoom;
    return { frameSize, scale, width: image.naturalWidth * scale, height: image.naturalHeight * scale };
  };

  const clampPosition = (next: { x: number; y: number }) => {
    const layout = getLayout();
    if (!layout) return next;
    return {
      x: Math.min(0, Math.max(layout.frameSize - layout.width, next.x)),
      y: Math.min(0, Math.max(layout.frameSize - layout.height, next.y)),
    };
  };

  const centerImage = () => {
    const layout = getLayout();
    if (!layout) return;
    setPosition({ x: (layout.frameSize - layout.width) / 2, y: (layout.frameSize - layout.height) / 2 });
  };

  useEffect(() => {
    let active = true;
    setPosition({ x: 0, y: 0 });
    void fileToDataUrl(file).then(value => { if (active) setSource(value); });
    return () => { active = false; };
  }, [file]);

  useEffect(() => {
    if (!source) return;
    const image = imageRef.current;
    if (image?.complete) centerImage();
  }, [source]);

  const handlePointerDown = (event: PointerEvent<HTMLImageElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, startX: position.x, startY: position.y };
  };

  const handlePointerMove = (event: PointerEvent<HTMLImageElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setPosition(clampPosition({ x: drag.startX + event.clientX - drag.x, y: drag.startY + event.clientY - drag.y }));
  };

  const stopDragging = () => { dragRef.current = null; };

  const handleZoom = (value: number) => {
    setZoom(value);
    requestAnimationFrame(() => setPosition(current => clampPosition(current)));
  };

  const confirm = async () => {
    const image = imageRef.current;
    if (!image) return;
    setBusy(true);
    try {
      const size = 900;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("تعذر تجهيز الصورة");
      const layout = getLayout();
      if (!layout) throw new Error("تعذر حساب مساحة القص");
      const sourceScale = layout.scale;
      const sourceX = Math.max(0, -position.x / sourceScale);
      const sourceY = Math.max(0, -position.y / sourceScale);
      const sourceWidth = Math.min(image.naturalWidth - sourceX, layout.frameSize / sourceScale);
      const sourceHeight = Math.min(image.naturalHeight - sourceY, layout.frameSize / sourceScale);
      context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, size, size);
      onComplete(canvas.toDataURL("image/jpeg", 0.84));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="image-crop-overlay" role="dialog" aria-modal="true" aria-label="اقتصاص الصورة">
      <div className="image-crop-dialog">
        <div className="image-crop-header"><strong>اقتصاص الصورة</strong><button type="button" onClick={onCancel} aria-label="إلغاء"><X size={18} /></button></div>
        <div ref={frameRef} className="image-crop-frame">
          {source && <img ref={imageRef} src={source} alt="معاينة الاقتصاص" onLoad={centerImage} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={stopDragging} onPointerCancel={stopDragging} style={{ width: getLayout()?.width, height: getLayout()?.height, left: position.x, top: position.y }} />}
        </div>
        <label className="image-crop-zoom">تكبير الصورة<input type="range" min="1" max="3" step="0.05" value={zoom} onChange={event => handleZoom(Number(event.target.value))} /></label>
        <div className="image-crop-actions"><button className="secondary-btn" type="button" onClick={onCancel}>إلغاء</button><button className="primary-btn" type="button" disabled={busy || !source} onClick={() => void confirm()}><Check size={16} /> {busy ? "جارٍ التجهيز..." : "استخدام الصورة"}</button></div>
      </div>
    </div>
  );
}
