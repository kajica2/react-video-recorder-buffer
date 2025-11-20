/**
 * Standalone Video Recorder Component
 *
 * A self-contained video recording component that can be used without
 * external auth providers. Requires auth context to be passed as prop.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { VideoBuffer, BufferStats } from '../services/VideoBuffer';
import { VideoUploadService, UploadProgress, UploadResult } from '../services/VideoUploadService';
import { RecordingConfig, AuthContextType } from '../types';

export interface VideoRecorderStandaloneProps {
  auth: AuthContextType; // Auth context passed as prop
  supabaseConfig: {
    url: string;
    anonKey: string;
  };
  config?: Partial<RecordingConfig>;
  onRecordingComplete?: (result: UploadResult) => void;
  onError?: (error: string) => void;
  className?: string;
}

export const VideoRecorderStandalone: React.FC<VideoRecorderStandaloneProps> = ({
  auth,
  supabaseConfig,
  config: userConfig,
  onRecordingComplete,
  onError,
  className = ''
}) => {
  const { user } = auth;

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const bufferRef = useRef<VideoBuffer | null>(null);
  const uploadServiceRef = useRef<VideoUploadService | null>(null);

  // State
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [bufferStats, setBufferStats] = useState<BufferStats | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // Configuration
  const config: RecordingConfig = {
    format: 'webm',
    quality: 'medium',
    maxDuration: 1800, // 30 minutes
    maxFileSize: 100 * 1024 * 1024, // 100MB
    ...userConfig
  };

  // Initialize upload service
  useEffect(() => {
    uploadServiceRef.current = new VideoUploadService({
      chunkSize: 5 * 1024 * 1024, // 5MB chunks
      maxRetries: 3,
      timeout: 60000 // 1 minute timeout
    });
  }, []);

  // Recording duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isRecording && !isPaused) {
      interval = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording, isPaused]);

  // Buffer stats update
  useEffect(() => {
    if (!bufferRef.current || !isRecording) return;

    const updateStats = () => {
      if (bufferRef.current) {
        const stats = bufferRef.current.getStats();
        setBufferStats(stats);

        // Check limits
        if (stats.isNearLimit) {
          handleError('Recording approaching storage limits');
        }
      }
    };

    const interval = setInterval(updateStats, 1000);
    return () => clearInterval(interval);
  }, [isRecording]);

  /**
   * Initialize camera and microphone
   */
  const initializeMedia = useCallback(async (): Promise<void> => {
    try {
      setIsInitializing(true);
      setError(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to access camera/microphone';
      handleError(errorMessage);
    } finally {
      setIsInitializing(false);
    }
  }, []);

  /**
   * Start recording
   */
  const startRecording = useCallback(async (): Promise<void> => {
    if (!user) {
      handleError('User authentication required to record videos');
      return;
    }

    if (!streamRef.current) {
      await initializeMedia();
      if (!streamRef.current) return;
    }

    try {
      setError(null);
      const newRecordingId = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setRecordingId(newRecordingId);

      // Initialize buffer
      bufferRef.current = new VideoBuffer(newRecordingId, {
        maxSize: config.maxFileSize,
        maxDuration: config.maxDuration,
        chunkInterval: 1000,
        autoFlush: true
      });
      bufferRef.current.initialize();

      // Create MediaRecorder
      const mimeType = config.format === 'webm' ? 'video/webm;codecs=vp9,opus' : 'video/mp4';

      if (!MediaRecorder.isTypeSupported(mimeType)) {
        throw new Error(`${config.format} format not supported by this browser`);
      }

      const recorder = new MediaRecorder(streamRef.current, {
        mimeType,
        videoBitsPerSecond: getVideoBitrate(config.quality),
        audioBitsPerSecond: getAudioBitrate(config.quality)
      });

      // Setup event handlers
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0 && bufferRef.current) {
          bufferRef.current.addChunk(event.data);
        }
      };

      recorder.onstart = () => {
        setIsRecording(true);
        setRecordingDuration(0);
        console.log('Recording started');
      };

      recorder.onstop = () => {
        console.log('Recording stopped');
        handleRecordingStop();
      };

      recorder.onerror = (event) => {
        handleError(`Recording error: ${(event as any).error}`);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000); // 1-second chunks

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start recording';
      handleError(errorMessage);
    }
  }, [user, config, initializeMedia]);

  /**
   * Stop recording
   */
  const stopRecording = useCallback((): void => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  }, [isRecording]);

  /**
   * Pause recording
   */
  const pauseRecording = useCallback((): void => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
    }
  }, [isRecording, isPaused]);

  /**
   * Resume recording
   */
  const resumeRecording = useCallback((): void => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
    }
  }, [isRecording, isPaused]);

  /**
   * Handle recording stop and upload
   */
  const handleRecordingStop = useCallback(async (): Promise<void> => {
    if (!bufferRef.current || !uploadServiceRef.current || !recordingId) return;

    try {
      setIsRecording(false);
      setIsPaused(false);
      setIsUploading(true);

      // Create final blob
      const finalBlob = await bufferRef.current.createCompleteFinalBlob(
        config.format === 'webm' ? 'video/webm' : 'video/mp4'
      );

      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `recording_${timestamp}.${config.format}`;

      // Upload with progress tracking
      const result = await uploadServiceRef.current.uploadVideo(
        finalBlob,
        filename,
        {
          duration: recordingDuration,
          format: config.format,
          quality: config.quality,
          resolution: await getVideoResolution(finalBlob)
        },
        setUploadProgress
      );

      if (result.success) {
        onRecordingComplete?.(result);
        resetRecordingState();
      } else {
        handleError(result.error || 'Upload failed');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process recording';
      handleError(errorMessage);
    } finally {
      setIsUploading(false);
      // Clean up buffer
      if (bufferRef.current) {
        await bufferRef.current.clear();
      }
    }
  }, [recordingId, config, recordingDuration, onRecordingComplete]);

  /**
   * Handle errors
   */
  const handleError = useCallback((errorMessage: string): void => {
    setError(errorMessage);
    onError?.(errorMessage);
    resetRecordingState();
  }, [onError]);

  /**
   * Reset recording state
   */
  const resetRecordingState = useCallback((): void => {
    setIsRecording(false);
    setIsPaused(false);
    setRecordingDuration(0);
    setBufferStats(null);
    setUploadProgress(null);
    setRecordingId(null);

    if (mediaRecorderRef.current) {
      mediaRecorderRef.current = null;
    }
  }, []);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (uploadServiceRef.current) {
        uploadServiceRef.current.cancelAllUploads();
      }
    };
  }, []);

  /**
   * Format duration for display
   */
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * Format file size for display
   */
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!user) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <p className="text-gray-500">User authentication required to record videos.</p>
      </div>
    );
  }

  return (
    <div className={`video-recorder ${className}`}>
      {/* Video Preview */}
      <div className="relative bg-gray-900 rounded-lg overflow-hidden mb-4">
        <video
          ref={videoRef}
          className="w-full h-64 object-cover"
          muted
          playsInline
        />

        {/* Recording Indicator */}
        {isRecording && (
          <div className="absolute top-4 right-4 flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`} />
            <span className="text-white text-sm font-medium">
              {isPaused ? 'PAUSED' : 'REC'} {formatDuration(recordingDuration)}
            </span>
          </div>
        )}

        {/* Error Overlay */}
        {error && (
          <div className="absolute inset-0 bg-red-500 bg-opacity-20 flex items-center justify-center">
            <div className="bg-red-500 text-white px-4 py-2 rounded">
              {error}
            </div>
          </div>
        )}

        {/* Initializing Overlay */}
        {isInitializing && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="text-white">Initializing camera...</div>
          </div>
        )}
      </div>

      {/* Recording Controls */}
      <div className="flex items-center justify-center space-x-4 mb-4">
        {!isRecording ? (
          <button
            onClick={startRecording}
            disabled={isInitializing || isUploading}
            className="bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white px-6 py-3 rounded-full flex items-center space-x-2"
          >
            <div className="w-4 h-4 rounded-full bg-white" />
            <span>Start Recording</span>
          </button>
        ) : (
          <>
            {!isPaused ? (
              <button
                onClick={pauseRecording}
                className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded"
              >
                Pause
              </button>
            ) : (
              <button
                onClick={resumeRecording}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
              >
                Resume
              </button>
            )}

            <button
              onClick={stopRecording}
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
            >
              Stop
            </button>
          </>
        )}
      </div>

      {/* Recording Stats */}
      {bufferStats && (
        <div className="bg-gray-100 p-4 rounded mb-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Duration:</strong> {formatDuration(bufferStats.totalDuration)}
            </div>
            <div>
              <strong>Size:</strong> {formatSize(bufferStats.totalSize)}
            </div>
            <div>
              <strong>Chunks:</strong> {bufferStats.chunkCount}
            </div>
            <div className={bufferStats.isNearLimit ? 'text-red-500' : ''}>
              <strong>Status:</strong> {bufferStats.isNearLimit ? 'Near Limit' : 'OK'}
            </div>
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {isUploading && uploadProgress && (
        <div className="bg-blue-50 p-4 rounded">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Uploading...</span>
            <span className="text-sm">{uploadProgress.percentage.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress.percentage}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{formatSize(uploadProgress.bytesUploaded)} / {formatSize(uploadProgress.totalBytes)}</span>
            <span>{uploadProgress.estimatedTimeRemaining > 0 ? `${uploadProgress.estimatedTimeRemaining.toFixed(0)}s remaining` : ''}</span>
          </div>
        </div>
      )}

      {/* Initialize Camera Button */}
      {!streamRef.current && !isInitializing && (
        <button
          onClick={initializeMedia}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded mb-4"
        >
          Initialize Camera
        </button>
      )}
    </div>
  );
};

/**
 * Get video bitrate based on quality setting
 */
function getVideoBitrate(quality: string): number {
  const bitrates = {
    low: 1000000, // 1 Mbps
    medium: 2500000, // 2.5 Mbps
    high: 5000000, // 5 Mbps
    lossless: 10000000 // 10 Mbps
  };
  return bitrates[quality] || bitrates.medium;
}

/**
 * Get audio bitrate based on quality setting
 */
function getAudioBitrate(quality: string): number {
  const bitrates = {
    low: 64000, // 64 kbps
    medium: 128000, // 128 kbps
    high: 256000, // 256 kbps
    lossless: 512000 // 512 kbps
  };
  return bitrates[quality] || bitrates.medium;
}

/**
 * Extract video resolution from blob
 */
async function getVideoResolution(blob: Blob): Promise<{ width: number; height: number } | undefined> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.onloadedmetadata = () => {
      resolve({
        width: video.videoWidth,
        height: video.videoHeight
      });
    };
    video.onerror = () => resolve(undefined);
    video.src = URL.createObjectURL(blob);
  });
}