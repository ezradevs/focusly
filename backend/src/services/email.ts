import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendVerificationEmailParams {
  email: string;
  name?: string;
  verificationToken: string;
}

export async function sendVerificationEmail({
  email,
  name,
  verificationToken,
}: SendVerificationEmailParams) {
  const verificationUrl = `${process.env.CLIENT_ORIGIN || "http://localhost:3000"}/verify?token=${verificationToken}`;

  const firstName = name?.split(" ")[0] || "there";

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "Focusly <onboarding@resend.dev>",
      to: email,
      subject: "Welcome to Focusly - Verify Your Email",
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Focusly</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Welcome to Focusly</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 24px; color: #333333;">
                Hi ${firstName},
              </p>

              <p style="margin: 0 0 20px; font-size: 16px; line-height: 24px; color: #333333;">
                Thanks for signing up for Focusly! We're excited to help you study smarter with AI-powered learning tools.
              </p>

              <p style="margin: 0 0 30px; font-size: 16px; line-height: 24px; color: #333333;">
                To get started, please verify your email address by clicking the button below:
              </p>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 0 0 30px;">
                    <a href="${verificationUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                      Verify Email Address
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 20px; font-size: 14px; line-height: 22px; color: #666666;">
                Or copy and paste this link into your browser:
              </p>

              <p style="margin: 0 0 30px; font-size: 14px; line-height: 22px; color: #667eea; word-break: break-all;">
                ${verificationUrl}
              </p>

              <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">

              <p style="margin: 0 0 10px; font-size: 14px; line-height: 22px; color: #666666;">
                Once verified, you'll have access to all our learning modules:
              </p>

              <ul style="margin: 0 0 20px; padding-left: 20px; font-size: 14px; line-height: 22px; color: #666666;">
                <li>Notes Summariser</li>
                <li>Question Generator</li>
                <li>Quiz Mode</li>
                <li>Flashcard Maker</li>
                <li>Exam Creator</li>
                <li>Revision Planner</li>
                <li>Language Practice</li>
                <li>NESA Software Engineering Exam</li>
              </ul>

              <p style="margin: 0; font-size: 14px; line-height: 22px; color: #999999;">
                This verification link will expire in 24 hours.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; text-align: center; border-top: 1px solid #e5e5e5; background-color: #fafafa; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 10px; font-size: 14px; color: #999999;">
                If you didn't sign up for Focusly, you can safely ignore this email.
              </p>
              <p style="margin: 0; font-size: 14px; color: #999999;">
                © ${new Date().getFullYear()} Focusly. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
      text: `
Hi ${firstName},

Thanks for signing up for Focusly! We're excited to help you study smarter with AI-powered learning tools.

To get started, please verify your email address by clicking the link below:

${verificationUrl}

Once verified, you'll have access to all our learning modules:
- Notes Summariser
- Question Generator
- Quiz Mode
- Flashcard Maker
- Exam Creator
- Revision Planner
- Language Practice
- NESA Software Engineering Exam

This verification link will expire in 24 hours.

If you didn't sign up for Focusly, you can safely ignore this email.

© ${new Date().getFullYear()} Focusly. All rights reserved.
      `,
    });

    if (error) {
      console.error("Failed to send verification email:", error);
      throw new Error("Failed to send verification email");
    }

    return { success: true, data };
  } catch (error) {
    console.error("Error sending verification email:", error);
    throw error;
  }
}
