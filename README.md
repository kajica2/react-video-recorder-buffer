# React Video Recorder Buffer 🎥

A comprehensive React video recording system that captures video to user buffer before saving to server, featuring progressive upload, real-time monitoring, and gallery management.

[![npm version](https://img.shields.io/npm/v/react-video-recorder-buffer.svg)](https://www.npmjs.com/package/react-video-recorder-buffer)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

### 🔄 Buffer-First Architecture
- **Memory-efficient chunk management** with configurable size limits
- **Automatic IndexedDB fallback** for large recordings
- **Real-time buffer monitoring** with size and duration tracking
- **Smart compression and cleanup** to prevent memory overload

### 📤 Progressive Upload System
- **Chunked upload support** for large files (configurable chunk size)
- **Retry logic** with exponential backoff
- **Progress tracking** with speed estimation and ETA
- **Cancellation support** for long-running uploads
- **Automatic thumbnail generation** post-upload

### 🎬 Advanced Recording Features
- **Multiple format support**: WebM, MP4, WAV, MP3
- **Quality settings**: Low, Medium, High, Lossless
- **Real-time preview** with recording indicators
- **Pause/resume functionality** during recording
- **Configurable limits** for duration and file size
- **Browser compatibility checks** for supported formats

### 🖼️ Comprehensive Gallery System
- **Grid view** with thumbnail previews
- **Sorting and filtering** by date, size, duration, format
- **In-app video player** with modal overlay
- **Batch management** operations
- **Real-time updates** via Supabase subscriptions
- **Metadata display** with detailed file information

## 🚀 Quick Start

### Installation

```bash
npm install react-video-recorder-buffer
# or
yarn add react-video-recorder-buffer
```

### Peer Dependencies

```bash
npm install react react-dom @supabase/supabase-js
```

### Basic Usage

```tsx
import React from 'react';
import { VideoRecorder, VideoGallery } from 'react-video-recorder-buffer';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabase = createClient(
  'your-supabase-url',
  'your-supabase-anon-key'
);

function App() {
  const handleRecordingComplete = (result) => {
    console.log('Recording uploaded:', result.publicUrl);
  };

  const handleError = (error) => {
    console.error('Recording error:', error);
  };

  return (
    <div className="app">
      <h1>Video Recording System</h1>

      {/* Video Recorder */}
      <VideoRecorder
        config={{
          format: 'webm',
          quality: 'high',
          maxDuration: 1800, // 30 minutes
          maxFileSize: 100 * 1024 * 1024 // 100MB
        }}
        onRecordingComplete={handleRecordingComplete}
        onError={handleError}
      />

      {/* Video Gallery */}
      <VideoGallery
        onVideoSelect={(video) => console.log('Selected:', video)}
        onVideoDelete={(id) => console.log('Deleted:', id)}
      />
    </div>
  );
}
```

### Standalone Usage (No Auth Provider)

```tsx
import React from 'react';
import { VideoRecorderStandalone } from 'react-video-recorder-buffer';

function StandaloneApp() {
  const authContext = {
    user: { id: 'user-123', email: 'user@example.com' },
    session: null,
    loading: false,
    error: null,
    signInWithGoogle: async () => ({ }),
    signOut: async () => ({ }),
    clearError: () => {}
  };

  const supabaseConfig = {
    url: 'your-supabase-url',
    anonKey: 'your-supabase-anon-key'
  };

  return (
    <VideoRecorderStandalone
      auth={authContext}
      supabaseConfig={supabaseConfig}
      config={{ format: 'webm', quality: 'high' }}
      onRecordingComplete={(result) => console.log('Done:', result)}
      onError={(error) => console.error('Error:', error)}
    />
  );
}
```

## 📖 API Reference

### VideoRecorder Component

```tsx
interface VideoRecorderProps {
  config?: Partial<RecordingConfig>;
  onRecordingComplete?: (result: UploadResult) => void;
  onError?: (error: string) => void;
  className?: string;
}

interface RecordingConfig {
  format: 'webm' | 'mp4';
  quality: 'low' | 'medium' | 'high' | 'lossless';
  maxDuration: number; // seconds
  maxFileSize: number; // bytes
}
```

### VideoGallery Component

```tsx
interface VideoGalleryProps {
  onVideoSelect?: (video: VideoRecord) => void;
  onVideoDelete?: (videoId: string) => void;
  className?: string;
}

interface VideoRecord {
  id: string;
  filename: string;
  filePath: string;
  fileSize: number;
  duration: number;
  format: string;
  quality: string;
  resolution?: { width: number; height: number };
  thumbnailPath?: string;
  metadata: Record<string, any>;
  status: 'uploaded' | 'processing' | 'processed' | 'error';
  createdAt: string;
}
```

### VideoBuffer Service

```tsx
import { VideoBuffer } from 'react-video-recorder-buffer';

const buffer = new VideoBuffer('recording-id', {
  maxSize: 100 * 1024 * 1024, // 100MB
  maxDuration: 1800, // 30 minutes
  chunkInterval: 1000, // 1 second chunks
  autoFlush: true // Auto-flush to IndexedDB
});

// Initialize buffer
buffer.initialize();

// Add recording chunks
buffer.addChunk(videoBlob);

// Get buffer statistics
const stats = buffer.getStats();

// Create final video file
const finalVideo = await buffer.createCompleteFinalBlob('video/webm');

// Clean up
await buffer.clear();
```

### VideoUploadService

```tsx
import { VideoUploadService } from 'react-video-recorder-buffer';

const uploadService = new VideoUploadService({
  chunkSize: 5 * 1024 * 1024, // 5MB chunks
  maxRetries: 3,
  timeout: 60000, // 1 minute
  enableCompression: false
});

// Upload video with progress tracking
const result = await uploadService.uploadVideo(
  videoBlob,
  'my-video.webm',
  {
    duration: 120,
    format: 'webm',
    quality: 'high'
  },
  (progress) => {
    console.log(`Upload: ${progress.percentage}%`);
  }
);

// Cancel upload
uploadService.cancelUpload(uploadId);
```

## 🗄️ Database Setup

### Supabase Schema

```sql
-- Create videos table
CREATE TABLE videos (
    id TEXT PRIMARY KEY,
    upload_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    duration DECIMAL(10,2) DEFAULT 0,
    format TEXT NOT NULL,
    quality TEXT NOT NULL,
    resolution JSONB,
    thumbnail_path TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'uploaded',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can manage their own videos"
    ON videos FOR ALL
    USING (auth.uid() = user_id);
```

### Storage Buckets

Create a `videos` bucket in your Supabase storage with appropriate policies:

```sql
-- Allow users to upload their own videos
CREATE POLICY "Users can upload videos" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to view their own videos
CREATE POLICY "Users can view own videos" ON storage.objects
    FOR SELECT USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);
```

## ⚙️ Configuration Options

### Buffer Configuration

```tsx
interface BufferConfig {
  maxSize: number;                  // Max buffer size in memory (bytes)
  maxDuration: number;              // Max duration before auto-stop (seconds)
  chunkInterval: number;            // Recording chunk interval (milliseconds)
  compressionLevel: 'none' | 'low' | 'medium' | 'high';
  autoFlush: boolean;               // Auto-flush to IndexedDB when limits reached
}
```

### Upload Configuration

```tsx
interface UploadConfig {
  chunkSize: number;                // Upload chunk size (bytes)
  maxRetries: number;               // Maximum retry attempts
  timeout: number;                  // Request timeout (milliseconds)
  compressionQuality: number;       // Client-side compression (0-1)
  enableCompression: boolean;       // Enable client-side compression
}
```

## 🎨 Styling

The components use Tailwind CSS classes by default, but you can customize the styling:

```tsx
<VideoRecorder
  className="my-custom-recorder"
  config={{ format: 'webm' }}
/>
```

```css
/* Custom styling */
.my-custom-recorder {
  @apply max-w-4xl mx-auto p-6;
}

.my-custom-recorder .video-preview {
  @apply rounded-xl shadow-lg;
}
```

## 🔧 Advanced Examples

### Custom Upload Endpoint

```tsx
// Create custom upload service
class CustomUploadService extends VideoUploadService {
  async uploadVideo(blob, filename, metadata, onProgress) {
    // Custom upload logic to your own backend
    const formData = new FormData();
    formData.append('video', blob);
    formData.append('metadata', JSON.stringify(metadata));

    const response = await fetch('/api/custom-upload', {
      method: 'POST',
      body: formData
    });

    return await response.json();
  }
}

// Use custom service
const customService = new CustomUploadService();
```

### Real-time Recording Analytics

```tsx
import { VideoBuffer } from 'react-video-recorder-buffer';

function RecordingAnalytics() {
  const [analytics, setAnalytics] = useState({
    bitrate: 0,
    fps: 0,
    compressionRatio: 0
  });

  useEffect(() => {
    const interval = setInterval(() => {
      if (bufferRef.current) {
        const stats = bufferRef.current.getStats();
        setAnalytics({
          bitrate: (stats.totalSize * 8) / stats.totalDuration,
          fps: stats.chunkCount / stats.totalDuration,
          compressionRatio: stats.totalSize / (stats.totalDuration * 1920 * 1080 * 3)
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="analytics-panel">
      <div>Bitrate: {analytics.bitrate.toFixed(0)} bps</div>
      <div>FPS: {analytics.fps.toFixed(1)}</div>
      <div>Compression: {(analytics.compressionRatio * 100).toFixed(1)}%</div>
    </div>
  );
}
```

### Batch Processing

```tsx
import { VideoUploadService } from 'react-video-recorder-buffer';

async function batchUpload(recordings: Blob[]) {
  const uploadService = new VideoUploadService();
  const uploads = recordings.map((blob, index) =>
    uploadService.uploadVideo(
      blob,
      `batch-recording-${index}.webm`,
      { quality: 'medium', format: 'webm' }
    )
  );

  const results = await Promise.allSettled(uploads);

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      console.log(`Upload ${index} successful:`, result.value);
    } else {
      console.error(`Upload ${index} failed:`, result.reason);
    }
  });
}
```

## 🌐 Browser Support

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| MediaRecorder API | ✅ 47+ | ✅ 25+ | ✅ 14+ | ✅ 79+ |
| IndexedDB | ✅ | ✅ | ✅ | ✅ |
| WebRTC getUserMedia | ✅ | ✅ | ✅ | ✅ |
| Blob/File APIs | ✅ | ✅ | ✅ | ✅ |

### Progressive Enhancement

```tsx
import { VideoRecorder } from 'react-video-recorder-buffer';

function ProgressiveVideoRecorder() {
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    const checkSupport = () => {
      const hasMediaRecorder = typeof MediaRecorder !== 'undefined';
      const hasGetUserMedia = navigator?.mediaDevices?.getUserMedia;
      const hasIndexedDB = typeof indexedDB !== 'undefined';

      setIsSupported(hasMediaRecorder && hasGetUserMedia && hasIndexedDB);
    };

    checkSupport();
  }, []);

  if (!isSupported) {
    return (
      <div className="unsupported-browser">
        <p>Video recording is not supported in this browser.</p>
        <p>Please use Chrome 47+, Firefox 25+, Safari 14+, or Edge 79+.</p>
      </div>
    );
  }

  return <VideoRecorder config={{ format: 'webm' }} />;
}
```

## 🔒 Security Considerations

### Authentication
- All API endpoints validate JWT tokens
- Row Level Security (RLS) enabled on database tables
- Upload size limits to prevent abuse

### Data Protection
- Automatic cleanup of temporary files and buffers
- Secure file paths with user ID isolation
- Metadata sanitization to prevent injection attacks

### Best Practices

```tsx
// Validate file types
const ALLOWED_TYPES = ['video/webm', 'video/mp4'];

function validateFile(file: File): boolean {
  return ALLOWED_TYPES.includes(file.type) && file.size <= 500 * 1024 * 1024;
}

// Sanitize metadata
function sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
  return Object.keys(metadata).reduce((clean, key) => {
    const value = metadata[key];
    if (typeof value === 'string') {
      clean[key] = value.replace(/<script[^>]*>.*?<\/script>/gi, '');
    } else {
      clean[key] = value;
    }
    return clean;
  }, {});
}
```

## 🧪 Testing

### Unit Tests

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { VideoRecorder } from 'react-video-recorder-buffer';

test('renders video recorder component', () => {
  render(<VideoRecorder />);
  expect(screen.getByText('Start Recording')).toBeInTheDocument();
});

test('handles recording start', async () => {
  const mockGetUserMedia = jest.fn().mockResolvedValue(new MediaStream());
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: mockGetUserMedia }
  });

  render(<VideoRecorder />);
  fireEvent.click(screen.getByText('Start Recording'));

  expect(mockGetUserMedia).toHaveBeenCalledWith({
    video: expect.objectContaining({
      width: { ideal: 1280 },
      height: { ideal: 720 }
    }),
    audio: expect.any(Object)
  });
});
```

### Integration Tests

```tsx
import { VideoBuffer } from 'react-video-recorder-buffer';

