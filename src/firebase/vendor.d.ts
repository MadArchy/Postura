/** Minimal typings when `firebase` is not yet installed locally. Real package types take precedence. */
declare module 'firebase/app' {
  export interface FirebaseApp {
    name: string;
  }
  export function initializeApp(config: Record<string, unknown>): FirebaseApp;
  export function getApps(): FirebaseApp[];
  export function getApp(name?: string): FirebaseApp;
}

declare module 'firebase/auth' {
  import type { FirebaseApp } from 'firebase/app';

  export interface User {
    uid: string;
    email: string | null;
    displayName: string | null;
    getIdTokenResult(forceRefresh?: boolean): Promise<{ claims: Record<string, unknown> }>;
    getIdToken(forceRefresh?: boolean): Promise<string>;
  }

  export interface Auth {
    currentUser: User | null;
  }

  export function getAuth(app?: FirebaseApp): Auth;
  export function connectAuthEmulator(auth: Auth, url: string, options?: { disableWarnings?: boolean }): void;
  export function signInWithEmailAndPassword(auth: Auth, email: string, password: string): Promise<{ user: User }>;
  export function signOut(auth: Auth): Promise<void>;
  export function onAuthStateChanged(auth: Auth, callback: (user: User | null) => void): () => void;
}

declare module 'firebase/firestore' {
  import type { FirebaseApp } from 'firebase/app';

  export type Firestore = object;
  export type DocumentReference = object;
  export interface WriteBatch {
    set(ref: DocumentReference, data: unknown, options?: { merge?: boolean }): WriteBatch;
    delete(ref: DocumentReference): WriteBatch;
    commit(): Promise<void>;
  }

  export function getFirestore(app?: FirebaseApp): Firestore;
  export function connectFirestoreEmulator(db: Firestore, host: string, port: number): void;
  export function doc(db: Firestore, ...path: string[]): DocumentReference;
  export function collection(db: Firestore, ...path: string[]): unknown;
  export function writeBatch(db: Firestore): WriteBatch;
  export function getDoc(ref: DocumentReference): Promise<{ exists(): boolean; data(): Record<string, unknown> | undefined }>;
  export function getDocs(q: unknown): Promise<{ docs: Array<{ id: string; data(): Record<string, unknown> }> }>;
  export interface QuerySnapshot {
    docs: Array<{ id: string; data(): Record<string, unknown> }>;
  }
  export function onSnapshot(
    ref: unknown,
    callback: (snapshot: QuerySnapshot) => void
  ): () => void;
  export function query(ref: unknown, ...constraints: unknown[]): unknown;
  export function where(fieldPath: string, opStr: string, value: unknown): unknown;
  export function setDoc(ref: DocumentReference, data: unknown, options?: { merge?: boolean }): Promise<void>;
  export function serverTimestamp(): unknown;
  export function deleteField(): unknown;
}

declare module 'firebase/storage' {
  import type { FirebaseApp } from 'firebase/app';

  export type FirebaseStorage = object;
  export type StorageReference = object;
  export interface UploadResult {
    ref: StorageReference;
  }

  export function getStorage(app?: FirebaseApp): FirebaseStorage;
  export function connectStorageEmulator(storage: FirebaseStorage, host: string, port: number): void;
  export function ref(storage: FirebaseStorage, path: string): StorageReference;
  export function uploadBytes(
    ref: StorageReference,
    data: Blob,
    metadata?: { contentType?: string }
  ): Promise<UploadResult>;
  export function getDownloadURL(ref: StorageReference): Promise<string>;
  export function deleteObject(ref: StorageReference): Promise<void>;
  export function updateMetadata(
    ref: StorageReference,
    metadata: { contentType?: string; customMetadata?: Record<string, string> }
  ): Promise<unknown>;
}

declare module '@firebase/rules-unit-testing' {
  export interface RulesTestEnvironment {
    authenticatedContext(uid: string, token?: Record<string, unknown>): {
      firestore(): unknown;
      storage(): unknown;
    };
    unauthenticatedContext(): {
      firestore(): unknown;
      storage(): unknown;
    };
    withSecurityRulesDisabled(callback: (context: { firestore(): unknown; storage(): unknown }) => Promise<void>): Promise<void>;
    clearFirestore(): Promise<void>;
    clearStorage(): Promise<void>;
    cleanup(): Promise<void>;
  }

  export function initializeTestEnvironment(config: {
    projectId: string;
    firestore?: { rules: string; host?: string; port?: number };
    storage?: { rules: string; host?: string; port?: number };
  }): Promise<RulesTestEnvironment>;

  export function assertFails(pr: Promise<unknown>): Promise<unknown>;
  export function assertSucceeds(pr: Promise<unknown>): Promise<unknown>;
}
