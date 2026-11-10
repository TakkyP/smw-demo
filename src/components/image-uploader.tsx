"use client";
import { useRef, useState } from "react";
import { MAX_IMAGES_PER_SUBMISSION } from "@/lib/constants";
import { api } from "@/lib/api-client";
import { compressImage } from "@/lib/image-compress";
import { IconCamera, IconX } from "./icons";
import { Spinner } from "./ui";

/** Multi-image picker: compresses in the browser, uploads each image, returns server URLs via onChange. */
export function ImageUploader({
  value,
  onChange,
  onBusyChange,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState("");

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    const room = MAX_IMAGES_PER_SUBMISSION - value.length;
    const picked = Array.from(files).slice(0, room);
    if (files.length > room) setError(`แนบรูปได้สูงสุด ${MAX_IMAGES_PER_SUBMISSION} รูป`);
    setUploading(picked.length);
    onBusyChange?.(true);

    let urls = [...value];
    for (const file of picked) {
      try {
        const form = new FormData();
        form.append("file", await compressImage(file));
        const { url } = await api<{ url: string }>("/api/uploads", { method: "POST", body: form });
        urls = [...urls, url];
        onChange(urls);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setUploading((n) => n - 1);
      }
    }
    onBusyChange?.(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {value.map((url) => (
          <div key={url} className="relative aspect-square overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(value.filter((u) => u !== url))}
              className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
              aria-label="ลบรูป"
            >
              <IconX width={14} height={14} />
            </button>
          </div>
        ))}
        {Array.from({ length: uploading }).map((_, i) => (
          <div key={`u${i}`} className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-brand-200 bg-brand-50 text-brand-600">
            <Spinner />
          </div>
        ))}
        {value.length + uploading < MAX_IMAGES_PER_SUBMISSION && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-brand-200 text-brand-600 hover:bg-brand-50"
          >
            <IconCamera />
            <span className="text-xs font-medium">เพิ่มรูป</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
      <p className="mt-2 text-xs text-neutral-500">
        {value.length}/{MAX_IMAGES_PER_SUBMISSION} รูป · ถ่ายจากกล้องหรือเลือกจากคลังภาพได้
      </p>
      {error && <p className="mt-1 text-xs text-brand-700">{error}</p>}
    </div>
  );
}