test('buffer management', async () => {
  const buffer = new VideoBuffer('test-recording');
  buffer.initialize();

  const testBlob = new Blob(['test'], { type: 'video/webm' });
  buffer.addChunk(testBlob);

  const stats = buffer.getStats();
  expect(stats.chunkCount).toBe(1);
  expect(stats.totalSize).toBe(testBlob.size);

  await buffer.clear();
});
```

## 🚀 Deployment

### Vercel

```json
{
  "functions": {
    "api/video/upload.ts": {
      "maxDuration": 300
    }
  }
}
```

### Netlify

```toml
[functions]
  directory = "api"

[[functions]]
  name = "upload"
  timeout = 300
```

### Environment Variables

```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## 📈 Performance Optimization

### Memory Management

```tsx
// Optimize buffer size based on available memory
const getOptimalBufferSize = (): number => {
  const memory = (navigator as any).deviceMemory;
  if (!memory) return 50 * 1024 * 1024; // Default 50MB

  if (memory >= 8) return 200 * 1024 * 1024; // 200MB for high-end
  if (memory >= 4) return 100 * 1024 * 1024; // 100MB for mid-range
  return 50 * 1024 * 1024; // 50MB for low-end
};

<VideoRecorder
  config={{
    maxFileSize: getOptimalBufferSize(),
    format: 'webm',
    quality: 'medium'
  }}
/>
```

