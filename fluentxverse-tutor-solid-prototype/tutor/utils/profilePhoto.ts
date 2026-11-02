import { validatePhotoFile, validatePhotoDimensions } from '../../../shared/profileGuidelines';
export async function validateProfilePhoto(file: File | Blob): Promise<void> {
  validatePhotoFile(file.type, file.size);
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); } catch { throw new Error('This photo could not be read. Choose a valid JPG or JPEG file.'); }
  try { validatePhotoDimensions(bitmap.width, bitmap.height); } finally { bitmap.close(); }
}
