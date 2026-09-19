/**
 * SPEC-010 · T603 React Parity Wave P3B — #28 video start / complete / attach_evidence.
 *
 * Presentation + existing recordings.ts only. TransitionClientTask frozen.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const portal = 'src/ui/modules/pages/ReactClientPortalPage.tsx';
const modal = 'src/ui/modules/pages/ReactTeleprompterModal.tsx';
const recordings = 'src/ui/modules/pages/ReactTaskRecordingBlock.tsx';
const workspace = 'src/ui/modules/pages/ReactClientWorkspacePage.tsx';
const hook = 'src/ui/hooks/useWave3Data.ts';
const reads = 'src/ui/data/compatibilityReads.ts';
const seam = 'src/ui/commands/commandSeam.ts';
const legacyTp = 'src/ui/legacy/teleprompterController.ts';
const app = 'src/application/executionDelivery/TransitionClientTask.ts';

describe('P3B A — native video action', () => {
  it('RECORD_VIDEO renders native React teleprompter opener', () => {
    const src = read(portal);
    expect(src).toMatch(/task\.type === 'RECORD_VIDEO'/);
    expect(src).toMatch(/ReactTeleprompterModal/);
    expect(src).toMatch(/react-portal-task-open-video-/);
    expect(src).toMatch(/grabar vídeo con el teleprompter/);
  });
});

describe('P3B B — open does not start', () => {
  it('modal mount camera preview does not invoke start', () => {
    const src = code(modal);
    const mountSlice = src.slice(src.indexOf('useEffect'), src.indexOf('ensureStream'));
    expect(mountSlice).toMatch(/getUserMedia/);
    expect(mountSlice).not.toMatch(/intent:\s*'start'/);
    expect(src).toMatch(/beginRecording/);
  });
});

describe('P3B C — start on first Grabar', () => {
  it('recording start delegates start exactly once via hook', () => {
    const src = code(modal);
    expect(src).toMatch(/startedRef/);
    expect(src).toMatch(/intent:\s*'start'/);
    expect(src).toMatch(/transition\.mutate\(\{ taskId, intent: 'start' \}\)/);
  });
});

describe('P3B D — no TASK_TRANSITIONS copy', () => {
  it('React P3B files do not copy domain transition tables', () => {
    expect(code(modal)).not.toMatch(/TASK_TRANSITIONS/);
    expect(code(portal)).not.toMatch(/TASK_TRANSITIONS/);
    expect(code(recordings)).not.toMatch(/TASK_TRANSITIONS/);
    expect(code(workspace)).not.toMatch(/TASK_TRANSITIONS/);
  });
});

describe('P3B E/F — unauthorized and tenant fail closed', () => {
  it('hook refuses mutation without trusted clientId', () => {
    const src = read(hook);
    expect(src).toMatch(/useTransitionClientTask/);
    expect(src).toMatch(/if \(!scope\?\.clientId\) return \{ ok: false, message: 'Cliente no resuelto' \}/);
    expect(src).toMatch(/requestedClientId: scope\.clientId/);
  });
});

describe('P3B G — permission denial skips start', () => {
  it('ensureStream failure returns before start', () => {
    const src = code(modal);
    expect(src).toMatch(/No se pudo acceder a la cámara/);
    expect(src).toMatch(/if \(!stream\) return;/);
  });
});

describe('P3B H — media cleanup', () => {
  it('stops tracks and revokes object URLs', () => {
    const src = code(modal);
    expect(src).toMatch(/getTracks\(\)\.forEach/);
    expect(src).toMatch(/URL\.revokeObjectURL/);
    expect(src).toMatch(/releaseCapture/);
    expect(code(recordings)).toMatch(/URL\.revokeObjectURL/);
  });
});

describe('P3B I/J — persist then complete', () => {
  it('send uses persistRecording then canonical complete', () => {
    const src = code(modal);
    expect(src).toMatch(/persistTrustedRecording\(/);
    expect(src).toMatch(/intent:\s*'complete'/);
    expect(src).toMatch(/evidenceUrl/);
    expect(src).not.toMatch(/advanceContentPipelineTarget/);
    expect(src).not.toMatch(/VIDEO_SUBMIT_PIPELINE_TARGET/);
    expect(src).not.toMatch(/notifyManager/);
    expect(src).not.toMatch(/VIDEO_SUBMITTED/);
  });
});

describe('P3B K/L — workspace attach_evidence', () => {
  it('re-upload persists then attach_evidence with minted ref', () => {
    const src = code(recordings);
    expect(src).toMatch(/persistTrustedRecording\(/);
    expect(src).toMatch(/intent:\s*'attach_evidence'/);
    expect(src).toMatch(/evidenceUrl: ref/);
    expect(src).toMatch(/downloadRecordingFromEvidence/);
    expect(src).toMatch(/resolveRecordingUrl/);
  });
});

describe('P3B M — no #30', () => {
  it('P3B surfaces never call addEvidenceItem', () => {
    expect(code(modal)).not.toMatch(/addEvidenceItem/);
    expect(code(recordings)).not.toMatch(/addEvidenceItem/);
    expect(code(portal)).not.toMatch(/addEvidenceItem/);
    expect(read(workspace)).not.toMatch(/addEvidenceItem/);
  });
});

describe('P3B N — no React db/Firestore business write', () => {
  it('P3B React files do not import dbService or firestore writes', () => {
    expect(read('src/ui/media/persistTrustedRecording.ts')).toMatch(/persistRecording/);
    expect(read(modal)).not.toMatch(/\bdbService\b/);
    expect(read(recordings)).not.toMatch(/\bdbService\b/);
    expect(read(portal)).not.toMatch(/\bdbService\b/);
    expect(read(workspace)).not.toMatch(/\bdbService\./);
    expect(code(modal)).not.toMatch(/getFirestore|writeBatch|setDoc/);
    expect(code(recordings)).not.toMatch(/getFirestore|writeBatch|setDoc/);
  });
});

describe('P3B O — P3A generic surface remains', () => {
  it('generic view/complete/request_changes remain native', () => {
    const src = read(portal);
    expect(src).toMatch(/isGenericClientTaskType/);
    expect(src).toMatch(/Abrir acción/);
    expect(src).toMatch(/Aprobar y Marcar como Listo/);
    expect(src).toMatch(/Solicitar Ajustes/);
  });
});

describe('P3B P — rollback files remain', () => {
  it('legacy teleprompter and command file still exist', () => {
    expect(read(legacyTp)).toMatch(/intent: 'start'/);
    expect(read(legacyTp)).toMatch(/confirmSendRecording/);
    expect(read(app)).toMatch(/createTransitionClientTask/);
    expect(read('src/components/Modals.ts')).toMatch(/renderTeleprompterModal/);
  });
});

describe('P3B pipeline excluded', () => {
  it('P3B files do not invoke pipeline controller', () => {
    expect(code(modal)).not.toMatch(/advanceContentPipelineTarget/);
    expect(code(recordings)).not.toMatch(/advanceContentPipelineTarget/);
    expect(code(portal)).not.toMatch(/advanceContentPipelineTarget/);
    expect(code(workspace)).not.toMatch(/contentPipelineCommands/);
  });
});

describe('P3B seam and reads', () => {
  it('seam already accepts start attach_evidence complete', () => {
    const src = read(seam);
    const block = src.slice(src.indexOf('transitionClientTask(intent'));
    expect(block).toMatch(/'start'/);
    expect(block).toMatch(/'attach_evidence'/);
    expect(block).toMatch(/'complete'/);
  });

  it('client read adds scriptPayload without evidenceUrl', () => {
    const src = read(reads);
    const fn = src.slice(src.indexOf('export function readClientTasks'));
    const end = fn.indexOf('export function readClientContent');
    const body = end >= 0 ? fn.slice(0, end) : fn.slice(0, 800);
    expect(body).toMatch(/scriptPayload/);
    expect(body).not.toMatch(/evidenceUrl/);
  });

  it('workspace read adds recordingRef and clientNotes', () => {
    const src = read(reads);
    const fn = src.slice(src.indexOf('export interface WorkspaceTaskRead'));
    expect(fn).toMatch(/recordingRef/);
    expect(fn).toMatch(/clientNotes/);
  });

  it('hook exposes start and attach_evidence presentation types', () => {
    const src = read(hook);
    expect(src).toMatch(/'start' \| 'attach_evidence'/);
    expect(src).toMatch(/evidenceUrl: params\.evidenceUrl/);
  });
});
