/**
 * Basic Usage Example
 *
 * Simple implementation of video recording with basic configuration
 */

import React, { useState } from 'react';
import { VideoRecorder, VideoGallery, UploadResult, VideoRecord } from '../src';

export function BasicUsageExample() {
  const [recordings, setRecordings] = useState<UploadResult[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<VideoRecord | null>(null);

  const handleRecordingComplete = (result: UploadResult) => {
    setRecordings(prev => [...prev, result]);
    console.log('Recording completed:', result);
  };

  const handleError = (error: string) => {
    console.error('Recording error:', error);
    alert(`Recording error: ${error}`);
  };

  const handleVideoSelect = (video: VideoRecord) => {
    setSelectedVideo(video);
    console.log('Selected video:', video);
  };

  const handleVideoDelete = (videoId: string) => {
    console.log('Video deleted:', videoId);
    // Refresh gallery or update state as needed
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Basic Video Recording Example
        </h1>
        <p className="text-gray-600">
          Simple implementation with default configuration
        </p>
      </header>

      {/* Recording Section */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Record Video</h2>
        <div className="bg-white rounded-lg shadow-md p-6">
          <VideoRecorder
            config={{
              format: 'webm',
              quality: 'medium',
              maxDuration: 600, // 10 minutes
              maxFileSize: 50 * 1024 * 1024 // 50MB
            }}
            onRecordingComplete={handleRecordingComplete}
            onError={handleError}
          />
        </div>
      </section>

      {/* Recent Recordings */}
      {recordings.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4">Recent Recordings</h2>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="space-y-2">
              {recordings.map((recording, index) => (
                <div key={recording.uploadId} className="text-sm">
                  <span className="font-medium">Recording {index + 1}:</span>
                  <span className="ml-2">{recording.metadata?.filename}</span>
                  <span className="ml-2 text-green-600">
                    {recording.success ? '✓ Uploaded' : '✗ Failed'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Gallery Section */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Video Gallery</h2>
        <div className="bg-white rounded-lg shadow-md p-6">
          <VideoGallery
            onVideoSelect={handleVideoSelect}
            onVideoDelete={handleVideoDelete}
          />
        </div>
      </section>

      {/* Selected Video Info */}
      {selectedVideo && (
        <section>
          <h2 className="text-xl font-semibold mb-4">Selected Video</h2>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><strong>Filename:</strong> {selectedVideo.filename}</div>
              <div><strong>Duration:</strong> {selectedVideo.duration}s</div>
              <div><strong>Size:</strong> {(selectedVideo.fileSize / (1024 * 1024)).toFixed(2)}MB</div>
              <div><strong>Format:</strong> {selectedVideo.format.toUpperCase()}</div>
              <div><strong>Quality:</strong> {selectedVideo.quality}</div>
              <div><strong>Status:</strong> {selectedVideo.status}</div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}