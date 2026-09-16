"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AiNotConfiguredError,
  AiRequestError,
  estimateMealFromPhoto,
  photoItemToFoodItem,
} from "@/lib/ai/gemini";
import { type MealPhotoItem } from "@/lib/ai/types";
import { type FoodItem, type MealType } from "@/lib/types";
import { fileToBase64Jpeg, videoFrameToBase64Jpeg } from "@/lib/image-utils";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";
import { todayKey } from "@/lib/date";
import { PhotoResultCard } from "@/components/PhotoResultCard";
import {
  Camera,
  CameraOff,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";

interface MealPhotoScannerProps {
  /** Diary date to log into ("yyyy-MM-dd"); defaults to today. */
  dateKey?: string;
  /** Called after all items have been logged (used to reset the flow). */
  onLogged?: () => void;
}

type Phase = "capture" | "analyzing" | "results";

/** One AI-detected item plus the user's edits before logging. */
interface EditableItem {
  estimate: MealPhotoItem;
  name: string;
  grams: number;
  mealType: MealType;
  included: boolean;
}

/** Build the loggable FoodItem from an edited estimate. */
function editableToFoodItem(e: EditableItem, index: number): FoodItem {
  const food = photoItemToFoodItem(e.estimate, index);
  food.name = e.name.trim() || e.estimate.name;
  food.servingSize = e.grams;
  food.servingLabel = `${e.grams} g (est.)`;
  return food;
}

export function MealPhotoScanner({ dateKey, onLogged }: MealPhotoScannerProps) {
  const addLog = useAppStore((s) => s.addLog);
  const activeMeal = useAppStore((s) => s.activeMeal);
  const ai = useAppStore((s) => s.users[s.activeUserId ?? ""]?.ai);
  const setAiSettings = useAppStore((s) => s.setAiSettings);

  const [phase, setPhase] = useState<Phase>("capture");
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<EditableItem[]>([]);
  // Transient preview of the analyzed photo (never persisted with the log).
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasKey = Boolean(ai?.apiKey?.trim());

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraReady(false);
  }, []);

  // No synchronous setState before the first await — this is also called
  // from the mount effect, which forbids sync state updates.
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
    } catch {
      setCameraError(
        "Camera unavailable. You can still pick a photo from your gallery below.",
      );
    }
  }, []);

  // Release the camera on unmount (mode switch, navigation away).
  useEffect(() => {
    return stopCamera;
  }, [stopCamera]);

  const analyze = async (base64: string) => {
    setPhase("analyzing");
    setError(null);
    try {
      const result = await estimateMealFromPhoto(
        base64,
        ai?.apiKey ?? "",
        ai?.model,
      );
      if (result.items.length === 0) {
        setError(
          "No food detected in that photo. Try a clearer, closer shot of the meal.",
        );
        setPhase("capture");
        void startCamera();
        return;
      }
      setItems(
        result.items.map((item) => ({
          estimate: item,
          name: item.name,
          grams: item.portionGrams,
          mealType: activeMeal,
          included: true,
        })),
      );
      setPhase("results");
    } catch (err) {
      if (err instanceof AiNotConfiguredError || err instanceof AiRequestError) {
        setError(err.message);
      } else {
        setError("Something went wrong while analyzing the photo.");
      }
      setPhase("capture");
      void startCamera();
    }
  };

  const handleShutter = () => {
    if (!videoRef.current) return;
    try {
      const base64 = videoFrameToBase64Jpeg(videoRef.current);
      setPreviewDataUrl(`data:image/jpeg;base64,${base64}`);
      stopCamera();
      void analyze(base64);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not capture photo.");
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const base64 = await fileToBase64Jpeg(file);
      setPreviewDataUrl(`data:image/jpeg;base64,${base64}`);
      stopCamera();
      void analyze(base64);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read image.");
    }
  };

  const reset = () => {
    setItems([]);
    setPreviewDataUrl(null);
    setError(null);
    setCameraError(null);
    setPhase("capture");
    void startCamera();
  };

  const updateItem = (index: number, updates: Partial<EditableItem>) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...updates } : item)),
    );
  };

  const handleAddAll = () => {
    const included = items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.included);
    for (const { item, index } of included) {
      addLog(dateKey ?? todayKey(), {
        food: editableToFoodItem(item, index),
        mealType: item.mealType,
        servings: 1,
      });
    }
    onLogged?.();
    reset();
  };

  const includedCount = items.filter((i) => i.included).length;
  const totalCalories = items
    .filter((i) => i.included)
    .reduce((sum, i) => {
      const food = editableToFoodItem(i, 0);
      return sum + food.calories;
    }, 0);

  // ------------------------------------------------------------- no key yet
  if (!hasKey) {
    return (
      <AiSetupCard
        onSave={(key) => setAiSettings({ apiKey: key })}
      />
    );
  }

  // ---------------------------------------------------------------- capture
  if (phase === "capture" || phase === "analyzing") {
    return (
      <div className="flex flex-col items-center gap-4">
        <Card className="relative w-full max-w-sm overflow-hidden rounded-3xl">
          <div className="relative aspect-[3/4] w-full bg-muted">
            <video
              ref={videoRef}
              playsInline
              muted
              className={cn(
                "h-full w-full object-cover transition-opacity",
                cameraReady ? "opacity-100" : "opacity-0",
              )}
            />
            {!cameraReady && !cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center text-muted-foreground">
                <Camera className="h-7 w-7" />
                <p className="text-xs leading-relaxed">
                  Point your camera at the meal and snap a photo.
                </p>
                <Button onClick={() => void startCamera()} size="sm">
                  Start camera
                </Button>
              </div>
            )}
            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
                <CameraOff className="h-6 w-6 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{cameraError}</p>
                <Button
                  onClick={() => {
                    setCameraError(null);
                    void startCamera();
                  }}
                  size="sm"
                  variant="outline"
                >
                  Try camera again
                </Button>
              </div>
            )}
            {/* Framing guide */}
            <div className="pointer-events-none absolute inset-6 rounded-3xl border-2 border-dashed border-white/50" />
            {phase === "analyzing" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium">Analyzing your meal…</p>
                <p className="text-xs text-muted-foreground">
                  Estimating calories and macros
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-6 p-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={phase === "analyzing"}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              aria-label="Pick a photo from your gallery"
              title="Pick a photo from your gallery"
            >
              <ImageIcon className="h-5 w-5" />
            </button>
            <button
              onClick={handleShutter}
              disabled={!cameraReady || phase === "analyzing"}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-90 disabled:opacity-50"
              aria-label="Take photo of meal"
            >
              <Camera className="h-7 w-7" />
            </button>
            <span className="h-11 w-11" aria-hidden />
          </div>
        </Card>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        {error && (
          <Card className="w-full max-w-sm border-destructive/50 p-4">
            <p className="text-sm text-destructive">{error}</p>
          </Card>
        )}

        <p className="max-w-xs text-center text-xs leading-relaxed text-muted-foreground">
          Your photo is sent to Google Gemini for analysis and is not stored.
          AI estimates are approximate — you can adjust them before logging.
        </p>
      </div>
    );
  }

  // ---------------------------------------------------------------- results
  return (
    <div className="flex flex-col gap-4">
      {previewDataUrl && (
        <Card className="mx-auto w-full max-w-sm overflow-hidden rounded-3xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewDataUrl}
            alt="Analyzed meal"
            className="aspect-[3/1.4] w-full object-cover"
          />
        </Card>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" />
          {items.length} item{items.length === 1 ? "" : "s"} detected
        </p>
        <button
          onClick={reset}
          className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retake
        </button>
      </div>

      <div className="flex flex-col gap-2.5">
        {items.map((item, index) => (
          <PhotoResultCard
            key={index}
            item={item.estimate}
            name={item.name}
            grams={item.grams}
            mealType={item.mealType}
            included={item.included}
            onChangeName={(name) => updateItem(index, { name })}
            onChangeGrams={(grams) => updateItem(index, { grams })}
            onChangeMeal={(mealType) => updateItem(index, { mealType })}
            onToggleIncluded={(included) =>
              updateItem(index, { included })
            }
          />
        ))}
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        AI estimates are approximate — adjust names and amounts if needed.
      </p>

      <Button
        onClick={handleAddAll}
        disabled={includedCount === 0}
        size="lg"
        className="rounded-2xl"
      >
        <UtensilsCrossed className="mr-2 h-5 w-5" />
        Add {includedCount} item{includedCount === 1 ? "" : "s"}
        {includedCount > 0 && ` · ${Math.round(totalCalories)} kcal`}
      </Button>
    </div>
  );
}

/** Inline key setup shown when the user has not configured Gemini yet. */
function AiSetupCard({ onSave }: { onSave: (key: string) => void }) {
  const [key, setKey] = useState("");

  return (
    <Card className="mx-auto w-full max-w-sm p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <p className="font-semibold leading-tight">Scan meals with AI</p>
          <p className="text-xs text-muted-foreground">
            One-time setup with a free Gemini key
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-1.5">
        <Label htmlFor="ai-key" className="text-xs font-bold">
          Gemini API key
        </Label>
        <Input
          id="ai-key"
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Paste your key"
          autoComplete="off"
          className="h-11 rounded-2xl text-base"
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Get a free key at{" "}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary hover:underline"
          >
            aistudio.google.com/apikey
          </a>
          . The key is stored only on this device and is sent directly to
          Google when you scan a photo. You can change it later in Profile.
        </p>
      </div>

      <Button
        onClick={() => key.trim() && onSave(key.trim())}
        disabled={!key.trim()}
        className="mt-4 w-full rounded-2xl"
      >
        Save key
      </Button>
    </Card>
  );
}
