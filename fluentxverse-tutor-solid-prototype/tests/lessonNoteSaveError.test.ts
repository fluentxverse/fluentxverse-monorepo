import {expect,test} from 'bun:test';
import {lessonNoteSaveError} from '../tutor/utils/lessonNoteSaveError';
test('privacy rejection is actionable but never reflects arbitrary server content',()=>{
  expect(lessonNoteSaveError({response:{status:400,data:{error:'Remove student names, alice@example.test'}}})).toContain('Use "the student"');
  expect(lessonNoteSaveError({response:{status:400,data:{error:'Remove student names, alice@example.test'}}})).not.toContain('alice@example.test');
  expect(lessonNoteSaveError({response:{status:500,data:{error:'secret database'}}})).toContain('draft is kept on this device');
  expect(lessonNoteSaveError({response:{status:500,data:{error:'secret database'}}})).not.toContain('secret');
});
