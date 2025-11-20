/**
 * Advanced Usage Example
 *
 * Advanced implementation with custom configuration, analytics,
 * and custom upload handling
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  VideoRecorder,
  VideoGallery,
  VideoBuffer,
  VideoUploadService,
  UploadResult,
  VideoRecord,
  BufferStats,
  UploadProgress
} from '../src';

export function AdvancedUsageExample() {
  const [analytics, setAnalytics] = useState({
    totalRecordings: 0,
    totalSize: 0,
    averageDuration: 0,
    successRate: 100
  });
  const [bufferStats, setBufferStats] = useState<BufferStats | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [recordings, setRecordings] = useState<UploadResult[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  // Custom upload service with enhanced configuration
  const uploadService = useRef(new VideoUploadService({
    chunkSize: 10 * 1024 * 1024, // 10MB chunks for faster upload
    maxRetries: 5,
    timeout: 120000, // 2 minutes
    enableCompression: true,
    compressionQuality: 0.85
  }));

  // Real-time analytics updates
  useEffect(() => {
    const successfulUploads = recordings.filter(r => r.success);
    const totalSize = successfulUploads.reduce((sum, r) => sum + (r.metadata?.size || 0), 0);
    const averageDuration = successfulUploads.length > 0
      ? successfulUploads.reduce((sum, r) => sum + (r.metadata?.duration || 0), 0) / successfulUploads.length
      : 0;

    setAnalytics({
      totalRecordings: recordings.length,
      totalSize,
      averageDuration,
      successRate: recordings.length > 0 ? (successfulUploads.length / recordings.length) * 100 : 100
    });
  }, [recordings]);

  const handleRecordingComplete = (result: UploadResult) => {
    setRecordings(prev => [...prev, result]);

    if (result.success) {
      console.log('Advanced upload completed:', {
        uploadId: result.uploadId,
        size: result.metadata?.size,
        duration: result.metadata?.duration,
        publicUrl: result.publicUrl
      });
    } else {
      setErrors(prev => [...prev, result.error || 'Unknown upload error']);
    }
  };

  const handleError = (error: string) => {
    setErrors(prev => [...prev, error]);
    console.error('Advanced recording error:', error);
  };

  const handleBufferUpdate = (stats: BufferStats) => {
    setBufferStats(stats);
  };

  const handleUploadProgress = (progress: UploadProgress) => {
    setUploadProgress(prev => {
      const index = prev.findIndex(p => p.uploadId === progress.uploadId);
      if (index >= 0) {
        const updated = [...prev];
        updated[index] = progress;
        return updated;
      }
      return [...prev, progress];
    });
  };

  const clearError = (index: number) => {
    setErrors(prev => prev.filter((_, i) => i !== index));
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Advanced Video Recording Example
        </h1>
        <p className="text-gray-600">
          Enhanced implementation with analytics, custom upload configuration, and real-time monitoring
        </p>
      </header>

      {/* Analytics Dashboard */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Recording Analytics</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-600">{analytics.totalRecordings}</div>
            <div className="text-sm text-gray-600">Total Recordings</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-600">{formatBytes(analytics.totalSize)}</div>
            <div className="text-sm text-gray-600">Total Size</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-purple-600">{formatDuration(analytics.averageDuration)}</div>
            <div className="text-sm text-gray-600">Avg Duration</div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-yellow-600">{analytics.successRate.toFixed(1)}%</div>
            <div className="text-sm text-gray-600">Success Rate</div>
          </div>
        </div>
      </section>

      {/* Error Panel */}
      {errors.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4 text-red-600">Errors</h2>
          <div className="space-y-2">
            {errors.map((error, index) => (
              <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-4 flex justify-between items-center">
                <span className="text-red-800">{error}</span>
                <button
                  onClick={() => clearError(index)}
                  className="text-red-600 hover:text-red-800 font-bold"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Real-time Buffer Stats */}
      {bufferStats && (
        <section>
          <h2 className="text-xl font-semibold mb-4">Buffer Status</h2>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div>
                <strong>Duration:</strong>
                <div>{formatDuration(bufferStats.totalDuration)}</div>
              </div>
              <div>
                <strong>Size:</strong>
                <div>{formatBytes(bufferStats.totalSize)}</div>
              </div>
              <div>
                <strong>Chunks:</strong>
                <div>{bufferStats.chunkCount}</div>
              </div>
              <div>
                <strong>Memory:</strong>
                <div>{formatBytes(bufferStats.memoryUsage)}</div>
              </div>
              <div>
                <strong>Status:</strong>
                <div className={bufferStats.isNearLimit ? 'text-red-500 font-bold' : 'text-green-500'}>
                  {bufferStats.isNearLimit ? 'Near Limit' : 'OK'}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Upload Progress */}
      {uploadProgress.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4">Upload Progress</h2>
          <div className="space-y-2">
            {uploadProgress.filter(p => p.status !== 'completed').map(progress => (
              <div key={progress.uploadId} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Upload {progress.uploadId.split('_')[2]}</span>
                  <span className="text-sm">{progress.percentage.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress.percentage}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{formatBytes(progress.bytesUploaded)} / {formatBytes(progress.totalBytes)}</span>
                  <span>
                    {progress.speed > 0 && `${formatBytes(progress.speed)}/s`}
                    {progress.estimatedTimeRemaining > 0 && ` • ${progress.estimatedTimeRemaining.toFixed(0)}s remaining`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Advanced Video Recorder */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Advanced Recorder</h2>
        <div className="bg-white rounded-lg shadow-lg p-6">
          <VideoRecorder
            config={{
              format: 'webm',
              quality: 'high',
              maxDuration: 3600, // 1 hour
              maxFileSize: 500 * 1024 * 1024 // 500MB
            }}
            onRecordingComplete={handleRecordingComplete}
            onError={handleError}
          />

          {/* Configuration Display */}
          <div className="mt-6 bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium mb-2">Current Configuration</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-600">
              <div>Format: WebM</div>
              <div>Quality: High</div>
              <div>Max Duration: 1 hour</div>
              <div>Max Size: 500MB</div>
            </div>
          </div>
        </div>
      </section>

      {/* Video Gallery with Enhanced Features */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Video Gallery</h2>
        <div className="bg-white rounded-lg shadow-lg p-6">
          <VideoGallery
            onVideoSelect={(video) => {
              console.log('Advanced video selection:', video);
              // Could trigger additional processing, analytics, etc.
            }}
            onVideoDelete={(videoId) => {
              console.log('Advanced video deletion:', videoId);
              // Could trigger cleanup, analytics update, etc.
            }}
          />
        </div>
      </section>

      {/* System Information */}
      <section>
        <h2 className="text-xl font-semibold mb-4">System Information</h2>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <strong>MediaRecorder Support:</strong>
              <span className="ml-2">{typeof MediaRecorder !== 'undefined' ? '✅ Yes' : '❌ No'}</span>
            </div>
            <div>
              <strong>IndexedDB Support:</strong>
              <span className="ml-2">{typeof indexedDB !== 'undefined' ? '✅ Yes' : '❌ No'}</span>
            </div>
            <div>
              <strong>WebRTC Support:</strong>
              <span className="ml-2">{navigator?.mediaDevices?.getUserMedia ? '✅ Yes' : '❌ No'}</span>
            </div>
            <div>
              <strong>Device Memory:</strong>
              <span className="ml-2">{(navigator as any)?.deviceMemory || 'Unknown'} GB</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}