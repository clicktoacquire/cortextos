import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import fs from 'fs';
import path from 'path';
import { OnboardingReviewActions } from '@/components/portal/OnboardingReviewActions';

// Local type shapes matching packages/onboarding/src/types.ts
interface OnboardingDoc {
  schema_version: '1.0';
  client_id: string;
  status: 'draft' | 'in_review' | 'approved' | 'amended';
  drafted_at?: string;
  drafted_from?: { zoom_recording_id?: string; transcript_url?: string; sales_notes_ref?: string };
  client_meta: {
    business_name: string;
    legal_name?: string;
    primary_contact?: { name: string; email: string; phone?: string };
    website?: string;
    founded_year?: number;
    team_size?: string;
  };
  services_catalog: Array<{ name: string; tier: 'primary' | 'offered' | 'upsell'; average_ticket_usd?: number }>;
  target_geos: Array<{ kind: string; value: string; radius_miles?: number; exclude?: boolean }>;
  budget_monthly: { total_usd: number; ramp_strategy?: string; split?: { google_usd?: number; meta_usd?: number } };
  vertical: string;
  brand_voice: { tone: string; must_use_phrases?: string[]; do_not_use_phrases?: string[] };
  has_existing_accounts: {
    google_ads: { exists: boolean; customer_id?: string };
    meta_ads: { exists: boolean; ad_account_id?: string };
    ga4?: { exists: boolean; property_id?: string };
    gtm?: { exists: boolean; container_id?: string };
  };
  amendments?: Array<{ amended_at: string; amended_by: string; field_path: string; note?: string }>;
}

interface OnboardingStateRecord {
  client_id: string;
  state: string;
  entered_at: string;
  history: unknown[];
}

export const dynamic = 'force-dynamic';

const AGENCY_OS_ROOT = process.env.AGENCY_OS_ROOT
  ?? path.resolve(process.cwd(), '../agency-os');

function readJsonFile<T>(filePath: string): T | undefined {
  if (!fs.existsSync(filePath)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return undefined;
  }
}

interface Props {
  params: Promise<{ clientId: string }>;
}

const STATUS_BADGE: Record<string, string> = {
  draft:     'bg-yellow-50 text-yellow-700 border-yellow-200',
  in_review: 'bg-blue-50 text-blue-700 border-blue-200',
  approved:  'bg-green-50 text-green-700 border-green-200',
  amended:   'bg-purple-50 text-purple-700 border-purple-200',
};

const STATE_LABELS: Record<string, string> = {
  intake:          'Intake',
  research_wave1:  'Research — Wave 1',
  research_wave2:  'Research — Wave 2',
  audit:           'Audit',
  cost_fit_gate:   'Cost-Fit Gate',
  strategy:        'Strategy',
  ready_to_launch: 'Ready to Launch',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      </div>
      <div className="px-5 py-4 text-sm text-gray-700 space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | number | boolean | null }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex gap-2">
      <span className="text-gray-400 w-36 shrink-0">{label}</span>
      <span>{String(value)}</span>
    </div>
  );
}

