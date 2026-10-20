import { client } from './utils';
import { createLessonPrivacyApi } from '../../../shared/lessonPrivacyApi';
export const lessonPrivacyApi = createLessonPrivacyApi(client);
