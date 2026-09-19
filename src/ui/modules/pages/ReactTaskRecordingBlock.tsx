/**
 * SPEC-010 P3B — ADMIN workspace recording play / download / re-upload.
 *
 * Play/download: existing recordings.ts only.
 * Re-upload: persistRecording → TransitionClientTask `attach_evidence`.
 * #30 / pipeline = 0.
 */

import { useEffect, useState } from 'react';
import { useTransitionClientTask } from '../../hooks/useWave3Data';
import type { TrustedTenantScope } from '../../query/tenantScope';
import { persistTrustedRecording } from '../../media/persistTrustedRecording';

function hasRecordingRef(evidenceUrl: string | null): boolean {
  return Boolean(
    evidenceUrl && (evidenceUrl.startsWith('indexeddb:') || evidenceUrl.startsWith('storage:'))
  );
}

export function ReactTaskRecordingBlock({
  taskId,
  evidenceUrl,
  clientNotes,
  scope,
}: {
  taskId: string;
  evidenceUrl: string | null;
  clientNotes: string | null;
  scope: TrustedTenantScope | null;
}) {
  const transition = useTransitionClientTask(scope);
  const [src, setSrc] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const playable = hasRecordingRef(evidenceUrl);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    if (!playable || !evidenceUrl) {
      setSrc(null);
      return;
    }
    void import('../../../services/recordings').then(({ resolveRecordingUrl }) =>
      resolveRecordingUrl(evidenceUrl).then((url) => {
        if (cancelled || !url) return;
        if (url.startsWith('blob:')) objectUrl = url;
        setSrc(url);
      })
    );
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [evidenceUrl, playable]);

  if (!playable) return null;

  const onDownload = async () => {
    const { downloadRecordingFromEvidence } = await import('../../../services/recordings');
    const ok = await downloadRecordingFromEvidence(evidenceUrl, undefined);
    if (!ok) setMessage('No hay video guardado para esta tarea');
  };

  const onReupload = async (file: File | undefined) => {
    if (!file) return;
    if (!scope?.organizationId || !scope.clientId) {
      setMessage('Cliente no resuelto');
      return;
    }
    try {
      const ref = await persistTrustedRecording(
        scope.organizationId,
        scope.clientId,
        taskId,
        file
      );
      const result = await transition.mutateAsync({
        taskId,
        intent: 'attach_evidence',
        evidenceUrl: ref,
        clientNotes: 'Versión re-subida por el manager.',
      });
      setMessage(result.ok ? 'Video actualizado' : result.message || 'No se pudo actualizar la evidencia');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo actualizar la evidencia');
    }
  };

  return (
    <div className="task-recording-block" data-testid={`react-ws-task-recording-${taskId}`}>
      {src ? (
        <video
          className="task-recording-video"
          controls
          playsInline
          preload="metadata"
          src={src}
          data-testid={`react-ws-task-recording-video-${taskId}`}
        />
      ) : (
        <p className="muted small">Cargando grabación…</p>
      )}
      <div className="task-recording-actions">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          data-testid={`react-ws-task-recording-download-${taskId}`}
          onClick={() => void onDownload()}
        >
          Descargar video
        </button>
        <label className="btn btn-ghost btn-sm">
          Re-subir versión
          <input
            type="file"
            accept="video/*"
            className="sr-only"
            data-testid={`react-ws-task-recording-reupload-${taskId}`}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              void onReupload(file);
            }}
          />
        </label>
      </div>
      {clientNotes ? <p className="muted small">{clientNotes}</p> : null}
      {message ? (
        <p className="muted small" role="status" data-testid={`react-ws-task-recording-msg-${taskId}`}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
