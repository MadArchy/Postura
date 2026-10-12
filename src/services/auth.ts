import { AuthAccount, Invitation, User } from '../types';
import { auditService } from './audit';
import { hashPassword, verifyPassword, createSalt } from '../lib/hash';
import { createId } from '../lib/id';
import { FIREBASE_ENABLED } from '../firebase/config';
import { dbService } from './db';

const ACCOUNTS_KEY = 'postura_accounts_v4';
const SESSION_KEY = 'postura_session_v4';
const IMPERSONATION_KEY = 'postura_impersonation_v1';
const DEFAULT_PASSWORD = 'Postura2026!';

interface ImpersonationContext {
  adminUid: string;
  clientId: string;
  displayName: string;
}

class AuthService {
  private currentUser: User | null = null;
  private accounts: AuthAccount[] = [];
  private listeners: Array<(user: User | null) => void> = [];
  private impersonation: ImpersonationContext | null = null;
  public readonly ready: Promise<void>;

  constructor() {
    this.ready = this.init();
  }

  private loadImpersonation(): ImpersonationContext | null {
    try {
      const raw = localStorage.getItem(IMPERSONATION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as ImpersonationContext;
      if (!parsed.adminUid || !parsed.clientId) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private persistImpersonation(ctx: ImpersonationContext | null) {
    this.impersonation = ctx;
    if (ctx) localStorage.setItem(IMPERSONATION_KEY, JSON.stringify(ctx));
    else localStorage.removeItem(IMPERSONATION_KEY);
  }

  private async syncFirestoreSession(user: User) {
    const sync = await import('./firestore/sync');
    sync.setFirestoreAuthoritative(true);

    let clientIds: string[] = [];
    if (user.role === 'ADMIN') {
      const boot = await dbService.bootstrapFirestoreIfEmpty();
      if (!boot.bootstrapped) {
        await dbService.hydrateFromRemote();
      }
      clientIds = dbService.getClients().map((c) => c.id);
    } else if (user.clientId) {
      await dbService.hydrateFromRemote([user.clientId]);
      clientIds = [user.clientId];
    }

    const { bindAuthNotificationIdentities } = await import('./notifications');
    bindAuthNotificationIdentities(user);

    if (clientIds.length) {
      await sync.startFirestoreRealtimeSync(clientIds, (partial, meta) => {
        dbService.importSnapshot(partial, {
          merge: true,
          skipRemote: true,
          scopeClientId: meta.clientId,
        });
      });
    }

    if (user.role === 'ADMIN' && user.organizationId) {
      const { syncStrategicBriefsWithFirestore } = await import('./strategicBriefConsumer');
      await syncStrategicBriefsWithFirestore(user.organizationId, clientIds).catch((err: unknown) => {
        const reason = err instanceof Error ? err.message : String(err);
        sync.reportFirestorePushError(`No se pudieron cargar los briefs: ${reason}`);
      });
    }
  }

  private async init() {
    if (FIREBASE_ENABLED) {
      const { bindFirebaseAuthState } = await import('../firebase/authBridge');
      await bindFirebaseAuthState(async (user) => {
        if (!user) {
          const sync = await import('./firestore/sync');
          sync.stopFirestoreRealtimeSync();
          sync.setFirestoreAuthoritative(false);
          const { stopStrategicBriefSync } = await import('./firestore/strategicBriefSync');
          stopStrategicBriefSync();
          this.currentUser = null;
          this.notify();
          return;
        }
        this.currentUser = user;
        this.notify();
        await this.syncFirestoreSession(user);
      });
      return;
    }

    try {
      this.accounts = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
    } catch {
      this.accounts = [];
    }
    if (this.accounts.length === 0) {
      await this.seedAccounts();
    } else {
      await this.ensureElenaLocalAccount();
      await this.ensureLocalAccountsHaveTenant();
    }

    this.impersonation = this.loadImpersonation();
    const saved = localStorage.getItem(SESSION_KEY);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as { uid?: string; displayName?: string };
      if (!parsed.uid) return;

      const account = this.accounts.find((a) => a.uid === parsed.uid && a.status === 'ACTIVE');
      if (!account) {
        this.setSession(null);
        return;
      }

      if (this.impersonation) {
        const admin = this.accounts.find(
          (a) => a.uid === this.impersonation!.adminUid && a.role === 'ADMIN' && a.status === 'ACTIVE'
        );
        if (!admin || account.role !== 'CLIENT' || account.clientId !== this.impersonation.clientId) {
          this.persistImpersonation(null);
          this.currentUser = this.toUser(account);
          return;
        }
        this.currentUser = this.toUser(account, {
          displayName: parsed.displayName || this.impersonation.displayName,
        });
        return;
      }

      this.currentUser = this.toUser(account, {
        displayName: parsed.displayName,
      });
      void import('./notifications').then(({ bindAuthNotificationIdentities }) => {
        if (this.currentUser) bindAuthNotificationIdentities(this.currentUser);
      });
    } catch {
      this.currentUser = null;
    }
  }

  private async seedAccounts() {
    /** Explicit demo fixture org — not a runtime fallback for missing claims. */
    const DEMO_ORG_ID = 'org_aurora_01';
    const managerSalt = createSalt();
    const clientSalt = createSalt();
    const elenaSalt = createSalt();
    this.accounts = [
      {
        uid: 'user_admin_01',
        email: 'manager@postura.internal',
        passwordSalt: managerSalt,
        passwordHash: await hashPassword(DEFAULT_PASSWORD, managerSalt),
        role: 'ADMIN',
        organizationId: DEMO_ORG_ID,
        status: 'ACTIVE',
      },
      {
        uid: 'user_client_juan_01',
        email: 'juan.vasquez@lexfirm.com',
        passwordSalt: clientSalt,
        passwordHash: await hashPassword(DEFAULT_PASSWORD, clientSalt),
        role: 'CLIENT',
        organizationId: DEMO_ORG_ID,
        clientId: 'client_juan_001',
        status: 'ACTIVE',
      },
      {
        uid: 'user_client_elena_01',
        email: 'elena.martinez@lexfirm.com',
        passwordSalt: elenaSalt,
        passwordHash: await hashPassword(DEFAULT_PASSWORD, elenaSalt),
        role: 'CLIENT',
        organizationId: DEMO_ORG_ID,
        clientId: 'client_elena_002',
        status: 'ACTIVE',
      },
    ];
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(this.accounts));
  }

  /** Migración: cuentas locales antiguas sin Elena (aislamiento DoD §7). */
  private async ensureElenaLocalAccount() {
    if (this.accounts.some((a) => a.email === 'elena.martinez@lexfirm.com')) return;
    const DEMO_ORG_ID = 'org_aurora_01';
    const elenaSalt = createSalt();
    this.accounts.push({
      uid: 'user_client_elena_01',
      email: 'elena.martinez@lexfirm.com',
      passwordSalt: elenaSalt,
      passwordHash: await hashPassword(DEFAULT_PASSWORD, elenaSalt),
      role: 'CLIENT',
      organizationId: DEMO_ORG_ID,
      clientId: 'client_elena_002',
      status: 'ACTIVE',
    });
    this.persistAccounts();
  }

  /** Local accounts missing tenant envelope are invalid — re-seed demo fixtures (not silent default). */
  private async ensureLocalAccountsHaveTenant() {
    const invalid = this.accounts.some(
      (a) =>
        !a.organizationId?.trim() ||
        (a.role === 'CLIENT' && !a.clientId?.trim())
    );
    if (invalid) {
      await this.seedAccounts();
    }
  }

  private persistAccounts() {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(this.accounts));
  }

