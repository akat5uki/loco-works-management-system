import smtplib
import ssl
import asyncio
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

def _send_email_sync(to_email: str, subject: str, html_content: str) -> None:
    """Synchronous function to send email, intended to run in a threadpool."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM_EMAIL
    msg["To"] = to_email

    # Plain text fallback
    text_content = f"Your verification code is: {html_content}"
    
    msg.attach(MIMEText(text_content, "plain"))
    msg.attach(MIMEText(html_content, "html"))

    # Select SMTP client type based on SSL config
    if settings.SMTP_USE_SSL:
        context = ssl.create_default_context()
        server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, context=context)
    else:
        server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)
        if settings.SMTP_USE_TLS:
            context = ssl.create_default_context()
            server.ehlo()
            server.starttls(context=context)
            server.ehlo()

    try:
        if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            
        server.sendmail(settings.SMTP_FROM_EMAIL, to_email, msg.as_string())
    finally:
        server.quit()

async def send_otp_email(to_email: str, otp: str, purpose: str) -> None:
    """
    Sends a 6-digit OTP verification email to the target address asynchronously.
    """
    subject = f"Loco Works System - {purpose} OTP Verification"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            .email-container {{
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                border: 1px solid #e0e0e0;
                border-radius: 8px;
                background-color: #ffffff;
            }}
            .header {{
                background-color: #1e3a8a;
                color: #ffffff;
                padding: 15px;
                text-align: center;
                border-radius: 6px 6px 0 0;
            }}
            .content {{
                padding: 20px;
                color: #333333;
                line-height: 1.6;
            }}
            .otp-box {{
                display: inline-block;
                margin: 20px 0;
                padding: 15px 30px;
                font-size: 28px;
                font-weight: bold;
                letter-spacing: 5px;
                color: #1e3a8a;
                background-color: #f3f4f6;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                text-align: center;
            }}
            .footer {{
                margin-top: 20px;
                font-size: 12px;
                color: #6b7280;
                text-align: center;
                border-top: 1px solid #e5e7eb;
                padding-top: 15px;
            }}
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="header">
                <h2>Loco Works Management System</h2>
            </div>
            <div class="content">
                <p>Hello,</p>
                <p>You requested a One-Time Password (OTP) for the following action: <strong>{purpose}</strong>.</p>
                <p>Please use the following verification code to proceed:</p>
                <div style="text-align: center;">
                    <div class="otp-box">{otp}</div>
                </div>
                <p>This code is valid for <strong>3 minutes</strong>. If you did not request this, you can safely ignore this email.</p>
            </div>
            <div class="footer">
                <p>This is an automated system notification. Please do not reply to this email.</p>
            </div>
        </div>
    </body>
    </html>
    """

    try:
        await asyncio.to_thread(_send_email_sync, to_email, subject, html_content)
        logger.info(f"Successfully dispatched OTP email to {to_email} for {purpose}")
    except Exception as e:
        logger.error(f"Failed to send OTP email to {to_email}: {e}")
        # Re-raise so calling router can handle or return failure
        raise e
