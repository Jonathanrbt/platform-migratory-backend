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

    private generateLawyerEmailTemplate(title: string, clientName: string, color: string, icon: string, message: string, actionUrl: string) {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                <div style="background-color: ${color}; color: white; padding: 20px; text-align: center;">
                    <h2 style="margin: 0; font-size: 24px;">${icon} Panel del Abogado</h2>
                </div>
                <div style="padding: 30px 20px; background-color: #ffffff; color: #374151;">
                    <p style="font-size: 16px; margin-top: 0;">Estimado Equipo Legal,</p>
                    <p style="font-size: 16px;">Se ha registrado una nueva actividad en el sistema para el cliente <strong>${clientName}</strong>:</p>
                    <div style="text-align: center; margin: 25px 0;">
                        <span style="display: inline-block; background-color: ${color}20; color: ${color}; padding: 8px 16px; border-radius: 9999px; font-weight: bold; font-size: 18px; border: 1px solid ${color};">
                            ${title}
                        </span>
                    </div>
                    <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; border-left: 4px solid ${color}; margin-bottom: 25px;">
                        <p style="margin: 0; font-size: 15px;">${message}</p>
                    </div>
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="${actionUrl}" style="display: inline-block; background-color: #111827; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Ir al Panel</a>
                    </div>
                </div>
                <div style="background-color: #f9fafb; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0;">Este es un mensaje automático del Sistema Migratorio, por favor no responda a este correo.</p>
                </div>
            </div>
        `;
    }

    async sendApplicationSubmittedEmail(lawyerEmails: string[], clientName: string) {
        if (!lawyerEmails || lawyerEmails.length === 0) return;
        const subject = `Nueva Solicitud Recibida - ${clientName}`;
        const actionUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const message = `El cliente ha completado el envío de su formulario inicial y documentos. La solicitud ya está lista para su revisión.`;
        
        const html = this.generateLawyerEmailTemplate(
            'Nueva Solicitud', 
            clientName, 
            '#8b5cf6', // Violeta para nuevas solicitudes
            '📄', 
            message, 
            actionUrl
        );
        await this.sendMail(lawyerEmails, subject, html);
    }

    async sendCorrectionSubmittedEmail(lawyerEmails: string[], clientName: string) {
        if (!lawyerEmails || lawyerEmails.length === 0) return;
        const subject = `Subsanación Recibida - ${clientName}`;
        const actionUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const message = `El cliente ha enviado sus correcciones o documentos adicionales y vuelve a estar completo. Por favor revise los cambios.`;
        
        const html = this.generateLawyerEmailTemplate(
            'Subsanación Recibida', 
            clientName, 
            '#0ea5e9', // Azul claro para subsanaciones
            '🔄', 
            message, 
            actionUrl
        );
        await this.sendMail(lawyerEmails, subject, html);
    }

    private generateStatusEmailTemplate(clientName: string, statusText: string, color: string, icon: string, customMessage: string, actionUrl: string) {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                <div style="background-color: ${color}; color: white; padding: 20px; text-align: center;">
                    <h2 style="margin: 0; font-size: 24px;">${icon} Sistema Migratorio</h2>
                </div>
                <div style="padding: 30px 20px; background-color: #ffffff; color: #374151;">
                    <p style="font-size: 16px; margin-top: 0;">Hola <strong>${clientName}</strong>,</p>
                    <p style="font-size: 16px;">El estado de su expediente ha sido actualizado a:</p>
                    <div style="text-align: center; margin: 25px 0;">
                        <span style="display: inline-block; background-color: ${color}20; color: ${color}; padding: 8px 16px; border-radius: 9999px; font-weight: bold; font-size: 18px; border: 1px solid ${color};">
                            ${statusText}
                        </span>
                    </div>
                    <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; border-left: 4px solid ${color}; margin-bottom: 25px;">
                        <p style="margin: 0; font-size: 15px; white-space: pre-wrap;">${customMessage}</p>
                    </div>
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="${actionUrl}" style="display: inline-block; background-color: #111827; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Ver mi expediente</a>
                    </div>
                </div>
                <div style="background-color: #f9fafb; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0;">Este es un mensaje automático del Sistema Migratorio, por favor no responda a este correo.</p>
                </div>
            </div>
        `;
    }

    async sendStatusUpdateEmail(clientEmail: string, clientName: string, status: string, note?: string) {
        if (!clientEmail) return;

        let color = '#3b82f6'; // Azul por defecto (En proceso)
        let icon = '⏳';
        let customMessage = 'Su expediente está siendo revisado por nuestro equipo.';
        
        if (status === 'Aprobado') {
            color = '#10b981'; // Verde
            icon = '✅';
            customMessage = 'Su expediente ha sido aprobado satisfactoriamente.';
        } else if (status === 'Rechazado') {
            color = '#ef4444'; // Rojo
            icon = '❌';
            customMessage = 'Su expediente ha sido rechazado. Por favor, contáctenos para más detalles.';
        } else if (status === 'Requiere subsanación') {
            color = '#f59e0b'; // Naranja
            icon = '⚠️';
            customMessage = note ? `<strong>Mensaje del abogado:</strong><br/><br/>${note}<br/><br/>Por favor, inicie sesión para corregir su solicitud.` : 'Por favor, inicie sesión para corregir su solicitud.';
        }

        const actionUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const subject = `Actualización de Estado - ${status}`;
        const html = this.generateStatusEmailTemplate(clientName, status, color, icon, customMessage, actionUrl);

        await this.sendMail(clientEmail, subject, html);
    }
}

export const emailService = new EmailService();
