import { NotificationItem } from '../types';
import { createId } from '../lib/id';
import { dbService } from './db';
import {
  expandUidAliases,
  LEGACY_JUAN_CLIENT_UID,
  LEGACY_MANAGER_UID,
  remapNotificationUserId,
  resolveClientUserId,
  resolveManagerUserId,
} from '../domain/notificationRoutingCore';

const KEY = 'postura_notifications_v4';
const ALIAS_KEY = 'postura_notification_uid_aliases_v1';

class NotificationService {
  private items: NotificationItem[] = [];
  /** legacyUid → current Firebase (or session) uid */
  private aliases: Record<string, string> = {};

  constructor() {
    try {
      this.items = JSON.parse(localStorage.getItem(KEY) || '[]');
    } catch {
      this.items = [];
    }
    try {
      this.aliases = JSON.parse(localStorage.getItem(ALIAS_KEY) || '{}');
    } catch {
      this.aliases = {};
    }
  }

  private persist() {
    localStorage.setItem(KEY, JSON.stringify(this.items.slice(0, 200)));
    localStorage.setItem(ALIAS_KEY, JSON.stringify(this.aliases));
    // Espejo en db para push Firestore (Spark OK; no requiere Blaze/Functions).
    try {
      dbService.replaceNotifications(this.items);
    } catch {
      /* db puede no estar listo en el primer tick */
    }
  }

  /** Vincula un UID legacy del seed al UID real de la sesión. */
  public registerUidAlias(legacyUid: string, currentUid: string): void {
    if (!legacyUid || !currentUid || legacyUid === currentUid) return;
    this.aliases[legacyUid] = currentUid;
    let changed = false;
    this.items = this.items.map((n) => {
      const next = remapNotificationUserId(n.userId, legacyUid, currentUid);
      if (next !== n.userId) {
        changed = true;
        return { ...n, userId: next };
      }
      return n;
    });
    if (changed || this.aliases[legacyUid] === currentUid) this.persist();
  }

  public resolveUid(uid: string): string {
    return this.aliases[uid] || uid;
  }

  public push(input: Omit<NotificationItem, 'id' | 'createdAt' | 'read'>): NotificationItem {
    const client = input.clientId ? dbService.getClientById(input.clientId) : undefined;
    const organizationId =
      input.organizationId?.trim() || client?.organizationId?.trim() || '';
    if (!organizationId) {
      throw new Error('notification requires organizationId from client/session context');
    }
    const item: NotificationItem = {
      ...input,
      organizationId,
      userId: this.resolveUid(input.userId),
      id: createId('ntf'),
      createdAt: new Date().toISOString(),
      read: false,
    };
    this.items.unshift(item);
    this.persist();
    return item;
  }

  public forUser(uid: string, _clientId?: string | null): NotificationItem[] {
    const ids = expandUidAliases(uid, this.aliases);
    return this.items.filter((n) => ids.has(n.userId));
  }

  public unreadCount(uid: string, clientId?: string | null): number {
    return this.forUser(uid, clientId).filter((n) => !n.read).length;
  }

  public markRead(id: string) {
    const item = this.items.find((n) => n.id === id);
    if (item) {
      item.read = true;
      this.persist();
    }
  }

  public markAllRead(uid: string) {
    const ids = expandUidAliases(uid, this.aliases);
    this.items.forEach((n) => {
      if (ids.has(n.userId)) n.read = true;
    });
    this.persist();
  }

  /** Tras hidratar Firestore / merge remoto. */
  public mergeFromRemote(remote: NotificationItem[]): void {
    if (!remote?.length) return;
    const map = new Map(this.items.map((n) => [n.id, n]));
    for (const row of remote) {
      if (!row.id) continue;
      const resolved = { ...row, userId: this.resolveUid(row.userId) };
      map.set(row.id, resolved);
    }
    this.items = Array.from(map.values()).sort((a, b) =>
      String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''))
    );
    localStorage.setItem(KEY, JSON.stringify(this.items.slice(0, 200)));
  }

  public getAll(): NotificationItem[] {
    return [...this.items];
  }
}

export const notificationService = new NotificationService();

/** Notifica al cliente vinculado; false si aún no tiene userId. */
export function notifyClient(
  clientId: string,
  input: Omit<NotificationItem, 'id' | 'createdAt' | 'read' | 'userId' | 'clientId' | 'organizationId'>
): boolean {
  const client = dbService.getClientById(clientId);
  const userId = resolveClientUserId(client);
  if (!userId) return false;
  const organizationId = client?.organizationId?.trim();
  if (!organizationId) return false;
  notificationService.push({ ...input, userId, clientId, organizationId });
  return true;
}

/** Notifica al Brand Manager del cliente (primaryManagerId o alias legacy). */
export function notifyManager(
  clientId: string,
  input: Omit<NotificationItem, 'id' | 'createdAt' | 'read' | 'userId' | 'clientId' | 'organizationId'>
): boolean {
  const client = dbService.getClientById(clientId);
  const raw = resolveManagerUserId(client, LEGACY_MANAGER_UID);
  if (!raw) return false;
  const organizationId = client?.organizationId?.trim();
  if (!organizationId) return false;
  notificationService.push({ ...input, userId: raw, clientId, organizationId });
  return true;
}

/** Tras login Firebase/local: alinea client.userId / primaryManagerId y alias de bandeja. */
export function bindAuthNotificationIdentities(user: {
  uid: string;
  role: string;
  clientId?: string | null;
}): void {
  if (user.role === 'ADMIN') {
    dbService.bindPrimaryManagerUid(user.uid);
    notificationService.registerUidAlias(LEGACY_MANAGER_UID, user.uid);
  } else if (user.clientId) {
    dbService.bindClientUserId(user.clientId, user.uid);
    if (user.clientId === 'client_juan_001') {
      notificationService.registerUidAlias(LEGACY_JUAN_CLIENT_UID, user.uid);
    }
  }
  notificationService.mergeFromRemote(dbService.getNotifications());
}
