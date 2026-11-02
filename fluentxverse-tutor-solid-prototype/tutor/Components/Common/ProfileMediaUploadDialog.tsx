import type { Component } from 'solid-js';
import { Upload, X } from 'lucide-solid';
import TutorDialog from './TutorDialog';
import ProfileGuidelines from './ProfileGuidelines';
import './ProfileMediaUploadDialog.css';

const ProfileMediaUploadDialog: Component<{
  kind: 'photo' | 'video'; busy: boolean; error?: string;
  onClose: () => void; onChoose: () => void;
}> = props => (
  <TutorDialog label={props.kind === 'photo' ? 'Upload profile photo' : 'Upload introduction video'} className="tutor-media-upload-dialog" onClose={props.onClose} busy={props.busy}>
    <div class="media-upload-layout">
      <header class="media-upload-header">
        <h3>{props.kind === 'photo' ? 'Upload profile photo' : 'Upload introduction video'}</h3>
        <button type="button" aria-label="Close upload guidelines" title="Close" disabled={props.busy} onClick={props.onClose}><X size={20}/></button>
      </header>
      <div class="media-upload-body"><ProfileGuidelines kind={props.kind} expanded/></div>
      <footer class="media-upload-footer">
        {props.error && <p role="alert" class="media-upload-error">{props.error}</p>}
        <button type="button" disabled={props.busy} onClick={props.onClose}>Cancel</button>
        <button type="button" class="media-upload-choose" disabled={props.busy} onClick={props.onChoose}><Upload size={17}/>{props.busy ? 'Uploading...' : props.kind === 'photo' ? 'Choose photo' : 'Choose video'}</button>
      </footer>
    </div>
  </TutorDialog>
);
export default ProfileMediaUploadDialog;
