/**
 * Presentation persist for P3B. Production uses existing `persistRecording`.
 * E2E may replace `__posturaUi.persistRecording` with the IndexedDB path
 * so tests do not mutate live Firebase Storage.
 */

type PersistFn = (
  organizationId: string,
  clientId: string,
  taskId: string,
  blob: Blob
) => Promise<string>;

export async function persistTrustedRecording(
  organizationId: string,
  clientId: string,
  taskId: string,
  blob: Blob
): Promise<string> {
  const harness = (
    window as unknown as {
      __posturaUi?: { persistRecording?: PersistFn };
    }
  ).__posturaUi;
  if (harness?.persistRecording) {
    return harness.persistRecording(organizationId, clientId, taskId, blob);
  }
  const { persistRecording } = await import('../../services/recordings');
  return persistRecording(organizationId, clientId, taskId, blob);
}
