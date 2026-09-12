import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import * as Handlebars from 'handlebars';
import * as path from 'node:path';
import { readFileSync } from 'node:fs';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mjml: (input: string, options?: Record<string, any>) => Promise<{ html: string; errors: any[] }> = require('mjml');

// Envío directo vía Resend (sin worker ni JobQueue) del correo de verificación
// de la tienda del vendedor.
@Injectable()
export class SellerVerificationEmailService {
    private readonly logger = new Logger(SellerVerificationEmailService.name);
    private resend: Resend;
    private templatesDir: string;
    private partialsDir: string;
    private compiled: Record<string, HandlebarsTemplateDelegate> = {};

    constructor() {
        this.resend = new Resend(process.env.RESEND_API_KEY);
        const baseDir = path.join(__dirname, '../../../../static/email/templates');
        this.templatesDir = path.join(baseDir, 'verify-seller-email');
        this.partialsDir = path.join(baseDir, 'partials');
        this.registerPartials();
        this.compileTemplates();
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
        try {
            const source = readFileSync(path.join(this.templatesDir, 'verify-seller-email.hbs'), 'utf8');
            this.compiled['verify-seller-email'] = Handlebars.compile(source);
        } catch (e: any) {
            this.logger.warn(`Could not compile template verify-seller-email: ${e.message}`);
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

    async sendVerification(to: string, verifyUrl: string, code: string): Promise<boolean> {
        try {
            const html = await this.render('verify-seller-email', { verifyUrl, code });
            const { data, error } = await this.resend.emails.send({
                to,
                from: '"EcommerShop" <ceo@ecommer.shop>',
                subject: 'Verifica tu correo para activar tu tienda - Ecommer.shop',
                html,
            });

            if (error) {
                this.logger.error(
                    `Resend rechazó el email de verificación a ${to}: ${JSON.stringify(error)}`,
                );
                return false;
            }

            this.logger.log(`Email de verificación enviado a ${to} (Resend ID: ${data?.id ?? 'n/a'})`);
            return true;
        } catch (e: any) {
            this.logger.error(`No se pudo enviar el email de verificación a ${to}: ${e.message}`);
            return false;
        }
    }
}