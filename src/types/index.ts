/**
 * Type definitions for React Video Recorder Buffer
 */

export interface VideoChunk {
  blob: Blob;
  timestamp: number;
  size: number;
  duration: number;
}

export interface BufferConfig {
  maxSize: number; // Max buffer size in bytes (default: 100MB)
  maxDuration: number; // Max duration in seconds (default: 1800 = 30 minutes)
  chunkInterval: number; // Chunk interval in ms (default: 1000ms)
  compressionLevel: 'none' | 'low' | 'medium' | 'high';
  autoFlush: boolean; // Auto flush to IndexedDB when limits reached
}

export interface BufferStats {
  totalSize: number;
  totalDuration: number;
  chunkCount: number;
  memoryUsage: number;
  isNearLimit: boolean;
}

export interface UploadConfig {
  chunkSize: number; // Size of upload chunks (default: 5MB)
  maxRetries: number; // Max retry attempts (default: 3)
  timeout: number; // Request timeout in ms (default: 30000)
  compressionQuality: number; // Compression quality 0-1 (default: 0.8)
  enableCompression: boolean; // Enable client-side compression
}

export interface UploadProgress {
  uploadId: string;
  bytesUploaded: number;
  totalBytes: number;
  percentage: number;
  speed: number; // bytes per second
  estimatedTimeRemaining: number; // seconds
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error' | 'cancelled';
  error?: string;
}

export interface UploadResult {
  success: boolean;
  uploadId: string;
  filePath?: string;
  publicUrl?: string;
  metadata?: VideoMetadata;
  error?: string;
}

export interface VideoMetadata {
  filename: string;
  size: number;
  duration: number;
  format: string;
  quality: string;
  resolution?: {
    width: number;
    height: number;
  };
  uploadedAt: string;
  userId: string;
}

export interface RecordingConfig {
  format: 'webm' | 'mp4';
  quality: 'low' | 'medium' | 'high' | 'lossless';
  maxDuration: number; // seconds
  maxFileSize: number; // bytes
}

export interface VideoRecord {
  id: string;
  uploadId: string;
  filename: string;
  filePath: string;
  fileSize: number;
  duration: number;
  format: string;
  quality: string;
  resolution?: {
    width: number;
    height: number;
  };
  thumbnailPath?: string;
  metadata: Record<string, any>;
  status: 'uploaded' | 'processing' | 'processed' | 'error';
  createdAt: string;
  processedAt?: string;
}

export interface VideoRecorderProps {
  config?: Partial<RecordingConfig>;
  onRecordingComplete?: (result: UploadResult) => void;
  onError?: (error: string) => void;
  className?: string;
}

export interface VideoGalleryProps {
  onVideoSelect?: (video: VideoRecord) => void;
  onVideoDelete?: (videoId: string) => void;
  className?: string;
}

export interface VideoRecordingDemoProps {
  className?: string;
}

export type ProgressCallback = (progress: UploadProgress) => void;

// Auth related types for compatibility
export interface User {
  id: string;
  email: string;
  name?: string;
  picture?: string;
  accessToken?: string;
}

export interface AuthContextType {
  user: User | null;
  session: any | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<{ error?: any }>;
  signOut: () => Promise<{ error?: any | null }>;
  clearError: () => void;
}