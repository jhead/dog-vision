"use client";

import type { ChangeEvent } from 'react';
import { useState, useRef, useCallback, useEffect } from 'react';
import NextImage from 'next/image';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Upload, Image as ImageIcon } from 'lucide-react';
import { applyDeuteranopiaFilter } from '@/lib/colorblind';
import { useToast } from "@/hooks/use-toast";

export default function ColorBlindVisionApp() {
  const [originalImageSrc, setOriginalImageSrc] = useState<string | null>(null);
  const [transformedImageSrc, setTransformedImageSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [sliderPosition, setSliderPosition] = useState<number>(50); // Percentage 0-100
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number, height: number} | null>(null);
  const { toast } = useToast();

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid File Type",
          description: "Please upload an image file (e.g., PNG, JPG, GIF).",
          variant: "destructive",
        });
        return;
      }
      processImage(file);
    }
  };

  const processImage = useCallback(async (file: File) => {
    setIsLoading(true);
    setOriginalImageSrc(null);
    setTransformedImageSrc(null);
    setImageDimensions(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const imgSrc = e.target?.result as string;
      
      const img = document.createElement('img');
      img.onload = () => {
        setOriginalImageSrc(imgSrc); // Show original immediately
        setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });

        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          toast({
            title: "Canvas Error",
            description: "Could not get canvas context for image processing.",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
        ctx.drawImage(img, 0, 0);
        try {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const transformedImageData = applyDeuteranopiaFilter(imageData);
          ctx.putImageData(transformedImageData, 0, 0);
          setTransformedImageSrc(canvas.toDataURL());
          setSliderPosition(50); // Reset slider
        } catch (error) {
            toast({
                title: "Processing Error",
                description: "Failed to process the image. It might be too large or in an unsupported format after loading.",
                variant: "destructive",
            });
            console.error("Error processing image:", error);
        } finally {
            setIsLoading(false);
        }
      };
      img.onerror = () => {
        toast({
          title: "Image Load Error",
          description: "Could not load the selected image file.",
          variant: "destructive",
        });
        setIsLoading(false);
      };
      img.src = imgSrc;
    };
    reader.onerror = () => {
        toast({
            title: "File Read Error",
            description: "Could not read the selected file.",
            variant: "destructive",
        });
        setIsLoading(false);
    }
    reader.readAsDataURL(file);
  }, [toast]);

  useEffect(() => {
    // Clean up object URLs if they were used (not in current setup with data URLs)
    return () => {
      if (originalImageSrc?.startsWith('blob:')) URL.revokeObjectURL(originalImageSrc);
      if (transformedImageSrc?.startsWith('blob:')) URL.revokeObjectURL(transformedImageSrc);
    };
  }, [originalImageSrc, transformedImageSrc]);
  
  const aspectRatio = imageDimensions ? imageDimensions.width / imageDimensions.height : 16/9;


  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background text-foreground">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="font-headline text-3xl md:text-4xl text-primary">ColorBlind Vision</CardTitle>
          <CardDescription className="text-muted-foreground">
            Upload an image to see how it might look to someone with red-green color blindness (Deuteranopia).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center space-y-4">
            <Input
              id="imageUpload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
              ref={fileInputRef}
            />
            <Button onClick={() => fileInputRef.current?.click()} className="w-full sm:w-auto" variant="default" size="lg">
              <Upload className="mr-2 h-5 w-5" /> Upload Image
            </Button>
          </div>

          {isLoading && (
            <div className="flex flex-col items-center justify-center space-y-2 text-muted-foreground py-10">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="font-headline">Processing image...</p>
            </div>
          )}

          {!isLoading && !originalImageSrc && (
             <div 
                className="w-full bg-muted rounded-lg flex flex-col items-center justify-center text-muted-foreground"
                style={{ aspectRatio: `${aspectRatio}` }}
              >
                <ImageIcon size={64} className="mb-4 opacity-50" />
                <p className="font-headline text-lg">Your images will appear here</p>
                <p className="text-sm">Upload an image to get started</p>
              </div>
          )}
          
          {!isLoading && originalImageSrc && (
            <div className="space-y-4">
              <div 
                className="relative w-full border border-border rounded-lg overflow-hidden shadow-md bg-muted"
                style={{ aspectRatio: `${aspectRatio}` }}
              >
                <img
                  src={originalImageSrc}
                  alt="Original"
                  className="absolute top-0 left-0 w-full h-full object-contain"
                  aria-label="Original image"
                />
                {transformedImageSrc && (
                  <div
                    className="absolute top-0 left-0 w-full h-full"
                    style={{ clipPath: `polygon(0 0, ${sliderPosition}% 0, ${sliderPosition}% 100%, 0 100%)` }}
                  >
                    <img
                      src={transformedImageSrc}
                      alt="Colorblind Simulation"
                      className="absolute top-0 left-0 w-full h-full object-contain"
                      aria-label="Colorblind simulated image"
                    />
                  </div>
                )}
                 {/* Slider Handle Visual */}
                {transformedImageSrc && (
                  <div 
                    className="absolute top-0 bottom-0 w-1 bg-primary/70 cursor-col-resize shadow-md"
                    style={{ left: `calc(${sliderPosition}% - 2px)` }} // 2px is half of 4px width
                    role="separator"
                    aria-orientation="vertical"
                  ></div>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4 items-center">
                <Label htmlFor="imageSlider" className="text-sm text-center font-headline">Original</Label>
                <Label htmlFor="imageSlider" className="text-sm text-center font-headline">Deuteranopia</Label>
              </div>
              <Slider
                id="imageSlider"
                value={[sliderPosition]}
                onValueChange={(value) => setSliderPosition(value[0])}
                max={100}
                step={0.1} // Finer control
                className="w-full"
                disabled={!transformedImageSrc}
                aria-label="Image comparison slider"
              />
            </div>
          )}
        </CardContent>
      </Card>
      <footer className="mt-8 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} ColorBlind Vision. All rights reserved.</p>
        <p className="text-xs mt-1">Simulation based on Deuteranopia (common red-green color blindness).</p>
      </footer>
    </div>
  );
}
