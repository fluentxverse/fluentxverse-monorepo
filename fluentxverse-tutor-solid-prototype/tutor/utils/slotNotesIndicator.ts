export type SlotNotesStatus = 'draft' | 'changes_pending' | 'submitted' | 'not_required';

export function slotNotesIndicator(endsAt: string | undefined, status: SlotNotesStatus | undefined, now: number): 'incomplete' | 'complete' | 'attendance' | 'not_required' {
  if (!endsAt || !Number.isFinite(Date.parse(endsAt)) || !Number.isFinite(now) || now < Date.parse(endsAt) || !status || !['draft', 'changes_pending', 'submitted', 'not_required'].includes(status)) return 'attendance';
  if (status === 'not_required') return 'not_required';
  return status === 'submitted' ? 'complete' : 'incomplete';
}
