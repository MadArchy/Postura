import { authService } from '../../../services/auth';
import { dbService } from '../../../services/db';
import { aiService } from '../../../services/ai';
import { auditService } from '../../../services/audit';
import { notifyManager } from '../../../services/notifications';
import { createContentDraft, reviewClientArticle, saveContentDraft, assignClientTask } from '../../../services/executionDeliveryConsumer';
import type { ContentPipelineAction } from '../../../domain/contentPublishCore';
import type { LegacyHandlerHost } from '../legacyAppHost';

export function bindContentHandlers(host: LegacyHandlerHost): void {
    document.querySelectorAll('.btn-open-generate-content').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const clientId = target.getAttribute('data-client-id') || host.resolveClientId();
        host.activeModal = 'generate-content';
        host.modalData = {
          clientId,
          thesisId: target.getAttribute('data-thesis-id') || host.filterState.thesisId || undefined,
          topic: target.getAttribute('data-topic') || undefined,
        };
        host.render();
      });
    });

    ['btn-close-generate-content', 'btn-cancel-generate-content'].forEach((id) => {
      document.getElementById(id)?.addEventListener('click', () => host.closeModal());
    });

    const formGenerate = document.getElementById('form-generate-content');
    formGenerate?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const clientId = formGenerate.getAttribute('data-client-id') || host.resolveClientId();
      const briefId = (document.getElementById('generate-strategic-brief') as HTMLSelectElement | null)?.value;
      const topic = (document.getElementById('generate-topic') as HTMLTextAreaElement | null)?.value.trim() || '';
      if (!topic) {
        host.showToast('Indica el tema del borrador.', 'warning');
        return;
      }

      const format = ((document.getElementById('generate-format') as HTMLSelectElement | null)?.value ||
        'LINKEDIN_ARTICLE') as 'VIDEO_SCRIPT' | 'LINKEDIN_ARTICLE' | 'ACADEMIC_PAPER' | 'THOUGHT_LEADERSHIP';
      const angle = (document.getElementById('generate-angle') as HTMLInputElement | null)?.value.trim();
      const submit = formGenerate.querySelector('button[type="submit"]') as HTMLButtonElement | null;
      if (submit) {
        submit.disabled = true;
        submit.textContent = 'Redactando…';
      }
      try {
        await createContentDraft({
          requestedClientId: clientId,
          intent: {
            kind: 'FORM_GENERATE',
            strategicBriefId: briefId ?? '',
            topic,
            format,
            angle: angle || undefined,
          },
        });
        host.showToast('Borrador creado. Revísalo antes de enviarlo al cliente.', 'success');
        host.closeModal();
      } catch (error) {
        host.showToast(error instanceof Error ? error.message : 'No se pudo generar el borrador', 'warning');
        if (submit) {
          submit.disabled = false;
          submit.textContent = 'Redactar borrador';
        }
      }
    });

    document.querySelectorAll('.btn-generate-scientific-article').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const target = e.currentTarget as HTMLButtonElement;
        const clientId = target.getAttribute('data-client-id') || host.resolveClientId();
        const topic = target.getAttribute('data-sci-title') || '';
        const why = target.getAttribute('data-sci-why') || '';
        const venue = target.getAttribute('data-sci-venue') || 'Working paper';
        const role = target.getAttribute('data-sci-role') || '';
        if (!topic.trim()) return;
        target.disabled = true;
        target.textContent = 'Redactando…';
        try {
          await createContentDraft({
            requestedClientId: clientId,
            intent: {
              kind: 'SCIENTIFIC_ARTICLE',
              thesisScopeId: host.filterState.thesisId || undefined,
              title: topic.trim(),
              why,
              venue,
              roleAngle: role,
            },
          });
          host.showToast('Borrador científico creado. Revísalo: no publiques citas no verificadas.', 'success');
        } catch (error) {
          host.showToast(error instanceof Error ? error.message : 'No se pudo generar el paper', 'warning');
        }
        host.render();
      });
    });

    document.querySelectorAll('.btn-open-content-editor').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        if (authService.getCurrentUser()?.role !== 'ADMIN') {
          host.showToast('Solo el Brand Manager puede abrir el editor de producción.', 'warning');
          return;
        }
        const contentId = (e.currentTarget as HTMLElement).getAttribute('data-content-id');
        if (!contentId) return;
        host.activeModal = 'content-editor';
        host.modalData = { contentId };
        host.render();
      });
    });

    document.querySelectorAll('.btn-preview-content').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const contentId = (e.currentTarget as HTMLElement).getAttribute('data-content-id');
        if (!contentId) return;
        host.activeModal = 'content-preview';
        host.modalData = { contentId };
        host.render();
      });
    });

    ['btn-close-content-preview', 'btn-close-content-preview-bottom'].forEach((id) => {
      document.getElementById(id)?.addEventListener('click', () => host.closeModal());
    });

    ['btn-close-content-editor', 'btn-cancel-content-editor'].forEach((id) => {
      document.getElementById(id)?.addEventListener('click', () => host.closeModal());
    });

    ['btn-close-content-diff', 'btn-close-content-diff-bottom'].forEach((id) => {
      document.getElementById(id)?.addEventListener('click', () => host.closeModal());
    });

    document.querySelectorAll('.btn-view-content-diff').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const contentId = (e.currentTarget as HTMLElement).getAttribute('data-content-id');
        if (!contentId) return;
        host.activeModal = 'content-diff';
        host.modalData = { contentId };
        host.render();
      });
    });

    document.querySelectorAll('.btn-content-pipeline-action').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const el = e.currentTarget as HTMLElement;
        const contentId = el.getAttribute('data-content-id');
        const action = el.getAttribute('data-pipeline-action') as ContentPipelineAction | null;
        if (!contentId || !action) return;
        host.runContentPipelineAction(contentId, action);
      });
    });

    document.querySelectorAll('.btn-open-article-review').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const el = e.currentTarget as HTMLElement;
        const contentId = el.getAttribute('data-content-id');
        const taskId = el.getAttribute('data-task-id') || undefined;
        if (!contentId) return;
        if (taskId) {
          const task = dbService.getAllTasks().find((t) => t.id === taskId);
          if (task) host.markArticleReviewStarted(task, contentId);
        }
        host.activeModal = 'article-review';
        host.modalData = { contentId, taskId };
        host.render();
      });
    });

    ['btn-close-article-review'].forEach((id) => {
      document.getElementById(id)?.addEventListener('click', () => host.closeModal());
    });

    const formArticleReview = document.getElementById('form-article-review');
    formArticleReview?.addEventListener('submit', (e) => {
      e.preventDefault();
      const contentId = formArticleReview.getAttribute('data-content-id');
      const taskId = formArticleReview.getAttribute('data-task-id') || undefined;
      if (!contentId) return;
      const title = (document.getElementById('article-review-title') as HTMLInputElement).value.trim();
      const body = (document.getElementById('article-review-body') as HTMLTextAreaElement).value.trim();
      const user = authService.getCurrentUser();
      if (!user) return;

      let event;
      try {
        event = reviewClientArticle({
          requestedClientId: user.clientId || host.resolveClientId(),
          contentId,
          decision: 'save_revision',
          title,
          body,
          taskId: taskId || undefined,
        }).feedbackEvent;
      } catch (error) {
        host.toastExecErr(error, 'No se pudo guardar la revisión');
        return;
      }
      const content = dbService.getContentById(contentId);
      if (content && event) {
        notifyManager(content.clientId, {
          type: 'CONTENT_REVIEW',
          title: 'Cliente editó borrador',
          body: `«${content.title}»: +${event.diffSummary?.added ?? 0}/−${event.diffSummary?.removed ?? 0} líneas`,
          href: 'ws-production',
          targetId: contentId,
        });
      }
      host.showToast(
        event ? 'Cambios guardados. Tu manager verá el diff.' : 'Sin cambios respecto al borrador original.',
        event ? 'success' : 'info'
      );
      host.render();
    });

    document.getElementById('btn-article-approve')?.addEventListener('click', (e) => {
      const el = e.currentTarget as HTMLElement;
      const contentId = el.getAttribute('data-content-id');
      const taskId = el.getAttribute('data-task-id') || undefined;
      if (!contentId) return;

      const title = (document.getElementById('article-review-title') as HTMLInputElement)?.value.trim();
      const body = (document.getElementById('article-review-body') as HTMLTextAreaElement)?.value.trim();
      void host.approveClientArticle(contentId, taskId, { title, body });
      host.closeModal();
    });

    document.getElementById('btn-article-reject')?.addEventListener('click', (e) => {
      const el = e.currentTarget as HTMLElement;
      const contentId = el.getAttribute('data-content-id');
      const taskId = el.getAttribute('data-task-id') || undefined;
      if (!contentId) return;
      host.activeModal = 'feedback';
      host.modalData = { targetId: contentId, type: 'CONTENT', taskId };
      host.render();
    });

    const formEditContent = document.getElementById('form-edit-content');
    formEditContent?.addEventListener('submit', (e) => {
      e.preventDefault();
      const contentId = formEditContent.getAttribute('data-content-id');
      const content = contentId ? dbService.getContentById(contentId) : null;
      if (!content) return;

      const body = (document.getElementById('edit-content-body') as HTMLTextAreaElement).value;
      const type = (document.getElementById('edit-content-type') as HTMLSelectElement).value as typeof content.type;
      const targetStatus = (document.getElementById('edit-content-status') as HTMLSelectElement).value as typeof content.status;

      const thesis = dbService.getThesesByClient(content.clientId).find((t) => t.id === content.thesisId);
      if (!thesis) {
        host.showToast('No se encontró la tesis asociada al contenido.', 'warning');
        return;
      }
      // Advisory projection only — Application does not treat this as publication authority.
      const claimSafety = aiService.reviewDraftClaims(body, thesis);

      try {
        saveContentDraft({
          requestedClientId: content.clientId,
          contentId: content.id,
          fields: {
            title: (document.getElementById('edit-content-title') as HTMLInputElement).value,
            targetPlatform: (document.getElementById('edit-content-platform') as HTMLSelectElement)
              .value as typeof content.targetPlatform,
            type,
            body,
            teleprompterScript: type === 'VIDEO_SCRIPT' ? body : content.teleprompterScript,
            managerNotes: (document.getElementById('edit-content-notes') as HTMLInputElement).value,
            claimSafety,
          },
          requestedTargetStatus: targetStatus !== content.status ? targetStatus : undefined,
        });
      } catch (error) {
        host.toastExecErr(error, 'No se pudo guardar el contenido');
        host.render();
        return;
      }
      host.showToast('Cambios guardados', 'success');
      host.closeModal();
    });

    document.querySelectorAll('.btn-comparative-signal').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const target = e.currentTarget as HTMLButtonElement;
        const signalId = target.getAttribute('data-signal-id');
        const signal = signalId ? dbService.getSignalById(signalId) : null;
        const clientId = host.resolveClientId(signal?.clientId);
        const thesis = signal
          ? dbService.resolveThesisFor({
              clientId,
              selectedThesisId: host.filterState.thesisId,
              entityThesisId: signal.thesisId,
            })
          : undefined;
        if (!signal || !thesis) {
          host.showToast('Selecciona una tesis válida antes del análisis comparativo.', 'warning');
          return;
        }

        target.disabled = true;
        target.textContent = 'Sintetizando…';
        try {
          const result = await aiService.runComparativeAnalysis(signal, thesis);
          host.activeModal = 'comparative';
          host.modalData = { result };
          host.render();
        } catch (error) {
          host.showToast(error instanceof Error ? error.message : 'No se pudo comparar', 'warning');
          host.render();
        }
      });
    });

    ['btn-close-comparative', 'btn-close-comparative-bottom'].forEach((id) => {
      document.getElementById(id)?.addEventListener('click', () => host.closeModal());
    });

    document.querySelectorAll('.btn-create-task-from-rec').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const recId = (e.currentTarget as HTMLElement).getAttribute('data-rec-id');
        const rec = dbService.getRecommendations().find((r) => r.id === recId);
        if (!rec) return;

        try {
          const result = await createContentDraft({
            requestedClientId: rec.clientId,
            intent: {
              kind: 'RECOMMENDATION_TASK_SCRIPT',
              recommendationId: rec.id,
            },
          });
          const { content, gate, advanced, recommendation } = result;
          assignClientTask({
            requestedClientId: rec.clientId,
            origin: {
              kind: 'FROM_RECOMMENDATION',
              thesisId: gate.thesisId,
              contentItemId: content.id,
              scriptPayload: content.teleprompterScript,
              strategicBriefId: gate.briefId,
              strategicBriefVersion: gate.version,
              signalId: recommendation?.signalId ?? gate.signalIds[0] ?? rec.signalId,
              title: `Grabar: ${(recommendation?.proposedAngle ?? rec.proposedAngle).substring(0, 60)}`,
              description: 'Guion redactado según tu tesis. Usa el teleprompter.',
            },
          });
          dbService.updateRecommendationStatus(rec.id, 'CONVERTED_TO_TASK');
          host.showToast(
            advanced
              ? 'Guion y tarea generados'
              : 'Tarea creada; el guion quedó en borrador por Claim Safety',
            advanced ? 'success' : 'warning'
          );
          host.setTab('ws-production');
        } catch (error) {
          host.showToast(error instanceof Error ? error.message : 'No se pudo generar el guion', 'warning');
        }
      });
    });

    document.querySelectorAll('.btn-add-evidence-vault').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const clientId = (e.currentTarget as HTMLElement).getAttribute('data-client-id') || host.resolveClientId();
        host.activeModal = 'add-evidence';
        host.modalData = { clientId };
        host.render();
      });
    });

    ['btn-close-evidence', 'btn-cancel-evidence'].forEach((id) => {
      document.getElementById(id)?.addEventListener('click', () => host.closeModal());
    });

    const formAddEvidence = document.getElementById('form-add-evidence');
    formAddEvidence?.addEventListener('submit', (e) => {
      e.preventDefault();
      const clientId = formAddEvidence.getAttribute('data-client-id') || host.resolveClientId();
      const title = (document.getElementById('evidence-title') as HTMLInputElement).value;
      const supports = (document.getElementById('evidence-supports') as HTMLTextAreaElement | null)
        ?.value.split('\n').map((line) => line.trim()).filter(Boolean) || [];
      const authorityRaw = Number.parseInt(
        (document.getElementById('evidence-authority-weight') as HTMLInputElement | null)?.value || '70',
        10
      );
      const associatedThesesIds = Array.from(
        document.querySelectorAll<HTMLInputElement>('input[name="evidence-thesis"]:checked')
      ).map((input) => input.value);
      if (!associatedThesesIds.length && host.filterState.thesisId) {
        associatedThesesIds.push(host.filterState.thesisId);
      }

      const organizationId = host.resolveOrganizationId(clientId);
      if (!organizationId) {
        host.showToast('Cliente sin organizationId — no se puede registrar evidencia', 'warning');
        return;
      }

      dbService.addEvidenceItem({
        organizationId,
        clientId,
        title,
        type: (document.getElementById('evidence-type') as HTMLSelectElement).value as never,
        confidenceScore: parseInt((document.getElementById('evidence-confidence') as HTMLInputElement).value || '95', 10),
        sourceUrl: (document.getElementById('evidence-url') as HTMLInputElement).value || undefined,
        snippet: (document.getElementById('evidence-snippet') as HTMLTextAreaElement).value,
        verified: true,
        verifiedAt: new Date().toISOString(),
        associatedThesesIds,
        supports: supports.length ? supports : undefined,
        authorityWeight: Number.isFinite(authorityRaw) ? Math.max(0, Math.min(100, authorityRaw)) : undefined,
      });

      auditService.log(authService.getCurrentUser(), 'ADD_EVIDENCE_ITEM', 'EvidenceVault', title);
      host.showToast('Evidencia registrada', 'success');
      host.closeModal();
    });
  }

  // ==========================================
  // Acciones del portal del cliente
  // ==========================================
