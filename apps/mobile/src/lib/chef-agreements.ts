import { supabase } from './supabase';

// The single agreement chefs currently need on file. Bumping the version string here means
// every chef will see it as unsigned again until they re-sign (past signatures for older
// versions stay in chef_agreements as an audit trail -- rows are never edited or deleted).
export const CURRENT_AGREEMENT_TYPE = 'independent_contractor_agreement';
export const CURRENT_AGREEMENT_VERSION = '2026-1';

export type ChefAgreement = {
  id: string;
  agreementType: string;
  documentVersion: string;
  signedAt: string | null;
};

async function findMyChefProfileId(authId: string, organizationId: string): Promise<string | null> {
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', authId)
    .maybeSingle();

  if (userError) throw userError;
  if (!user) return null;

  const { data: chefProfile, error: chefError } = await supabase
    .from('chef_profiles')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (chefError) throw chefError;
  return chefProfile?.id ?? null;
}

// Fetches the signed-in chef's own signing history plus whether the current agreement
// version has been signed yet.
export async function fetchMyAgreementStatus(
  authId: string,
  organizationId: string
): Promise<{ agreements: ChefAgreement[]; hasSignedCurrent: boolean; error: string | null }> {
  try {
    const chefProfileId = await findMyChefProfileId(authId, organizationId);
    if (!chefProfileId) {
      return { agreements: [], hasSignedCurrent: false, error: null };
    }

    const { data, error } = await supabase
      .from('chef_agreements')
      .select('id, agreement_type, document_version, signed_at')
      .eq('chef_id', chefProfileId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const agreements: ChefAgreement[] = (data ?? []).map((a) => ({
      id: a.id,
      agreementType: a.agreement_type,
      documentVersion: a.document_version,
      signedAt: a.signed_at,
    }));

    const hasSignedCurrent = agreements.some(
      (a) => a.agreementType === CURRENT_AGREEMENT_TYPE && a.documentVersion === CURRENT_AGREEMENT_VERSION
    );

    return { agreements, hasSignedCurrent, error: null };
  } catch (e) {
    return { agreements: [], hasSignedCurrent: false, error: e instanceof Error ? e.message : 'Could not load agreements.' };
  }
}

// Records the chef's e-signature (a typed full legal name) for the current agreement
// version. This is a simple typed-name attestation, not a drawn/biometric signature.
export async function signCurrentAgreement(
  authId: string,
  organizationId: string,
  typedFullName: string
): Promise<void> {
  const trimmed = typedFullName.trim();
  if (!trimmed) throw new Error('Type your full legal name to sign.');

  const chefProfileId = await findMyChefProfileId(authId, organizationId);
  if (!chefProfileId) throw new Error('You do not have a chef profile in this organization yet.');

  const { error } = await supabase.from('chef_agreements').insert({
    chef_id: chefProfileId,
    agreement_type: CURRENT_AGREEMENT_TYPE,
    document_version: CURRENT_AGREEMENT_VERSION,
    signature_data: trimmed,
    signed_at: new Date().toISOString(),
  });

  if (error) throw error;
}
