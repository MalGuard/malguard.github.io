# MalGuard AI shared account integration

The AI header uses the existing Game Scam Guard first-party email API. It does not require new Clerk credentials, OAuth applications, database tables or billing. Existing Game Scam Guard email/password accounts can sign in, and registration uses the same profile, Brevo verification code and Supabase account record as that application.

Requests are restricted to auth/status, auth/start, auth/verify, auth/password and auth/session on the existing API. Opening the account dialog checks service availability. No mail is sent until the user submits registration. Session tokens are used only in memory to validate the returned profile. Passwords, challenges and tokens are not written to localStorage/sessionStorage or sent to AI models. Closing the dialog aborts outstanding browser requests; it cannot retract an email already requested by the user.

Sign-out is **page-only**. It clears the AI conversations/drafts, selected file, project files/preview/undo, code-sharing option and saved tool consents. Users are reminded to export their project first. It does not invalidate sessions in Game Scam Guard or other devices. Reloading the AI page requires signing in again. Account names do not grant admin rights or authorize private server resources.

This change does not add account-synchronized chat/project storage, password recovery, global session revocation, account deletion, GitHub/Notion OAuth or admin access. Existing email-auth challenge replay/attempt-limit findings remain tracked in the private engineering audit; this UI must not be represented as remediation of those backend defects or complete authentication hardening. No RLS claim is made.

Validation uses synthetic profiles and mocked account endpoints. Browser coverage includes signup/code verification, wrong-code failure, password sign-in, server-validated session, safe provider errors, no credential storage, native dialog Escape/focus behavior, Persian RTL and a 360px full-AI sign-out/project-clearing journey. Real-user mail delivery/account creation requires an owner-controlled email test and is not silently performed by automation.
