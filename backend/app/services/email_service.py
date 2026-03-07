# ============================================
# FILE: app/services/email_service.py
# ============================================
"""
Email Service — powered by Resend
Handles password reset, document notifications, and approval emails.
"""
import os
from typing import Optional


class EmailService:
    """Sends transactional emails via Resend API"""

    @classmethod
    def _get_client(cls):
        api_key = os.getenv("RESEND_API_KEY")
        if not api_key:
            raise ValueError("RESEND_API_KEY is not set in environment variables")
        import resend
        resend.api_key = api_key
        return resend

    @classmethod
    def _from_address(cls) -> str:
        domain = os.getenv("EMAIL_FROM_DOMAIN", "")
        name = os.getenv("EMAIL_FROM_NAME", "DocPortal")
        email = os.getenv("EMAIL_FROM_ADDRESS", f"noreply@{domain}")
        return f"{name} <{email}>"

    @classmethod
    def _app_url(cls) -> str:
        return os.getenv("APP_URL", "https://yourdomain.com").rstrip("/")

    # ─── Password Reset ──────────────────────────────────────────────────────

    @classmethod
    async def send_password_reset(cls, to_email: str, to_name: str, reset_token: str) -> bool:
        """Send password reset email with a secure link"""
        try:
            resend = cls._get_client()
            reset_url = f"{cls._app_url()}/reset-password?token={reset_token}"

            html = f"""
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#4c6ef5,#364fc7);padding:32px;text-align:center">
            <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700">🔐 Password Reset</h1>
            <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px">Engineering Documentation Portal</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px">
            <p style="color:#374151;font-size:16px;margin:0 0 16px">Hi <strong>{to_name}</strong>,</p>
            <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 28px">
              We received a request to reset your password. Click the button below to choose a new password.
              This link expires in <strong>1 hour</strong>.
            </p>

            <!-- CTA Button -->
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px">
              <tr>
                <td align="center" style="background:#4c6ef5;border-radius:8px">
                  <a href="{reset_url}"
                     style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px">
                    Reset My Password
                  </a>
                </td>
              </tr>
            </table>

            <p style="color:#9ca3af;font-size:13px;line-height:1.5;margin:0 0 8px">
              If the button doesn't work, copy and paste this link:
            </p>
            <p style="color:#4c6ef5;font-size:12px;word-break:break-all;margin:0 0 24px">
              <a href="{reset_url}" style="color:#4c6ef5">{reset_url}</a>
            </p>

            <hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0">
            <p style="color:#9ca3af;font-size:13px;margin:0">
              If you didn't request this, you can safely ignore this email — your password won't change.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;text-align:center">
            <p style="color:#9ca3af;font-size:12px;margin:0">
              Engineering Documentation Portal · Sent by DocPortal
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
"""
            resend.Emails.send({
                "from": cls._from_address(),
                "to": [to_email],
                "subject": "Reset your DocPortal password",
                "html": html,
            })
            print(f"[Email] Password reset sent to {to_email}")
            return True

        except Exception as e:
            print(f"[Email] Failed to send password reset to {to_email}: {e}")
            return False

    # ─── Welcome / Email Verification ───────────────────────────────────────

    @classmethod
    async def send_welcome_verification(
        cls,
        to_email: str,
        to_name: str,
        verification_token: str,
        temporary_password: Optional[str] = None,
    ) -> bool:
        """Send a welcome email with an email verification link to a newly created user"""
        try:
            resend = cls._get_client()
            verify_url = f"{cls._app_url()}/verify-email?token={verification_token}"

            password_section = ""
            if temporary_password:
                password_section = f"""
            <div style="background:#f0f4ff;border:1px solid #c7d2fe;border-radius:8px;padding:16px 20px;margin:20px 0">
              <p style="color:#4338ca;font-size:13px;font-weight:600;margin:0 0 6px">Your temporary login credentials</p>
              <p style="color:#374151;font-size:14px;margin:0">Email: <strong>{to_email}</strong></p>
              <p style="color:#374151;font-size:14px;margin:4px 0 0">Password: <strong style="font-family:monospace;background:#e0e7ff;padding:2px 6px;border-radius:4px">{temporary_password}</strong></p>
              <p style="color:#6b7280;font-size:12px;margin:8px 0 0">Please change your password after your first login.</p>
            </div>
"""

            html = f"""
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#4c6ef5,#364fc7);padding:36px;text-align:center">
            <div style="width:56px;height:56px;background:rgba(255,255,255,0.2);border-radius:14px;margin:0 auto 16px;display:flex;align-items:center;justify-content:center">
              <span style="font-size:28px">📂</span>
            </div>
            <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700">Welcome to DocPortal</h1>
            <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px">Engineering Documentation Portal</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px">
            <p style="color:#374151;font-size:16px;margin:0 0 12px">Hi <strong>{to_name}</strong>,</p>
            <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 8px">
              Your account has been created on the <strong>Engineering Documentation Portal</strong>.
              Please verify your email address to activate your account and gain access.
            </p>

            {password_section}

            <!-- Verify Button -->
            <p style="color:#374151;font-size:15px;font-weight:600;margin:24px 0 12px">Step 1 — Verify your email</p>
            <table cellpadding="0" cellspacing="0" style="margin:0 0 24px">
              <tr>
                <td align="center" style="background:#4c6ef5;border-radius:8px">
                  <a href="{verify_url}"
                     style="display:inline-block;padding:14px 36px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px">
                    ✅ Verify My Email
                  </a>
                </td>
              </tr>
            </table>

            <p style="color:#9ca3af;font-size:13px;line-height:1.5;margin:0 0 4px">
              Or copy and paste this link in your browser:
            </p>
            <p style="color:#4c6ef5;font-size:12px;word-break:break-all;margin:0 0 24px">
              <a href="{verify_url}" style="color:#4c6ef5">{verify_url}</a>
            </p>

            <hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0">

            <!-- What you can do -->
            <p style="color:#374151;font-size:14px;font-weight:600;margin:0 0 12px">What you can do with DocPortal:</p>
            <table cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td style="padding:6px 0;color:#6b7280;font-size:14px">📁 Access and manage engineering documents</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#6b7280;font-size:14px">🔍 Search documentation with AI-powered semantic search</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#6b7280;font-size:14px">💬 Collaborate with comments and feedback</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#6b7280;font-size:14px">🤖 Ask the AI assistant questions about documents</td>
              </tr>
            </table>

            <hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0">
            <p style="color:#9ca3af;font-size:13px;margin:0">
              This verification link expires in <strong>24 hours</strong>.
              If you didn't expect this email, you can safely ignore it.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;text-align:center">
            <p style="color:#9ca3af;font-size:12px;margin:0">Engineering Documentation Portal · Sent by DocPortal</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
"""
            resend.Emails.send({
                "from": cls._from_address(),
                "to": [to_email],
                "subject": "✅ Verify your DocPortal email address",
                "html": html,
            })
            print(f"[Email] Welcome/verification sent to {to_email}")
            return True

        except Exception as e:
            print(f"[Email] Failed to send welcome email to {to_email}: {e}")
            return False

    # ─── Document Approval/Rejection ────────────────────────────────────────

    @classmethod
    async def send_document_approved(
        cls,
        to_email: str,
        to_name: str,
        document_title: str,
        document_id: str,
        reviewer_name: str,
    ) -> bool:
        try:
            resend = cls._get_client()
            doc_url = f"{cls._app_url()}/documents/{document_id}"
            html = f"""
<!DOCTYPE html><html><body style="font-family:'Segoe UI',Arial,sans-serif;background:#f5f5f5;margin:0;padding:40px 20px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#059669,#047857);padding:28px 32px;text-align:center">
      <h2 style="color:#fff;margin:0;font-size:20px">✅ Document Approved</h2>
    </div>
    <div style="padding:32px">
      <p style="color:#374151;font-size:15px">Hi <strong>{to_name}</strong>,</p>
      <p style="color:#6b7280;font-size:15px;line-height:1.6">
        Your document <strong>"{document_title}"</strong> has been <strong style="color:#059669">approved</strong> by {reviewer_name}.
      </p>
      <a href="{doc_url}" style="display:inline-block;margin-top:16px;padding:12px 28px;background:#059669;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">
        View Document
      </a>
    </div>
    <div style="background:#f9fafb;padding:16px 32px;text-align:center">
      <p style="color:#9ca3af;font-size:12px;margin:0">Engineering Documentation Portal</p>
    </div>
  </div>
</body></html>
"""
            resend.Emails.send({
                "from": cls._from_address(),
                "to": [to_email],
                "subject": f"✅ Document Approved: {document_title}",
                "html": html,
            })
            return True
        except Exception as e:
            print(f"[Email] Failed to send approval notice: {e}")
            return False

    @classmethod
    async def send_document_rejected(
        cls,
        to_email: str,
        to_name: str,
        document_title: str,
        document_id: str,
        reviewer_name: str,
        reason: Optional[str] = None,
    ) -> bool:
        try:
            resend = cls._get_client()
            doc_url = f"{cls._app_url()}/documents/{document_id}"
            reason_html = f'<p style="color:#6b7280;font-size:14px;background:#fef3f2;border-left:3px solid #f87171;padding:12px 16px;border-radius:4px;margin:16px 0"><strong>Reason:</strong> {reason}</p>' if reason else ""
            html = f"""
<!DOCTYPE html><html><body style="font-family:'Segoe UI',Arial,sans-serif;background:#f5f5f5;margin:0;padding:40px 20px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#dc2626,#b91c1c);padding:28px 32px;text-align:center">
      <h2 style="color:#fff;margin:0;font-size:20px">❌ Document Needs Changes</h2>
    </div>
    <div style="padding:32px">
      <p style="color:#374151;font-size:15px">Hi <strong>{to_name}</strong>,</p>
      <p style="color:#6b7280;font-size:15px;line-height:1.6">
        Your document <strong>"{document_title}"</strong> was returned to draft by {reviewer_name} and requires changes before it can be approved.
      </p>
      {reason_html}
      <a href="{doc_url}" style="display:inline-block;margin-top:16px;padding:12px 28px;background:#4c6ef5;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">
        View & Update Document
      </a>
    </div>
    <div style="background:#f9fafb;padding:16px 32px;text-align:center">
      <p style="color:#9ca3af;font-size:12px;margin:0">Engineering Documentation Portal</p>
    </div>
  </div>
</body></html>
"""
            resend.Emails.send({
                "from": cls._from_address(),
                "to": [to_email],
                "subject": f"❌ Changes Requested: {document_title}",
                "html": html,
            })
            return True
        except Exception as e:
            print(f"[Email] Failed to send rejection notice: {e}")
            return False

    @classmethod
    async def send_review_requested(
        cls,
        to_email: str,
        to_name: str,
        document_title: str,
        document_id: str,
        requester_name: str,
    ) -> bool:
        try:
            resend = cls._get_client()
            doc_url = f"{cls._app_url()}/documents/{document_id}"
            html = f"""
<!DOCTYPE html><html><body style="font-family:'Segoe UI',Arial,sans-serif;background:#f5f5f5;margin:0;padding:40px 20px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#d97706,#b45309);padding:28px 32px;text-align:center">
      <h2 style="color:#fff;margin:0;font-size:20px">👀 Review Requested</h2>
    </div>
    <div style="padding:32px">
      <p style="color:#374151;font-size:15px">Hi <strong>{to_name}</strong>,</p>
      <p style="color:#6b7280;font-size:15px;line-height:1.6">
        <strong>{requester_name}</strong> has submitted <strong>"{document_title}"</strong> for your review.
      </p>
      <a href="{doc_url}" style="display:inline-block;margin-top:16px;padding:12px 28px;background:#d97706;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">
        Review Document
      </a>
    </div>
    <div style="background:#f9fafb;padding:16px 32px;text-align:center">
      <p style="color:#9ca3af;font-size:12px;margin:0">Engineering Documentation Portal</p>
    </div>
  </div>
</body></html>
"""
            resend.Emails.send({
                "from": cls._from_address(),
                "to": [to_email],
                "subject": f"👀 Review Requested: {document_title}",
                "html": html,
            })
            return True
        except Exception as e:
            print(f"[Email] Failed to send review request to {to_email}: {e}")
            return False

    # ─── Login Alert ────────────────────────────────────────────────────────

    @classmethod
    async def send_login_alert(cls, to_email: str, to_name: str, ip_address: str = "Unknown") -> bool:
        """Notify user that a new login was detected on their account"""
        try:
            resend = cls._get_client()
            settings_url = f"{cls._app_url()}/settings"
            html = f"""
<!DOCTYPE html><html><body style="font-family:'Segoe UI',Arial,sans-serif;background:#f5f5f5;margin:0;padding:40px 20px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#4c6ef5,#364fc7);padding:28px 32px;text-align:center">
      <h2 style="color:#fff;margin:0;font-size:20px">New Login Detected</h2>
    </div>
    <div style="padding:32px">
      <p style="color:#374151;font-size:15px">Hi <strong>{to_name}</strong>,</p>
      <p style="color:#6b7280;font-size:15px;line-height:1.6">A new login to your DocPortal account was just detected.</p>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin:20px 0">
        <p style="color:#374151;font-size:13px;margin:0 0 6px"><strong>IP Address:</strong> {ip_address}</p>
        <p style="color:#6b7280;font-size:12px;margin:0">If this was you, no action is needed.</p>
      </div>
      <p style="color:#6b7280;font-size:14px;line-height:1.6">
        If you did not log in, your account may be compromised. Change your password immediately.
      </p>
      <a href="{settings_url}" style="display:inline-block;margin-top:12px;padding:12px 28px;background:#4c6ef5;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">
        Go to Security Settings
      </a>
    </div>
    <div style="background:#f9fafb;padding:16px 32px;text-align:center">
      <p style="color:#9ca3af;font-size:12px;margin:0">Engineering Documentation Portal &middot; You can turn off login alerts in Settings</p>
    </div>
  </div>
</body></html>"""
            resend.Emails.send({"from": cls._from_address(), "to": [to_email], "subject": "New login to your DocPortal account", "html": html})
            print(f"[Email] Login alert sent to {to_email}")
            return True
        except Exception as e:
            print(f"[Email] Failed to send login alert to {to_email}: {e}")
            return False

    # ─── Password Changed ────────────────────────────────────────────────────

    @classmethod
    async def send_password_changed(cls, to_email: str, to_name: str) -> bool:
        """Notify user their password was changed"""
        try:
            resend = cls._get_client()
            reset_url = f"{cls._app_url()}/forgot-password"
            html = f"""
<!DOCTYPE html><html><body style="font-family:'Segoe UI',Arial,sans-serif;background:#f5f5f5;margin:0;padding:40px 20px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#d97706,#b45309);padding:28px 32px;text-align:center">
      <h2 style="color:#fff;margin:0;font-size:20px">Password Changed</h2>
    </div>
    <div style="padding:32px">
      <p style="color:#374151;font-size:15px">Hi <strong>{to_name}</strong>,</p>
      <p style="color:#6b7280;font-size:15px;line-height:1.6">Your DocPortal account password was successfully changed.</p>
      <p style="color:#6b7280;font-size:14px;line-height:1.6">
        If you made this change, no action is required. If you did <strong>not</strong> change your password,
        reset it immediately and contact your administrator.
      </p>
      <a href="{reset_url}" style="display:inline-block;margin-top:12px;padding:12px 28px;background:#d97706;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">
        Reset My Password
      </a>
    </div>
    <div style="background:#f9fafb;padding:16px 32px;text-align:center">
      <p style="color:#9ca3af;font-size:12px;margin:0">Engineering Documentation Portal</p>
    </div>
  </div>
</body></html>"""
            resend.Emails.send({"from": cls._from_address(), "to": [to_email], "subject": "Your DocPortal password was changed", "html": html})
            print(f"[Email] Password changed alert sent to {to_email}")
            return True
        except Exception as e:
            print(f"[Email] Failed to send password changed alert to {to_email}: {e}")
            return False

    # ─── Account Deactivated ─────────────────────────────────────────────────

    @classmethod
    async def send_account_deactivated(cls, to_email: str, to_name: str) -> bool:
        """Notify user their account was deactivated by an admin"""
        try:
            resend = cls._get_client()
            html = f"""
<!DOCTYPE html><html><body style="font-family:'Segoe UI',Arial,sans-serif;background:#f5f5f5;margin:0;padding:40px 20px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#6b7280,#4b5563);padding:28px 32px;text-align:center">
      <h2 style="color:#fff;margin:0;font-size:20px">Account Deactivated</h2>
    </div>
    <div style="padding:32px">
      <p style="color:#374151;font-size:15px">Hi <strong>{to_name}</strong>,</p>
      <p style="color:#6b7280;font-size:15px;line-height:1.6">
        Your DocPortal account has been deactivated by an administrator. You will no longer be able to log in.
      </p>
      <p style="color:#6b7280;font-size:14px">If you believe this is an error, please contact your system administrator.</p>
    </div>
    <div style="background:#f9fafb;padding:16px 32px;text-align:center">
      <p style="color:#9ca3af;font-size:12px;margin:0">Engineering Documentation Portal</p>
    </div>
  </div>
</body></html>"""
            resend.Emails.send({"from": cls._from_address(), "to": [to_email], "subject": "Your DocPortal account has been deactivated", "html": html})
            return True
        except Exception as e:
            print(f"[Email] Failed to send deactivation notice to {to_email}: {e}")
            return False


# Convenience export
email_service = EmailService()
