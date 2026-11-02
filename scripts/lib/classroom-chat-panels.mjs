export function sharedChatPanels(text) {
  const start = text.indexOf('          {(isHistoryOpen() || isSettingsOpen()) && (');
  const end = text.indexOf('          <div class="chat-messages">', start);
  if (start < 0 || end < 0) throw Error('Classroom panel markers changed');
  text = text.slice(0, start) + `          <ClassroomChatPanels
            historyOpen={isHistoryOpen()} settingsOpen={isSettingsOpen()} sessionId={currentSessionId()}
            historyLoading={isHistoryLoading()} activities={activityLogs()} formatDate={formatActivityDate} formatTime={formatActivityTime}
            audioDevices={audioInputDevices()} videoDevices={videoInputDevices()}
            audioDeviceId={selectedAudioDeviceId()} videoDeviceId={selectedVideoDeviceId()}
            onAudioDevice={setSelectedAudioDeviceId} onVideoDevice={setSelectedVideoDeviceId}
            applying={isApplyingDeviceSettings()} recordingAvailable={recordingAvailable()}
            onRecording={() => setRecordingRevision(value => value + 1)}
            onRefreshHistory={() => {
              setIsHistoryLoading(true);
              socketInstance()?.emit('classroom:request-activity-history', { sessionId: currentSessionId() });
            }}
            onRefreshDevices={loadMediaDevices} onApply={applyDeviceSettings}
            onClose={() => { setIsHistoryOpen(false); setIsSettingsOpen(false); }}/>
` + text.slice(end);
  text = text.replace('import TutorDialog from "../Components/Common/TutorDialog";\n', '');
  const toolsStart=text.indexOf('            <div class="chat-header-actions" aria-label="Chat tools">');
  const toolsEnd=text.indexOf('            </div>',toolsStart);
  if(toolsStart<0||toolsEnd<0)throw Error('Classroom toolbar markers changed');
  text=text.slice(0,toolsStart)+'            <ClassroomChatTools onHistory={requestActivityHistory} onSettings={openDeviceSettings}/>'+text.slice(toolsEnd+'            </div>'.length);
  return "import ClassroomChatPanels, { ClassroomChatTools } from '../../../shared/ui/ClassroomChatPanels';\n" + text;
}
