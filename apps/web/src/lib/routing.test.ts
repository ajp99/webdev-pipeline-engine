import { describe, expect, it } from 'vitest';
import { decideAccess, homeFor } from './routing';

const to = (p: string) => ({ kind: 'redirect', to: p });
const allow = { kind: 'allow' };

describe('decideAccess', () => {
  it('sends a signed-out visitor to the login page from everywhere else', () => {
    for (const p of ['/', '/owner', '/owner/projects', '/client', '/anything'])
      expect(decideAccess(false, null, p)).toEqual(to('/login'));
  });
  it('lets a signed-out visitor see the login page', () => {
    expect(decideAccess(false, null, '/login')).toEqual(allow);
  });
  it('keeps a client out of every owner route', () => {
    for (const p of ['/owner', '/owner/queue', '/owner/projects/1'])
      expect(decideAccess(true, 'client', p)).toEqual(to('/client'));
  });
  it('keeps an owner out of client routes', () => {
    expect(decideAccess(true, 'owner', '/client')).toEqual(to('/owner'));
  });
  it('lets each role into its own area', () => {
    expect(decideAccess(true, 'owner', '/owner/queue')).toEqual(allow);
    expect(decideAccess(true, 'client', '/client')).toEqual(allow);
  });
  it('does not mistake a look-alike path for an owner route', () => {
    expect(decideAccess(true, 'client', '/ownership')).toEqual(allow);
    expect(decideAccess(true, 'client', '/owner-x')).toEqual(allow);
  });
  it('sends signed-in users from / and /login to their home', () => {
    expect(decideAccess(true, 'owner', '/')).toEqual(to('/owner'));
    expect(decideAccess(true, 'client', '/login')).toEqual(to('/client'));
  });
  it('gives a signed-in user with no role only the login page', () => {
    expect(decideAccess(true, null, '/owner')).toEqual(to('/login?error=no_role'));
    expect(decideAccess(true, null, '/client')).toEqual(to('/login?error=no_role'));
    expect(decideAccess(true, null, '/login')).toEqual(allow);
  });
  it('homeFor', () => {
    expect(homeFor('owner')).toBe('/owner');
    expect(homeFor('client')).toBe('/client');
    expect(homeFor(null)).toBe('/login');
  });
});
