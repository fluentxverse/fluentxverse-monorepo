import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import { client, getErrorMessage } from './utils';
export interface LessonProof {
    bookingId: string;
    eligible: boolean;
    submissionAvailable?: boolean;
    status: 'ready' | 'local_proof_generated' | 'submitted' | 'verified' | 'failed' | 'retired' | 'expired' | 'revoked';
    commitment?: string;
    txHash?: string;
    aggregationId?: number;
}
export const lessonProofApi = {
    async list(): Promise<LessonProof[]> {
        const response = await client.get('/proof/student-lessons/me');
        return response.data.data;
    },
    async claim(bookingId: string): Promise<LessonProof> {
        try {
            const response = await client.post(`/proof/student-lessons/${encodeURIComponent(bookingId)}/claim`);
            return response.data.data;
        }
        catch (error) {
            throw new Error(getErrorMessage(error));
        }
    }
};
