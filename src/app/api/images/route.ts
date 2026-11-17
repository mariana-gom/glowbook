import { put } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { panelAccess } from "@/lib/access";
export async function POST(request: Request) {
  const access = await panelAccess(true);
  if (access.demo)
    return Response.json(
      { error: "Las cargas están deshabilitadas en el demo." },
      { status: 403 },
    );
  if (!process.env.BLOB_READ_WRITE_TOKEN)
    return Response.json(
      { error: "Configura Vercel Blob para cargar imágenes." },
      { status: 503 },
    );
  const form = await request.formData(),
    file = form.get("file");
  if (
    !(file instanceof File) ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 4 * 1024 * 1024
  )
    return Response.json(
      { error: "Elige una imagen JPG, PNG o WebP de hasta 4 MB." },
      { status: 400 },
    );
  const extension = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  }[file.type];
  const blob = await put(
    `${access.salonId}/${randomUUID()}.${extension}`,
    file,
    { access: "public", contentType: file.type, addRandomSuffix: false },
  );
  return Response.json({ url: blob.url });
}
