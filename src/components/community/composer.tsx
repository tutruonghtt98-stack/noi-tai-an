"use client";
/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from "react";
import { ImagePlus, X, LoaderCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { useToast } from "@/components/ui/toast";
import { createPost } from "@/actions/community";
import { compressImage, uploadImage } from "./image-upload";
import { cn } from "@/lib/cn";

const CATS = ["READING", "WORKOUT", "STUDY", "FOCUS", "GOAL", "OTHER"] as const;
type Cat = (typeof CATS)[number];

export function Composer({
  groupId,
  challengeId,
  kind = "POST",
  placeholder,
  defaultCategory = "OTHER",
  onPosted,
  compact,
}: {
  groupId?: string;
  challengeId?: string;
  kind?: "POST" | "CHECKIN" | "SUMMARY";
  placeholder?: string;
  defaultCategory?: Cat;
  onPosted?: () => void;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const { exec, pending } = useAction();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [category, setCategory] = useState<Cat>(defaultCategory);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageKey, setImageKey] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "compress" | "upload">(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 25 * 1024 * 1024) return toast("error", t.community.imageTooLarge);
    try {
      setBusy("compress");
      const blob = await compressImage(file);
      setPreview(URL.createObjectURL(blob));
      setBusy("upload");
      const res = await uploadImage(blob);
      if (!res.ok) {
        setPreview(null);
        toast("error", res.error === "RATE_LIMIT" ? t.community.rateLimit : t.community.imageTooLarge);
      } else setImageKey(res.key);
    } catch {
      setPreview(null);
      toast("error", t.common.error);
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const clearImage = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setImageKey(null);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    exec(() => createPost({ content: text, category, imageKey, groupId: groupId ?? null, challengeId: challengeId ?? null, kind }), {
      success: t.community.posted,
      onSuccess: () => {
        setText("");
        clearImage();
        onPosted?.();
      },
    });
  };

  return (
    <form onSubmit={submit} className={cn(!compact && "card")}>
      <label htmlFor={`composer-${groupId ?? challengeId ?? "feed"}`} className="sr-only">
        {placeholder ?? t.community.composerPh}
      </label>
      <textarea
        id={`composer-${groupId ?? challengeId ?? "feed"}`}
        className="input min-h-24 resize-none"
        maxLength={2000}
        placeholder={placeholder ?? t.community.composerPh}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {preview && (
        <div className="relative mt-3 w-fit">
          <img src={preview} alt="" className="max-h-56 rounded-2xl object-cover" />
          {busy && (
            <span className="absolute inset-0 grid place-items-center rounded-2xl bg-ink/40 text-sm font-medium text-bg">
              <span className="flex items-center gap-2">
                <LoaderCircle className="size-4 animate-spin" aria-hidden /> {busy === "compress" ? t.community.compressing : t.community.uploading}
              </span>
            </span>
          )}
          {!busy && (
            <button type="button" onClick={clearImage} className="icon-btn absolute right-2 top-2 size-9 bg-ink/70 text-bg hover:bg-ink" aria-label={t.community.removePhoto}>
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {kind === "POST" && !challengeId && (
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Category">
            {CATS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={category === c}
                onClick={() => setCategory(c)}
                className={cn("min-h-9 cursor-pointer rounded-full px-3 text-sm font-medium transition-colors", category === c ? "bg-ink text-bg" : "bg-surface-2 text-ink-2 hover:bg-surface-3")}
              >
                {t.community.categories[c]}
              </button>
            ))}
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <input ref={fileRef} type="file" accept="image/*" className="sr-only" id={`file-${groupId ?? challengeId ?? "feed"}`} onChange={(e) => pick(e.target.files?.[0])} />
          <label htmlFor={`file-${groupId ?? challengeId ?? "feed"}`} className={cn("icon-btn cursor-pointer", (busy || preview) && "pointer-events-none opacity-50")} title={t.community.addPhoto}>
            <ImagePlus className="size-5" aria-hidden />
            <span className="sr-only">{t.community.addPhoto}</span>
          </label>
          <button className="btn btn-primary" disabled={pending || !!busy || !text.trim()}>
            {t.community.post}
          </button>
        </div>
      </div>
    </form>
  );
}
