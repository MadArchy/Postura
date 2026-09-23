import { rematerializeLocalSnapshot } from '../../../services/localSnapshotConsumer';
import { createClientWithInvite } from '../../../services/clientLifecycleConsumer';
import type { ClientAdminHandlerHost } from '../legacyAppHost';

export function bindClientAdminHandlers(host: ClientAdminHandlerHost): void  {
  document.getElementById('btn-firebase-push-local')?.addEventListener('click', async () => {
    const grant = host.requireAdmin();
    if (!grant.ok) {
      host.showToast(grant.message, 'warning');
      return;
    }
    try {
      const result = await rematerializeLocalSnapshot();
      host.showToast(result.message, result.ok ? 'success' : 'warning');
    } catch (error) {
      host.showToast(
        error instanceof Error ? error.message : 'No se pudo subir el snapshot.',
        'warning'
      );
    }
  });

  document.getElementById('btn-open-create-client')?.addEventListener('click', () => {
    host.activeModal = 'create-client';
    host.render();
  });

  ['btn-close-create-client', 'btn-cancel-create-client'].forEach((id) => {
    document.getElementById(id)?.addEventListener('click', () => host.closeModal());
  });

  document.getElementById('form-create-client')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = (id: string) => (document.getElementById(id) as HTMLInputElement).value;
    const firstName = val('new-client-firstname');
    const lastName = val('new-client-lastname');
    const email = val('new-client-email');

    try {
      // CR-1 #34 — business authority is CreateClientWithInvite (Application).
      // Organization/actor come from requireAdminActor inside the consumer.
      const { invitation } = createClientWithInvite({
        firstName,
        lastName,
        email,
        profession: val('new-client-profession'),
        company: val('new-client-company'),
        targetMarket: val('new-client-target'),
      });
      host.showToast(`Cliente creado. Token de invitación: ${invitation.token}`, 'success');
      host.activeModal = null;
      host.render();
    } catch (error) {
      host.showToast(error instanceof Error ? error.message : 'No se pudo crear el cliente', 'warning');
    }
  });
}