### Lazy Loading

```tsx
import { lazy, Suspense } from 'react';

const VideoRecorder = lazy(() =>
  import('react-video-recorder-buffer').then(module => ({
    default: module.VideoRecorder
  }))
);

function App() {
  return (
    <Suspense fallback={<div>Loading video recorder...</div>}>
      <VideoRecorder />
    </Suspense>
  );
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Setup

```bash
git clone https://github.com/kajicadjuric/react-video-recorder-buffer.git
cd react-video-recorder-buffer
npm install
npm run dev
```

### Running Tests

```bash
npm test              # Run tests once
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Run tests with coverage
```

## 📄 License

MIT © [Kai Djuric](https://github.com/kajicadjuric)

## 🔗 Links

- [GitHub Repository](https://github.com/kajicadjuric/react-video-recorder-buffer)
- [npm Package](https://www.npmjs.com/package/react-video-recorder-buffer)
- [Documentation](https://github.com/kajicadjuric/react-video-recorder-buffer/blob/main/docs/video-recording-system.md)
- [Examples](https://github.com/kajicadjuric/react-video-recorder-buffer/tree/main/examples)

## 📋 Changelog

### v1.0.0
- Initial release with comprehensive video recording system
- Buffer-first architecture with progressive upload
- Real-time monitoring and gallery management
- Full TypeScript support
- Comprehensive documentation and examples

---

**Made with ❤️ for the React community**