export const JOB_STATES = ['queued', 'extracting', 'identifying-claims', 'researching', 'evaluating', 'ready-for-review', 'published', 'failed'] as const;
export type JobState = typeof JOB_STATES[number];

const activeJobStates: readonly string[] = ['queued', 'extracting', 'identifying-claims', 'researching', 'evaluating'];

export function isActiveJobState(status: string): boolean {
  return activeJobStates.includes(status);
}

const allowed: Record<JobState, readonly JobState[]> = {
  queued: ['extracting', 'failed'],
  extracting: ['identifying-claims', 'failed'],
  'identifying-claims': ['researching', 'failed'],
  researching: ['evaluating', 'failed'],
  evaluating: ['ready-for-review', 'failed'],
  'ready-for-review': ['published'],
  published: ['ready-for-review'],
  failed: ['queued'],
};

/** Database updates must also compare the expected state to prevent racing workers. */
export function canTransition(from: JobState, to: JobState): boolean {
  return allowed[from].includes(to);
}
