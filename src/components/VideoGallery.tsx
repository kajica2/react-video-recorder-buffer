/**
 * Video Gallery Component
 *
 * Displays user's recorded videos with playback, management, and metadata.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { supabase, STORAGE_BUCKETS } from '../../utils/supabaseClient';
import { useAuth } from './AuthProvider';

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

export interface VideoGalleryProps {
  onVideoSelect?: (video: VideoRecord) => void;
  onVideoDelete?: (videoId: string) => void;
  className?: string;
}

export const VideoGallery: React.FC<VideoGalleryProps> = ({
  onVideoSelect,
  onVideoDelete,
  className = ''
}) => {
  const { user } = useAuth();

  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<VideoRecord | null>(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [sortBy, setSortBy] = useState<'created_at' | 'duration' | 'file_size'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterFormat, setFilterFormat] = useState<string>('all');

  /**
   * Load videos from database
   */
  const loadVideos = useCallback(async (): Promise<void> => {
    if (!user) {
      setVideos([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('videos')
        .select('*')
        .eq('user_id', user.id)
        .order(sortBy, { ascending: sortOrder === 'asc' });

      if (fetchError) {
        throw fetchError;
      }

      const videoRecords: VideoRecord[] = (data || []).map(row => ({
        id: row.id,
        uploadId: row.upload_id,
        filename: row.filename,
        filePath: row.file_path,
        fileSize: row.file_size,
        duration: parseFloat(row.duration) || 0,
        format: row.format,
        quality: row.quality,
        resolution: row.resolution,
        thumbnailPath: row.thumbnail_path,
        metadata: row.metadata || {},
        status: row.status,
        createdAt: row.created_at,
        processedAt: row.processed_at
      }));

      setVideos(videoRecords);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load videos';
      setError(errorMessage);
      console.error('Error loading videos:', err);
    } finally {
      setLoading(false);
    }
  }, [user, sortBy, sortOrder]);

  /**
   * Get public URL for video file
   */
  const getVideoUrl = useCallback((filePath: string): string => {
    const { data } = supabase.storage
      .from(STORAGE_BUCKETS.VIDEOS)
      .getPublicUrl(filePath);
    return data.publicUrl;
  }, []);

  /**
   * Get thumbnail URL if available
   */
  const getThumbnailUrl = useCallback((thumbnailPath?: string): string | null => {
    if (!thumbnailPath) return null;
    const { data } = supabase.storage
      .from(STORAGE_BUCKETS.VIDEOS)
      .getPublicUrl(thumbnailPath);
    return data.publicUrl;
  }, []);

  /**
   * Delete video
   */
  const handleDeleteVideo = useCallback(async (video: VideoRecord): Promise<void> => {
    if (!window.confirm(`Are you sure you want to delete "${video.filename}"?`)) {
      return;
    }

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from(STORAGE_BUCKETS.VIDEOS)
        .remove([video.filePath]);

      if (storageError) {
        console.warn('Storage deletion warning:', storageError);
      }

      // Delete thumbnail if exists
      if (video.thumbnailPath) {
        await supabase.storage
          .from(STORAGE_BUCKETS.VIDEOS)
          .remove([video.thumbnailPath]);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('videos')
        .delete()
        .eq('id', video.id);

      if (dbError) {
        throw dbError;
      }

      // Update local state
      setVideos(prev => prev.filter(v => v.id !== video.id));
      onVideoDelete?.(video.id);

      if (selectedVideo?.id === video.id) {
        setSelectedVideo(null);
        setShowPlayer(false);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete video';
      setError(errorMessage);
      console.error('Error deleting video:', err);
    }
  }, [selectedVideo, onVideoDelete]);

  /**
   * Handle video selection
   */
  const handleVideoSelect = useCallback((video: VideoRecord): void => {
    setSelectedVideo(video);
    setShowPlayer(true);
    onVideoSelect?.(video);
  }, [onVideoSelect]);

  /**
   * Filter videos by format
   */
  const filteredVideos = videos.filter(video =>
    filterFormat === 'all' || video.format === filterFormat
  );

  /**
   * Format file size for display
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  /**
   * Format duration for display
   */
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * Format date for display
   */
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Load videos on mount and when dependencies change
  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  // Set up real-time subscription for video updates
  useEffect(() => {
    if (!user) return;

    const subscription = supabase
      .channel('videos_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'videos',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          // Reload videos when changes occur
          loadVideos();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user, loadVideos]);

  if (!user) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <p className="text-gray-500">Please sign in to view your videos.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-500">Loading videos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <div className="text-red-500 mb-4">{error}</div>
        <button
          onClick={loadVideos}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={`video-gallery ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Your Videos ({filteredVideos.length})</h2>

        <div className="flex items-center space-x-4">
          {/* Format Filter */}
          <select
            value={filterFormat}
            onChange={(e) => setFilterFormat(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1 text-sm"
          >
            <option value="all">All Formats</option>
            <option value="webm">WebM</option>
            <option value="mp4">MP4</option>
            <option value="wav">WAV</option>
            <option value="mp3">MP3</option>
          </select>

          {/* Sort Controls */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="border border-gray-300 rounded px-3 py-1 text-sm"
          >
            <option value="created_at">Date</option>
            <option value="duration">Duration</option>
            <option value="file_size">Size</option>
          </select>

          <button
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="text-gray-500 hover:text-gray-700"
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>

          <button
            onClick={loadVideos}
            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Video Grid */}
      {filteredVideos.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">📹</div>
          <p className="text-gray-500 mb-2">No videos found</p>
          <p className="text-sm text-gray-400">
            {filterFormat !== 'all' ? 'Try changing the format filter' : 'Record your first video to get started'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredVideos.map(video => (
            <div key={video.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
              {/* Thumbnail */}
              <div
                className="aspect-video bg-gray-200 relative cursor-pointer group"
                onClick={() => handleVideoSelect(video)}
              >
                {getThumbnailUrl(video.thumbnailPath) ? (
                  <img
                    src={getThumbnailUrl(video.thumbnailPath)!}
                    alt={video.filename}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-gray-400 text-4xl">🎬</div>
                  </div>
                )}

                {/* Play button overlay */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 flex items-center justify-center transition-all">
                  <div className="w-12 h-12 bg-white bg-opacity-0 group-hover:bg-opacity-90 rounded-full flex items-center justify-center transition-all">
                    <div className="w-0 h-0 border-l-[6px] border-l-gray-700 border-y-[4px] border-y-transparent ml-1"></div>
                  </div>
                </div>

                {/* Status indicator */}
                {video.status !== 'processed' && (
                  <div className="absolute top-2 right-2">
                    <div className={`w-2 h-2 rounded-full ${
                      video.status === 'processing' ? 'bg-yellow-500 animate-pulse' :
                      video.status === 'error' ? 'bg-red-500' : 'bg-blue-500'
                    }`} />
                  </div>
                )}

                {/* Duration */}
                <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                  {formatDuration(video.duration)}
                </div>
              </div>

              {/* Video Info */}
              <div className="p-4">
                <h3 className="font-medium text-sm mb-2 truncate" title={video.filename}>
                  {video.filename}
                </h3>

                <div className="space-y-1 text-xs text-gray-500">
                  <div className="flex justify-between">
                    <span>Size:</span>
                    <span>{formatFileSize(video.fileSize)}</span>
                  </div>

                  <div className="flex justify-between">
                    <span>Format:</span>
                    <span className="uppercase">{video.format}</span>
                  </div>

                  {video.resolution && (
                    <div className="flex justify-between">
                      <span>Resolution:</span>
                      <span>{video.resolution.width}×{video.resolution.height}</span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span>Quality:</span>
                    <span className="capitalize">{video.quality}</span>
                  </div>

                  <div className="flex justify-between">
                    <span>Created:</span>
                    <span>{formatDate(video.createdAt)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t">
                  <button
                    onClick={() => handleVideoSelect(video)}
                    className="text-blue-500 hover:text-blue-600 text-xs"
                  >
                    Play
                  </button>

                  <button
                    onClick={() => handleDeleteVideo(video)}
                    className="text-red-500 hover:text-red-600 text-xs"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Video Player Modal */}
      {showPlayer && selectedVideo && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-full overflow-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-medium">{selectedVideo.filename}</h3>
              <button
                onClick={() => {
                  setShowPlayer(false);
                  setSelectedVideo(null);
                }}
                className="text-gray-500 hover:text-gray-700 text-xl"
              >
                ×
              </button>
            </div>

            <div className="p-4">
              <video
                controls
                autoPlay
                className="w-full max-h-96 bg-black"
                src={getVideoUrl(selectedVideo.filePath)}
              >
                Your browser does not support video playback.
              </video>

              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Duration:</strong> {formatDuration(selectedVideo.duration)}
                </div>
                <div>
                  <strong>Size:</strong> {formatFileSize(selectedVideo.fileSize)}
                </div>
                <div>
                  <strong>Format:</strong> {selectedVideo.format.toUpperCase()}
                </div>
                <div>
                  <strong>Quality:</strong> {selectedVideo.quality}
                </div>
                {selectedVideo.resolution && (
                  <>
                    <div>
                      <strong>Resolution:</strong> {selectedVideo.resolution.width}×{selectedVideo.resolution.height}
                    </div>
                    <div>
                      <strong>Aspect Ratio:</strong> {(selectedVideo.resolution.width / selectedVideo.resolution.height).toFixed(2)}
                    </div>
                  </>
                )}
                <div>
                  <strong>Created:</strong> {formatDate(selectedVideo.createdAt)}
                </div>
                <div>
                  <strong>Status:</strong> {selectedVideo.status}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};