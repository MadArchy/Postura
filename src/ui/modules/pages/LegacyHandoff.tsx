/**
 * SPEC-010 · unavailable-action notice (wave 3).
 *
 * Every wave-3 page still lacks some action, because the action's legacy handler
 * writes business state with no canonical Application use case (AUDIT010-09) or
 * its React control has not been built yet. This component names the affected
 * action and states that it is not yet available in this interface, so a blocked
 * action is visibly declared rather than silently missing.
 *
 * Under Phase-6 Option E a legacy UI-mode request keeps React served, so this
 * notice offers no previous-interface switch: that path cannot be reached.
 *
 * It is presentation only: it renders text. It performs no read, no command and
 * no navigation.
 */

export function LegacyHandoff({
  actions,
  testId,
}: {
  /** The actions not yet available in this interface, in the user's words. */
  actions: readonly string[];
  testId: string;
}) {
  return (
    <p className="muted small" data-testid={testId} data-legacy-handoff="true">
      {actions.length === 1
        ? `${actions[0]} todavía no está disponible en esta interfaz.`
        : `Estas funciones todavía no están disponibles en esta interfaz: ${actions.join(', ')}.`}
    </p>
  );
}

/** Shared empty/loading/error shells so every wave-3 panel declares all three states. */
export function PanelState({
  kind,
  message,
  testId,
}: {
  kind: 'loading' | 'error' | 'empty' | 'no-scope';
  message: string;
  testId: string;
}) {
  return (
    <section
      className="card"
      role={kind === 'error' ? 'alert' : undefined}
      data-testid={testId}
      data-panel-state={kind}
    >
      <p className={kind === 'empty' ? 'empty-state' : 'muted'}>{message}</p>
    </section>
  );
}
