"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, LoaderCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useToast } from "@/components/ui/toast";
import { setAvatar } from "@/actions/profile";
import { Avatar } from "@/components/ui/avatar";
import { compressAvatar, uploadImage } from "./image-upload";

export function AvatarUploader({ name, image, size = 88, showRemove = false }: { name: string; image: string | null; size?: number; showRemove?: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const pick = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 25 * 1024 * 1024) return toast("error", t.community.imageTooLarge);
    setBusy(true);
    try {
      const blob = await compressAvatar(file);
      setPreview(URL.createObjectURL(blob));
      const up = await uploadImage(blob, "avatars");
      if (!up.ok) throw new Error(up.error);
      const res = await setAvatar(up.key);
      if (!res.ok) throw new Error(res.error);
      toast("success", t.avatar.saved);
      router.refresh();
    } catch {
      setPreview(null);
      toast("error", t.community.imageTooLarge);
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0">
        <Avatar name={name} image={preview ?? image} size={size} />
        <input ref={ref} id="avatar-file" type="file" accept="image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
        <label
          htmlFor="avatar-file"
          className="absolute -bottom-1 -right-1 grid size-9 cursor-pointer place-items-center rounded-full bg-ink text-bg shadow-pop ring-2 ring-surface transition-transform hover:scale-105"
          title={t.avatar.change}
        >
          {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Camera className="size-4" aria-hidden />}
          <span className="sr-only">{t.avatar.change}</span>
        </label>
      </div>
      {showRemove && (
        <div className="grid gap-1.5">
          <label htmlFor="avatar-file" className="btn btn-soft btn-sm w-fit cursor-pointer">
            {busy ? t.avatar.uploading : t.avatar.change}
          </label>
          {image && (
            <button
              type="button"
              className="btn btn-ghost btn-sm w-fit"
              disabled={busy}
              onClick={async () => {
                const r = await setAvatar(null);
                if (r.ok) {
                  setPreview(null);
                  router.refresh();
                }
              }}
            >
              {t.avatar.remove}
            </button>
          )}
          <p className="text-xs text-muted">{t.avatar.hint}</p>
        </div>
      )}
    </div>
  );
}
