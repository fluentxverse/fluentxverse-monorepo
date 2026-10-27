const { spawnSync } = require('node:child_process');
const suites = process.argv.slice(2);
for (const suite of suites.length ? suites : ['tutorDesign', 'becomeTutorDesign', 'inboxLayout', 'knowledgeBase', 'tutorNavigationRestore', 'materialsPage', 'materialDetailDesign', 'performanceMetrics', 'schedulingGuards', 'bookingNotification', 'lessonReportLayout', 'classroomIssueReport', 'recordingDialogDesign', 'authFlows', 'multiMaterialNotes', 'pdf']) {
  console.log('Running ' + suite);
  const result = spawnSync(process.execPath, ['tests/browser/' + suite + '.cjs'], { stdio: 'inherit', env: { ...process.env, TUTOR_TEST_URL: process.env.TUTOR_TEST_URL || 'http://127.0.0.1:5177' } });
  if (result.status !== 0) process.exit(result.status || 1);
}
