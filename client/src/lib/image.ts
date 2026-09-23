export async function compressImage(file: File, { maxBytes = 500_000, maxDimension = 1600 }: { maxBytes?: number; maxDimension?: number } = {}) {
  if (!file.type.startsWith("image/")) return await fileToDataUrl(file);

  const source = await fileToDataUrl(file);
  const image = await loadImage(source);

  const maxSide = Math.max(image.width, image.height);
  const scale = maxSide > maxDimension ? maxDimension / maxSide : 1;
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return source;
  context.drawImage(image, 0, 0, width, height);

  let quality = 0.82;
  let output = canvas.toDataURL(file.type || "image/jpeg", quality);
  let attempts = 0;
  while (output.length > maxBytes * 1.2 && attempts < 8) {
    quality = Math.max(0.25, quality - 0.1);
    output = canvas.toDataURL(file.type || "image/jpeg", quality);
    attempts += 1;
  }

  if (output.length > maxBytes * 1.1 && maxSide > 900) {
    const smallerScale = 900 / maxSide;
    const nextCanvas = document.createElement("canvas");
    nextCanvas.width = Math.max(1, Math.round(image.width * smallerScale));
    nextCanvas.height = Math.max(1, Math.round(image.height * smallerScale));
    const nextContext = nextCanvas.getContext("2d");
    if (nextContext) {
      nextContext.drawImage(image, 0, 0, nextCanvas.width, nextCanvas.height);
      output = nextCanvas.toDataURL(file.type || "image/jpeg", 0.7);
    }
  }

  return output.length > maxBytes ? source : output;
}

export function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("تعذر قراءة الملف"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("تعذر تحميل الصورة"));
    image.src = src;
  });
}
