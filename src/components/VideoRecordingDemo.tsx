/**
 * Video Recording Demo Component
 *
 * Comprehensive demonstration of the video recording system including:
 * - Recording with buffer management
 * - Progressive upload with progress tracking
 * - Video gallery with playback
 * - Error handling and recovery
 */

import React, { useState, useCallback } from 'react';
import { VideoRecorder } from './VideoRecorder';
import { VideoGallery } from './VideoGallery';
import { UploadResult } from '../services/VideoUploadService';
import { VideoRecord } from './VideoGallery';
import { useAuth } from './AuthProvider';

export interface VideoRecordingDemoProps {
  className?: string;
}

type ViewMode = 'recorder' | 'gallery' | 'both';

export const VideoRecordingDemo: React.FC<VideoRecordingDemoProps> = ({
  className = ''
}) => {
  const { user } = useAuth();

  const [viewMode, setViewMode] = useState<ViewMode>('both');
  const [recentUploads, setRecentUploads] = useState<UploadResult[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<VideoRecord | null>(null);
  const [notifications, setNotifications] = useState<{ id: string; type: 'success' | 'error'; message: string; }[]>([]);

  /**
   * Add notification
   */
  const addNotification = useCallback((type: 'success' | 'error', message: string): void => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [...prev, { id, type, message }]);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  }, []);

  /**
   * Handle successful recording upload
   */
  const handleRecordingComplete = useCallback((result: UploadResult): void => {
    setRecentUploads(prev => [result, ...prev.slice(0, 4)]); // Keep last 5
    addNotification('success', `Video "${result.metadata?.filename}" uploaded successfully!`);
  }, [addNotification]);

  /**
   * Handle recording errors
   */
  const handleRecordingError = useCallback((error: string): void => {
    addNotification('error', `Recording error: ${error}`);
  }, [addNotification]);

  /**
   * Handle video selection from gallery
   */
  const handleVideoSelect = useCallback((video: VideoRecord): void => {
    setSelectedVideo(video);
    addNotification('success', `Selected video: ${video.filename}`);
  }, [addNotification]);

  /**
   * Handle video deletion
   */
  const handleVideoDelete = useCallback((videoId: string): void => {
    setSelectedVideo(prev => prev?.id === videoId ? null : prev);
    addNotification('success', 'Video deleted successfully');
  }, [addNotification]);

  /**
   * Remove notification
   */
  const removeNotification = useCallback((id: string): void => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  if (!user) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <div className="text-gray-400 text-6xl mb-4">🔐</div>
        <h2 className="text-2xl font-bold text-gray-700 mb-2">Authentication Required</h2>
        <p className="text-gray-500">Please sign in to access the video recording system.</p>
      </div>
    );
  }

  return (
    <div className={`video-recording-demo ${className}`}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Video Recording System</h1>
        <p className="text-gray-600">
          Record videos with real-time buffering, progressive upload, and comprehensive gallery management.
        </p>
      </div>

      {/* View Mode Selector */}
      <div className="mb-6">
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-700">View:</span>
          <div className="flex rounded-md shadow-sm">
            <button
              onClick={() => setViewMode('recorder')}
              className={`px-4 py-2 text-sm font-medium rounded-l-md border ${
                viewMode === 'recorder'
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Recorder Only
            </button>
            <button
              onClick={() => setViewMode('gallery')}
              className={`px-4 py-2 text-sm font-medium border-t border-b ${
                viewMode === 'gallery'
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Gallery Only
            </button>
            <button
              onClick={() => setViewMode('both')}
              className={`px-4 py-2 text-sm font-medium rounded-r-md border ${
                viewMode === 'both'
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Both
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="mb-6">
          <div className="space-y-2">
            {notifications.map(notification => (
              <div
                key={notification.id}
                className={`p-4 rounded-md flex items-center justify-between ${
                  notification.type === 'success'
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                <div className="flex items-center">
                  <span className={`mr-2 ${
                    notification.type === 'success' ? '✅' : '❌'
                  }`}>
                  </span>
                  {notification.message}
                </div>
                <button
                  onClick={() => removeNotification(notification.id)}
                  className="text-sm opacity-70 hover:opacity-100"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Uploads Summary */}
      {recentUploads.length > 0 && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-md p-4">
          <h3 className="text-sm font-medium text-green-800 mb-2">Recent Uploads</h3>
          <div className="space-y-1">
            {recentUploads.map((upload, index) => (
              <div key={upload.uploadId} className="text-sm text-green-700">
                {index + 1}. {upload.metadata?.filename} - {upload.success ? '✓ Success' : '✗ Failed'}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected Video Info */}
      {selectedVideo && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-md p-4">
          <h3 className="text-sm font-medium text-blue-800 mb-2">Selected Video</h3>
          <div className="text-sm text-blue-700">
            <strong>{selectedVideo.filename}</strong> -
            {Math.round(selectedVideo.duration)}s,
            {(selectedVideo.fileSize / (1024 * 1024)).toFixed(1)}MB,
            {selectedVideo.format.toUpperCase()}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className={`grid gap-8 ${
        viewMode === 'both' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
      }`}>
        {/* Video Recorder */}
        {(viewMode === 'recorder' || viewMode === 'both') && (
          <div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">Record New Video</h2>
              <VideoRecorder
                config={{
                  format: 'webm',
                  quality: 'high',
                  maxDuration: 1800, // 30 minutes
                  maxFileSize: 100 * 1024 * 1024 // 100MB
                }}
                onRecordingComplete={handleRecordingComplete}
                onError={handleRecordingError}
                className="w-full"
              />

              {/* Recording Tips */}
              <div className="mt-6 bg-gray-50 rounded-md p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">💡 Recording Tips</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Ensure good lighting for better video quality</li>
                  <li>• Test your microphone before recording</li>
                  <li>• Keep recordings under 30 minutes for optimal performance</li>
                  <li>• Videos are automatically uploaded when recording stops</li>
                  <li>• Thumbnails are generated automatically after upload</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Video Gallery */}
        {(viewMode === 'gallery' || viewMode === 'both') && (
          <div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <VideoGallery
                onVideoSelect={handleVideoSelect}
                onVideoDelete={handleVideoDelete}
                className="w-full"
              />
            </div>
          </div>
        )}
      </div>

      {/* System Information */}
      <div className="mt-8 bg-gray-50 rounded-md p-6">
        <h2 className="text-lg font-semibold mb-4">System Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <div>
            <strong className="text-gray-700">Supported Formats:</strong>
            <div className="text-gray-600">WebM, MP4, QuickTime</div>
          </div>
          <div>
            <strong className="text-gray-700">Quality Options:</strong>
            <div className="text-gray-600">Low, Medium, High, Lossless</div>
          </div>
          <div>
            <strong className="text-gray-700">Max File Size:</strong>
            <div className="text-gray-600">500MB per video</div>
          </div>
          <div>
            <strong className="text-gray-700">Max Duration:</strong>
            <div className="text-gray-600">30 minutes per video</div>
          </div>
          <div>
            <strong className="text-gray-700">Storage:</strong>
            <div className="text-gray-600">Supabase Cloud Storage</div>
          </div>
          <div>
            <strong className="text-gray-700">Features:</strong>
            <div className="text-gray-600">Auto-thumbnails, Real-time buffer</div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-2">How It Works</h3>
          <ol className="text-sm text-gray-600 space-y-1">
            <li>1. <strong>Record:</strong> Video is captured to memory buffer in real-time chunks</li>
            <li>2. <strong>Buffer Management:</strong> Large recordings automatically flush to IndexedDB</li>
            <li>3. <strong>Upload:</strong> Progressive upload with retry logic and progress tracking</li>
            <li>4. <strong>Processing:</strong> Server generates thumbnails and extracts metadata</li>
            <li>5. <strong>Gallery:</strong> Videos are available for playback and management</li>
          </ol>
        </div>
      </div>
    </div>
  );
};