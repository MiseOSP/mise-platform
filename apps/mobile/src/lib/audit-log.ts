import { supabase } from './supabase';

// Read-only activity trail for org management. Rows are written exclusively
// by database triggers (see 014_audit_logs_rls_and_triggers.sql) on events,
// payments, and payouts -- the app never writes to this table directly, and
// RLS restricts reads to management of the owning organization.

export type AuditLogEntry = {
  id: string;
  action: string;
  tableName: string;
  recordId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export async function fetchAuditLogs(organizationId: string): Promise<{
  data: AuditLogEntry[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, action, table_name, record_id, metadata, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return { data: [], error: error.message };

  return {
    data: (data ?? []).map((r: any) => ({
      id: r.id,
      action: r.action,
      tableName: r.table_name,
      recordId: r.record_id,
      metadata: r.metadata,
      createdAt: r.created_at,
    })),
    error: null,
  };
}
