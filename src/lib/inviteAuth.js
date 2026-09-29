// Displayed account and server authentication are separate; do not claim logout.
export function inviteLoadError(error) {
  const code = String(error?.code ?? '');
  const message = String(error?.message ?? '');
  const needsAuth = ['INVITE_AUTH_REQUIRED', 'PGRST301', 'PGRST302', 'PGRST303'].includes(code)
    || error?.status === 401 || /LOGIN_REQUIRED|JWT.*(?:expired|invalid)|invalid.*JWT/i.test(message);
  return {
    needsAuth,
    message: needsAuth
      ? '로그인 정보는 남아 있지만 초대 기능에 필요한 본인 확인을 다시 해야 해요.'
      : '초대 링크를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
  };
}

export function inviteReturnAfterAuth(pending, user, hasToken) {
  return pending && user?.id && !user?.isGuest && hasToken ? 'invite' : null;
}
