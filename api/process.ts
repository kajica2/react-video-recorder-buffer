/**
 * Video Processing API Endpoint
 *
 * Handles post-upload video processing including thumbnail generation,
 * metadata extraction, and format optimization.
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface ProcessingRequest {
  videoId: string;
  operations: ProcessingOperation[];
}

export interface ProcessingOperation {
  type: 'thumbnail' | 'metadata' | 'compress' | 'format_convert';
  options?: Record<string, any>;
}

export interface ProcessingResponse {
  success: boolean;
  videoId: string;
  results: ProcessingResult[];
  error?: string;
}

export interface ProcessingResult {
  operation: string;
  success: boolean;
  outputPath?: string;
  metadata?: Record<string, any>;
  error?: string;
}

export default async function handler(req: Request): Promise<Response> {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  try {
    // Get authorization token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const token = authHeader.split(' ')[1];

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid token' }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Parse request
    const requestData: ProcessingRequest = await req.json();

    if (!requestData.videoId || !requestData.operations) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing videoId or operations' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Get video record
    const { data: videoRecord, error: videoError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', requestData.videoId)
      .eq('user_id', user.id)
      .single();

    if (videoError || !videoRecord) {
      return new Response(
        JSON.stringify({ success: false, error: 'Video not found' }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Process operations
    const results: ProcessingResult[] = [];

    for (const operation of requestData.operations) {
      try {
        let result: ProcessingResult;

        switch (operation.type) {
          case 'thumbnail':
            result = await generateThumbnail(videoRecord, operation.options);
            break;

          case 'metadata':
            result = await extractMetadata(videoRecord, operation.options);
            break;

          case 'compress':
            result = await compressVideo(videoRecord, operation.options);
            break;

          case 'format_convert':
            result = await convertFormat(videoRecord, operation.options);
            break;

          default:
            result = {
              operation: operation.type,
              success: false,
              error: `Unknown operation type: ${operation.type}`
            };
        }

        results.push(result);

      } catch (error) {
        results.push({
          operation: operation.type,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Update video status
    await supabase
      .from('videos')
      .update({
        status: 'processed',
        processed_at: new Date().toISOString()
      })
      .eq('id', requestData.videoId);

    const response: ProcessingResponse = {
      success: true,
      videoId: requestData.videoId,
      results
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Video processing error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}

/**
 * Generate thumbnail from video
 */
async function generateThumbnail(
  videoRecord: any,
  options: Record<string, any> = {}
): Promise<ProcessingResult> {
  try {
    const { width = 320, height = 180, quality = 0.8, timestamp = null } = options;

    // Download video file
    const { data: videoFile, error: downloadError } = await supabase.storage
      .from('videos')
      .download(videoRecord.file_path);

    if (downloadError || !videoFile) {
      throw new Error('Failed to download video file');
    }

    // Create video element for processing
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';

    return new Promise((resolve, reject) => {
      video.onloadedmetadata = () => {
        // Calculate thumbnail timestamp
        const thumbTimestamp = timestamp !== null ? timestamp : video.duration / 2;
        video.currentTime = Math.min(thumbTimestamp, video.duration - 1);

        video.onseeked = async () => {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (!ctx) {
              throw new Error('Could not get canvas context');
            }

            // Calculate dimensions maintaining aspect ratio
            const aspectRatio = video.videoWidth / video.videoHeight;
            if (aspectRatio > width / height) {
              canvas.width = width;
              canvas.height = width / aspectRatio;
            } else {
              canvas.width = height * aspectRatio;
              canvas.height = height;
            }

            // Draw video frame
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Convert to blob
            canvas.toBlob(async (blob) => {
              if (!blob) {
                throw new Error('Failed to create thumbnail blob');
              }

              // Upload thumbnail
              const thumbnailPath = `thumbnails/${videoRecord.user_id}/${videoRecord.id}_${Date.now()}.jpg`;

              const { error: uploadError } = await supabase.storage
                .from('videos')
                .upload(thumbnailPath, blob, {
                  contentType: 'image/jpeg',
                  cacheControl: '3600',
                  upsert: true
                });

              if (uploadError) {
                throw uploadError;
              }

              // Update video record
              await supabase
                .from('videos')
                .update({ thumbnail_path: thumbnailPath })
                .eq('id', videoRecord.id);

              resolve({
                operation: 'thumbnail',
                success: true,
                outputPath: thumbnailPath,
                metadata: {
                  width: canvas.width,
                  height: canvas.height,
                  timestamp: thumbTimestamp,
                  fileSize: blob.size
                }
              });

            }, 'image/jpeg', quality);

          } catch (error) {
            reject(error);
          }
        };
      };

      video.onerror = () => reject(new Error('Failed to load video'));
      video.src = URL.createObjectURL(videoFile);
    });

  } catch (error) {
    return {
      operation: 'thumbnail',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Extract video metadata
 */
async function extractMetadata(
  videoRecord: any,
  options: Record<string, any> = {}
): Promise<ProcessingResult> {
  try {
    // Download video file
    const { data: videoFile, error: downloadError } = await supabase.storage
      .from('videos')
      .download(videoRecord.file_path);

    if (downloadError || !videoFile) {
      throw new Error('Failed to download video file');
    }

    // Create video element for metadata extraction
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';

    return new Promise((resolve) => {
      video.onloadedmetadata = async () => {
        const metadata = {
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
          aspectRatio: video.videoWidth / video.videoHeight,
          fileSize: videoFile.size,
          hasAudio: false, // Would need more complex detection
          frameRate: null, // Not directly available in browser
          bitrate: Math.round((videoFile.size * 8) / video.duration), // Estimated
          extractedAt: new Date().toISOString()
        };

        // Update video record with extracted metadata
        await supabase
          .from('videos')
          .update({
            duration: metadata.duration,
            resolution: {
              width: metadata.width,
              height: metadata.height
            },
            metadata: {
              ...videoRecord.metadata,
              extracted: metadata
            }
          })
          .eq('id', videoRecord.id);

        resolve({
          operation: 'metadata',
          success: true,
          metadata
        });
      };

      video.onerror = () => {
        resolve({
          operation: 'metadata',
          success: false,
          error: 'Failed to load video for metadata extraction'
        });
      };

      video.src = URL.createObjectURL(videoFile);
    });

  } catch (error) {
    return {
      operation: 'metadata',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Compress video (placeholder - would require server-side processing)
 */
async function compressVideo(
  videoRecord: any,
  options: Record<string, any> = {}
): Promise<ProcessingResult> {
  // Video compression requires server-side processing with tools like FFmpeg
  // This is a placeholder implementation

  return {
    operation: 'compress',
    success: false,
    error: 'Video compression not implemented. Requires server-side processing.'
  };
}

/**
 * Convert video format (placeholder - would require server-side processing)
 */
async function convertFormat(
  videoRecord: any,
  options: Record<string, any> = {}
): Promise<ProcessingResult> {
  // Format conversion requires server-side processing with tools like FFmpeg
  // This is a placeholder implementation

  return {
    operation: 'format_convert',
    success: false,
    error: 'Format conversion not implemented. Requires server-side processing.'
  };
}