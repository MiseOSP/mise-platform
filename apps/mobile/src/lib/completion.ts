import { supabase } from './supabase';

// Chef Portal completion reporting (spec S91/S102: "Mark required completion steps").
// Management defines a per-event checklist (event_completion_steps); the assigned chef
// reads it and toggles each step done. RLS + the guard trigger in migration 035 are the
// real authorization boundary -- a chef can only toggle completion on their own event's
// steps, never edit the checklist itself (spec S51/S60).

export type CompletionStep = {
  id: string;
  label: string;
  sortOrder: number;
  completedAt: string | null;
};

// Lists the completion checklist for one event, in the order management defined.
export async function fetchCompletionSteps(eventId: string): Promise<CompletionStep[]> {
  const { data, error } = await supabase
    .from('event_completion_steps')
    .select('id, label, sort_order, completed_at')
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id as string,
    label: (row.label as string) ?? '',
    sortOrder: (row.sort_order as number) ?? 0,
    completedAt: (row.completed_at as string) ?? null,
  }));
}

// Marks a single completion step done or not-done. The guard trigger stamps completed_by
// from the acting chef, so we only send completed_at here.
export async function setStepCompletion(stepId: string, done: boolean): Promise<void> {
  const { error } = await supabase
    .from('event_completion_steps')
    .update({ completed_at: done ? new Date().toISOString() : null })
    .eq('id', stepId);

  if (error) throw error;
}
