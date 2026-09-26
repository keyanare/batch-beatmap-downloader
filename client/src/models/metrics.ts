export interface CurrentDownload {
  Size: number;
  Progress: number;
  Speed: number;
  Active: boolean;
  Finished: boolean;
}

export interface DailyDownloadStats {
  Maps: number;
  Size: number;
  Speed: number;
  Completed: number;
}

export interface DownloadMetrics {
  CurrentDownloads: CurrentDownload[] | null;
  DailyStats: DailyDownloadStats;
  CurrentBandwidthUsage: number;
  AverageSpeedMinute: number;
}

export interface DatabaseMetrics {
  NumberStoredRanked: number;
  NumberStoredUnranked: number;
  NumberStoredLoved: number;
  LastBeatmapAdded: number;
}

export interface Metrics {
  Download: DownloadMetrics;
  Database: DatabaseMetrics;
}
