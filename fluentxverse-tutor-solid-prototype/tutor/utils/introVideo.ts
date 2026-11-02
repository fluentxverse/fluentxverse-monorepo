export const MAX_INTRO_VIDEO_SECONDS = 30;
export function validateIntroDuration(duration: number): void {
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Could not read this video. Please upload a valid video file.');
  if (duration > MAX_INTRO_VIDEO_SECONDS) throw new Error('Introduction videos must be 30 seconds or shorter. Please trim your video before uploading.');
}
export function checkIntroVideo(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    const cleanup = () => { clearTimeout(timeout); video.onloadedmetadata = null; video.onerror = null; video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url); };
    const finish = (error?: unknown) => { cleanup(); error ? reject(error) : resolve(); };
    const timeout = setTimeout(() => finish(new Error('Could not read this video. Please try a different file.')), 10000);
    video.preload = 'metadata';
    video.onloadedmetadata = () => { try { validateIntroDuration(video.duration); finish(); } catch (error) { finish(error); } };
    video.onerror = () => finish(new Error('Could not read this video. Please upload a valid video file.'));
    video.src = url;
  });
}
