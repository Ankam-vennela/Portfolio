import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config({ override: true });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for sending contact email
  app.post("/api/contact", async (req, res) => {
    const { fname, lname, email, subject, message } = req.body;

    if (!email || !message) {
      return res.status(400).json({ error: "Email and message are required fields." });
    }

    try {
      let emailUser = process.env.EMAIL_USER ? process.env.EMAIL_USER.trim() : "";
      let emailPass = process.env.EMAIL_PASS ? process.env.EMAIL_PASS.trim() : "";

      // Strip outer quotes if present
      if (emailUser.startsWith('"') && emailUser.endsWith('"')) {
        emailUser = emailUser.slice(1, -1);
      } else if (emailUser.startsWith("'") && emailUser.endsWith("'")) {
        emailUser = emailUser.slice(1, -1);
      }

      if (emailPass.startsWith('"') && emailPass.endsWith('"')) {
        emailPass = emailPass.slice(1, -1);
      } else if (emailPass.startsWith("'") && emailPass.endsWith("'")) {
        emailPass = emailPass.slice(1, -1);
      }

      if (emailPass) {
        // Strip out any space formatting in Google's App Passwords (e.g., 'yngl xxux ankq rolr' -> 'ynglxxuxankqrolr')
        emailPass = emailPass.replace(/\s+/g, "");
      }

      console.log(`[SMTP Debug] Attempting email send process:`);
      console.log(`  - emailUser: "${emailUser || "NOT CONFIGURED"}"`);
      if (emailPass) {
        const mask = emailPass.length > 4 
          ? `${emailPass.substring(0, 2)}***${emailPass.substring(emailPass.length - 2)}`
          : "***";
        console.log(`  - emailPass (sanitized): "${mask}" (length: ${emailPass.length})`);
      } else {
        console.log(`  - emailPass: NOT CONFIGURED`);
      }

      const recipient = "ankamvennela2006@gmail.com";
      const subjectLine = subject ? `[Portfolio Contact] ${subject}` : `New message from ${fname || ""} ${lname || ""}`;

      const textBody = `
You have received a new contact submission from your portfolio website:

Sender Name: ${fname || ""} ${lname || ""}
Sender Email: ${email}
Subject: ${subject || "No Subject"}

Message:
------------------------------------------
${message}
------------------------------------------

This email was processed by your portfolio contact form backend.
`;

      const htmlBody = `
<div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; background-color: #ffffff; color: #1a202c;">
  <h2 style="color: #4f8ef7; margin-top: 0; border-bottom: 2px solid #edf2f7; padding-bottom: 12px;">New Contact Message</h2>
  <p>You received a message via your Portfolio contact form:</p>
  <table style="width: 100%; margin-bottom: 20px; border-collapse: collapse;">
    <tr>
      <td style="padding: 6px 0; font-weight: bold; width: 120px; color: #4a5568;">Sender Name:</td>
      <td style="padding: 6px 0; color: #2d3748;">${fname || ""} ${lname || ""}</td>
    </tr>
    <tr>
      <td style="padding: 6px 0; font-weight: bold; color: #4a5568;">Sender Email:</td>
      <td style="padding: 6px 0; color: #2d3748;"><a href="mailto:${email}" style="color: #4f8ef7; text-decoration: none;">${email}</a></td>
    </tr>
    <tr>
      <td style="padding: 6px 0; font-weight: bold; color: #4a5568;">Subject:</td>
      <td style="padding: 6px 0; color: #2d3748;">${subject || "No Subject"}</td>
    </tr>
  </table>
  <div style="background-color: #f7fafc; border-left: 4px solid #4f8ef7; padding: 16px; border-radius: 4px; margin-top: 20px;">
    <p style="font-weight: bold; margin-top: 0; margin-bottom: 8px; color: #4a5568;">Message:</p>
    <p style="white-space: pre-wrap; margin: 0; color: #2d3748;">${message}</p>
  </div>
  <footer style="margin-top: 30px; font-size: 11px; text-align: center; color: #a0aec0; border-top: 1px solid #edf2f7; padding-top: 12px;">
    Sent from your Portfolio contact form backend.
  </footer>
</div>
`;

      if (emailUser && emailPass) {
        // Direct secure SMTP Transporter setup using smtp.gmail.com on standard SSL port 465
        const transporter = nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 465,
          secure: true, // true for port 465 SSL, false for other ports
          auth: {
            user: emailUser,
            pass: emailPass,
          },
          tls: {
            rejectUnauthorized: false // avoid SSL handshake rejections on containers
          }
        });

        await transporter.sendMail({
          from: `"${fname || 'Portfolio Contact'} Form" <${emailUser}>`,
          to: recipient,
          replyTo: email,
          subject: subjectLine,
          text: textBody,
          html: htmlBody,
        });

        console.log(`Email successfully forwarded to ${recipient} using Nodemailer SMTP.`);
        return res.json({ success: true, message: "Your message has been sent successfully to Vennela's email." });
      } else {
        // Simulated local fallback for development / before config
        console.warn("--- CONTACT SUBMISSION (SMTP credentials not configured in environment) ---");
        console.warn(`To: ${recipient}`);
        console.warn(`From: ${email}`);
        console.warn(`Subject: ${subjectLine}`);
        console.warn(`Message: ${message}`);
        console.warn("To enable real email sending, define EMAIL_USER and EMAIL_PASS in your .env or Secrets.");
        console.warn("-------------------------------------------------------------------------");

        return res.json({ 
          success: true, 
          simulated: true, 
          message: "Message processed successfully. (Developer Mode: SMTP credentials not set, but printed to development logs! To configure real delivery, configure EMAIL_USER and EMAIL_PASS environment variables)." 
        });
      }
    } catch (error: any) {
      console.error("Failed to process contact email:", error);
      return res.status(500).json({ error: "Failed to send message: " + error.message });
    }
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server starting on http://localhost:${PORT}`);
  });
}

startServer();