export default async function OnboardingReviewPage({ params }: Props) {
  const { clientId } = await params;
  const session = await auth();

  if (!session?.user) redirect('/portal/login');
  const isStaff = session.user.role === 'founder' || session.user.role === 'employee';
  if (!isStaff) notFound();

  const docPath = path.join(AGENCY_OS_ROOT, 'clients', clientId, 'onboarding-doc.json');
  const statePath = path.join(AGENCY_OS_ROOT, 'clients', clientId, 'onboarding-state.json');

  const doc = readJsonFile<OnboardingDoc>(docPath);
  const stateRecord = readJsonFile<OnboardingStateRecord>(statePath);

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <a
          href={`/portal/${clientId}`}
          className="text-sm text-gray-400 hover:text-gray-600 mb-3 inline-block"
        >
          ← Back to overview
        </a>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Onboarding review</h1>
          {doc && (
            <span className={`text-xs border rounded-full px-2.5 py-0.5 ${STATUS_BADGE[doc.status] ?? STATUS_BADGE.draft}`}>
              {doc.status}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Client: <strong>{clientId}</strong>
          {stateRecord && (
            <> · State: <strong>{STATE_LABELS[stateRecord.state] ?? stateRecord.state}</strong></>
          )}
        </p>
      </div>

      {!doc ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
          <p className="text-sm text-gray-400 mb-1">No onboarding document found yet.</p>
          <p className="text-xs text-gray-300">Trigger the <code>draft-from-transcript</code> Trigger.dev job to generate one.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Client meta */}
          <Section title="Client information">
            <Row label="Business name" value={doc.client_meta?.business_name} />
            <Row label="Legal name" value={doc.client_meta?.legal_name} />
            <Row label="Website" value={doc.client_meta?.website} />
            <Row label="Contact" value={doc.client_meta?.primary_contact ? `${doc.client_meta.primary_contact.name} <${doc.client_meta.primary_contact.email}>` : undefined} />
            <Row label="Phone" value={doc.client_meta?.primary_contact?.phone} />
            <Row label="Vertical" value={doc.vertical} />
            <Row label="Team size" value={doc.client_meta?.team_size} />
            <Row label="Founded" value={doc.client_meta?.founded_year} />
          </Section>

          {/* Services */}
          <Section title="Services catalog">
            {doc.services_catalog?.map((s, i) => (
              <div key={i} className="flex gap-2">
                <span className={`text-xs border rounded px-1.5 py-0.5 shrink-0 ${s.tier === 'primary' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                  {s.tier}
                </span>
                <span>{s.name}</span>
                {s.average_ticket_usd && <span className="text-gray-400">avg ${s.average_ticket_usd.toLocaleString()}</span>}
              </div>
            ))}
          </Section>

          {/* Geos */}
          <Section title="Target geos">
            {doc.target_geos?.map((g, i) => (
              <Row key={i} label={g.kind} value={`${g.value}${g.radius_miles ? ` (${g.radius_miles}mi)` : ''}${g.exclude ? ' [EXCLUDE]' : ''}`} />
            ))}
          </Section>

          {/* Budget */}
          <Section title="Budget">
            <Row label="Monthly total" value={doc.budget_monthly?.total_usd ? `$${doc.budget_monthly.total_usd.toLocaleString()}` : undefined} />
            <Row label="Ramp strategy" value={doc.budget_monthly?.ramp_strategy} />
            {doc.budget_monthly?.split?.google_usd && <Row label="Google" value={`$${doc.budget_monthly.split.google_usd.toLocaleString()}`} />}
            {doc.budget_monthly?.split?.meta_usd && <Row label="Meta" value={`$${doc.budget_monthly.split.meta_usd.toLocaleString()}`} />}
          </Section>

          {/* Brand voice */}
          <Section title="Brand voice">
            <Row label="Tone" value={doc.brand_voice?.tone} />
            {doc.brand_voice?.must_use_phrases?.length ? (
              <div className="flex gap-2">
                <span className="text-gray-400 w-36 shrink-0">Must use</span>
                <span>{doc.brand_voice.must_use_phrases.join(', ')}</span>
              </div>
            ) : null}
            {doc.brand_voice?.do_not_use_phrases?.length ? (
              <div className="flex gap-2">
                <span className="text-gray-400 w-36 shrink-0">Do not use</span>
                <span className="text-red-600">{doc.brand_voice.do_not_use_phrases.join(', ')}</span>
              </div>
            ) : null}
          </Section>

          {/* Existing accounts */}
          <Section title="Existing accounts">
            <Row label="Google Ads" value={doc.has_existing_accounts?.google_ads?.exists ? `Yes${doc.has_existing_accounts.google_ads.customer_id ? ` (${doc.has_existing_accounts.google_ads.customer_id})` : ''}` : 'No'} />
            <Row label="Meta Ads" value={doc.has_existing_accounts?.meta_ads?.exists ? `Yes${doc.has_existing_accounts.meta_ads.ad_account_id ? ` (${doc.has_existing_accounts.meta_ads.ad_account_id})` : ''}` : 'No'} />
            <Row label="GA4" value={doc.has_existing_accounts?.ga4?.exists ? `Yes${doc.has_existing_accounts.ga4.property_id ? ` (${doc.has_existing_accounts.ga4.property_id})` : ''}` : 'No'} />
            <Row label="GTM" value={doc.has_existing_accounts?.gtm?.exists ? `Yes${doc.has_existing_accounts.gtm.container_id ? ` (${doc.has_existing_accounts.gtm.container_id})` : ''}` : 'No'} />
          </Section>

          {/* Provenance */}
          {doc.drafted_from && (
            <Section title="Source">
              <Row label="Drafted at" value={doc.drafted_at ? new Date(doc.drafted_at).toLocaleString() : undefined} />
              <Row label="Zoom recording" value={doc.drafted_from.zoom_recording_id} />
              <Row label="Transcript URL" value={doc.drafted_from.transcript_url} />
              <Row label="Sales notes" value={doc.drafted_from.sales_notes_ref} />
            </Section>
          )}

          {/* Amendment history */}
          {doc.amendments && doc.amendments.length > 0 && (
            <Section title="Amendment history">
              {doc.amendments.map((a, i) => (
                <div key={i} className="text-xs text-gray-500">
                  <span className="text-gray-300">{new Date(a.amended_at).toLocaleString()}</span>
                  {' · '}
                  <span>{a.amended_by}</span>
                  {' · '}
                  <span>{a.field_path}</span>
                  {a.note && <span className="ml-1 text-gray-400">"{a.note}"</span>}
                </div>
              ))}
            </Section>
          )}

          {/* Approve / Reject */}
          <div className="pt-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Decision</h2>
            <OnboardingReviewActions clientId={clientId} currentStatus={doc.status} />
          </div>
        </div>
      )}
    </div>
  );
}
