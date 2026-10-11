export async function compressImage(file: File, { maxBytes = 500_000, maxDimension = 1600 }: { maxBytes?: number; maxDimension?: number } = {}) {
  if (!file.type.startsWith("image/")) throw new Error("الملف المختار ليس صورة");
  if (!Number.isFinite(maxBytes) || maxBytes <= 0 || !Number.isFinite(maxDimension) || maxDimension <= 0) {
    throw new Error("إعدادات ضغط الصورة غير صحيحة");
  }

  const source = await fileToDataUrl(file);
  const image = await loadImage(source);
  const initialScale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  let width = Math.max(1, Math.round(image.width * initialScale));
  let height = Math.max(1, Math.round(image.height * initialScale));

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("تعذر تجهيز الصورة للضغط");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const quality = Math.max(0.3, 0.86 - Math.floor(attempt % 4) * 0.14);
    const output = canvas.toDataURL("image/jpeg", quality);
    if (output.length <= maxBytes) return output;

    if ((attempt + 1) % 4 === 0) {
      width = Math.max(1, Math.floor(width * 0.8));
      height = Math.max(1, Math.floor(height * 0.8));
    }
  }

  throw new Error("حجم الصورة كبير جدًا، اختر صورة أصغر");
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
