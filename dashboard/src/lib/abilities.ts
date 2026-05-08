/**
 * CASL ability factory (PHASES Task 2.1).
 *
 * defineAbilitiesFor(user) returns the CASL Ability for a given user role.
 *
 * Roles:
 *   founder  — full access (Rob); can do everything
 *   employee — read-only on most resources; blocked from billing, publish,
 *              agency-settings, user management
 *
 * Subject strings map to dashboard sections/actions. Add new subjects here
 * as new sections ship; never hard-gate in component code — always use `ability.can()`.
 */

import { AbilityBuilder, createMongoAbility, type MongoAbility } from '@casl/ability';
import type { UserRole } from './types';

// Subjects — dashboard resource domains
export type Subject =
  | 'Task'
  | 'Approval'
  | 'Agent'
  | 'Client'
  | 'Analytics'
  | 'Knowledge'
  | 'Comms'
  | 'Recommendation'
  | 'Settings'         // general settings
  | 'AgencySettings'   // agency-wide config (billing, branding) — founder only
  | 'Billing'          // billing/subscription — founder only
  | 'Publish'          // publishing LP/campaign live — founder only
  | 'User'             // user management — founder only
  | 'all';

// Actions
export type Action = 'read' | 'create' | 'update' | 'delete' | 'manage';

export type AppAbility = MongoAbility<[Action, Subject]>;

export interface AbilityUser {
  id: string | number;
  role: UserRole;
}

/**
 * Factory: returns a CASL Ability for the given user.
 *
 * Usage:
 *   const ability = defineAbilitiesFor({ id: user.id, role: user.role });
 *   if (ability.can('read', 'Client')) { ... }
 */
export function defineAbilitiesFor(user: AbilityUser): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  if (user.role === 'founder') {
    // Founder: unrestricted
    can('manage', 'all');
  } else {
    // Employee: read most resources; no sensitive ops
    can('read', 'Task');
    can('create', 'Task');
    can('update', 'Task');

    can('read', 'Approval');
    can('read', 'Agent');
    can('read', 'Client');
    can('read', 'Analytics');
    can('read', 'Knowledge');
    can('read', 'Comms');
    can('read', 'Recommendation');
    can('read', 'Settings');

    // Blocked from sensitive actions
    cannot('manage', 'Billing');
    cannot('manage', 'AgencySettings');
    cannot('manage', 'Publish');
    cannot('manage', 'User');
    cannot('delete', 'Client');
    cannot('delete', 'Agent');
  }

  return build();
}
