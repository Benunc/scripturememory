export const ProgressStatus = {
  NotStarted: 'not_started',
  InProgress: 'in_progress',
  Mastered: 'mastered',
} as const;

export type ProgressStatus = typeof ProgressStatus[keyof typeof ProgressStatus];

export interface VerseProgress {
  status: ProgressStatus;
  lastUpdated: string;
}

const STORAGE_KEY = 'scripture-memory-progress';

export const getProgress = (): Record<string, VerseProgress> => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : {};
};

export const updateProgress = (verseId: string, status: ProgressStatus) => {
  const progress = getProgress();
  progress[verseId] = {
    status,
    lastUpdated: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
};

export const getVerseProgress = (verseId: string): ProgressStatus => {
  const progress = getProgress();
  return progress[verseId]?.status || ProgressStatus.NotStarted;
}; 