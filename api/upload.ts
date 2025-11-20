/**
 * Video Upload API Endpoint
 *
 * Handles video file uploads with metadata processing and storage.
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface VideoUploadRequest {
  uploadId: string;
  filename: string;
  fileSize: number;
  duration?: number;
  format: string;
  quality: string;
  resolution?: {
    width: number;
    height: number;
  };
  metadata?: Record<string, any>;
}

export interface VideoUploadResponse {
  success: boolean;
  uploadId: string;
  filePath?: string;
  publicUrl?: string;
  thumbnailUrl?: string;
  videoId?: string;
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

    // Parse form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const uploadData = formData.get('data') as string;

    if (!file || !uploadData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing file or metadata' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const requestData: VideoUploadRequest = JSON.parse(uploadData);

    // Validate file size (max 500MB)
    const maxFileSize = 500 * 1024 * 1024; // 500MB
    if (file.size > maxFileSize) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `File too large. Maximum size is ${maxFileSize / (1024 * 1024)}MB`
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Validate file type
    const allowedTypes = ['video/webm', 'video/mp4', 'video/quicktime'];
    if (!allowedTypes.includes(file.type)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid file type. Only WebM, MP4, and QuickTime videos are allowed.'
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Generate file path
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeFilename = requestData.filename
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/__+/g, '_')
      .replace(/^_|_$/g, '');

    const filePath = `videos/${user.id}/${timestamp}_${safeFilename}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('videos')
      .upload(filePath, file, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to upload file to storage'
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

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('videos')
      .getPublicUrl(filePath);

    // Generate unique video ID
    const videoId = `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store video metadata in database
    const { data: dbData, error: dbError } = await supabase
      .from('videos')
      .insert({
        id: videoId,
        upload_id: requestData.uploadId,
        user_id: user.id,
        filename: requestData.filename,
        file_path: filePath,
        file_size: file.size,
        duration: requestData.duration || 0,
        format: requestData.format,
        quality: requestData.quality,
        resolution: requestData.resolution,
        metadata: {
          ...requestData.metadata,
          originalName: file.name,
          uploadedAt: new Date().toISOString(),
          contentType: file.type
        },
        status: 'uploaded',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      // Don't return error here - file was uploaded successfully
      // Just log the error for later debugging
    }

    // Generate thumbnail in background (don't wait for completion)
    generateThumbnail(filePath, user.id, videoId).catch(error => {
      console.error('Thumbnail generation error:', error);
    });

    const response: VideoUploadResponse = {
      success: true,
      uploadId: requestData.uploadId,
      filePath,
      publicUrl: urlData.publicUrl,
      videoId
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Video upload error:', error);

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
 * Generate thumbnail for uploaded video (background process)
 */
async function generateThumbnail(filePath: string, userId: string, videoId: string): Promise<void> {
  try {
    // Get video file from storage
    const { data: videoFile, error: downloadError } = await supabase.storage
      .from('videos')
      .download(filePath);

    if (downloadError || !videoFile) {
      throw new Error('Failed to download video for thumbnail generation');
    }

    // Create video element for thumbnail extraction
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';

    return new Promise((resolve, reject) => {
      video.onloadeddata = async () => {
        try {
          // Seek to middle of video for thumbnail
          video.currentTime = video.duration / 2;

          video.onseeked = async () => {
            try {
              // Create canvas for thumbnail
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');

              if (!ctx) {
                throw new Error('Could not get canvas context');
              }

              // Set canvas dimensions
              const maxWidth = 320;
              const maxHeight = 180;
              const aspectRatio = video.videoWidth / video.videoHeight;

              if (aspectRatio > maxWidth / maxHeight) {
                canvas.width = maxWidth;
                canvas.height = maxWidth / aspectRatio;
              } else {
                canvas.width = maxHeight * aspectRatio;
                canvas.height = maxHeight;
              }

              // Draw video frame to canvas
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

              // Convert to blob
              canvas.toBlob(async (blob) => {
                if (!blob) {
                  throw new Error('Failed to create thumbnail blob');
                }

                // Upload thumbnail to storage
                const thumbnailPath = `thumbnails/${userId}/${videoId}_thumbnail.jpg`;

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

                // Update video record with thumbnail path
                await supabase
                  .from('videos')
                  .update({ thumbnail_path: thumbnailPath })
                  .eq('id', videoId);

                console.log(`Thumbnail generated for video ${videoId}`);
                resolve();

              }, 'image/jpeg', 0.8);
            } catch (error) {
              reject(error);
            }
          };
        } catch (error) {
          reject(error);
        }
      };

      video.onerror = () => reject(new Error('Failed to load video'));
      video.src = URL.createObjectURL(videoFile);
    });

  } catch (error) {
    console.error('Error generating thumbnail:', error);
    throw error;
  }
}