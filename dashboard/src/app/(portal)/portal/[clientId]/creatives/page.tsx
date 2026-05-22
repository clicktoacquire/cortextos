interface Props {
  params: Promise<{ clientId: string }>;
}

export default async function CreativesPage({ params }: Props) {
  const { clientId } = await params;

  const gdriveConfigured = !!process.env.GDRIVE_SERVICE_ACCOUNT_JSON;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">Creatives</h1>

      {!gdriveConfigured && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          Google Drive is not configured — asset previews unavailable. Contact your account manager.
        </div>
      )}

      {/* Placeholder grid — populated when GDrive fileIds are wired per-client */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {gdriveConfigured ? (
          <p className="col-span-full text-sm text-gray-400">
            No creatives on file yet for <span className="font-mono">{clientId}</span>.
          </p>
        ) : (
          Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="aspect-video animate-pulse rounded-lg bg-gray-100"
            />
          ))
        )}
      </div>
    </div>
  );
}
