/**
 * GTM Container Audit — GTM-NGSFDQ3C
 * Lists all tags, triggers, and variables with analysis
 */
require('dotenv').config();
const { google } = require('googleapis');

const TARGET_CONTAINER_PUBLIC_ID = 'GTM-NGSFDQ3C';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_ADS_CLIENT_ID,
  process.env.GOOGLE_ADS_CLIENT_SECRET
);
oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
});

const tagmanager = google.tagmanager({ version: 'v2', auth: oauth2Client });

async function main() {
  // 1. List all accounts
  console.log('=== LISTING GTM ACCOUNTS ===\n');
  const accountsRes = await tagmanager.accounts.list();
  const accounts = accountsRes.data.account || [];

  if (!accounts.length) {
    console.log('No GTM accounts found for this OAuth user.');
    return;
  }

  for (const acct of accounts) {
    console.log(`Account: ${acct.name} (ID: ${acct.accountId})`);
  }

  // 2. Find the container GTM-NGSFDQ3C
  let targetContainer = null;
  let targetAccountPath = null;

  for (const acct of accounts) {
    const containersRes = await tagmanager.accounts.containers.list({
      parent: acct.path,
    });
    const containers = containersRes.data.container || [];
    for (const c of containers) {
      console.log(`  Container: ${c.name} (${c.publicId}) — Account: ${acct.name}`);
      if (c.publicId === TARGET_CONTAINER_PUBLIC_ID) {
        targetContainer = c;
        targetAccountPath = acct.path;
      }
    }
  }

  if (!targetContainer) {
    console.log(`\nContainer ${TARGET_CONTAINER_PUBLIC_ID} not found!`);
    return;
  }

  console.log(`\n=== FOUND TARGET: ${targetContainer.name} (${targetContainer.publicId}) ===`);
  console.log(`Container path: ${targetContainer.path}\n`);

  // 3. Get the default workspace
  const workspacesRes = await tagmanager.accounts.containers.workspaces.list({
    parent: targetContainer.path,
  });
  const workspaces = workspacesRes.data.workspace || [];
  // Use "Default Workspace" or first available
  const workspace = workspaces.find(w => w.name === 'Default Workspace') || workspaces[0];
  if (!workspace) {
    console.log('No workspace found!');
    return;
  }
  console.log(`Using workspace: ${workspace.name} (${workspace.workspaceId})\n`);

  // 4. Get all triggers first (we need them to map tag firing)
  const triggersRes = await tagmanager.accounts.containers.workspaces.triggers.list({
    parent: workspace.path,
  });
  const triggers = triggersRes.data.trigger || [];

  // Build trigger lookup
  const triggerMap = {};
  for (const t of triggers) {
    triggerMap[t.triggerId] = t;
  }

  // 5. Get all tags
  const tagsRes = await tagmanager.accounts.containers.workspaces.tags.list({
    parent: workspace.path,
  });
  const tags = tagsRes.data.tag || [];

  // 6. Get all variables
  const varsRes = await tagmanager.accounts.containers.workspaces.variables.list({
    parent: workspace.path,
  });
  const variables = varsRes.data.variable || [];

  // === REPORT ===

  console.log('================================================================');
  console.log('                    GTM AUDIT REPORT');
  console.log(`           Container: ${targetContainer.name} (${TARGET_CONTAINER_PUBLIC_ID})`);
  console.log('================================================================\n');

  // --- TRIGGERS ---
  console.log('=== ALL TRIGGERS ===\n');
  for (const t of triggers) {
    console.log(`[Trigger ${t.triggerId}] "${t.name}"`);
    console.log(`  Type: ${t.type}`);
    if (t.filter) {
      console.log(`  Filters:`);
      for (const f of t.filter) {
        console.log(`    ${JSON.stringify(f)}`);
      }
    }
    if (t.customEventFilter) {
      console.log(`  Custom Event Filters:`);
      for (const f of t.customEventFilter) {
        console.log(`    ${JSON.stringify(f)}`);
      }
    }
    if (t.autoEventFilter) {
      console.log(`  Auto Event Filters:`);
      for (const f of t.autoEventFilter) {
        console.log(`    ${JSON.stringify(f)}`);
      }
    }
    console.log('');
  }

  // --- TAGS ---
  console.log('=== ALL TAGS ===\n');
  for (const tag of tags) {
    console.log(`[Tag ${tag.tagId}] "${tag.name}"`);
    console.log(`  Type: ${tag.type}`);
    console.log(`  Paused: ${tag.paused || false}`);

    // Show parameters
    if (tag.parameter) {
      console.log('  Parameters:');
      for (const p of tag.parameter) {
        if (p.type === 'LIST' || p.type === 'MAP') {
          console.log(`    ${p.key}: ${JSON.stringify(p.list || p.map, null, 2).substring(0, 500)}`);
        } else {
          console.log(`    ${p.key}: ${p.value}`);
        }
      }
    }

    // Show firing triggers
    if (tag.firingTriggerId) {
      console.log('  Fires on:');
      for (const tId of tag.firingTriggerId) {
        const tr = triggerMap[tId];
        if (tr) {
          console.log(`    -> "${tr.name}" (type: ${tr.type})`);
        } else {
          console.log(`    -> Trigger ID ${tId} (built-in or not found)`);
        }
      }
    }
    if (tag.blockingTriggerId) {
      console.log('  Blocked by:');
      for (const tId of tag.blockingTriggerId) {
        const tr = triggerMap[tId];
        console.log(`    -> "${tr ? tr.name : 'ID ' + tId}" (type: ${tr ? tr.type : 'unknown'})`);
      }
    }
    console.log('');
  }

  // --- VARIABLES ---
  console.log('=== ALL VARIABLES ===\n');
  for (const v of variables) {
    console.log(`[Variable ${v.variableId}] "${v.name}"`);
    console.log(`  Type: ${v.type}`);
    if (v.parameter) {
      for (const p of v.parameter) {
        if (p.type === 'LIST' || p.type === 'MAP') {
          console.log(`    ${p.key}: ${JSON.stringify(p.list || p.map).substring(0, 300)}`);
        } else {
          console.log(`    ${p.key}: ${p.value}`);
        }
      }
    }
    console.log('');
  }

  // === ANALYSIS ===
  console.log('================================================================');
  console.log('                    ANALYSIS & FLAGS');
  console.log('================================================================\n');

  // Find "All Pages" trigger (built-in trigger ID = 2147479553)
  const ALL_PAGES_TRIGGER_ID = '2147479553';

  // 1. Google Ads conversion tags
  console.log('--- GOOGLE ADS CONVERSION TAGS ---\n');
  const gadsConvTags = tags.filter(t =>
    t.type === 'awct' || t.type === 'gaawe' || t.type === 'sp' ||
    (t.type === 'html' && t.name && t.name.toLowerCase().includes('google')) ||
    (t.type === 'html' && t.name && t.name.toLowerCase().includes('conversion'))
  );
  if (gadsConvTags.length === 0) {
    console.log('No Google Ads conversion tags found.\n');
  }
  for (const tag of gadsConvTags) {
    console.log(`"${tag.name}" (type: ${tag.type})`);
    if (tag.firingTriggerId) {
      for (const tId of tag.firingTriggerId) {
        const tr = triggerMap[tId];
        const trigName = tr ? tr.name : (tId === ALL_PAGES_TRIGGER_ID ? 'All Pages (BUILT-IN)' : `ID ${tId}`);
        const trigType = tr ? tr.type : (tId === ALL_PAGES_TRIGGER_ID ? 'pageview' : 'unknown');
        console.log(`  Fires on: "${trigName}" (${trigType})`);
        if (tId === ALL_PAGES_TRIGGER_ID) {
          console.log('  *** WARNING: Conversion tag firing on All Pages! ***');
        }
      }
    }
    console.log('');
  }

  // 2. Facebook Pixel tags
  console.log('--- FACEBOOK / META PIXEL TAGS ---\n');
  const fbTags = tags.filter(t =>
    (t.name && (t.name.toLowerCase().includes('facebook') || t.name.toLowerCase().includes('meta') || t.name.toLowerCase().includes('fb') || t.name.toLowerCase().includes('pixel'))) ||
    (t.type === 'html' && t.parameter && t.parameter.some(p => p.value && typeof p.value === 'string' && (p.value.includes('fbq(') || p.value.includes('facebook') || p.value.includes('fbevents'))))
  );
  if (fbTags.length === 0) {
    console.log('No Facebook/Meta Pixel tags found.\n');
  }
  for (const tag of fbTags) {
    console.log(`"${tag.name}" (type: ${tag.type})`);
    // Check for fbq calls in HTML
    if (tag.type === 'html' && tag.parameter) {
      const htmlParam = tag.parameter.find(p => p.key === 'html');
      if (htmlParam && htmlParam.value) {
        const fbqCalls = htmlParam.value.match(/fbq\([^)]+\)/g);
        if (fbqCalls) {
          console.log(`  FB Pixel calls: ${fbqCalls.join(', ')}`);
        }
      }
    }
    if (tag.firingTriggerId) {
      for (const tId of tag.firingTriggerId) {
        const tr = triggerMap[tId];
        const trigName = tr ? tr.name : (tId === ALL_PAGES_TRIGGER_ID ? 'All Pages (BUILT-IN)' : `ID ${tId}`);
        console.log(`  Fires on: "${trigName}"`);
      }
    }
    console.log('');
  }

  // 3. Form submission / postMessage tracking
  console.log('--- FORM SUBMISSION / POSTMESSAGE TRACKING ---\n');
  const formTags = tags.filter(t => {
    const nameMatch = t.name && (t.name.toLowerCase().includes('form') || t.name.toLowerCase().includes('postmessage') || t.name.toLowerCase().includes('iframe') || t.name.toLowerCase().includes('ghl') || t.name.toLowerCase().includes('leadconnector'));
    const htmlMatch = t.type === 'html' && t.parameter && t.parameter.some(p => p.value && typeof p.value === 'string' && (p.value.includes('postMessage') || p.value.includes('addEventListener') || p.value.includes('form') || p.value.includes('iframe')));
    return nameMatch || htmlMatch;
  });
  const formTriggers = triggers.filter(t =>
    t.type === 'formSubmission' || t.type === 'customEvent' ||
    (t.name && (t.name.toLowerCase().includes('form') || t.name.toLowerCase().includes('postmessage') || t.name.toLowerCase().includes('iframe')))
  );

  if (formTags.length === 0 && formTriggers.length === 0) {
    console.log('No form submission or postMessage tracking found.\n');
  }
  for (const tag of formTags) {
    console.log(`Tag: "${tag.name}" (type: ${tag.type})`);
    if (tag.type === 'html' && tag.parameter) {
      const htmlParam = tag.parameter.find(p => p.key === 'html');
      if (htmlParam && htmlParam.value) {
        // Show relevant parts of the HTML
        console.log(`  HTML snippet (first 800 chars):\n${htmlParam.value.substring(0, 800)}`);
      }
    }
    console.log('');
  }
  for (const tr of formTriggers) {
    console.log(`Trigger: "${tr.name}" (type: ${tr.type})`);
    if (tr.customEventFilter) {
      for (const f of tr.customEventFilter) {
        console.log(`  Filter: ${JSON.stringify(f)}`);
      }
    }
    console.log('');
  }

  // 4. Tags firing on All Pages that shouldn't
  console.log('--- TAGS FIRING ON "ALL PAGES" ---\n');
  const allPagesTags = tags.filter(t =>
    t.firingTriggerId && t.firingTriggerId.includes(ALL_PAGES_TRIGGER_ID)
  );

  if (allPagesTags.length === 0) {
    // Also check for custom "All Pages" triggers
    const allPagesCustom = triggers.filter(t => t.type === 'pageview' && (!t.filter || t.filter.length === 0));
    const customAllPagesIds = allPagesCustom.map(t => t.triggerId);
    const tagsOnCustomAllPages = tags.filter(t =>
      t.firingTriggerId && t.firingTriggerId.some(id => customAllPagesIds.includes(id))
    );
    if (tagsOnCustomAllPages.length > 0) {
      console.log('Tags on custom "All Pages" pageview triggers:');
      for (const tag of tagsOnCustomAllPages) {
        const isConversion = tag.type === 'awct' || tag.type === 'gaawe' ||
          (tag.name && (tag.name.toLowerCase().includes('conversion') || tag.name.toLowerCase().includes('lead') || tag.name.toLowerCase().includes('purchase')));
        console.log(`  "${tag.name}" (type: ${tag.type}) ${isConversion ? '*** CONVERSION TAG ON ALL PAGES — FIX THIS ***' : '(OK — likely config/base tag)'}`);
      }
    } else {
      console.log('No tags found firing on All Pages built-in trigger.');
    }
  } else {
    for (const tag of allPagesTags) {
      const isConversion = tag.type === 'awct' || tag.type === 'gaawe' ||
        (tag.name && (tag.name.toLowerCase().includes('conversion') || tag.name.toLowerCase().includes('lead') || tag.name.toLowerCase().includes('purchase')));
      console.log(`"${tag.name}" (type: ${tag.type}) ${isConversion ? '*** CONVERSION TAG ON ALL PAGES — FIX THIS ***' : '(OK — likely config/base tag)'}`);
    }
  }

  console.log('\n=== AUDIT COMPLETE ===');
}

main().catch(err => {
  console.error('Error:', err.message);
  if (err.response) {
    console.error('Response data:', JSON.stringify(err.response.data, null, 2));
  }
});
