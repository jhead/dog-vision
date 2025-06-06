
"use client";

import type { ChangeEvent } from 'react';
import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Upload, Image as ImageIcon, Camera, AlertTriangle } from 'lucide-react';
import { applyDeuteranopiaFilter } from '@/lib/colorblind';
import { useToast } from "@/hooks/use-toast";

export default function ColorBlindVisionApp() {
  // State for image upload mode
  const [originalImageSrc, setOriginalImageSrc] = useState<string | null>(null);
  const [transformedImageSrc, setTransformedImageSrc] = useState<string | null>(null);
  const [isImageProcessing, setIsImageProcessing] = useState<boolean>(false);
  const [sliderPosition, setSliderPosition] = useState<number>(50);
  const [imageDimensions, setImageDimensions] = useState<{ width: number, height: number} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State for general app and camera mode
  const [mode, setMode] = useState<'upload' | 'camera'>('upload');
  const { toast } = useToast();

  // State for live camera mode
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const [cameraStreamState, setCameraStreamState] = useState<MediaStream | null>(null); // For UI reactivity
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isCameraInitializing, setIsCameraInitializing] = useState<boolean>(false);

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
    setIsImageProcessing(true);
    setOriginalImageSrc(null);
    setTransformedImageSrc(null);
    setImageDimensions(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const imgSrc = e.target?.result as string;
      
      const img = document.createElement('img');
      img.onload = () => {
        setOriginalImageSrc(imgSrc);
        setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });

        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          toast({ title: "Canvas Error", description: "Could not get canvas context.", variant: "destructive" });
          setIsImageProcessing(false);
          return;
        }
        ctx.drawImage(img, 0, 0);
        try {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const transformedImageData = applyDeuteranopiaFilter(imageData);
          ctx.putImageData(transformedImageData, 0, 0);
          setTransformedImageSrc(canvas.toDataURL());
          setSliderPosition(50);
        } catch (error) {
            toast({ title: "Processing Error", description: "Failed to process the image.", variant: "destructive" });
            console.error("Error processing image:", error);
        } finally {
            setIsImageProcessing(false);
        }
      };
      img.onerror = () => {
        toast({ title: "Image Load Error", description: "Could not load the image file.", variant: "destructive" });
        setIsImageProcessing(false);
      };
      img.src = imgSrc;
    };
    reader.onerror = () => {
        toast({ title: "File Read Error", description: "Could not read the file.", variant: "destructive" });
        setIsImageProcessing(false);
    }
    reader.readAsDataURL(file);
  }, [toast]);

  const stopCurrentCamera = useCallback(() => {
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(track => track.stop());
      cameraStreamRef.current = null;
    }
    setCameraStreamState(null);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      if (videoRef.current.srcObject === null && videoRef.current.pause) { // Ensure it's pausable
        videoRef.current.pause();
        videoRef.current.load(); // Reset video element
      }
    }
    if (canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
    setIsCameraInitializing(false);
  }, []);

  useEffect(() => { // Handles camera initialization based on mode
    if (mode === 'camera') {
      if (!cameraStreamRef.current && hasCameraPermission !== false) {
        const requestCamera = async () => {
          setIsCameraInitializing(true);
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            cameraStreamRef.current = stream;
            setCameraStreamState(stream); // For UI reactivity
            setHasCameraPermission(true);
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
              videoRef.current.play().catch(err => console.error("Error playing video:", err));
            }
          } catch (error) {
            console.error('Error accessing camera:', error);
            setHasCameraPermission(false);
            toast({
              variant: 'destructive',
              title: 'Camera Access Denied',
              description: 'Please enable camera permissions in your browser settings.',
            });
          } finally {
            setIsCameraInitializing(false);
          }
        };
        requestCamera();
      }
    } else {
      stopCurrentCamera();
    }
  }, [mode, hasCameraPermission, stopCurrentCamera, toast]);

  useEffect(() => { // Handles frame processing loop
    const videoElement = videoRef.current;
    const canvasElement = canvasRef.current;

    if (mode === 'camera' && cameraStreamState && videoElement && canvasElement) {
      const processFrame = () => {
        if (!videoRef.current || !canvasRef.current || videoRef.current.paused || videoRef.current.ended || videoRef.current.readyState < 3) {
          if(cameraStreamRef.current) animationFrameIdRef.current = requestAnimationFrame(processFrame); // Keep trying if stream exists
          return;
        }
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (ctx) {
          if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          try {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const transformedImageData = applyDeuteranopiaFilter(imageData);
            ctx.putImageData(transformedImageData, 0, 0);
          } catch (e) {
            console.error("Error processing frame:", e);
            // Optionally stop or notify user if errors persist
          }
        }
        if(cameraStreamRef.current) animationFrameIdRef.current = requestAnimationFrame(processFrame);
      };
      
      const handleCanPlay = () => {
        if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
        if(cameraStreamRef.current) animationFrameIdRef.current = requestAnimationFrame(processFrame);
      };

      videoElement.addEventListener('canplay', handleCanPlay);
      if (videoElement.readyState >= 3) handleCanPlay(); // If already playable

      return () => {
        videoElement.removeEventListener('canplay', handleCanPlay);
        if (animationFrameIdRef.current) {
          cancelAnimationFrame(animationFrameIdRef.current);
          animationFrameIdRef.current = null;
        }
      };
    } else {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    }
  }, [mode, cameraStreamState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCurrentCamera();
    };
  }, [stopCurrentCamera]);
  
  const imageUploadAspectRatio = imageDimensions ? imageDimensions.width / imageDimensions.height : 16/9;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background text-foreground">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="font-headline text-3xl md:text-4xl text-primary">ColorBlind Vision</CardTitle>
          <CardDescription className="text-muted-foreground">
            Simulate red-green color blindness on your photos or with your live camera.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs value={mode} onValueChange={(value) => setMode(value as 'upload' | 'camera')} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload">Image Upload</TabsTrigger>
              <TabsTrigger value="camera">Live Camera</TabsTrigger>
            </TabsList>
            
            <TabsContent value="upload" className="mt-6">
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

              {isImageProcessing && (
                <div className="flex flex-col items-center justify-center space-y-2 text-muted-foreground py-10">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <p className="font-headline">Processing image...</p>
                </div>
              )}

              {!isImageProcessing && !originalImageSrc && (
                 <div 
                    className="w-full bg-muted rounded-lg flex flex-col items-center justify-center text-muted-foreground mt-4"
                    style={{ aspectRatio: `${imageUploadAspectRatio}` }}
                  >
                    <ImageIcon size={64} className="mb-4 opacity-50" />
                    <p className="font-headline text-lg">Your images will appear here</p>
                    <p className="text-sm">Upload an image to get started</p>
                  </div>
              )}
              
              {!isImageProcessing && originalImageSrc && (
                <div className="space-y-4 mt-4">
                  <div 
                    className="relative w-full border border-border rounded-lg overflow-hidden shadow-md bg-muted"
                    style={{ aspectRatio: `${imageUploadAspectRatio}` }}
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
                    {transformedImageSrc && (
                      <div 
                        className="absolute top-0 bottom-0 w-1 bg-primary/70 cursor-col-resize shadow-md"
                        style={{ left: `calc(${sliderPosition}% - 2px)` }}
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
                    step={0.1}
                    className="w-full"
                    disabled={!transformedImageSrc}
                    aria-label="Image comparison slider"
                  />
                </div>
              )}
            </TabsContent>

            <TabsContent value="camera" className="mt-6">
              <div className="flex flex-col items-center space-y-4">
                <div 
                  className="relative w-full bg-muted rounded-lg overflow-hidden shadow-md"
                  style={{ aspectRatio: '16/9' }} // Default aspect ratio for camera view
                >
                  <video ref={videoRef} className="hidden" autoPlay muted playsInline />
                  <canvas ref={canvasRef} className="w-full h-full object-contain" />
                  
                  {isCameraInitializing && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/80">
                      <Loader2 className="h-12 w-12 animate-spin text-primary" />
                      <p className="font-headline mt-2">Starting camera...</p>
                    </div>
                  )}

                  {!cameraStreamState && !isCameraInitializing && hasCameraPermission !== false && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                      <Camera size={64} className="mb-4 opacity-50" />
                      <p className="font-headline text-lg">Live camera feed will appear here</p>
                      {hasCameraPermission === null && <p className="text-sm">Allow camera permission to start.</p>}
                    </div>
                  )}
                </div>

                {hasCameraPermission === false && (
                  <Alert variant="destructive" className="w-full">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Camera Access Denied</AlertTitle>
                    <AlertDescription>
                      Please enable camera permissions in your browser settings. 
                      <Button 
                        onClick={() => setHasCameraPermission(null) } // Resets to allow re-try
                        variant="link" 
                        className="p-0 h-auto ml-1 text-destructive-foreground underline"
                      >
                        Retry?
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                {cameraStreamState && (
                  <Button onClick={stopCurrentCamera} variant="destructive" className="w-full sm:w-auto">
                    Stop Camera
                  </Button>
                )}
                 {!cameraStreamState && hasCameraPermission !== false && !isCameraInitializing && (
                   <Button onClick={() => { /* Effectively handled by useEffect on mode/hasCameraPermission change */ 
                      if (hasCameraPermission === null) { // Trigger permission prompt if not yet decided
                        setMode('camera'); // Ensure mode is camera to trigger useEffect
                      }
                    }} 
                    className="w-full sm:w-auto"
                    disabled={isCameraInitializing}
                    >
                     Start Camera
                   </Button>
                 )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      <footer className="mt-8 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} ColorBlind Vision. All rights reserved.</p>
        <p className="text-xs mt-1">Simulation based on Deuteranopia (common red-green color blindness).</p>
      </footer>
    </div>
  );
}

    