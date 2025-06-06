
"use client";

import type { ChangeEvent, MediaDeviceInfo } from 'react';
import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Upload, Image as ImageIcon, Camera, AlertTriangle, RefreshCcw, ScreenShare, Minimize } from 'lucide-react';
import { applyDeuteranopiaFilter } from '@/lib/colorblind';
import { useToast } from "@/hooks/use-toast";

export default function ColorBlindVisionApp() {
  const [originalImageSrc, setOriginalImageSrc] = useState<string | null>(null);
  const [transformedImageSrc, setTransformedImageSrc] = useState<string | null>(null);
  const [isImageProcessing, setIsImageProcessing] = useState<boolean>(false);
  const [sliderPosition, setSliderPosition] = useState<number>(50);
  const [imageDimensions, setImageDimensions] = useState<{ width: number, height: number} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [mode, setMode] = useState<'upload' | 'camera'>('upload');
  const { toast } = useToast();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const [cameraStreamState, setCameraStreamState] = useState<MediaStream | null>(null); 
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null); // null: unknown, true: granted, false: denied
  const [isCameraInitializing, setIsCameraInitializing] = useState<boolean>(false);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined);
  const [isSwitchingCamera, setIsSwitchingCamera] = useState<boolean>(false);
  const cameraViewRef = useRef<HTMLDivElement>(null);
  const [isFullscreenActive, setIsFullscreenActive] = useState<boolean>(false);


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
      if (videoRef.current.pause) { 
        videoRef.current.pause();
      }
      if(videoRef.current.load) {
        videoRef.current.load(); 
      }
    }
    if (canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
  }, []);

  const attemptInitialCameraAccess = useCallback(async () => {
    if (mode !== 'camera') return;

    setIsCameraInitializing(true);
    setHasCameraPermission(null); 

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setHasCameraPermission(true);

      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const currentVideoDevices = allDevices.filter(device => device.kind === 'videoinput');
      setVideoDevices(currentVideoDevices);
      
      let currentTrackDeviceId: string | undefined;
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length > 0) {
          currentTrackDeviceId = videoTracks[0].getSettings().deviceId;
      }
      stream.getTracks().forEach(track => track.stop()); 

      if (currentVideoDevices.length > 0) {
        const rearCamera = currentVideoDevices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment'));
        const preferredDeviceId = currentTrackDeviceId || rearCamera?.deviceId || currentVideoDevices[0].deviceId;
        setSelectedDeviceId(preferredDeviceId); 
      } else {
        toast({ variant: 'destructive', title: 'No Cameras Found', description: 'No video input devices detected after permission.' });
        setHasCameraPermission(false);
      }
    } catch (error) {
      console.error('Initial camera access error:', error);
      setHasCameraPermission(false);
      toast({
        variant: 'destructive',
        title: 'Camera Permission Denied',
        description: 'Please enable camera permissions in your browser settings to use this feature.',
      });
    } finally {
      setIsCameraInitializing(false);
    }
  }, [mode, toast]);

  useEffect(() => {
    let isMounted = true;

    const startSelectedCameraStream = async () => {
      if (!isMounted || !selectedDeviceId || hasCameraPermission !== true || mode !== 'camera') {
        setIsCameraInitializing(false);
        setIsSwitchingCamera(false);
        return;
      }

      setIsCameraInitializing(true);
      setIsSwitchingCamera(true);
      stopCurrentCamera(); 

      try {
        const constraints: MediaStreamConstraints = { video: { deviceId: { exact: selectedDeviceId } } };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        if (isMounted) {
          cameraStreamRef.current = stream;
          setCameraStreamState(stream);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => {
              if (isMounted && videoRef.current) {
                videoRef.current.play().catch(err => {
                  console.error("Error playing video:", err);
                  toast({ variant: "destructive", title: "Video Play Error", description: "Could not play camera stream." });
                });
              }
            };
          }
          const allDevices = await navigator.mediaDevices.enumerateDevices();
          const currentVideoDevices = allDevices.filter(device => device.kind === 'videoinput');
          setVideoDevices(currentVideoDevices);

        } else {
          stream.getTracks().forEach(track => track.stop());
        }
      } catch (error) {
        console.error('Error accessing camera with deviceId:', selectedDeviceId, error);
        if (isMounted) {
          toast({
            variant: 'destructive',
            title: 'Camera Device Error',
            description: `Failed to access the selected camera. Please try another one.`,
          });
          if (videoDevices.length <= 1) setHasCameraPermission(false);
        }
      } finally {
        if (isMounted) {
          setIsCameraInitializing(false);
          setIsSwitchingCamera(false);
        }
      }
    };

    if (mode === 'camera' && hasCameraPermission === true && selectedDeviceId) {
      startSelectedCameraStream();
    } else if (mode !== 'camera') {
      stopCurrentCamera();
      setIsCameraInitializing(false);
      setIsSwitchingCamera(false);
    } else {
      setIsCameraInitializing(false); 
      setIsSwitchingCamera(false);
    }

    return () => {
      isMounted = false;
    };
  }, [mode, selectedDeviceId, hasCameraPermission, toast, stopCurrentCamera, videoDevices.length]);

   useEffect(() => {
    if (mode === 'camera' && hasCameraPermission === true && videoDevices.length === 0 && !selectedDeviceId) {
      const populateDevices = async () => {
        setIsCameraInitializing(true);
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoInputs = devices.filter(device => device.kind === 'videoinput');
          setVideoDevices(videoInputs);
          if (videoInputs.length > 0) {
            const rearCamera = videoInputs.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment'));
            setSelectedDeviceId(rearCamera?.deviceId || videoInputs[0].deviceId);
          } else if (videoInputs.length === 0) {
            toast({ variant: 'destructive', title: 'No Cameras Found', description: 'No video input devices detected.'});
            setHasCameraPermission(false); 
          }
        } catch (error) {
          console.error("Error enumerating devices:", error);
          toast({ variant: 'destructive', title: 'Device Error', description: 'Could not list camera devices.'});
        } finally {
          setIsCameraInitializing(false);
        }
      };
      populateDevices();
    }
  }, [mode, hasCameraPermission, videoDevices.length, selectedDeviceId, toast]);

  useEffect(() => { 
    const videoElement = videoRef.current;
    const canvasElement = canvasRef.current;

    if (mode === 'camera' && cameraStreamState && videoElement && canvasElement) {
      const processFrame = () => {
        if (!videoRef.current || !canvasRef.current || videoRef.current.paused || videoRef.current.ended || videoRef.current.readyState < 3 || !cameraStreamRef.current) {
          if(cameraStreamRef.current && animationFrameIdRef.current !== null) animationFrameIdRef.current = requestAnimationFrame(processFrame);
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
          }
        }
        if(cameraStreamRef.current && animationFrameIdRef.current !== null) animationFrameIdRef.current = requestAnimationFrame(processFrame);
      };
      
      const handleCanPlay = () => {
        if (animationFrameIdRef.current !== null) cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = requestAnimationFrame(processFrame);
      };

      videoElement.addEventListener('canplay', handleCanPlay);
      if (videoElement.readyState >= 3) handleCanPlay(); 

      return () => {
        videoElement.removeEventListener('canplay', handleCanPlay);
        if (animationFrameIdRef.current !== null) {
          cancelAnimationFrame(animationFrameIdRef.current);
          animationFrameIdRef.current = null;
        }
      };
    } else {
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    }
  }, [mode, cameraStreamState]);

  useEffect(() => { 
    return () => stopCurrentCamera();
  }, [stopCurrentCamera]);

  const handleSwitchCamera = useCallback(async () => {
    if (videoDevices.length < 2 || isSwitchingCamera || isCameraInitializing) return;
    
    const currentIndex = videoDevices.findIndex(device => device.deviceId === selectedDeviceId);
    const nextIndex = (currentIndex + 1) % videoDevices.length;
    const nextDeviceId = videoDevices[nextIndex]?.deviceId;

    if (nextDeviceId && nextDeviceId !== selectedDeviceId) {
      setSelectedDeviceId(nextDeviceId); 
    }
  }, [videoDevices, selectedDeviceId, isSwitchingCamera, isCameraInitializing]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element, mozFullScreenElement?: Element, msFullscreenElement?: Element };
      const fullscreenElement = doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement;
      setIsFullscreenActive(!!fullscreenElement && fullscreenElement === cameraViewRef.current);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    if (!cameraViewRef.current) return;

    const element = cameraViewRef.current as HTMLDivElement & { 
      webkitRequestFullscreen?: () => Promise<void>; 
      mozRequestFullScreen?: () => Promise<void>; 
      msRequestFullscreen?: () => Promise<void>; 
    };
    const doc = document as Document & { 
      webkitExitFullscreen?: () => Promise<void>; 
      mozCancelFullScreen?: () => Promise<void>; 
      msExitFullscreen?: () => Promise<void>;
      webkitFullscreenElement?: Element; 
      mozFullScreenElement?: Element; 
      msFullscreenElement?: Element; 
    };

    const isCurrentlyFullscreen = !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement);

    if (!isCurrentlyFullscreen) {
      if (typeof element.requestFullscreen === 'function') {
        element.requestFullscreen().catch(err => {
          toast({ variant: "destructive", title: "Fullscreen Error", description: `Could not enter fullscreen: ${err.message}` });
        });
      } else if (typeof element.webkitRequestFullscreen === 'function') {
        element.webkitRequestFullscreen().catch(err => {
          toast({ variant: "destructive", title: "Fullscreen Error", description: `Could not enter fullscreen: ${err.message}` });
        });
      } else if (typeof element.mozRequestFullScreen === 'function') {
        element.mozRequestFullScreen().catch(err => {
          toast({ variant: "destructive", title: "Fullscreen Error", description: `Could not enter fullscreen: ${err.message}` });
        });
      } else if (typeof element.msRequestFullscreen === 'function') {
        element.msRequestFullscreen().catch(err => {
          toast({ variant: "destructive", title: "Fullscreen Error", description: `Could not enter fullscreen: ${err.message}` });
        });
      } else {
        toast({ variant: "destructive", title: "Fullscreen Not Supported", description: "Fullscreen API is not supported on this browser or for this element." });
      }
    } else {
      if (typeof doc.exitFullscreen === 'function') {
        doc.exitFullscreen().catch(err => {
          toast({ variant: "destructive", title: "Fullscreen Error", description: `Could not exit fullscreen: ${err.message}` });
        });
      } else if (typeof doc.webkitExitFullscreen === 'function') {
        doc.webkitExitFullscreen().catch(err => {
          toast({ variant: "destructive", title: "Fullscreen Error", description: `Could not exit fullscreen: ${err.message}` });
        });
      } else if (typeof doc.mozCancelFullScreen === 'function') {
        doc.mozCancelFullScreen().catch(err => {
          toast({ variant: "destructive", title: "Fullscreen Error", description: `Could not exit fullscreen: ${err.message}` });
        });
      } else if (typeof doc.msExitFullscreen === 'function') {
        doc.msExitFullscreen().catch(err => {
          toast({ variant: "destructive", title: "Fullscreen Error", description: `Could not exit fullscreen: ${err.message}` });
        });
      } else {
         toast({ variant: "destructive", title: "Fullscreen Not Supported", description: "Could not exit fullscreen. API not available." });
      }
    }
  }, [toast]);
  
  const imageUploadAspectRatio = imageDimensions ? imageDimensions.width / imageDimensions.height : 16/9;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background text-foreground">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="font-headline text-3xl md:text-4xl text-primary">ColorBlind Vision</CardTitle>
          <CardDescription className="text-muted-foreground">
            Simulate red-green color blindness on photos or with your live camera.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs value={mode} onValueChange={(value) => {
              const newMode = value as 'upload' | 'camera';
              if (newMode === 'camera' && mode === 'upload') {
                if (hasCameraPermission === null) {
                    setSelectedDeviceId(undefined); 
                }
              }
              setMode(newMode);
            }} className="w-full">
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
                  ref={cameraViewRef}
                  className="relative w-full bg-muted rounded-lg overflow-hidden shadow-md dark:bg-neutral-800 camera-viewport"
                  style={{ aspectRatio: '16/9' }}
                >
                  <video ref={videoRef} className="hidden w-full h-full object-contain" autoPlay muted playsInline />
                  <canvas ref={canvasRef} className="w-full h-full object-contain" />
                  
                  {(isCameraInitializing || (isSwitchingCamera && !cameraStreamState)) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/80 dark:bg-neutral-800/80">
                      <Loader2 className="h-12 w-12 animate-spin text-primary" />
                      <p className="font-headline mt-2">
                        {isSwitchingCamera ? 'Switching camera...' : 'Starting camera...'}
                      </p>
                    </div>
                  )}

                  {!cameraStreamState && !isCameraInitializing && hasCameraPermission !== false && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                      <Camera size={64} className="mb-4 opacity-50" />
                       <p className="font-headline text-lg">
                        {hasCameraPermission === null ? "Click 'Start Camera' to begin" : "Camera feed will appear here"}
                      </p>
                      {hasCameraPermission === null && <p className="text-sm">Allow camera permission when prompted.</p>}
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
                        onClick={() => { 
                          setHasCameraPermission(null); 
                          setSelectedDeviceId(undefined); 
                        }} 
                        variant="link" 
                        className="p-0 h-auto ml-1 text-destructive-foreground underline"
                      >
                        Retry?
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="w-full flex flex-col sm:flex-row justify-center items-center gap-2">
                  {mode === 'camera' && hasCameraPermission === null && !isCameraInitializing && (
                     <Button 
                       onClick={attemptInitialCameraAccess} 
                       className="flex-grow sm:flex-grow-0 w-full sm:w-auto"
                       disabled={isCameraInitializing}
                     >
                       <Camera className="mr-2 h-5 w-5" /> Start Camera
                     </Button>
                  )}
                  {cameraStreamState && hasCameraPermission === true && (
                    <Button onClick={() => { stopCurrentCamera(); setHasCameraPermission(null); setSelectedDeviceId(undefined);}} variant="destructive" className="flex-grow sm:flex-grow-0 w-full sm:w-auto">
                      Stop Camera
                    </Button>
                  )}
                  {cameraStreamState && hasCameraPermission === true && videoDevices.length > 1 && (
                    <Button 
                      onClick={handleSwitchCamera} 
                      variant="outline" 
                      className="flex-grow sm:flex-grow-0 w-full sm:w-auto"
                      disabled={isSwitchingCamera || isCameraInitializing}
                    >
                      {isSwitchingCamera ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <RefreshCcw className="mr-2 h-5 w-5" />}
                      Switch Camera
                    </Button>
                  )}
                  {cameraStreamState && hasCameraPermission === true && (
                     <Button 
                        onClick={handleToggleFullscreen} 
                        variant="outline" 
                        className="flex-grow sm:flex-grow-0 w-full sm:w-auto"
                        disabled={isCameraInitializing}
                      >
                       {isFullscreenActive ? <Minimize className="mr-2 h-5 w-5" /> : <ScreenShare className="mr-2 h-5 w-5" />}
                       {isFullscreenActive ? 'Exit Fullscreen' : 'Fullscreen'}
                     </Button>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      <footer className="mt-8 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} ColorBlind Vision. All rights reserved.</p>
        <p className="text-xs mt-1">Simulation based on Deuteranopia (common red-green color blindness).</p>
      </footer>
      <style jsx global>{`
        .camera-viewport:fullscreen {
          width: 100vw !important;
          height: 100vh !important;
          max-width: none !important;
          max-height: none !important;
          padding: 0;
          background-color: #000;
        }
        .camera-viewport:-webkit-full-screen { /* Safari */
          width: 100vw !important;
          height: 100vh !important;
          max-width: none !important;
          max-height: none !important;
          padding: 0;
          background-color: #000;
        }
        .camera-viewport:-moz-full-screen { /* Firefox */
          width: 100vw !important;
          height: 100vh !important;
          max-width: none !important;
          max-height: none !important;
          padding: 0;
          background-color: #000;
        }
        .camera-viewport:-ms-fullscreen { /* IE/Edge */
          width: 100vw !important;
          height: 100vh !important;
          max-width: none !important;
          max-height: none !important;
          padding: 0;
          background-color: #000;
        }

        .camera-viewport:fullscreen video,
        .camera-viewport:fullscreen canvas,
        .camera-viewport:-webkit-full-screen video,
        .camera-viewport:-webkit-full-screen canvas,
        .camera-viewport:-moz-full-screen video,
        .camera-viewport:-moz-full-screen canvas,
        .camera-viewport:-ms-fullscreen video,
        .camera-viewport:-ms-fullscreen canvas {
          object-fit: contain;
        }
      `}</style>
    </div>
  );
}
    

    

    