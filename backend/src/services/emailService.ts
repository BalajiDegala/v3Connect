import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { config } from '../config/index.js';

export interface DCVEmailData {
  userEmail: string;
  userName: string;
  machineName: string;
  dcvLink: string;
  dcvUsername: string;
  dcvPassword: string;
  expiryDate: string;
  task?: string;
}

class EmailService {
  private transporter: Transporter;

  constructor() {
    // Handle both ESM and CommonJS imports
    const createTransport = (nodemailer as any).createTransport || (nodemailer as any).default?.createTransport;
    this.transporter = createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });
  }

  async sendDCVCredentials(data: DCVEmailData): Promise<void> {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .credentials { background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; }
          .credential-row { margin: 10px 0; padding: 10px; background: #f5f5f5; border-radius: 5px; }
          .label { font-weight: bold; color: #667eea; }
          .value { font-family: 'Courier New', monospace; background: #fff; padding: 5px 10px; border-radius: 3px; margin-top: 5px; display: inline-block; }
          .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎬 Ankiya Cloud Machine Ready!</h1>
          </div>
          <div class="content">
            <p>Hello <strong>${data.userName}</strong>,</p>
            
            <p>Great news! Your cloud machine <strong>${data.machineName}</strong> has been provisioned and is ready to use.</p>
            
            ${data.task ? `<p>Assigned Task: <strong>${data.task}</strong></p>` : ''}
            
            <div class="credentials">
              <h3>🔐 Connection Details</h3>
              
              <div class="credential-row">
                <div class="label">Machine Name:</div>
                <div class="value">${data.machineName}</div>
              </div>
              
              <div class="credential-row">
                <div class="label">DCV Link:</div>
                <div class="value">${data.dcvLink}</div>
              </div>
              
              <div class="credential-row">
                <div class="label">Username:</div>
                <div class="value">${data.dcvUsername}</div>
              </div>
              
              <div class="credential-row">
                <div class="label">Password:</div>
                <div class="value">${data.dcvPassword}</div>
              </div>
              
              <div class="credential-row">
                <div class="label">Valid Until:</div>
                <div class="value">${data.expiryDate}</div>
              </div>
            </div>
            
            <a href="${data.dcvLink}" class="button">🚀 Connect Now</a>
            
            <div class="warning">
              <strong>⚠️ Security Notice:</strong>
              <ul>
                <li>Please change your password after first login</li>
                <li>Do not share these credentials with anyone</li>
                <li>Keep this email secure or delete it after saving the credentials</li>
              </ul>
            </div>
            
            <h3>📚 Getting Started</h3>
            <ol>
              <li>Click the "Connect Now" button above or copy the DCV link</li>
              <li>Use the provided username and password to log in</li>
              <li>You'll have full access to your configured environment</li>
              <li>All your data will be synced to NFS storage automatically</li>
            </ol>
            
            <p>Need help? Contact our support team at <a href="mailto:support@ankiyacloud.com">support@ankiyacloud.com</a></p>
            
            <p>Happy creating! 🎥</p>
          </div>
          <div class="footer">
            <p>© 2026 Ankiya Cloud - VFX & Media Cloud Platform</p>
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.transporter.sendMail({
      from: `"Ankiya Cloud" <${config.email.from}>`,
      to: data.userEmail,
      subject: `🎬 Your Machine ${data.machineName} is Ready - DCV Access Details`,
      html: htmlContent,
    });
  }

  async sendOrderConfirmation(email: string, orderNumber: string, amount: number): Promise<void> {
    await this.transporter.sendMail({
      from: `"Ankiya Cloud" <${config.email.from}>`,
      to: email,
      subject: `Order Confirmation - ${orderNumber}`,
      html: `
        <h2>Thank you for your order!</h2>
        <p>Order Number: <strong>${orderNumber}</strong></p>
        <p>Amount: <strong>₹${amount}</strong></p>
        <p>Our team will provision your machines shortly.</p>
      `,
    });
  }

  async sendTicketUpdate(email: string, ticketNumber: string, status: string): Promise<void> {
    await this.transporter.sendMail({
      from: `"Ankiya Cloud" <${config.email.from}>`,
      to: email,
      subject: `Ticket Update - ${ticketNumber}`,
      html: `
        <h2>Ticket Status Update</h2>
        <p>Ticket: <strong>${ticketNumber}</strong></p>
        <p>New Status: <strong>${status}</strong></p>
      `,
    });
  }

  async sendInvitationEmail(
    email: string, 
    organizationName: string, 
    invitedBy: string, 
    inviteUrl: string
  ): Promise<void> {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 15px 40px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .highlight { background: #e8f4fd; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎬 You're Invited!</h1>
          </div>
          <div class="content">
            <p>Hello!</p>
            
            <p><strong>${invitedBy}</strong> has invited you to join <strong>${organizationName}</strong> on Ankiya Cloud.</p>
            
            <div class="highlight">
              <p><strong>Ankiya Cloud</strong> is a cloud workstation platform for VFX studios. Once you join, you'll be able to access powerful cloud machines for your creative work.</p>
            </div>
            
            <p style="text-align: center;">
              <a href="${inviteUrl}" class="button">Accept Invitation</a>
            </p>
            
            <p>Or copy this link into your browser:</p>
            <p style="word-break: break-all; background: #fff; padding: 10px; border-radius: 5px; font-size: 12px;">${inviteUrl}</p>
            
            <p><em>This invitation will expire in 7 days.</em></p>
            
            <p>If you weren't expecting this invitation, you can safely ignore this email.</p>
          </div>
          <div class="footer">
            <p>© 2026 Ankiya Cloud - VFX & Media Cloud Platform</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.transporter.sendMail({
      from: `"Ankiya Cloud" <${config.email.from}>`,
      to: email,
      subject: `You're invited to join ${organizationName} on Ankiya Cloud`,
      html: htmlContent,
    });
  }

  // New order notification for admin
  async sendNewOrderNotification(
    adminEmail: string,
    orderNumber: string,
    organizationName: string,
    machineConfigName: string,
    quantity: number,
    duration: number,
    amount: number
  ): Promise<void> {
    await this.transporter.sendMail({
      from: `"Ankiya Cloud" <${config.email.from}>`,
      to: adminEmail,
      subject: `🆕 New Machine Order - ${orderNumber}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1e293b; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .order-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
            .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>📦 New Machine Order Received</h2>
            </div>
            <div class="content">
              <p>A new machine order has been paid and requires provisioning.</p>
              
              <div class="order-details">
                <div class="detail-row">
                  <strong>Order Number:</strong>
                  <span>${orderNumber}</span>
                </div>
                <div class="detail-row">
                  <strong>Organization:</strong>
                  <span>${organizationName}</span>
                </div>
                <div class="detail-row">
                  <strong>Machine Type:</strong>
                  <span>${machineConfigName}</span>
                </div>
                <div class="detail-row">
                  <strong>Quantity:</strong>
                  <span>${quantity} machine(s)</span>
                </div>
                <div class="detail-row">
                  <strong>Duration:</strong>
                  <span>${duration} month(s)</span>
                </div>
                <div class="detail-row">
                  <strong>Amount Paid:</strong>
                  <span>₹${amount.toLocaleString()}</span>
                </div>
              </div>
              
              <p style="text-align: center;">
                <a href="${config.frontend.url}/admin/machines" class="button">
                  View in Admin Panel
                </a>
              </p>
              
              <p style="color: #666; font-size: 12px;">
                Please provision the machines and update the order status.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
  }

  // Machine ready notification for studio admins
  async sendMachineReadyEmail(
    email: string,
    organizationName: string,
    machineName: string,
    machineConfig: string,
    dcvUrl: string,
    expiryDate: string
  ): Promise<void> {
    await this.transporter.sendMail({
      from: `"Ankiya Cloud" <${config.email.from}>`,
      to: email,
      subject: `✅ Machine Ready - ${machineName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .machine-card { background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981; margin: 20px 0; }
            .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Your Machine is Ready!</h1>
            </div>
            <div class="content">
              <p>Great news! Your cloud machine has been provisioned and is ready for use.</p>
              
              <div class="machine-card">
                <h3>${machineName}</h3>
                <p><strong>Configuration:</strong> ${machineConfig}</p>
                <p><strong>DCV URL:</strong> ${dcvUrl}</p>
                <p><strong>Valid Until:</strong> ${expiryDate}</p>
              </div>
              
              <h3>📋 Next Steps</h3>
              <ol>
                <li>Go to the <strong>Machines</strong> page in your dashboard</li>
                <li>Assign this machine to a team member</li>
                <li>The assigned user can then connect using their DCV credentials</li>
              </ol>
              
              <p style="text-align: center;">
                <a href="${config.frontend.url}/machines" class="button">
                  View Machines
                </a>
              </p>
            </div>
            <div class="footer">
              <p>© 2026 Ankiya Cloud - VFX & Media Cloud Platform</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
  }

  // Machine assigned notification (simplified - no credentials)
  async sendMachineAssignedEmail(
    email: string,
    userName: string,
    machineName: string,
    machineConfig: string,
    dcvUrl: string,
    task?: string
  ): Promise<void> {
    await this.transporter.sendMail({
      from: `"Ankiya Cloud" <${config.email.from}>`,
      to: email,
      subject: `🖥️ Machine Assigned - ${machineName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .machine-card { background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; margin: 20px 0; }
            .button { display: inline-block; padding: 15px 40px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            .info-box { background: #e8f4fd; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🖥️ Machine Assigned to You!</h1>
            </div>
            <div class="content">
              <p>Hello <strong>${userName}</strong>,</p>
              
              <p>A cloud machine has been assigned to you. You can now connect and start working!</p>
              
              <div class="machine-card">
                <h3>${machineName}</h3>
                <p><strong>Configuration:</strong> ${machineConfig}</p>
                ${task ? `<p><strong>Task:</strong> ${task}</p>` : ''}
              </div>
              
              <div class="info-box">
                <strong>How to Connect:</strong>
                <ol>
                  <li>Click the "Connect Now" button below or go to the Machines page</li>
                  <li>Log in using your organization credentials (AD/DCV login)</li>
                  <li>Start working on your creative projects!</li>
                </ol>
              </div>
              
              <p style="text-align: center;">
                <a href="${dcvUrl}" class="button">🚀 Connect Now</a>
              </p>
              
              <p>Need help? Contact your studio admin or reach out to <a href="mailto:support@ankiyacloud.com">support@ankiyacloud.com</a></p>
            </div>
            <div class="footer">
              <p>© 2026 Ankiya Cloud - VFX & Media Cloud Platform</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
  }

  // Order cancelled notification
  async sendOrderCancelledEmail(
    email: string,
    orderNumber: string,
    machineConfigName: string,
    quantity: number,
    reason: string
  ): Promise<void> {
    await this.transporter.sendMail({
      from: `"Ankiya Cloud" <${config.email.from}>`,
      to: email,
      subject: `Order Cancelled - ${orderNumber}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .order-card { background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #dc2626; margin: 20px 0; }
            .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>❌ Order Cancelled</h2>
            </div>
            <div class="content">
              <p>Your order has been cancelled.</p>
              
              <div class="order-card">
                <p><strong>Order Number:</strong> ${orderNumber}</p>
                <p><strong>Machine Type:</strong> ${machineConfigName}</p>
                <p><strong>Quantity:</strong> ${quantity}</p>
                <p><strong>Reason:</strong> ${reason}</p>
              </div>
              
              <p>If you'd like to place a new order, please visit our Get Quote page.</p>
              
              <p style="text-align: center;">
                <a href="${config.frontend.url}/quote" class="button">
                  Get a New Quote
                </a>
              </p>
              
              <p>Questions? Contact <a href="mailto:support@ankiyacloud.com">support@ankiyacloud.com</a></p>
            </div>
            <div class="footer">
              <p>© 2026 Ankiya Cloud - VFX & Media Cloud Platform</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
  }

  // Machine unassigned notification
  async sendMachineUnassignedEmail(
    email: string,
    userName: string,
    machineName: string
  ): Promise<void> {
    await this.transporter.sendMail({
      from: `"Ankiya Cloud" <${config.email.from}>`,
      to: email,
      subject: `Machine Access Removed - ${machineName}`,
      html: `
        <h2>Machine Access Removed</h2>
        <p>Hello ${userName},</p>
        <p>Your access to machine <strong>${machineName}</strong> has been removed.</p>
        <p>If you believe this is an error, please contact your studio admin.</p>
        <p>- Ankiya Cloud Team</p>
      `,
    });
  }

  // Machine extended notification
  async sendMachineExtendedEmail(
    email: string,
    userName: string,
    machineName: string,
    extensionMonths: number,
    newExpiryDate: Date
  ): Promise<void> {
    await this.transporter.sendMail({
      from: `"Ankiya Cloud" <${config.email.from}>`,
      to: email,
      subject: `Machine Extended - ${machineName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .info-box { background: white; padding: 20px; border-left: 4px solid #10b981; margin: 20px 0; border-radius: 0 5px 5px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Machine Extended!</h1>
            </div>
            <div class="content">
              <p>Hello <strong>${userName}</strong>,</p>
              
              <p>Great news! Your machine subscription has been extended.</p>
              
              <div class="info-box">
                <h3>📋 Extension Details</h3>
                <p><strong>Machine:</strong> ${machineName}</p>
                <p><strong>Extension Period:</strong> ${extensionMonths} month(s)</p>
                <p><strong>New Expiry Date:</strong> ${newExpiryDate.toLocaleDateString('en-IN', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</p>
              </div>
              
              <p>You can continue using your machine without any interruption. If you have any questions, please contact support.</p>
              
              <p>Thank you for choosing Ankiya Cloud!</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Ankiya Cloud. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
  }
}

export const emailService = new EmailService();
