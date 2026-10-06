/**
 * SPEC-010 · React Login (wave 1, T-010-111; P15 invite accept).
 *
 * Authority: presentation only. Email/password forwards to `sessionCommands.login`.
 * Invite acceptance forwards to `clientLifecycleCommands.acceptInvitation` (#1).
 * This module never decides authorization outcomes.
 *
 * P15: `?invite=` query prefill opens native #1 form; token validation is canonical only.
 */

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useEffect, useState, type FormEvent } from 'react';
import { sessionCommands } from '../../commands/commandSeam';
import { applyUiMode } from '../../mount';
import { useAcceptClientInvitation } from '../../hooks/useWave3Data';

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Introduce tu correo.').email('Correo no válido.'),
  password: z.string().min(1, 'Introduce tu contraseña.'),
});

type LoginFields = z.infer<typeof loginSchema>;

const inviteFieldsSchema = z
  .object({
    displayName: z.string().trim().min(1, 'Introduce tu nombre para mostrar.'),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
    confirmPassword: z.string().min(8, 'Confirma tu contraseña.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmPassword'],
  });

type InviteFields = z.infer<typeof inviteFieldsSchema>;

const VALUE_POINTS = [
  'Tesis de posicionamiento clara, aprobada por el cliente.',
  'Radar de señales puntuadas contra esa tesis, no ruido genérico.',
  'Contenido listo para grabar con teleprompter integrado.',
  'Resultados medidos con KPIs de negocio, no vanity metrics.',
];

function readInviteTokenFromLocation(): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('invite')?.trim() ?? '';
}

function LoginAside() {
  return (
    <aside className="login-aside">
      <div className="login-aside-top">
        <span className="brand-mark" aria-hidden="true">
          P
        </span>
        <span className="brand-logo">POSTURA</span>
      </div>

      <div>
        <h1 className="login-headline">Autoridad profesional, construida con método.</h1>
        <p className="login-lede">
          Plataforma de posicionamiento asistida por IA con control humano en cada entrega. Del
          análisis a la publicación, sin improvisar.
        </p>
        <ul className="login-points">
          {VALUE_POINTS.map((text) => (
            <li key={text}>
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="login-aside-foot">Positioning Intelligence &amp; Management System · v1.1</p>
    </aside>
  );
}

function EmailLoginCard({
  rejection,
  onSubmit,
  isSubmitting,
  register,
  errors,
}: {
  rejection: string;
  onSubmit: (event: FormEvent) => void;
  isSubmitting: boolean;
  register: ReturnType<typeof useForm<LoginFields>>['register'];
  errors: ReturnType<typeof useForm<LoginFields>>['formState']['errors'];
}) {
  return (
    <div className="login-card" data-testid="react-login-email-card">
      <h1>Entrar a la plataforma</h1>
      <p>Cada cuenta es un usuario real con permisos propios.</p>

      {rejection ? (
        <div className="login-error" role="alert" data-testid="react-login-error">
          <span>{rejection}</span>
        </div>
      ) : null}

      <form onSubmit={onSubmit} noValidate>
        <div className="form-group">
          <label className="form-label" htmlFor="react-login-email">
            Correo
          </label>
          <input
            className="form-input"
            type="email"
            id="react-login-email"
            autoComplete="username"
            placeholder="tu@empresa.com"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? 'react-login-email-error' : undefined}
            {...register('email')}
          />
          {errors.email ? (
            <span className="form-hint" id="react-login-email-error" role="alert">
              {errors.email.message}
            </span>
          ) : null}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="react-login-password">
            Contraseña
          </label>
          <input
            className="form-input"
            type="password"
            id="react-login-password"
            autoComplete="current-password"
            placeholder="••••••••"
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? 'react-login-password-error' : undefined}
            {...register('password')}
          />
          {errors.password ? (
            <span className="form-hint" id="react-login-password-error" role="alert">
              {errors.password.message}
            </span>
          ) : null}
        </div>

        <button
          className="btn btn-gradient btn-lg btn-block"
          type="submit"
          disabled={isSubmitting}
          data-testid="react-login-submit"
        >
          {isSubmitting ? 'Verificando…' : 'Iniciar sesión'}
        </button>
      </form>

      <p className="login-hint">
        ¿Tienes un token de invitación? Abre el enlace de invitación que recibiste para crear tu
        cuenta.
      </p>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => void applyUiMode('legacy')}
        data-testid="react-login-to-legacy"
      >
        Volver a la interfaz anterior
      </button>
    </div>
  );
}

