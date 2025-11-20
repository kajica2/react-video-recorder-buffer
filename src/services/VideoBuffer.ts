/**
 * Video Buffer Service
 *
 * Manages video recording buffers with chunk-based accumulation,
 * memory management, and progressive upload preparation.
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

export class VideoBuffer {
  private chunks: VideoChunk[] = [];
  private config: BufferConfig;
  private startTime: number = 0;
  private recordingId: string;
  private indexedDBName: string = 'VideoRecordingBuffer';

  constructor(recordingId: string, config?: Partial<BufferConfig>) {
    this.recordingId = recordingId;
    this.config = {
      maxSize: 100 * 1024 * 1024, // 100MB default
      maxDuration: 1800, // 30 minutes default
      chunkInterval: 1000, // 1 second chunks
      compressionLevel: 'medium',
      autoFlush: true,
      ...config
    };
  }

  /**
   * Initialize buffer for new recording
   */
  initialize(): void {
    this.chunks = [];
    this.startTime = Date.now();
  }

  /**
   * Add new chunk to buffer
   */
  addChunk(blob: Blob): void {
    const now = Date.now();
    const chunk: VideoChunk = {
      blob,
      timestamp: now,
      size: blob.size,
      duration: (now - this.startTime) / 1000
    };

    this.chunks.push(chunk);

    // Check limits and auto-flush if needed
    if (this.config.autoFlush && this.isNearLimit()) {
      this.flushToIndexedDB();
    }
  }

  /**
   * Get buffer statistics
   */
  getStats(): BufferStats {
    const totalSize = this.chunks.reduce((sum, chunk) => sum + chunk.size, 0);
    const totalDuration = this.chunks.length > 0
      ? (Date.now() - this.startTime) / 1000
      : 0;

    return {
      totalSize,
      totalDuration,
      chunkCount: this.chunks.length,
      memoryUsage: this.estimateMemoryUsage(),
      isNearLimit: this.isNearLimit()
    };
  }

  /**
   * Check if buffer is near configured limits
   */
  isNearLimit(): boolean {
    const stats = this.getStats();
    const sizeLimit = stats.totalSize >= this.config.maxSize * 0.8; // 80% of max
    const durationLimit = stats.totalDuration >= this.config.maxDuration * 0.8; // 80% of max

    return sizeLimit || durationLimit;
  }

  /**
   * Create final recording blob from all chunks
   */
  createFinalBlob(mimeType: string = 'video/webm'): Blob {
    const allBlobs = this.chunks.map(chunk => chunk.blob);
    return new Blob(allBlobs, { type: mimeType });
  }

  /**
   * Flush current chunks to IndexedDB for temporary storage
   */
  async flushToIndexedDB(): Promise<void> {
    if (this.chunks.length === 0) return;

    try {
      const db = await this.openIndexedDB();
      const transaction = db.transaction(['chunks'], 'readwrite');
      const store = transaction.objectStore('chunks');

      // Store each chunk
      for (const chunk of this.chunks) {
        const chunkData = {
          id: `${this.recordingId}_${chunk.timestamp}`,
          recordingId: this.recordingId,
          blob: chunk.blob,
          timestamp: chunk.timestamp,
          size: chunk.size,
          duration: chunk.duration
        };

        await this.promisifyRequest(store.put(chunkData));
      }

      // Clear memory chunks after flushing
      this.chunks = [];

      console.log(`Flushed ${this.chunks.length} chunks to IndexedDB`);
    } catch (error) {
      console.error('Error flushing to IndexedDB:', error);
      throw error;
    }
  }

  /**
   * Retrieve all chunks from both memory and IndexedDB
   */
  async getAllChunks(): Promise<VideoChunk[]> {
    const memoryChunks = [...this.chunks];

    try {
      const db = await this.openIndexedDB();
      const transaction = db.transaction(['chunks'], 'readonly');
      const store = transaction.objectStore('chunks');
      const index = store.index('recordingId');

      const dbChunks = await this.promisifyRequest(
        index.getAll(this.recordingId)
      );

      // Combine and sort by timestamp
      const allChunks = [
        ...dbChunks.map(data => ({
          blob: data.blob,
          timestamp: data.timestamp,
          size: data.size,
          duration: data.duration
        })),
        ...memoryChunks
      ];

      return allChunks.sort((a, b) => a.timestamp - b.timestamp);
    } catch (error) {
      console.warn('Could not retrieve chunks from IndexedDB, using memory only:', error);
      return memoryChunks;
    }
  }

  /**
   * Create final blob from all sources (memory + IndexedDB)
   */
  async createCompleteFinalBlob(mimeType: string = 'video/webm'): Promise<Blob> {
    const allChunks = await this.getAllChunks();
    const allBlobs = allChunks.map(chunk => chunk.blob);
    return new Blob(allBlobs, { type: mimeType });
  }

  /**
   * Clear all buffer data
   */
  async clear(): Promise<void> {
    this.chunks = [];

    try {
      const db = await this.openIndexedDB();
      const transaction = db.transaction(['chunks'], 'readwrite');
      const store = transaction.objectStore('chunks');
      const index = store.index('recordingId');

      const keys = await this.promisifyRequest(
        index.getAllKeys(this.recordingId)
      );

      for (const key of keys) {
        await this.promisifyRequest(store.delete(key));
      }

      console.log(`Cleared buffer for recording ${this.recordingId}`);
    } catch (error) {
      console.error('Error clearing IndexedDB buffer:', error);
    }
  }

  /**
   * Estimate current memory usage
   */
  private estimateMemoryUsage(): number {
    // Rough estimation: blob size + metadata overhead
    const blobSize = this.chunks.reduce((sum, chunk) => sum + chunk.size, 0);
    const metadataOverhead = this.chunks.length * 100; // ~100 bytes per chunk metadata
    return blobSize + metadataOverhead;
  }

  /**
   * Open IndexedDB connection
   */
  private openIndexedDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.indexedDBName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains('chunks')) {
          const store = db.createObjectStore('chunks', { keyPath: 'id' });
          store.createIndex('recordingId', 'recordingId', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  /**
   * Promisify IndexedDB request
   */
  private promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get recording summary for display
   */
  getRecordingSummary(): {
    recordingId: string;
    duration: string;
    size: string;
    chunks: number;
    status: 'recording' | 'complete' | 'error';
  } {
    const stats = this.getStats();

    const formatDuration = (seconds: number): string => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const formatSize = (bytes: number): string => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return {
      recordingId: this.recordingId,
      duration: formatDuration(stats.totalDuration),
      size: formatSize(stats.totalSize),
      chunks: stats.chunkCount,
      status: stats.isNearLimit ? 'error' : 'recording'
    };
  }

  /**
   * Clean up old recordings from IndexedDB
   */
  static async cleanupOldRecordings(maxAge: number = 24 * 60 * 60 * 1000): Promise<void> {
    try {
      const db = await new VideoBuffer('cleanup').openIndexedDB();
      const transaction = db.transaction(['chunks'], 'readwrite');
      const store = transaction.objectStore('chunks');

      const cutoffTime = Date.now() - maxAge;
      const allRecords = await new VideoBuffer('cleanup').promisifyRequest(store.getAll());

      for (const record of allRecords) {
        if (record.timestamp < cutoffTime) {
          await new VideoBuffer('cleanup').promisifyRequest(store.delete(record.id));
        }
      }

      console.log(`Cleaned up old video recording buffers older than ${maxAge}ms`);
    } catch (error) {
      console.error('Error cleaning up old recordings:', error);
    }
  }
}