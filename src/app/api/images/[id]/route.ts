import { requireUser } from "@/server/auth";
import { imageBucket, toObjectId } from "@/server/db";
import { HttpError, handler } from "@/server/http";

type Ctx = { params: Promise<{ id: string }> };

/** Serve an image from GridFS. Requires login; images never change, so they are cached long-term. */
export const GET = handler<Ctx>(async (_req, { params }) => {
  await requireUser();
  const { id } = await params;
  const _id = toObjectId(id);
  if (!_id) throw new HttpError(404, "ไม่พบรูปภาพ");
  const bucket = await imageBucket();
  const [file] = await bucket.find({ _id }).limit(1).toArray();
  if (!file) throw new HttpError(404, "ไม่พบรูปภาพ");

  const chunks: Buffer[] = [];
  for await (const chunk of bucket.openDownloadStream(_id)) chunks.push(chunk as Buffer);
  return new Response(new Uint8Array(Buffer.concat(chunks)), {
    headers: {
      "Content-Type": (file.metadata?.content_type as string) || "application/octet-stream",
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
