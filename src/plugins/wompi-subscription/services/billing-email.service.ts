import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import * as Handlebars from 'handlebars';
import * as path from 'node:path';
import { readFileSync } from 'node:fs';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mjml: (input: string, options?: Record<string, any>) => Promise<{ html: string; errors: any[] }> = require('mjml');

@Injectable()
export class BillingEmailService {
    private readonly logger = new Logger(BillingEmailService.name);
    private resend: Resend;
    private templatesDir: string;
    private partialsDir: string;
    private compiled: Record<string, HandlebarsTemplateDelegate> = {};
    private initialized = false;

    constructor() {
        this.resend = new Resend(process.env.RESEND_API_KEY);
        const baseDir = path.join(__dirname, '../../../../static/email/templates');
        this.templatesDir = path.join(baseDir, 'subscription');
        this.partialsDir = path.join(baseDir, 'partials');
        this.registerPartials();
        this.compileTemplates();
        this.initialized = true;
    }

    private registerPartials() {
        try {
            const header = readFileSync(path.join(this.partialsDir, 'header.hbs'), 'utf8');
            const footer = readFileSync(path.join(this.partialsDir, 'footer.hbs'), 'utf8');
            Handlebars.registerPartial('header', header);
            Handlebars.registerPartial('footer', footer);
        } catch (e: any) {
            this.logger.warn('Could not load Handlebars partials: ' + e.message);
        }
    }

    private compileTemplates() {
        const names = ['renewal-success', 'renewal-failed', 'manual-reminder', 'payment-expired', 'suspended', 'grace-period'];
        for (const name of names) {
            try {
                const source = readFileSync(path.join(this.templatesDir, `${name}.hbs`), 'utf8');
                this.compiled[name] = Handlebars.compile(source);
            } catch (e: any) {
                this.logger.warn(`Could not compile template ${name}: ${e.message}`);
            }
        }
    }

    private async render(templateName: string, data: Record<string, any>): Promise<string> {
        const compile = this.compiled[templateName];
        if (!compile) {
            throw new Error(`Template ${templateName} not found`);
        }
        const mjmlContent = compile(data);
        const { html, errors } = await mjml(mjmlContent);
        if (errors?.length) {
            this.logger.error(`MJML errors en ${templateName}: ${JSON.stringify(errors)}`);
        }
        if (!html) {
            throw new Error(`No se pudo generar HTML del email ${templateName}`);
        }
        return html;
    }

    async sendRenewalSuccess(to: string, planName: string, endsAt: string) {
        const html = await this.render('renewal-success', { planName, endsAt });
        await this.send(to, 'Renovación exitosa - Ecommer.shop', html);
    }

    async sendRenewalFailed(to: string, planName: string, reason: string) {
        const html = await this.render('renewal-failed', { planName, reason });
        await this.send(to, 'Error en la renovación - Ecommer.shop', html);
    }

    async sendManualReminder(to: string, planName: string, daysLeft: number) {
        const html = await this.render('manual-reminder', { planName, daysLeft: String(daysLeft) });
        await this.send(to, 'Recordatorio de pago - Ecommer.shop', html);
    }

    async sendPaymentExpired(to: string, planName: string) {
        const html = await this.render('payment-expired', { planName });
        await this.send(to, 'Pago pendiente expirado - Ecommer.shop', html);
    }

    async sendSuspended(to: string, planName: string) {
        const html = await this.render('suspended', { planName });
        await this.send(to, 'Plan suspendido - Ecommer.shop', html);
    }

    async sendGracePeriodNotice(to: string, planName: string) {
        const html = await this.render('grace-period', { planName });
        await this.send(to, 'Período de gracia - Ecommer.shop', html);
    }

    private async send(to: string, subject: string, html: string) {
        try {
            await this.resend.emails.send({
                to,
                from: '"EcommerShop" <ceo@ecommer.shop>',
                subject,
                html,
            });
            this.logger.log(`Email sent to ${to}: ${subject}`);
        } catch (e: any) {
            this.logger.error(`Failed to send email to ${to}: ${e.message}`);
        }
    }
}
