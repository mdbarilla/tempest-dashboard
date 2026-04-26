import { isLocalAccess } from './access';

// Garden nav is only available on local access (towerhill.local, localhost, private IPs).
// Hidden completely on towerhill.app (external).
export function shouldShowGardenNav() {
  return isLocalAccess();
}
