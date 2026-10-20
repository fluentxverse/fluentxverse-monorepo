import AppDialog, { type AppDialogProps } from '../../../../shared/ui/AppDialog';
import './StudentDialog.css';
export default function StudentDialog(props: AppDialogProps) {
    return <AppDialog {...props} className={`student-dialog ${props.className || ''}`}/>;
}