function InviteAcceptCard({ inviteToken }: { inviteToken: string }) {
  const accept = useAcceptClientInvitation();
  const [rejection, setRejection] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<InviteFields>({
    defaultValues: {
      displayName: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setRejection('');
    const parsed = inviteFieldsSchema.safeParse(values);
    if (!parsed.success) {
      setRejection(parsed.error.issues[0]?.message ?? 'Revisa los datos introducidos.');
      return;
    }
    if (!inviteToken.trim()) {
      setRejection('El token de invitación es obligatorio.');
      return;
    }

    const result = await accept.mutateAsync({
      token: inviteToken.trim(),
      password: parsed.data.password,
      displayName: parsed.data.displayName,
    });
    if (!result.ok) {
      setRejection(result.message);
    }
  });

  const busy = isSubmitting || accept.isPending;

  return (
    <div className="login-card" data-testid="react-login-invite">
      <h1>Aceptar invitación</h1>
      <p>Crea tu cuenta de cliente con el token que recibiste.</p>

      {rejection ? (
        <div className="login-error" role="alert" data-testid="react-login-invite-error">
          <span>{rejection}</span>
        </div>
      ) : null}

      <form onSubmit={onSubmit} noValidate>
        <p className="muted small" data-testid="react-login-invite-token">
          Token: {inviteToken}
        </p>

        <div className="form-group">
          <label className="form-label" htmlFor="react-login-invite-name">
            Nombre para mostrar
          </label>
          <input
            className="form-input"
            id="react-login-invite-name"
            autoComplete="name"
            placeholder="Nombre y apellido"
            aria-invalid={errors.displayName ? true : undefined}
            {...register('displayName')}
            data-testid="react-login-invite-name"
          />
          {errors.displayName ? (
            <span className="form-hint" role="alert">
              {errors.displayName.message}
            </span>
          ) : null}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="react-login-invite-password">
            Elige contraseña
          </label>
          <input
            className="form-input"
            type="password"
            id="react-login-invite-password"
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
            minLength={8}
            aria-invalid={errors.password ? true : undefined}
            {...register('password')}
            data-testid="react-login-invite-password"
          />
          {errors.password ? (
            <span className="form-hint" role="alert">
              {errors.password.message}
            </span>
          ) : null}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="react-login-invite-confirm">
            Confirmar contraseña
          </label>
          <input
            className="form-input"
            type="password"
            id="react-login-invite-confirm"
            autoComplete="new-password"
            placeholder="Repite la contraseña"
            minLength={8}
            aria-invalid={errors.confirmPassword ? true : undefined}
            {...register('confirmPassword')}
            data-testid="react-login-invite-confirm"
          />
          {errors.confirmPassword ? (
            <span className="form-hint" role="alert">
              {errors.confirmPassword.message}
            </span>
          ) : null}
        </div>

        <button
          className="btn btn-gradient btn-lg btn-block"
          type="submit"
          disabled={busy}
          data-testid="react-login-invite-submit"
        >
          {busy ? 'Creando cuenta…' : 'Crear cuenta de cliente'}
        </button>
      </form>

      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => void applyUiMode('legacy')}
        data-testid="react-login-invite-to-legacy"
      >
        Volver a la interfaz anterior
      </button>
    </div>
  );
}

export function ReactLogin() {
  const [inviteToken, setInviteToken] = useState(() => readInviteTokenFromLocation());

  useEffect(() => {
    const syncInviteToken = () => setInviteToken(readInviteTokenFromLocation());
    syncInviteToken();
    window.addEventListener('popstate', syncInviteToken);
    return () => window.removeEventListener('popstate', syncInviteToken);
  }, []);

  const showInviteFlow = inviteToken.length > 0;

  const [rejection, setRejection] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFields>({
    defaultValues: { email: 'manager@postura.internal', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setRejection('');

    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) {
      setRejection(parsed.error.issues[0]?.message ?? 'Revisa los datos introducidos.');
      return;
    }

    const result = await sessionCommands.login(parsed.data.email, parsed.data.password);
    if (!result.ok) setRejection(result.message);
  });

  return (
    <div className="login-shell" data-testid="react-login">
      <LoginAside />

      <main className="login-main">
        {showInviteFlow ? (
          <InviteAcceptCard inviteToken={inviteToken} />
        ) : (
          <EmailLoginCard
            rejection={rejection}
            onSubmit={onSubmit}
            isSubmitting={isSubmitting}
            register={register}
            errors={errors}
          />
        )}
      </main>
    </div>
  );
}
