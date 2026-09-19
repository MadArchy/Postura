/**
 * SPEC-010 P3B — React teleprompter / camera presentation for #28 RECORD_VIDEO.
 *
 * COMMAND: TransitionClientTask `start` (first Grabar) then `complete` + recording ref.
 * MEDIA: existing `persistRecording` only. Pipeline / #30 / notify / extra audit = 0.
 */

import { useEffect, useRef, useState } from 'react';
import { useSession } from '../../providers/SessionProvider';
import { useClientTaskScriptPayload, useTransitionClientTask } from '../../hooks/useWave3Data';
import { persistTrustedRecording } from '../../media/persistTrustedRecording';
import {
  MAX_RECORDING_DURATION_MS,
  RECORDING_VIDEO_BITS_PER_SECOND,
} from '../../../domain/recordingLimits';

function preferredMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
    return 'video/webm;codecs=vp9,opus';
  }
  if (MediaRecorder.isTypeSupported('video/webm')) return 'video/webm';
  return undefined;
}

export function ReactTeleprompterModal({
  taskId,
  title,
  scriptPayload,
  onClose,
}: {
  taskId: string;
  title: string;
  scriptPayload: string | null;
  onClose: () => void;
}) {
  const { tenantScope } = useSession();
  const transition = useTransitionClientTask(tenantScope);
  const scriptRead = useClientTaskScriptPayload(tenantScope, taskId);
  const scriptText = scriptRead.data ?? scriptPayload;
  const cameraRef = useRef<HTMLVideoElement | null>(null);
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const previewUrlRef = useRef<string | null>(null);
  const startedRef = useRef(false);
  const scrollTimerRef = useRef<number | null>(null);
  const limitTimerRef = useRef<number | null>(null);
  const [phase, setPhase] = useState<'record' | 'preview'>('record');
  const [recording, setRecording] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ kind: 'success' | 'error' | 'info'; text: string } | null>(
    null
  );
  const [sending, setSending] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (cameraRef.current) cameraRef.current.srcObject = null;
  };

  const revokePreview = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  };

  const stopRecorder = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop();
      } catch {
        /* already stopped */
      }
    }
    recorderRef.current = null;
    chunksRef.current = [];
  };

  const stopScroll = () => {
    setScrolling(false);
    if (scrollTimerRef.current) {
      window.clearInterval(scrollTimerRef.current);
      scrollTimerRef.current = null;
    }
  };

  const clearLimit = () => {
    if (limitTimerRef.current) {
      window.clearTimeout(limitTimerRef.current);
      limitTimerRef.current = null;
    }
  };

  const releaseCapture = () => {
    clearLimit();
    stopScroll();
    stopRecorder();
    stopTracks();
    revokePreview();
    setPreviewBlob(null);
    setRecording(false);
  };

  useEffect(() => {
    let cancelled = false;
    const startPreview = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (cameraRef.current) {
          cameraRef.current.srcObject = stream;
          await cameraRef.current.play().catch(() => undefined);
        }
      } catch {
        if (!cancelled) {
          setDeviceError('No se pudo acceder a la cámara. Revisa permisos del navegador.');
        }
      }
    };
    void startPreview();
    return () => {
      cancelled = true;
      releaseCapture();
    };
    // Capture session is owned by this mount; cleanup runs on unmount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ensureStream = async (): Promise<MediaStream | null> => {
    if (streamRef.current) return streamRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true,
      });
      streamRef.current = stream;
      if (cameraRef.current) {
        cameraRef.current.srcObject = stream;
        await cameraRef.current.play().catch(() => undefined);
      }
      setDeviceError(null);
      return stream;
    } catch {
      setDeviceError('No se pudo acceder a la cámara. Revisa permisos del navegador.');
      stopTracks();
      return null;
    }
  };

  const beginRecording = async () => {
    setStatusMessage(null);
    const stream = await ensureStream();
    if (!stream) return;

    chunksRef.current = [];
    revokePreview();
    setPreviewBlob(null);

    try {
      const mimeType = preferredMimeType();
      const options: MediaRecorderOptions = { videoBitsPerSecond: RECORDING_VIDEO_BITS_PER_SECOND };
      if (mimeType) options.mimeType = mimeType;
      const recorder = new MediaRecorder(stream, options);
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorderRef.current = recorder;
      recorder.start(1000);
    } catch {
      setStatusMessage({ kind: 'error', text: 'Tu navegador no soporta grabación de video aquí' });
      return;
    }

    if (!startedRef.current) {
      startedRef.current = true;
      transition.mutate({ taskId, intent: 'start' });
    }

    setRecording(true);
    setStatusMessage({ kind: 'info', text: 'Grabando… (máx. 10 min)' });
    clearLimit();
    limitTimerRef.current = window.setTimeout(() => {
      void stopToPreview();
      setStatusMessage({ kind: 'error', text: 'Grabación detenida: máximo 10 minutos' });
    }, MAX_RECORDING_DURATION_MS);
  };

  const stopToPreview = async () => {
    clearLimit();
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      setStatusMessage({ kind: 'error', text: 'No hay una grabación activa' });
      return;
    }
    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });
    recorderRef.current = null;
    setRecording(false);
    const blob = chunksRef.current.length
      ? new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || 'video/webm' })
      : null;
    chunksRef.current = [];
    if (!blob || blob.size === 0) {
      setStatusMessage({ kind: 'error', text: 'La grabación quedó vacía. Intenta de nuevo.' });
      return;
    }
    revokePreview();
    const url = URL.createObjectURL(blob);
    previewUrlRef.current = url;
    setPreviewBlob(blob);
    setPhase('preview');
    stopScroll();
    if (previewRef.current) {
      previewRef.current.src = url;
      await previewRef.current.play().catch(() => undefined);
    }
  };

  const retake = () => {
    revokePreview();
    setPreviewBlob(null);
    setPhase('record');
    void ensureStream();
  };

  const send = async () => {
    if (!previewBlob) {
      setStatusMessage({ kind: 'error', text: 'Graba un video antes de enviar' });
      return;
    }
    if (!tenantScope?.organizationId || !tenantScope.clientId) {
      setStatusMessage({ kind: 'error', text: 'Cliente no resuelto' });
      return;
    }
    setSending(true);
    try {
      const evidenceUrl = await persistTrustedRecording(
        tenantScope.organizationId,
        tenantScope.clientId,
        taskId,
        previewBlob
      );
      const result = await transition.mutateAsync({
        taskId,
        intent: 'complete',
        evidenceUrl,
        clientNotes: 'Video enviado desde el teleprompter.',
      });
      if (!result.ok) {
        setStatusMessage({ kind: 'error', text: result.message || 'No se pudo enviar el video' });
        setSending(false);
        return;
      }
      releaseCapture();
      onClose();
    } catch (error) {
      setStatusMessage({
        kind: 'error',
        text: error instanceof Error ? error.message : 'No se pudo enviar el video',
      });
      setSending(false);
    }
  };

  const toggleScroll = () => {
    if (scrolling) {
      stopScroll();
      return;
    }
    setScrolling(true);
    scrollTimerRef.current = window.setInterval(() => {
      const area = scrollRef.current;
      if (!area) return;
      area.scrollTop += speed;
      if (area.scrollTop + area.clientHeight >= area.scrollHeight) {
        stopScroll();
      }
    }, 40);
  };

  return (
    <section
      className="card modal-card teleprompter-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Teleprompter y grabación"
      data-testid="react-teleprompter-modal"
      data-authority="PRESENTATION"
    >
      <div className="card-header">
        <div>
          <h3>Teleprompter y grabación</h3>
          <p className="muted small">{title}</p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          data-testid="react-teleprompter-close"
          onClick={() => {
            releaseCapture();
            onClose();
          }}
        >
          Cerrar
        </button>
      </div>

      <div className="teleprompter-layout">
        <div className="teleprompter-media">
          <video
            ref={cameraRef}
            className="teleprompter-camera"
            autoPlay
            muted
            playsInline
            data-testid="react-teleprompter-camera"
            hidden={phase === 'preview'}
          />
          <video
            ref={previewRef}
            className="teleprompter-preview"
            playsInline
            controls
            data-testid="react-teleprompter-preview"
            hidden={phase !== 'preview'}
          />
          {recording ? (
            <p className="teleprompter-rec-indicator" data-testid="react-teleprompter-recording">
              Grabando
            </p>
          ) : null}
          <p className="muted small">
            {deviceError ?? 'Activa cámara y micrófono. Ideal en móvil en vertical.'}
          </p>
        </div>
        <div className="teleprompter-container">
          <div
            ref={scrollRef}
            id="react-teleprompter-scroll-area"
            className="teleprompter-glass"
            data-testid="react-teleprompter-script"
          >
            <p className="teleprompter-text">{scriptText || 'Guion no disponible.'}</p>
          </div>
        </div>
      </div>

      {phase === 'record' ? (
        <div className="teleprompter-controls" data-testid="react-teleprompter-record-controls">
          <button type="button" className="btn btn-primary" onClick={toggleScroll}>
            {scrolling ? 'Pausar desplazamiento' : 'Iniciar desplazamiento'}
          </button>
          <label className="teleprompter-speed-control">
            <span className="muted small">Velocidad</span>
            <input
              type="range"
              min={1}
              max={5}
              value={speed}
              onChange={(event) => setSpeed(Number(event.target.value))}
              data-testid="react-teleprompter-speed"
            />
          </label>
          {!recording ? (
            <button
              type="button"
              className="btn btn-danger"
              data-testid="react-teleprompter-record"
              onClick={() => void beginRecording()}
            >
              Grabar
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-secondary"
              data-testid="react-teleprompter-stop"
              onClick={() => void stopToPreview()}
            >
              Detener
            </button>
          )}
        </div>
      ) : (
        <div className="teleprompter-controls" data-testid="react-teleprompter-preview-controls">
          <p className="muted small">Revisa tu toma antes de enviarla al manager.</p>
          <button type="button" className="btn btn-secondary" data-testid="react-teleprompter-retake" onClick={retake}>
            Volver a grabar
          </button>
          <button
            type="button"
            className="btn btn-success"
            data-testid="react-teleprompter-send"
            disabled={sending}
            onClick={() => void send()}
          >
            {sending ? 'Enviando…' : 'Enviar video al manager'}
          </button>
        </div>
      )}

      {statusMessage ? (
        <p
          className={statusMessage.kind === 'error' ? 'form-error' : 'form-success'}
          role="status"
          data-testid={
            statusMessage.kind === 'error' ? 'react-teleprompter-error' : 'react-teleprompter-status'
          }
        >
          {statusMessage.text}
        </p>
      ) : null}
    </section>
  );
}
