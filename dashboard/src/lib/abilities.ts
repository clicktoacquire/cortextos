import { AbilityBuilder, createMongoAbility, type MongoAbility } from '@casl/ability';
import type { UserRole } from './types';

type Actions = 'read' | 'manage';
type Subjects = 'clients' | 'users' | 'settings' | 'portal' | 'all';

export type AppAbility = MongoAbility<[Actions, Subjects]>;

export function defineAbilitiesFor(role: UserRole): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  if (role === 'admin') {
    can('manage', 'all');
  } else if (role === 'client') {
    can('read', 'portal');
  } else {
    can('read', 'clients');
  }

  return build();
}

export function canAccess(role: UserRole, action: Actions, subject: Subjects): boolean {
  const ability = defineAbilitiesFor(role);
  return ability.can(action, subject);
}
