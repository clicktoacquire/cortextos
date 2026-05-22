import { BigQuery } from '@google-cloud/bigquery';
import { writeFileSync, existsSync } from 'fs';

let credsTmpPath: string | undefined;

function ensureCredentials(): void {
  const json = process.env.GOOGLE_CREDENTIALS_JSON;
  if (!json) return;
  if (credsTmpPath) return;
  credsTmpPath = '/tmp/bq-credentials.json';
  writeFileSync(credsTmpPath, json, 'utf-8');
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credsTmpPath;
}

export function makeBQClient(projectId = process.env.GCLOUD_PROJECT ?? 'click-to-acquire'): BigQuery {
  const json = process.env.GOOGLE_CREDENTIALS_JSON;
  if (json) {
    return new BigQuery({ projectId, credentials: JSON.parse(json) });
  }
  ensureCredentials();
  return new BigQuery({ projectId });
}
