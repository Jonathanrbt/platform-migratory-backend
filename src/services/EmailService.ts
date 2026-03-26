import nodemailer from 'nodemailer';

class EmailService {
    private transporter: nodemailer.Transporter;

    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 587,
            secure: Number(process.env.SMTP_PORT) === 465, // true for 465, false for other ports
            family: 4, // force IPv4 to fix ENETUNREACH IPv6 issues
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        } as any);
    }

    private async sendMail(to: string | string[], subject: string, html: string) {
        try {
            if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
                console.warn('[EmailService] SMTP credentials not configured. Skipping email sending.');
                return;
            }

            const mailOptions = {
                from: process.env.SMTP_FROM || '"Sistema Migratorio" <no-reply@migratorio.com>',
                to: Array.isArray(to) ? to.join(',') : to,
                subject,
                html,
            };

            const info = await this.transporter.sendMail(mailOptions);
            console.log(`[EmailService] Message sent: ${info.messageId}`);
        } catch (error) {
            console.error('[EmailService] Error sending email:', error);
            // Non-blocking: we don't throw the error
        }
    }

    async sendApplicationSubmittedEmail(lawyerEmails: string[], clientName: string) {
        if (!lawyerEmails || lawyerEmails.length === 0) return;
        const subject = `Nueva Solicitud Recibida - ${clientName}`;
        const html = `
            <h2>Nueva Solicitud de Cliente</h2>
            <p>El cliente <strong>${clientName}</strong> ha completado el env&iacute;o de su formulario inicial y documentos.</p>
            <p>Por favor, inicie sesi&oacute;n en su panel para revisar la solicitud.</p>
        `;
        await this.sendMail(lawyerEmails, subject, html);
    }

    async sendCorrectionSubmittedEmail(lawyerEmails: string[], clientName: string) {
        if (!lawyerEmails || lawyerEmails.length === 0) return;
        const subject = `Subsanación Recibida - ${clientName}`;
        const html = `
            <h2>Subsanaci&oacute;n de Cliente</h2>
            <p>El cliente <strong>${clientName}</strong> ha enviado sus correcciones o documentos adicionales y vuelve a estar completo.</p>
            <p>Por favor, inicie sesi&oacute;n en su panel para revisar la solicitud.</p>
        `;
        await this.sendMail(lawyerEmails, subject, html);
    }
}

export const emailService = new EmailService();
