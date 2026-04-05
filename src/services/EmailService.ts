import { Resend } from 'resend';
import { render } from '@react-email/render';
import React from 'react';
import VerifyEmailTemplate from '../emails/VerifyEmailTemplate';
import ResetPasswordTemplate from '../emails/ResetPasswordTemplate';
import LawyerNotificationTemplate from '../emails/LawyerNotificationTemplate';
import StatusUpdateTemplate from '../emails/StatusUpdateTemplate';

class EmailService {
    private resend: Resend;

    constructor() {
        this.resend = new Resend(process.env.RESEND_API_KEY || 're_dummy');
    }

    private getFromEmail(): string {
        return process.env.SMTP_FROM || 'Plataforma Migratoria <notificaciones@jonathanrbt.lat>';
    }

    async sendVerificationEmail(email: string, code: string) {
        if (!process.env.RESEND_API_KEY) {
            console.warn('[EmailService] RESEND_API_KEY no configurado. Código generado:', code);
            return;
        }

        try {
            const html = await render(React.createElement(VerifyEmailTemplate, { validationCode: code }));
            const { data, error } = await this.resend.emails.send({
                from: this.getFromEmail(),
                to: email,
                subject: 'Verifica tu cuenta - Sistema Migratorio',
                html,
            });

            if (error) {
                console.error('[EmailService] Error enviando correo de verificación:', error);
            } else {
                console.log(`[EmailService] Correo de verificación enviado a ${email}:`, data?.id);
            }
        } catch (error) {
            console.error('[EmailService] Exception enviando correo:', error);
        }
    }

    async sendPasswordResetEmail(email: string, code: string) {
        if (!process.env.RESEND_API_KEY) {
            console.warn('[EmailService] RESEND_API_KEY no configurado. Código generado:', code);
            return;
        }

        try {
            const html = await render(React.createElement(ResetPasswordTemplate, { validationCode: code }));
            const { data, error } = await this.resend.emails.send({
                from: this.getFromEmail(),
                to: email,
                subject: 'Recuperación de contraseña - Sistema Migratorio',
                html,
            });

            if (error) {
                console.error('[EmailService] Error enviando correo de recuperación:', error);
            } else {
                console.log(`[EmailService] Correo de recuperación enviado a ${email}:`, data?.id);
            }
        } catch (error) {
            console.error('[EmailService] Exception enviando correo:', error);
        }
    }

    async sendApplicationSubmittedEmail(lawyerEmails: string[], clientName: string) {
        if (!lawyerEmails || lawyerEmails.length === 0) return;
        if (!process.env.RESEND_API_KEY) {
            console.warn('[EmailService] RESEND_API_KEY no configurado.');
            return;
        }

        const subject = `Nueva Solicitud Recibida - ${clientName}`;
        const actionUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const message = `El cliente ha completado el envío de su formulario inicial y documentos. La solicitud ya está lista para su revisión.`;
        
        try {
            const html = await render(React.createElement(LawyerNotificationTemplate, {
                title: 'Nueva Solicitud',
                clientName,
                color: '#18181B',
                iconType: 'document',
                message,
                actionUrl
            }));

            const { data, error } = await this.resend.emails.send({
                from: this.getFromEmail(),
                to: lawyerEmails,
                subject,
                html,
            });

            if (error) console.error('[EmailService] Error:', error);
        } catch (error) {
            console.error('[EmailService] Exception:', error);
        }
    }

    async sendCorrectionSubmittedEmail(lawyerEmails: string[], clientName: string) {
        if (!lawyerEmails || lawyerEmails.length === 0) return;
        if (!process.env.RESEND_API_KEY) {
            console.warn('[EmailService] RESEND_API_KEY no configurado.');
            return;
        }

        const subject = `Subsanación Recibida - ${clientName}`;
        const actionUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const message = `El cliente ha enviado sus correcciones o documentos adicionales y vuelve a estar completo. Por favor revise los cambios.`;
        
        try {
            const html = await render(React.createElement(LawyerNotificationTemplate, {
                title: 'Subsanación Recibida',
                clientName,
                color: '#27272A',
                iconType: 'update',
                message,
                actionUrl
            }));

            const { data, error } = await this.resend.emails.send({
                from: this.getFromEmail(),
                to: lawyerEmails,
                subject,
                html,
            });

            if (error) console.error('[EmailService] Error:', error);
        } catch (error) {
            console.error('[EmailService] Exception:', error);
        }
    }

    async sendStatusUpdateEmail(clientEmail: string, clientName: string, status: string, note?: string) {
        if (!clientEmail) return;
        if (!process.env.RESEND_API_KEY) {
            console.warn('[EmailService] RESEND_API_KEY no configurado.');
            return;
        }

        let color = '#3F3F46';
        let iconType: 'success' | 'error' | 'warning' | 'pending' | 'document' = 'pending';
        let customMessage = 'Su expediente está siendo revisado por nuestro equipo.';
        
        if (status === 'Aprobado') {
            color = '#3F6250';
            iconType = 'success';
            customMessage = 'Su expediente ha sido aprobado satisfactoriamente.';
        } else if (status === 'Rechazado') {
            color = '#7F1D1D';
            iconType = 'error';
            customMessage = 'Su expediente ha sido rechazado. Por favor, contáctenos para más detalles.';
        } else if (status === 'Requiere subsanación') {
            color = '#9A3412';
            iconType = 'warning';
            customMessage = note ? `<strong>Mensaje del abogado:</strong><br/><br/>${note}<br/><br/>Por favor, inicie sesión para corregir su solicitud.` : 'Por favor, inicie sesión para corregir su solicitud.';
        }

        const actionUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const subject = `Actualización de Estado - ${status}`;

        try {
            const html = await render(React.createElement(StatusUpdateTemplate, {
                clientName,
                statusText: status,
                color,
                iconType,
                customMessage,
                actionUrl
            }));

            const { data, error } = await this.resend.emails.send({
                from: this.getFromEmail(),
                to: clientEmail,
                subject,
                html,
            });

            if (error) console.error('[EmailService] Error:', error);
        } catch (error) {
            console.error('[EmailService] Exception:', error);
        }
    }
}

export const emailService = new EmailService();