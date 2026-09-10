import { FollowStatus } from '@charuto/shared';
import { PrimaryButton } from './PrimaryButton';

interface FollowButtonProps {
  status: FollowStatus | null | undefined;
  loading?: boolean;
  onFollow: () => void;
  onUnfollow: () => void;
}

// Reflete o estado de "isFollowedByMe" do PublicUser (seção 7.5):
// null/undefined -> Seguir · PENDING -> Solicitado (toque cancela) ·
// ACCEPTED -> Seguindo (toque deixa de seguir) · BLOCKED -> desabilitado.
export function FollowButton({ status, loading, onFollow, onUnfollow }: FollowButtonProps) {
  if (status === 'BLOCKED') {
    return <PrimaryButton title="Bloqueado" onPress={() => undefined} variant="outline" disabled />;
  }

  if (status === 'ACCEPTED') {
    return <PrimaryButton title="Seguindo" onPress={onUnfollow} variant="outline" loading={loading} />;
  }

  if (status === 'PENDING') {
    return <PrimaryButton title="Solicitado" onPress={onUnfollow} variant="outline" loading={loading} />;
  }

  return <PrimaryButton title="Seguir" onPress={onFollow} loading={loading} />;
}
