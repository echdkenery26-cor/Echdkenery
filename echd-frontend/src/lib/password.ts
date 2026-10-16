/** Même règle que le serveur : 8 à 72 caractères, avec au moins une lettre et un chiffre. */
export function passwordProblem(pw: string, t: (fr: string, ar: string) => string): string | null {
  if (pw.length < 8) return t('Le mot de passe doit contenir au moins 8 caractères.', 'يجب أن تحتوي كلمة المرور على 8 أحرف على الأقل.');
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return t('Ajoutez au moins une lettre et un chiffre.', 'أضف حرفاً ورقماً على الأقل.');
  if (pw.length > 72) return t('Mot de passe trop long (72 caractères maximum).', 'كلمة المرور طويلة جداً (72 حرفاً كحد أقصى).');
  return null;
}
