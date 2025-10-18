"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ImageMask } from "@/types";
import { Trash2, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ImageOcclusionEditorProps {
  imageSrc?: string;
  masks: ImageMask[];
  onChange: (payload: { imageSrc?: string; masks: ImageMask[] }) => void;
}

interface DraftMask {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function ImageOcclusionEditor({
  imageSrc,
  masks,
  onChange,
}: ImageOcclusionEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draftMask, setDraftMask] = useState<DraftMask | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const handleFileChange = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file.");
      return;
    }

    // Show loading toast for large images
    if (file.size > 1024 * 1024) {
      toast.info("Optimizing large image...");
    }

    try {
      const optimizedDataUrl = await optimizeImage(file);
      onChange({ imageSrc: optimizedDataUrl, masks: [] });
    } catch (error) {
      toast.error("Failed to process image. Please try a different file.");
    }
  };

  // Optimize image by resizing and compressing
  const optimizeImage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };

      img.onload = () => {
        // Maximum dimensions
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;

        let { width, height } = img;

        // Calculate new dimensions while maintaining aspect ratio
        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
          width = Math.floor(width * ratio);
          height = Math.floor(height * ratio);
        }

        // Create canvas and resize image
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        // Use better image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to data URL with compression
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        resolve(dataUrl);
      };

      img.onerror = () => {
        reject(new Error("Failed to load image"));
      };

      reader.onerror = () => {
        reject(new Error("Failed to read file"));
      };

      reader.readAsDataURL(file);
    });
  };

  const normaliseMask = (mask: DraftMask): ImageMask => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return mask;
    return {
      id: mask.id,
      x: Math.max(0, Math.min(1, mask.x / rect.width)),
      y: Math.max(0, Math.min(1, mask.y / rect.height)),
      width: Math.max(0.01, Math.min(1, mask.width / rect.width)),
      height: Math.max(0.01, Math.min(1, mask.height / rect.height)),
    };
  };

  const denormaliseMask = (mask: ImageMask): DraftMask => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) {
      return {
        id: mask.id,
        x: mask.x,
        y: mask.y,
        width: mask.width,
        height: mask.height,
      };
    }
    return {
      id: mask.id,
      x: mask.x * rect.width,
      y: mask.y * rect.height,
      width: mask.width * rect.width,
      height: mask.height * rect.height,
    };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!imageSrc) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const startX = event.clientX - rect.left;
    const startY = event.clientY - rect.top;
    setDraftMask({
      id: crypto.randomUUID(),
      x: startX,
      y: startY,
      width: 0,
      height: 0,
    });
    setIsDrawing(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDrawing || !draftMask) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const currentX = event.clientX - rect.left;
    const currentY = event.clientY - rect.top;

    const width = currentX - draftMask.x;
    const height = currentY - draftMask.y;

    setDraftMask((prev) =>
      prev
        ? {
            ...prev,
            width,
            height,
          }
        : prev
    );
  };

  const handlePointerUp = () => {
    if (!draftMask) {
      setIsDrawing(false);
      return;
    }
    const normalised = normaliseMask({
      ...draftMask,
      width: Math.abs(draftMask.width),
      height: Math.abs(draftMask.height),
      x: draftMask.width < 0 ? draftMask.x + draftMask.width : draftMask.x,
      y: draftMask.height < 0 ? draftMask.y + draftMask.height : draftMask.y,
    });
    onChange({ imageSrc, masks: [...masks, normalised] });
    setIsDrawing(false);
    setDraftMask(null);
  };

  const handleDeleteMask = (maskId: string) => {
    onChange({
      imageSrc,
      masks: masks.filter((mask) => mask.id !== maskId),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-muted-foreground/40 px-3 py-2 text-sm hover:border-primary">
          <UploadCloud className="h-4 w-4" />
          <span>{imageSrc ? "Change image" : "Upload image"}</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => handleFileChange(event.target.files?.[0])}
          />
        </label>
        <Badge variant="outline">{masks.length} masks</Badge>
      </div>

      <div
        ref={containerRef}
        className={cn(
          "relative aspect-video w-full overflow-hidden rounded-lg border bg-muted",
          imageSrc ? "cursor-crosshair" : "cursor-pointer"
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {imageSrc ? (
          <>
            <Image
              src={imageSrc}
              alt="Flashcard occlusion reference"
              fill
              className="object-contain"
              draggable={false}
              unoptimized
              sizes="(max-width: 768px) 100vw, 50vw"
            />
            {masks.map((mask) => {
              const { x, y, width, height } = denormaliseMask(mask);
              return (
                <div
                  key={mask.id}
                  className="absolute rounded-md border-2 border-primary/80 bg-primary/40 backdrop-blur-sm transition"
                  style={{
                    left: `${x}px`,
                    top: `${y}px`,
                    width: `${width}px`,
                    height: `${height}px`,
                  }}
                />
              );
            })}
            {isDrawing && draftMask && (
              <div
                className="absolute rounded-md border-2 border-primary/70 border-dashed bg-primary/10"
                style={{
                  left:
                    draftMask.width < 0
                      ? draftMask.x + draftMask.width
                      : draftMask.x,
                  top:
                    draftMask.height < 0
                      ? draftMask.y + draftMask.height
                      : draftMask.y,
                  width: Math.abs(draftMask.width),
                  height: Math.abs(draftMask.height),
                }}
              />
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Upload an image to start masking areas.
          </div>
        )}
      </div>

      {masks.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Masked regions
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {masks.map((mask, index) => (
              <div
                key={mask.id}
                className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-xs"
              >
                <div>
                  <p className="font-semibold">Area {index + 1}</p>
                  <p className="text-muted-foreground">
                    x:{(mask.x * 100).toFixed(0)}% · y:
                    {(mask.y * 100).toFixed(0)}% · w:
                    {(mask.width * 100).toFixed(0)}% · h:
                    {(mask.height * 100).toFixed(0)}%
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteMask(mask.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
