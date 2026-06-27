# Switch from Development to Production SMTP Configuration

This guide details the steps required to transition the Loco Works Management System (LWMS) email dispatch system from the local development SMTP server (Mailpit) to a secure production SMTP service (e.g., Amazon SES, SendGrid, Gmail).

---

## 1. Environment Variable Configuration

To switch to production SMTP, update the following variables in the `.env` file located in the project root:

```env
# Enable Email OTP Verification (1 = Active, 0 = Inactive)
ENABLE_EMAIL_OTP=1

# Production SMTP Server Host
# e.g., email-smtp.us-east-1.amazonaws.com (Amazon SES), smtp.sendgrid.net (SendGrid), or smtp.gmail.com
SMTP_HOST=smtp.sendgrid.net

# Production SMTP Port
# Use 587 for STARTTLS (recommended) or 465 for SMTP over SSL
SMTP_PORT=587

# SMTP Authentication Credentials
# Provide the username/API key and password/secret key given by your email provider
SMTP_USERNAME=apikey
SMTP_PASSWORD=your_production_smtp_password_or_api_key

# Sender Address
# IMPORTANT: This must be a verified sender domain/address configured in your mail service
SMTP_FROM_EMAIL=no-reply@yourcompany.com

# TLS and SSL Configuration
# Set SMTP_USE_TLS=True if using port 587 (STARTTLS)
SMTP_USE_TLS=True
# Set SMTP_USE_SSL=True if using port 465 (SSL)
SMTP_USE_SSL=False
```

---

## 2. Production Mail Provider Configurations

### Option A: Amazon SES (Simple Email Service)
1. **Host**: Set `SMTP_HOST` to the SES SMTP endpoint for your region (e.g., `email-smtp.us-east-1.amazonaws.com`).
2. **Credentials**: Generate SMTP credentials in the SES Console. Note that SES SMTP credentials are *different* from your standard AWS IAM secret keys.
3. **Port & Encryption**: Set `SMTP_PORT=587`, `SMTP_USE_TLS=True`, and `SMTP_USE_SSL=False`.
4. **Verification**: Verify your sender domain or email address in SES before attempting to send.

### Option B: SendGrid
1. **Host**: Set `SMTP_HOST=smtp.sendgrid.net`.
2. **Credentials**: 
   - `SMTP_USERNAME` must be set to the literal string `apikey`.
   - `SMTP_PASSWORD` must be set to your generated SendGrid API Key.
3. **Port & Encryption**: Set `SMTP_PORT=587`, `SMTP_USE_TLS=True`, and `SMTP_USE_SSL=False`.

### Option C: Gmail / Google Workspace
1. **Host**: Set `SMTP_HOST=smtp.gmail.com`.
2. **Credentials**: 
   - `SMTP_USERNAME` is your full Google Workspace email address.
   - `SMTP_PASSWORD` **MUST** be a Google App Password (2-Step Verification is required to generate this; do *not* use your primary login password).
3. **Port & Encryption**: Set `SMTP_PORT=587`, `SMTP_USE_TLS=True`, and `SMTP_USE_SSL=False`.

---

## 3. Production Email Deliverability & Security Checklist

* **SPF (Sender Policy Framework)**: Add a TXT record to your DNS domain authorizing your SMTP provider to send mail on your behalf:
  ```
  v=spf1 include:sendgrid.net ~all
  ```
* **DKIM (DomainKeys Identified Mail)**: Configure DKIM keys provided by your mail service in your DNS registrar to cryptographically sign outbound emails.
* **DMARC (Domain-based Message Authentication, Reporting, and Conformance)**: Add a DMARC policy record to protect your domain from spoofing:
  ```
  v=DMARC1; p=quarantine; pct=100;
  ```
* **Network Firewalls**: Ensure outgoing TCP traffic on port `587` or `465` is allowed from your application hosting instances to the public web.
