import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import { client } from './utils';
export interface LessonSubmissionIssue {
    message: string;
    field?: 'studentFeedback' | 'tutorHandoff' | 'stoppingPoint';
    materialType?: string;
    materialId?: string;
}
export interface LessonWorkflow {
    studentAttendance: string;
    attendanceVerified: boolean;
    outcome: string;
    notesStatus: 'draft' | 'changes_pending' | 'submitted' | 'not_required';
    submittedAt: string | null;
    startsAt: string;
    endsAt: string;
    editableUntil: string;
    serverNow: string;
    canEdit: boolean;
    closed: boolean;
}
export interface Continuation {
    materialId: string;
    materialType: string;
    materialTitle: string;
    stoppedAt: string | null;
    stoppedAtLabel: string;
    progressDetails: string;
    previousLessonId: string;
}
export const lessonWorkflowApi = {
    async get(id: string): Promise<LessonWorkflow> {
        const { data } = await client.get(`/lesson-workflow/tutor/${encodeURIComponent(id)}`);
        if (!data.success || !data.data?.notesStatus)
            throw new Error('Could not load submission status');
        return data.data;
    },
    async submit(id: string): Promise<LessonWorkflow> {
        const { data } = await client.post(`/lesson-workflow/tutor/${encodeURIComponent(id)}/submit`);
        if (!data.success || !data.data?.notesStatus)
            throw new Error(data.error || 'Could not submit notes.');
        return data.data;
    },
    async pending(signal?: AbortSignal): Promise<(LessonWorkflow & {
        bookingId: string;
        studentName: string;
    })[]> {
        const { data } = await client.get('/lesson-workflow/tutor/pending', { signal });
        if (!data.success || !Array.isArray(data.data)) throw new Error('Could not load pending lesson notes');
        return data.data;
    },
    async continuations(id: string): Promise<Continuation[]> { return (await client.get(`/lesson-workflow/tutor/${encodeURIComponent(id)}/continuations`)).data.data; }
};
