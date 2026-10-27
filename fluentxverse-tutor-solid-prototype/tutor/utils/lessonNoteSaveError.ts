export function lessonNoteSaveError(error: unknown): string {
  const response = (error as { response?: { status?: number; data?: { error?: unknown } } })?.response;
  if (response?.status === 400 && typeof response.data?.error === 'string' && response.data.error.startsWith('Remove student names,')) {
    return 'Remove names, contact details, addresses and personal identifiers. Use "the student" instead. These changes have not been saved to the lesson.';
  }
  return 'These changes could not be saved to the lesson. Your draft is kept on this device.';
}
