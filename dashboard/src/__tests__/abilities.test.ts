import { describe, it, expect } from 'vitest';
import { defineAbilitiesFor } from '../lib/abilities';

const founder = { id: 1, role: 'founder' as const };
const employee = { id: 2, role: 'employee' as const };

describe('defineAbilitiesFor — founder', () => {
  const ability = defineAbilitiesFor(founder);

  it('can manage all subjects', () => {
    expect(ability.can('manage', 'all')).toBe(true);
  });

  it('can read/create/update/delete clients', () => {
    expect(ability.can('read', 'Client')).toBe(true);
    expect(ability.can('delete', 'Client')).toBe(true);
  });

  it('can manage billing', () => {
    expect(ability.can('manage', 'Billing')).toBe(true);
  });

  it('can manage agency settings', () => {
    expect(ability.can('manage', 'AgencySettings')).toBe(true);
  });

  it('can publish', () => {
    expect(ability.can('manage', 'Publish')).toBe(true);
  });

  it('can manage users', () => {
    expect(ability.can('manage', 'User')).toBe(true);
  });
});

describe('defineAbilitiesFor — employee', () => {
  const ability = defineAbilitiesFor(employee);

  it('can read clients', () => {
    expect(ability.can('read', 'Client')).toBe(true);
  });

  it('cannot delete clients', () => {
    expect(ability.cannot('delete', 'Client')).toBe(true);
  });

  it('can read tasks and create/update them', () => {
    expect(ability.can('read', 'Task')).toBe(true);
    expect(ability.can('create', 'Task')).toBe(true);
    expect(ability.can('update', 'Task')).toBe(true);
  });

  it('cannot manage billing', () => {
    expect(ability.cannot('manage', 'Billing')).toBe(true);
  });

  it('cannot manage agency settings', () => {
    expect(ability.cannot('manage', 'AgencySettings')).toBe(true);
  });

  it('cannot publish', () => {
    expect(ability.cannot('manage', 'Publish')).toBe(true);
  });

  it('cannot manage users', () => {
    expect(ability.cannot('manage', 'User')).toBe(true);
  });

  it('cannot delete agents', () => {
    expect(ability.cannot('delete', 'Agent')).toBe(true);
  });

  it('can read analytics', () => {
    expect(ability.can('read', 'Analytics')).toBe(true);
  });

  it('can read approvals', () => {
    expect(ability.can('read', 'Approval')).toBe(true);
  });
});
