// Configuração exclusiva do site paralelo com login.
// Não altera o site raiz.
(function () {
  window.supabaseShadowConfig = Object.assign({}, window.supabaseShadowConfig || {}, {
    enabled: true,
    url: "https://njqqllpebqwoajjytkbw.supabase.co",
    anonKey: "",
    seasonId: "2025-26",
  });

  window.emailLoginConfig = Object.assign({}, window.emailLoginConfig || {}, {
    enabled: true,
    strict: true,
    sharedInitialPassword: "BOLAOUEFA2526",
    forcePasswordChange: true,
    resetPasswordRedirectUrl:
      "https://magoleoo.github.io/https-magoleoo.github.io-bolaouefa-tepermitesonhar/login/",
  });

  if (!window.supabaseShadowConfig.anonKey) {
    console.warn(
      "[Bolão Login Paralelo] Preencha anonKey em /login/supabase-config.js para ativar login Supabase."
    );
  }
})();
