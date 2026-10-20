import AppDialog, { type AppDialogProps } from '../../../../shared/ui/AppDialog';
import './TutorDialog.css';
export default function TutorDialog(props: AppDialogProps) {
    return <AppDialog {...props} className={`tutor-dialog ${props.className || ''}`}/>;
}
