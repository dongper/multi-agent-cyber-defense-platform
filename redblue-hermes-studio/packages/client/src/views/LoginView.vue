<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { setApiKey, clearApiKey, hasApiKey } from "@/api/client";
import { fetchAuthStatus, loginWithPassword } from "@/api/auth";
import { isDesktopShell } from "@/utils/desktop-bridge";
import { resolveLoginRedirect } from "@/utils/login-redirect";
import { useTheme } from "@/composables/useTheme";

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const { activateUserTheme } = useTheme();

const username = ref("");
const password = ref("");
const loading = ref(false);
const errorMsg = ref("");
const showLockResetHint = ref(false);
const desktopShell = isDesktopShell();

if (desktopShell) {
  // Desktop login is a recovery path. Drop stale JWTs before any background
  // request can reuse them and show an unrelated expiry notice.
  clearApiKey();
} else if (hasApiKey()) {
  router.replace(resolveLoginRedirect(route.query.redirect));
}

onMounted(async () => {
  try {
    await fetchAuthStatus();
  } catch {
    // Login remains available; the submit request will surface connection errors.
  }
});

async function handleLogin() {
  await handlePasswordLogin();
}

async function handlePasswordLogin() {
  if (!username.value.trim() || !password.value) {
    errorMsg.value = t("login.credentialsRequired");
    return;
  }

  loading.value = true;
  errorMsg.value = "";
  showLockResetHint.value = false;

  try {
    const session = await loginWithPassword(username.value.trim(), password.value);
    setApiKey(session.token);
    activateUserTheme(session.userId, session.theme);
    router.replace(resolveLoginRedirect(route.query.redirect));
  } catch (err: any) {
    if (err.status === 429 || err.status === 503) {
      errorMsg.value = t("login.tooManyAttempts");
      showLockResetHint.value = true;
    } else {
      errorMsg.value = err.message || t("login.invalidCredentials");
    }
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-view">
    <div class="login-card">
      <div class="login-logo">
        <img src="/logo.png" alt="联通智能体" width="80" height="80" />
      </div>
      <h1 class="login-title">{{ t("login.title") }}</h1>
      <p class="login-desc">{{ t("login.description") }}</p>
      <p class="login-default-hint">{{ t("login.defaultCredentialsHint") }}</p>

      <form class="login-form" @submit.prevent="handleLogin">
        <input
          v-model="username"
          type="text"
          class="login-input"
          :placeholder="t('login.usernamePlaceholder')"
          autofocus
        />
        <input
          v-model="password"
          type="password"
          class="login-input"
          :placeholder="t('login.passwordPlaceholder')"
          @keyup.enter="handleLogin"
        />

        <div v-if="errorMsg" class="login-error">{{ errorMsg }}</div>
        <div v-if="showLockResetHint" class="login-lock-hint">
          <template v-if="desktopShell">
            <span>{{ t("login.desktopLockResetHint") }}</span>
          </template>
          <template v-else>
            <span>{{ t("login.lockResetHint") }}</span>
            <code>hermes-web-ui clear-login-locks --restart</code>
            <span>{{ t("login.defaultLoginResetHint") }}</span>
            <code>hermes-web-ui reset-default-login</code>
          </template>
        </div>
        <button type="submit" class="login-btn" :disabled="loading">
          {{ loading ? "..." : t("login.submit") }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;

.login-view {
  height: calc(100 * var(--vh));
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at 18% 16%, rgba(220, 67, 86, .18), transparent 32%),
    radial-gradient(circle at 82% 84%, rgba(47, 145, 255, .2), transparent 36%),
    #06111b;
  font-family: Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
}

.login-card {
  width: 480px;
  max-width: calc(100vw - 32px);
  padding: 56px;
  border: 1px solid #25445b;
  border-radius: 18px;
  background: rgba(10, 27, 41, .94);
  box-shadow: 0 28px 80px rgba(0, 0, 0, .38), inset 0 1px rgba(255, 255, 255, .04);
  text-align: center;

  @media (max-width: $breakpoint-mobile) {
    padding: 32px 24px;
  }
}

.login-logo {
  margin-bottom: 24px;
}

.login-title {
  font-size: 26px;
  font-weight: 600;
  color: #e5eef5;
  margin: 0 0 10px;
}

.login-desc {
  font-size: 14px;
  color: #8198aa;
  margin: 0 0 12px;
  line-height: 1.6;
}

.login-default-hint {
  margin: 0 0 28px;
  font-family: $font-code;
  font-size: 13px;
  color: #698399;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.login-input {
  width: 100%;
  padding: 14px 16px;
  border: 1px solid #294a61;
  border-radius: $radius-sm;
  font-size: 15px;
  color: #e1ebf2;
  background: #0b1d2c;
  outline: none;
  transition: border-color $transition-fast;
  box-sizing: border-box;
  font-family: $font-code;

  &::placeholder {
    color: #607b90;
  }

  &:focus {
    border-color: #2f91ff;
    box-shadow: 0 0 0 3px rgba(47, 145, 255, .12);
  }
}

.login-error {
  font-size: 13px;
  color: $error;
  text-align: start;
}

.login-lock-hint {
  padding: 10px 12px;
  border: 1px solid rgba(var(--warning-rgb), 0.35);
  border-radius: $radius-sm;
  background: rgba(var(--warning-rgb), 0.08);
  color: $text-secondary;
  font-size: 12px;
  line-height: 1.5;
  text-align: start;

  code {
    display: block;
    margin-top: 4px;
    color: $text-primary;
    font-family: $font-code;
    word-break: break-all;
  }
}

.login-btn {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: $radius-sm;
  background: linear-gradient(100deg, #cf4355 0%, #6d557d 48%, #2f91ff 100%);
  color: #ffffff;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity $transition-fast;

  &:hover {
    opacity: .9;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
</style>
