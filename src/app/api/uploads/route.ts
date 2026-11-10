import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { MAX_UPLOAD_BYTES } from "@/lib/constants";
import { requireUser } from "@/server/auth";
import { imageBucket } from "@/server/db";
import { HttpError, handler, ok } from "@/server/http";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/** Upload one image (multipart field "file"). The client compresses to JPEG and sends files one by one. */
export const POST = handler(async (req) => {
  const user = await requireUser();
  const form = await req.formData().catch(() => {
    throw new HttpError(400, "ไม่พบไฟล์");
  });
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "ไม่พบไฟล์");
  if (!ALLOWED.has(file.type)) throw new HttpError(400, "รองรับเฉพาะไฟล์รูปภาพ JPG, PNG, WEBP, GIF");
  if (file.size > MAX_UPLOAD_BYTES) throw new HttpError(413, "ไฟล์ใหญ่เกินไป");

  const bucket = await imageBucket();
  const upload = bucket.openUploadStream(file.name || "image", {
    metadata: { uploaded_by: user._id, content_type: file.type },
  });
  await pipeline(Readable.from(Buffer.from(await file.arrayBuffer())), upload);
  return ok({ url: `/api/images/${upload.id}` }, { status: 201 });
});
