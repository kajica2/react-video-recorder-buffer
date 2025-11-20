/**
 * React Video Recorder Buffer
 *
 * A comprehensive video recording system with buffer management,
 * progressive upload, and gallery features for React applications.
 */

// Core Services
export { VideoBuffer } from './services/VideoBuffer';
export { VideoUploadService } from './services/VideoUploadService';

// React Components
export { VideoRecorder } from './components/VideoRecorder';
export { VideoGallery } from './components/VideoGallery';
export { VideoRecordingDemo } from './components/VideoRecordingDemo';

// Type Definitions
export type {
  VideoChunk,
  BufferConfig,
  BufferStats,
  UploadConfig,
  UploadProgress,
  UploadResult,
  VideoMetadata,
  RecordingConfig,
  VideoRecord,
  VideoRecorderProps,
  VideoGalleryProps,
  VideoRecordingDemoProps,
  ProgressCallback,
  User,
  AuthContextType
} from './types';

// Version
export const VERSION = '1.0.0';