import { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Camera, Loader2 } from "lucide-react";
import { fetchProductByBarcode } from "@/lib/openfoodfacts";
import type { FoodItem } from "@/lib/types";
import { AddFoodDialog } from "@/components/AddFoodDialog";

interface BarcodeScannerProps {
  /** Diary date to log into ("yyyy-MM-dd"); defaults to today. */
  dateKey?: string;
  onScanSuccess?: (food: FoodItem) => void;
}

export function BarcodeScanner({ dateKey, onScanSuccess }: BarcodeScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFood, setLastFood] = useState<FoodItem | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scanningRef = useRef(false);

  const stopScanner = async () => {
    if (scannerRef.current && scanningRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {}
      scanningRef.current = false;
    }
  };

  const startScanner = async () => {
    setError(null);
    const html5Qrcode = new Html5Qrcode("qr-reader");
    scannerRef.current = html5Qrcode;
    scanningRef.current = true;

    try {
      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) {
        setError("No camera found on this device.");
        setScanning(false);
        return;
      }
      // Prefer a rear-facing camera if available.
      const cam = devices.find((d) =>
        (d.label || "").toLowerCase().includes("back"),
      ) || devices[0];

      await html5Qrcode.start(
        cam.id,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        async (decoded) => {
          if (!scanningRef.current) return;
          scanningRef.current = false;
          setLoading(true);
          // HTML5-QRCode can return barcode in various formats.
          const barcode = decoded.split(",")[0].trim();
          const food = await fetchProductByBarcode(barcode);
          if (food) {
            setLastFood(food);
            onScanSuccess?.(food);
          } else {
            setError(`Product not found for barcode: ${barcode}`);
          }
          await stopScanner();
          setScanning(false);
          setLoading(false);
        },
        (errorMessage) => {
          // Ignore non-fatal scan errors; they fire frequently during scanning.
          if (
            !errorMessage.includes("NotFoundException") &&
            !errorMessage.includes("No MultiFormat") &&
            !errorMessage.includes("No code found")
          ) {
            console.warn("Barcode scan error:", errorMessage);
          }
        },
      );
      setScanning(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start camera.");
      setScanning(false);
    }
  };

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      {!scanning && !loading && !lastFood && (
        <Button onClick={startScanner} className="w-full max-w-sm" size="lg">
          <Camera className="mr-2 h-5 w-5" />
          Start Barcode Scanner
        </Button>
      )}

      {scanning && (
        <Card className="relative w-full max-w-sm overflow-hidden rounded-lg">
          <div id="qr-reader" className="w-full" />
          <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-primary rounded-lg" />
        </Card>
      )}

      {loading && (
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Looking up product…</p>
        </div>
      )}

      {error && (
        <Card className="w-full max-w-sm p-4 border-destructive/50">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 w-full"
            onClick={() => {
              setError(null);
              setLastFood(null);
              startScanner();
            }}
          >
            Try again
          </Button>
        </Card>
      )}

      {lastFood && (
        <div className="w-full max-w-sm">
          <AddFoodDialog food={lastFood} dateKey={dateKey} trigger={undefined}>
            <Card className="p-4">
              <p className="mb-2 text-sm font-medium">
                Tap to add {lastFood.name} to your log
              </p>
              <FoodCardPreview food={lastFood} />
            </Card>
          </AddFoodDialog>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full"
            onClick={() => setLastFood(null)}
          >
            Scan another barcode
          </Button>
        </div>
      )}
    </div>
  );
}

function FoodCardPreview({ food }: { food: FoodItem }) {
  return (
    <div className="flex items-center gap-3">
      {food.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={food.image}
          alt={food.name}
          className="h-16 w-16 rounded object-cover"
        />
      )}
      <div className="flex-1">
        <p className="font-medium">{food.name}</p>
        <p className="text-xs text-muted-foreground">
          {food.calories} kcal / {food.servingSize}g
        </p>
      </div>
    </div>
  );
}