  public getCurrentUser(): User | null {
    return this.currentUser;
  }

  /** True solo cuando un ADMIN está viendo el portal como cliente. */
  public isImpersonating(): boolean {
    return this.impersonation !== null && this.currentUser?.role === 'CLIENT';
  }

  public subscribe(callback: (user: User | null) => void): () => void {
    this.listeners.push(callback);
    callback(this.currentUser);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  private notify() {
    this.listeners.forEach((cb) => cb(this.currentUser));
  }

  private toUser(account: AuthAccount, extras?: Partial<User>): User {
    const organizationId = account.organizationId?.trim();
    if (!organizationId) {
      throw new Error('Cuenta sin organizationId (fail-closed; no default tenant).');
    }
    if (account.role === 'CLIENT' && !account.clientId?.trim()) {
      throw new Error('Cuenta CLIENT sin clientId (fail-closed).');
    }
    const isAdmin = account.role === 'ADMIN';
    return {
      uid: account.uid,
      organizationId,
      email: account.email,
      displayName: isAdmin ? 'Santiago Morales (Brand Manager)' : extras?.displayName || account.email,
      role: account.role,
      status: account.status,
      clientId: isAdmin ? null : account.clientId,
      managerId: isAdmin ? null : 'user_admin_01',
      mustCompleteOnboarding: extras?.mustCompleteOnboarding ?? false,
      aiKeyManagementAllowed: isAdmin,
      locale: 'es-ES',
      timezone: 'America/Bogota',
      lastLoginAt: new Date().toISOString(),
      createdAt: '2026-08-01T00:00:00Z',
      createdBy: 'system',
      updatedAt: new Date().toISOString(),
      updatedBy: 'system',
    };
  }

  private setSession(user: User | null) {
    this.currentUser = user;
    if (user) {
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ uid: user.uid, displayName: user.displayName })
      );
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
    this.notify();
  }

  public async login(email: string, password: string): Promise<{ ok: true } | { ok: false; message: string }> {
    if (FIREBASE_ENABLED) {
      const { firebaseSignIn } = await import('../firebase/authBridge');
      const result = await firebaseSignIn(email, password);
      if (!result.ok) return result;
      this.persistImpersonation(null);
      auditService.log(result.user, 'LOGIN', 'User', result.user.uid);
      this.currentUser = result.user;
      await this.syncFirestoreSession(result.user);
      this.notify();
      return { ok: true };
    }

    const account = this.accounts.find((a) => a.email.toLowerCase() === email.trim().toLowerCase());
    if (!account) return { ok: false, message: 'Credenciales inválidas.' };
    if (account.status === 'SUSPENDED') return { ok: false, message: 'Cuenta suspendida.' };
    if (account.status !== 'ACTIVE') return { ok: false, message: 'La cuenta aún no está activa.' };
    const valid = await verifyPassword(password, account.passwordSalt, account.passwordHash);
    if (!valid) return { ok: false, message: 'Credenciales inválidas.' };
    this.persistImpersonation(null);
    const user = this.toUser(account);
    auditService.log(user, 'LOGIN', 'User', user.uid);
    this.setSession(user);
    const { bindAuthNotificationIdentities } = await import('./notifications');
    bindAuthNotificationIdentities(user);
    return { ok: true };
  }

  public async registerFromInvite(
    invite: Invitation,
    password: string,
    displayName: string
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    if (invite.status !== 'PENDING') return { ok: false, message: 'La invitación no está vigente.' };
    if (Date.parse(invite.expiresAt) < Date.now()) return { ok: false, message: 'INVITATION_EXPIRED' };
    if (!invite.organizationId?.trim()) {
      return { ok: false, message: 'Invitación sin organizationId (fail-closed).' };
    }
    if (!invite.clientId?.trim()) {
      return { ok: false, message: 'Invitación sin clientId (fail-closed).' };
    }

    const organizationId = invite.organizationId.trim();
    const existingIdx = this.accounts.findIndex(
      (a) => a.email.toLowerCase() === invite.email.toLowerCase()
    );
    const salt = createSalt();
    const passwordHash = await hashPassword(password, salt);

    let account: AuthAccount;
    if (existingIdx >= 0) {
      const existing = this.accounts[existingIdx];
      const pendingInviteMatch =
        existing.status === 'INVITED' &&
        existing.clientId === invite.clientId &&
        existing.organizationId?.trim() === organizationId;
      if (!pendingInviteMatch) {
        return { ok: false, message: 'Ya existe una cuenta con ese correo.' };
      }
      account = {
        ...existing,
        passwordSalt: salt,
        passwordHash,
        status: 'ACTIVE',
      };
      this.accounts[existingIdx] = account;
    } else {
      account = {
        uid: createId('user'),
        email: invite.email,
        passwordSalt: salt,
        passwordHash,
        role: 'CLIENT',
        organizationId,
        clientId: invite.clientId,
        status: 'ACTIVE',
      };
      this.accounts.push(account);
    }

    this.persistAccounts();
    this.persistImpersonation(null);
    const user = this.toUser(account, { displayName, mustCompleteOnboarding: true });
    auditService.log(user, 'ACCEPT_INVITATION', 'Invitation', invite.id);
    this.setSession(user);
    return { ok: true };
  }

  public logout(): void {
    auditService.log(this.currentUser, 'LOGOUT', 'User', this.currentUser?.uid || 'anon');
    this.persistImpersonation(null);
    if (FIREBASE_ENABLED) {
      void (async () => {
        const { firebaseSignOut } = await import('../firebase/authBridge');
        const { setFirestoreAuthoritative } = await import('./firestore/sync');
        await firebaseSignOut();
        setFirestoreAuthoritative(false);
        this.currentUser = null;
        this.notify();
      })();
      return;
    }
    this.setSession(null);
  }

  public impersonateClient(clientId: string, displayName: string): void {
    if (this.currentUser?.role !== 'ADMIN') return;
    const account = this.accounts.find((a) => a.clientId === clientId && a.role === 'CLIENT' && a.status === 'ACTIVE');
    if (!account) {
      auditService.log(this.currentUser, 'IMPERSONATE_DENIED', 'Client', clientId, {
        reason: 'NO_CLIENT_ACCOUNT',
      });
      return;
    }
    this.persistImpersonation({
      adminUid: this.currentUser.uid,
      clientId,
      displayName,
    });
    const user = this.toUser(account, { displayName });
    auditService.log(this.currentUser, 'IMPERSONATE_CLIENT', 'Client', clientId);
    this.setSession(user);
  }

  public returnToManager(): void {
    if (!this.impersonation) return;
    const account = this.accounts.find(
      (a) => a.uid === this.impersonation!.adminUid && a.role === 'ADMIN' && a.status === 'ACTIVE'
    );
    if (!account) {
      this.persistImpersonation(null);
      this.setSession(null);
      return;
    }
    this.persistImpersonation(null);
    this.setSession(this.toUser(account));
  }

  /** Limpia el flag de onboarding en la sesión activa (p. ej. tras completar o saltar). */
  public clearOnboardingFlag(): void {
    if (!this.currentUser) return;
    this.currentUser = { ...this.currentUser, mustCompleteOnboarding: false };
    this.setSession(this.currentUser);
  }

  public createPendingAccount(email: string, clientId: string, organizationId: string): void {
    if (this.accounts.some((a) => a.email.toLowerCase() === email.toLowerCase())) return;
    const org = organizationId.trim();
    if (!org) {
      throw new Error('organizationId required for pending account (no default tenant)');
    }
    this.accounts.push({
      uid: createId('user'),
      email,
      passwordSalt: '',
      passwordHash: '',
      role: 'CLIENT',
      organizationId: org,
      clientId,
      status: 'INVITED',
    });
    this.persistAccounts();
  }
}

export const authService = new AuthService();
export const DEFAULT_LOGIN_PASSWORD = DEFAULT_PASSWORD;
