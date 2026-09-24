/**
 * SPEC-010 T-010-402 — modal dispatch extracted from the `main.ts` controller.
 *
 * This is a pure presentation router: given the current modal selection it
 * returns markup. It performs no persistence, triggers no command and holds no
 * authority. Event wiring for whatever it renders stays with the owning legacy
 * controller, so this module cannot become a second command path.
 *
 * One case is not pure markup: the content editor is manager-only. Rather than
 * mutating shared state from inside a render (the pre-extraction behaviour), the
 * refusal is returned as `forceClose` and the caller applies it. Same outcome,
 * but a render no longer has a hidden write.
 */
import {
  renderTeleprompterModal,
  renderArticleReviewModal,
  renderContentDiffModal,
  renderCreateClientModal,
  renderComparativeModal,
  renderChallengeModal,
  renderAddEvidenceModal,
  renderContentEditorModal,
  renderContentPreviewModal,
  renderFeedbackModal,
  renderAddTaskModal,
  renderDeliveryPreviewModal,
  renderGenerateContentModal,
} from '../components/Modals';
import { renderOnboardingWizard } from '../components/OnboardingWizard';
import { renderThesisEditorModal } from '../components/ThesisEditorModal';

export interface ModalPresentationContext {
  activeModal: string | null;
  modalData: any;
  /** Trusted-session-derived client used only as a display fallback. */
  fallbackClientId: string;
  /** Client whose workspace is open, or null at portfolio level. */
  currentClientId: string | null;
  /** Whether the trusted session is a manager. Never supplied by the caller UI. */
  isAdmin: boolean;
  /** Notifications panel markup, owned by the session/notification surface. */
  renderNotificationsPanel: () => string;
}

export interface ModalPresentation {
  html: string;
  /** Set when the modal must not be shown for this session. */
  forceClose: boolean;
}

export function presentActiveModal(ctx: ModalPresentationContext): ModalPresentation {
  const { activeModal: modal, modalData: data, fallbackClientId } = ctx;
  const html = (value: string): ModalPresentation => ({ html: value, forceClose: false });

  if (modal === 'teleprompter' && data?.taskId) return html(renderTeleprompterModal(data.taskId));
  if (modal === 'create-client') return html(renderCreateClientModal());
  if (modal === 'onboarding') {
    return html(renderOnboardingWizard(data?.clientId || fallbackClientId, data?.step || 1));
  }
  if (modal === 'thesis-editor') {
    return html(
      renderThesisEditorModal(data?.clientId || fallbackClientId, data?.thesisId, data?.focusBlock),
    );
  }
  if (modal === 'generate-content') {
    return html(
      renderGenerateContentModal(data?.clientId || fallbackClientId, {
        thesisId: data?.thesisId,
        topic: data?.topic,
      }),
    );
  }
  if (modal === 'add-task' && data?.clientId) return html(renderAddTaskModal(data.clientId));
  if (modal === 'comparative' && data?.result) return html(renderComparativeModal(data.result));
  if (modal === 'challenge' && data) {
    return html(
      renderChallengeModal(data.title, data.challenge, {
        clientId: data.clientId,
        thesisId: data.thesisId,
        thesisStatus: data.thesisStatus,
      }),
    );
  }
  if (modal === 'add-evidence' && data?.clientId) return html(renderAddEvidenceModal(data.clientId));
  if (modal === 'content-editor' && data?.contentId) {
    if (!ctx.isAdmin) return { html: '', forceClose: true };
    return html(renderContentEditorModal(data.contentId));
  }
  if (modal === 'content-preview' && data?.contentId) {
    return html(renderContentPreviewModal(data.contentId));
  }
  if (modal === 'article-review' && data?.contentId) {
    return html(renderArticleReviewModal(data.contentId, data.taskId));
  }
  if (modal === 'content-diff' && data?.contentId) {
    return html(renderContentDiffModal(data.contentId));
  }
  if (modal === 'notifications') return html(ctx.renderNotificationsPanel());
  if (modal === 'feedback' && data) {
    return html(renderFeedbackModal(data.targetId, data.type, data.taskId));
  }
  if (modal === 'delivery-preview' && data?.packageId) {
    return html(renderDeliveryPreviewModal(data.packageId));
  }
  return html('');
}
