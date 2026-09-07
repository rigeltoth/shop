import { vendureDashboardPlugin } from '@vendure/dashboard/vite';
import { LanguageCode } from '@vendure/core';
import { dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { defineConfig } from 'vite';
import { IS_DEV } from './src/config/environment';
import { patchBaseUiMouseUp } from './src/vite-plugins/patch-base-ui-mouseup';
import { injectGtm } from './src/vite-plugins/inject-gtm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function patchVendureDashboardChannelPermissions() {
    return {
        name: 'patch-vendure-dashboard-channel-permissions',
        enforce: 'pre' as const,
        transform(code: string, id: string) {
            const normalizedId = id.replace(/\\/g, '/');
            let nextCode = code;

            if (normalizedId.includes('/data-display/boolean.tsx')) {
                nextCode = nextCode
                    .replace(/labelTrue \?\? 'Enabled'/g, "labelTrue ?? 'Habilitado'")
                    .replace(/labelFalse \?\? 'Disabled'/g, "labelFalse ?? 'Deshabilitado'")
                    .replace(/labelTrue \?\? "Enabled"/g, 'labelTrue ?? "Habilitado"')
                    .replace(/labelFalse \?\? "Disabled"/g, 'labelFalse ?? "Deshabilitado"');
            }

            if (normalizedId.includes('/@vendure/dashboard/src/lib/hooks/use-dynamic-translations.ts')) {
                nextCode = nextCode.replace(
                    `    const getTranslatedFieldName = (fieldId: string) => {
        const fieldNameTranslationId = \`fieldName.\${fieldId}\`;
        const translatedDisplay = i18n.t(fieldNameTranslationId);
        return translatedDisplay !== fieldNameTranslationId
            ? translatedDisplay
            : camelCaseToTitleCase(fieldId);
    };`,
                    `    const fieldNameOverrides: Record<string, string> = {
        enabled: 'Habilitado',
    };
    const getTranslatedFieldName = (fieldId: string) => {
        if (fieldNameOverrides[fieldId]) {
            return fieldNameOverrides[fieldId];
        }
        const fieldNameTranslationId = \`fieldName.\${fieldId}\`;
        const translatedDisplay = i18n.t(fieldNameTranslationId);
        return translatedDisplay !== fieldNameTranslationId
            ? translatedDisplay
            : camelCaseToTitleCase(fieldId);
    };`,
                );
            }

            if (normalizedId.includes('/@vendure/dashboard/src/lib/components/layout/channel-switcher.tsx')) {
                if (!nextCode.includes("import { usePermissions } from '@/vdb/hooks/use-permissions.js';")) {
                    nextCode = nextCode.replace(
                        "import { useUserSettings } from '@/vdb/hooks/use-user-settings.js';",
                        "import { useUserSettings } from '@/vdb/hooks/use-user-settings.js';\nimport { usePermissions } from '@/vdb/hooks/use-permissions.js';",
                    );
                }

                if (!nextCode.includes('const { hasPermissions } = usePermissions();')) {
                    nextCode = nextCode.replace(
                        '    const { channels, activeChannel, setActiveChannel } = useChannel();',
                        '    const { channels, activeChannel, setActiveChannel } = useChannel();\n    const { hasPermissions } = usePermissions();',
                    );
                }

                if (!nextCode.includes("{hasPermissions(['CreateChannel']) &&")) {
                    nextCode = nextCode.replace(
                        `                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="gap-2 p-2 cursor-pointer" asChild>
                                <Link to={'/channels/new'}>
                                    <div className="bg-background flex size-6 items-center justify-center rounded-md border">
                                        <Plus className="size-4" />
                                    </div>
                                    <div className="text-muted-foreground font-medium">Add channel</div>
                                </Link>
                            </DropdownMenuItem>`,
                        `                            {hasPermissions(['CreateChannel']) && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="gap-2 p-2 cursor-pointer" asChild>
                                        <Link to={'/channels/new'}>
                                            <div className="bg-background flex size-6 items-center justify-center rounded-md border">
                                                <Plus className="size-4" />
                                            </div>
                                            <div className="text-muted-foreground font-medium">Add channel</div>
                                        </Link>
                                    </DropdownMenuItem>
                                </>
                            )}`,
                    );
                }
            }

            if (normalizedId.includes('/@vendure/dashboard/src/app/routes/_authenticated/_channels/channels_.$id.tsx')) {
                nextCode = nextCode.replace(
                    "<PermissionGuard requires={['UpdateChannel']}>",
                    "<PermissionGuard requires={creatingNewEntity ? ['CreateChannel'] : ['UpdateChannel']}>",
                );
            }

            if (normalizedId.includes('/@vendure/dashboard/src/app/routes/_authenticated/_payment-methods/payment-methods_.$id.tsx')) {
                // Prefer the billing-style asset field (hydrate + Ver/Descargar) over EntityAssets.
                if (nextCode.includes("import { EntityAssets } from '@/vdb/components/shared/entity-assets.js';")) {
                    nextCode = nextCode.replace(
                        "\nimport { EntityAssets } from '@/vdb/components/shared/entity-assets.js';",
                        '',
                    );
                }
                if (!nextCode.includes("import { BillingCertificateDocField } from '@/plugins/invoice-client/dashboard/components/billing-certificate-doc-field';")) {
                    nextCode = nextCode.replace(
                        "import { ErrorPage } from '@/vdb/components/shared/error-page.js';",
                        "import { ErrorPage } from '@/vdb/components/shared/error-page.js';\nimport { BillingCertificateDocField } from '@/plugins/invoice-client/dashboard/components/billing-certificate-doc-field';\nimport { PayoutSettingsSection } from '@/plugins/payout/dashboard/components/payout-settings-section';",
                    );
                }
                if (!nextCode.includes("import { PermissionGuard } from '@/vdb/components/shared/permission-guard.js';")) {
                    nextCode = nextCode.replace(
                        "import { ErrorPage } from '@/vdb/components/shared/error-page.js';",
                        "import { ErrorPage } from '@/vdb/components/shared/error-page.js';\nimport { PermissionGuard } from '@/vdb/components/shared/permission-guard.js';",
                    );
                }
                if (!nextCode.includes("import { usePermissions } from '@/vdb/hooks/use-permissions.js';")) {
                    nextCode = nextCode.replace(
                        "import { toast } from 'sonner';",
                        "import { toast } from 'sonner';\nimport { usePermissions } from '@/vdb/hooks/use-permissions.js';",
                    );
                }
                if (!nextCode.includes('const canConfigurePaymentProcessor')) {
                    nextCode = nextCode.replace(
                        '    const { t } = useLingui();',
                        `    const { t } = useLingui();
    const { hasPermissions } = usePermissions();
    const canConfigurePaymentProcessor = hasPermissions(['CreateSettings']);
    const canManageBankVerification = hasPermissions(['SuperAdmin']);`,
                    );
                }

                nextCode = nextCode.replace(
                    `        transformCreateInput: input => {
            return {
                ...input,
                checker: input.checker?.code ? input.checker : undefined,
                handler: input.handler,
            };
        },`,
                    `        transformCreateInput: input => {
            const customFields = { ...(input.customFields ?? {}) };
            if (!canManageBankVerification) {
                delete customFields.bankCertificationVerified;
            } else if (customFields.bankCertificationVerified == null) {
                customFields.bankCertificationVerified = false;
            }
            return {
                ...input,
                customFields,
                code:
                    input.code?.trim() ||
                    (input.name ?? '')
                        .toLowerCase()
                        .trim()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-+|-+$/g, ''),
                checker: input.checker?.code ? input.checker : undefined,
                handler: input.handler?.code
                    ? input.handler
                    : {
                          code: 'dummy-payment-handler',
                          arguments: [{ name: 'automaticSettle', value: 'false' }],
                      },
            };
        },
        transformUpdateInput: input => {
            const customFields = { ...(input.customFields ?? {}) };
            const prev = entity?.customFields ?? {};
            const bankChanged =
                String(customFields.accountNumber ?? '').trim() !== String(prev.accountNumber ?? '').trim() ||
                String(customFields.bankName ?? '').trim() !== String(prev.bankName ?? '').trim() ||
                String(customFields.bankCertificationPdf ?? '') !== String(prev.bankCertificationPdf ?? '');
            if (!canManageBankVerification) {
                delete customFields.bankCertificationVerified;
            } else if (bankChanged) {
                customFields.bankCertificationVerified = false;
            }
            return { ...input, customFields };
        },`,
                );
                nextCode = nextCode.replace(
                    `                    description: err instanceof Error ? err.message : 'Unknown error',`,
                    `                    description:
                        err instanceof Error &&
                        (err.message.includes('ConfigurableOperationInput!') ||
                            err.message.includes('PaymentMethodHandler'))
                            ? 'Debes seleccionar un método de procesamiento de pago (Calculator) antes de crear el método de pago.'
                            : err instanceof Error
                              ? err.message
                              : 'Error desconocido',`,
                );

                nextCode = nextCode.replace(
                    `                        <FormFieldWrapper
                            control={form.control}
                            name="code"
                            label={<Trans>Code</Trans>}
                            render={({ field }) => <Input {...field} />}
                        />`,
                    '',
                );
                nextCode = nextCode.replace(
                    `                        <TranslatableFormFieldWrapper
                            control={form.control}
                            name="name"
                            label={<Trans>Name</Trans>}
                            render={({ field }) => <Input {...field} />}
                        />`,
                    `                        <TranslatableFormFieldWrapper
                            control={form.control}
                            name="name"
                            label="Nombre"
                            render={({ field }) => <Input {...field} />}
                        />`,
                );
                nextCode = nextCode.replace(
                    `                        label={<Trans>Enabled</Trans>}`,
                    `                        label="Habilitado"`,
                );
                nextCode = nextCode.replace(
                    `                    <TranslatableFormFieldWrapper
                        control={form.control}
                        name="description"
                        label={<Trans>Description</Trans>}
                        render={({ field }) => <RichTextInput {...field} />}
                    />`,
                    '',
                );
                nextCode = nextCode.replace(
                    `<CustomFieldsPageBlock column="main" entityType="PaymentMethod" control={form.control} />`,
                    `<PageBlock
                    column="main"
                    blockId="bank-certification-pdf"
                    title="Carga tu certificado bancario"
                >
                    <BillingCertificateDocField
                        label="Certificación bancaria"
                        hint="PDF o imagen de la certificación bancaria. Si reemplazas el archivo, la verificación se desactiva hasta que SuperAdmin la revise."
                        assetId={String(form.watch('customFields.bankCertificationPdf') ?? '')}
                        onAssetIdChange={id => {
                            form.setValue('customFields.bankCertificationPdf', id || undefined, {
                                shouldDirty: true,
                                shouldValidate: true,
                            });
                            form.setValue('customFields.bankCertificationVerified', false, {
                                shouldDirty: true,
                            });
                        }}
                        accept=".pdf,.jpg,.jpeg,.png,image/*,application/pdf"
                    />
                </PageBlock>
                <PageBlock column="main" blockId="payment-method-bank-fields" title="Datos bancarios">
                    <DetailFormGrid>
                        <FormFieldWrapper
                            control={form.control}
                            name="customFields.accountNumber"
                            label="Número de cuenta"
                            render={({ field }) => (
                                <Input
                                    {...field}
                                    onChange={e => {
                                        field.onChange(e);
                                        form.setValue('customFields.bankCertificationVerified', false, {
                                            shouldDirty: true,
                                        });
                                    }}
                                />
                            )}
                        />
                        <FormFieldWrapper
                            control={form.control}
                            name="customFields.bankName"
                            label="Banco"
                            render={({ field }) => (
                                <Input
                                    {...field}
                                    onChange={e => {
                                        field.onChange(e);
                                        form.setValue('customFields.bankCertificationVerified', false, {
                                            shouldDirty: true,
                                        });
                                    }}
                                />
                            )}
                        />
                    </DetailFormGrid>
                    <PermissionGuard requires={['SuperAdmin']}>
                        <FormFieldWrapper
                            control={form.control}
                            name="customFields.bankCertificationVerified"
                            label="Certificación bancaria verificada"
                            render={({ field }) => (
                                <Switch checked={field.value ?? false} onCheckedChange={field.onChange} />
                            )}
                        />
                    </PermissionGuard>
                </PageBlock>
                <PageBlock column="main" blockId="payout-settings" title="Liquidaciones">
                    <PayoutSettingsSection />
                    {!canManageBankVerification ? (
                        <p className="text-xs text-muted-foreground mt-2">
                            Si cambias cuenta, banco o el PDF, la certificación deja de estar verificada hasta que SuperAdmin la revise.
                        </p>
                    ) : null}
                </PageBlock>`,
                );
                nextCode = nextCode.replace(
                    'title={<Trans>Payment eligibility checker</Trans>}',
                    "title={'Verificador de elegibilidad de pago'}",
                );
                nextCode = nextCode.replace(
                    'title={<Trans>Calculator</Trans>}',
                    "title={'Calculadora'}",
                );

                if (!nextCode.includes('canConfigurePaymentProcessor && (!checkerArgsValid')) {
                    nextCode = nextCode.replace(
                        `                        disabled={
                            !form.formState.isDirty ||
                            !form.formState.isValid ||
                            isPending ||
                            !checkerArgsValid ||
                            !handlerArgsValid
                        }`,
                        `                        disabled={
                            !form.formState.isDirty ||
                            !form.formState.isValid ||
                            isPending ||
                            (canConfigurePaymentProcessor &&
                                (!checkerArgsValid || !handlerArgsValid))
                        }`,
                    );
                }

                if (!nextCode.includes('<PermissionGuard requires={[\'CreateSettings\']}')) {
                    nextCode = nextCode.replace(
                        `                <PageBlock
                    column="main"
                    blockId="payment-eligibility-checker"
                    title={'Verificador de elegibilidad de pago'}
                >`,
                        `                <PermissionGuard requires={['CreateSettings']}>
                <PageBlock
                    column="main"
                    blockId="payment-eligibility-checker"
                    title={'Verificador de elegibilidad de pago'}
                >`,
                    );
                    nextCode = nextCode.replace(
                        `                </PageBlock>
                <PageBlock column="main" blockId="payment-handler" title={'Calculadora'}>`,
                        `                </PageBlock>
                </PermissionGuard>
                <PermissionGuard requires={['CreateSettings']}>
                <PageBlock column="main" blockId="payment-handler" title={'Calculadora'}>`,
                    );
                    nextCode = nextCode.replace(
                        `                </PageBlock>
            </PageLayout>`,
                        `                </PageBlock>
                </PermissionGuard>
            </PageLayout>`,
                    );
                }
            }
            if (
                normalizedId.includes(
                    '/@vendure/dashboard/src/app/routes/_authenticated/_payment-methods/components/payment-eligibility-checker-selector.tsx',
                )
            ) {
                nextCode = nextCode.replace(
                    'buttonText="Select Payment Eligibility Checker"',
                    `buttonText="Seleccionar verificador de elegibilidad de pago"`,
                );
                nextCode = nextCode.replace(
                    'emptyText="No checkers found"',
                    `emptyText="No se encontraron verificadores"`,
                );
            }
            if (
                normalizedId.includes(
                    '/@vendure/dashboard/src/app/routes/_authenticated/_payment-methods/components/payment-handler-selector.tsx',
                )
            ) {
                nextCode = nextCode.replace(
                    'buttonText="Select Payment Handler"',
                    `buttonText="Seleccionar método de pago (Calculadora)"`,
                );
            }

            if (normalizedId.includes('/@vendure/dashboard/src/app/routes/_authenticated/_payment-methods/payment-methods.tsx')) {
                nextCode = nextCode.replace(
                    'title={<Trans>Payment Methods</Trans>}',
                    "title={'Métodos de pago'}",
                );
                nextCode = nextCode.replace(
                    'breadcrumb: () => <Trans>Payment Methods</Trans>',
                    "breadcrumb: () => 'Métodos de pago'",
                );
                nextCode = nextCode.replace(
                    '<Trans>New payment method</Trans>',
                    "'Nuevo método de pago'",
                );
            }

            if (normalizedId.includes('/@vendure/dashboard/src/app/routes/_authenticated/_shipping-methods/shipping-methods_.$id.tsx')) {
                if (!nextCode.includes("import { PermissionGuard } from '@/vdb/components/shared/permission-guard.js';")) {
                    nextCode = nextCode.replace(
                        "import { ErrorPage } from '@/vdb/components/shared/error-page.js';",
                        "import { ErrorPage } from '@/vdb/components/shared/error-page.js';\nimport { PermissionGuard } from '@/vdb/components/shared/permission-guard.js';",
                    );
                }
                if (!nextCode.includes("import { useEffect } from 'react';")) {
                    nextCode = nextCode.replace(
                        "import { useState } from 'react';",
                        "import { useEffect, useState } from 'react';",
                    );
                }

                if (!nextCode.includes('transformCreateInput: input =>')) {
                    nextCode = nextCode.replace(
                        `        params: { id: params.id },`,
                        `        transformCreateInput: input => {
            const name =
                input.translations?.[0]?.name ??
                input.name ??
                '';
            return {
                ...input,
                code:
                    input.code?.trim() ||
                    name
                        .toLowerCase()
                        .trim()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-+|-+$/g, ''),
                fulfillmentHandler: input.fulfillmentHandler || 'manual-fulfillment',
                checker: input.checker?.code
                    ? input.checker
                    : {
                          code: 'multivendor-shipping-eligibility-checker',
                          arguments: [],
                      },
                calculator: input.calculator?.code
                    ? input.calculator
                    : {
                          code: 'default-shipping-calculator',
                          arguments: [
                              { name: 'rate', value: '500' },
                              { name: 'includesTax', value: 'auto' },
                              { name: 'taxRate', value: '20' },
                          ],
                      },
            };
        },
        params: { id: params.id },`,
                    );
                }

                if (!nextCode.includes('multivendor-shipping-eligibility-checker')) {
                    nextCode = nextCode.replace(
                        `    const [checkerArgsValid, setCheckerArgsValid] = useState(true);
    const [calculatorArgsValid, setCalculatorArgsValid] = useState(true);`,
                        `    const [checkerArgsValid, setCheckerArgsValid] = useState(true);
    const [calculatorArgsValid, setCalculatorArgsValid] = useState(true);

    useEffect(() => {
        if (!creatingNewEntity) {
            return;
        }
        if (!form.getValues('fulfillmentHandler')) {
            form.setValue('fulfillmentHandler', 'manual-fulfillment', {
                shouldDirty: true,
                shouldValidate: true,
            });
        }
        if (!form.getValues('checker')?.code) {
            form.setValue(
                'checker',
                { code: 'multivendor-shipping-eligibility-checker', arguments: [] },
                { shouldDirty: true, shouldValidate: true },
            );
        }
        if (!form.getValues('calculator')?.code) {
            form.setValue(
                'calculator',
                {
                    code: 'default-shipping-calculator',
                    arguments: [
                        { name: 'rate', value: '500' },
                        { name: 'includesTax', value: 'auto' },
                        { name: 'taxRate', value: '20' },
                    ],
                },
                { shouldDirty: true, shouldValidate: true },
            );
        }
    }, [creatingNewEntity, form]);`,
                    );
                }

                nextCode = nextCode.replace(
                    '{creatingNewEntity ? <Trans>New shipping method</Trans> : (entity?.name ?? \'\')}',
                    "{creatingNewEntity ? 'Nuevo método de envío' : (entity?.name ?? '')}",
                );
                nextCode = nextCode.replace(
                    `                            label={<Trans>Name</Trans>}`,
                    `                            label="Nombre"`,
                );
                nextCode = nextCode.replace(
                    `                            label={<Trans>Code</Trans>}`,
                    `                            label="Código"`,
                );
                nextCode = nextCode.replace(
                    `                            label={<Trans>Description</Trans>}`,
                    `                            label="Descripción"`,
                );
                nextCode = nextCode.replace(
                    `                            label={<Trans>Fulfillment handler</Trans>}`,
                    `                            label="Manejador de cumplimiento"`,
                );
                nextCode = nextCode.replace(
                    'title={<Trans>Conditions</Trans>}',
                    "title={'Condiciones'}",
                );
                nextCode = nextCode.replace(
                    'title={<Trans>Calculator</Trans>}',
                    "title={'Calculadora'}",
                );
                nextCode = nextCode.replace(
                    '{creatingNewEntity ? <Trans>Create</Trans> : <Trans>Update</Trans>}',
                    "{creatingNewEntity ? 'Crear' : 'Actualizar'}",
                );

                if (!nextCode.includes('<PermissionGuard requires={[\'CreateSettings\']}')) {
                    nextCode = nextCode.replace(
                        `                {!creatingNewEntity && entity && (
                    <ActionBarItem itemId="test-shipping-button">
                        <TestSingleShippingMethodSheet checker={checker} calculator={calculator} />
                    </ActionBarItem>
                )}`,
                        `                {!creatingNewEntity && entity && (
                    <PermissionGuard requires={['CreateSettings']}>
                        <ActionBarItem itemId="test-shipping-button">
                            <TestSingleShippingMethodSheet checker={checker} calculator={calculator} />
                        </ActionBarItem>
                    </PermissionGuard>
                )}`,
                    );
                }
            }

            if (normalizedId.includes('/@vendure/dashboard/src/app/routes/_authenticated/_shipping-methods/shipping-methods.tsx')) {
                nextCode = nextCode.replace(
                    'title={<Trans>Shipping Methods</Trans>}',
                    "title={'Métodos de envío'}",
                );
                nextCode = nextCode.replace(
                    'breadcrumb: () => <Trans>Shipping Methods</Trans>',
                    "breadcrumb: () => 'Métodos de envío'",
                );
                nextCode = nextCode.replace(
                    '<Trans>New Shipping Method</Trans>',
                    "'Nuevo método de envío'",
                );
                if (!nextCode.includes('<PermissionGuard requires={[\'CreateSettings\']}')) {
                    nextCode = nextCode.replace(
                        `            <ActionBarItem itemId="test-shipping-button">
                <TestShippingMethodsSheet />
            </ActionBarItem>`,
                        `            <PermissionGuard requires={['CreateSettings']}>
                <ActionBarItem itemId="test-shipping-button">
                    <TestShippingMethodsSheet />
                </ActionBarItem>
            </PermissionGuard>`,
                    );
                }
            }

            if (
                normalizedId.includes(
                    '/@vendure/dashboard/src/app/routes/_authenticated/_shipping-methods/components/shipping-eligibility-checker-selector.tsx',
                )
            ) {
                nextCode = nextCode.replace(
                    'buttonText="Select Shipping Eligibility Checker"',
                    `buttonText="Seleccionar verificador de elegibilidad de envío"`,
                );
            }

            if (
                normalizedId.includes(
                    '/@vendure/dashboard/src/app/routes/_authenticated/_shipping-methods/components/shipping-calculator-selector.tsx',
                )
            ) {
                nextCode = nextCode.replace(
                    'buttonText="Select Shipping Calculator"',
                    `buttonText="Seleccionar calculadora de envío"`,
                );
            }

            if (
                normalizedId.includes(
                    '/@vendure/dashboard/src/app/routes/_authenticated/_shipping-methods/components/fulfillment-handler-selector.tsx',
                )
            ) {
                nextCode = nextCode.replace(
                    'placeholder="Select a fulfillment handler"',
                    `placeholder="Seleccionar manejador de cumplimiento"`,
                );
            }

            if (
                normalizedId.includes(
                    '/@vendure/dashboard/src/app/routes/_authenticated/_products/components/add-product-variant-dialog.tsx',
                )
            ) {
                if (!nextCode.includes('const generateVariantSku = () =>')) {
                    nextCode = nextCode.replace(
                        'type FormValues = z.infer<typeof formSchema>;\n',
                        `type FormValues = z.infer<typeof formSchema>;\n\nconst generateVariantSku = () => {\n    const bytes = new Uint8Array(6);\n    globalThis.crypto.getRandomValues(bytes);\n    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');\n};\n`,
                    );
                }

                nextCode = nextCode.replace(
                    `    useEffect(() => {\n        if (open && productData?.product) {\n            checkForDuplicateVariant(form.getValues());\n        }\n    }, [open, productData?.product, checkForDuplicateVariant, form]);`,
                    `    useEffect(() => {\n        if (open && productData?.product) {\n            checkForDuplicateVariant(form.getValues());\n            form.setValue('sku', generateVariantSku(), {\n                shouldDirty: true,\n                shouldValidate: true,\n            });\n        }\n    }, [open, productData?.product, checkForDuplicateVariant, form]);`,
                );

                nextCode = nextCode.replace(
                    `                        <FormFieldWrapper\n                            control={form.control}\n                            name="sku"\n                            label={<Trans>SKU</Trans>}\n                            render={({ field }) => <Input {...field} />}\n                        />`,
                    `                        <FormFieldWrapper\n                            control={form.control}\n                            name="sku"\n                            label={<Trans>SKU</Trans>}\n                            render={({ field }) => (\n                                <Input {...field} readOnly className="cursor-not-allowed bg-muted" value={field.value?.toUpperCase?.() ?? ''} />\n                            )}\n                        />`,
                );
            }

            if (
                normalizedId.includes(
                    '/@vendure/dashboard/src/app/routes/_authenticated/_product-variants/product-variants_.$id.tsx',
                )
            ) {
                nextCode = nextCode.replace(
                    `                        <FormFieldWrapper\n                            control={form.control}\n                            name="sku"\n                            label={<Trans>SKU</Trans>}\n                            render={({ field }) => <Input {...field} />}\n                        />`,
                    `                        <FormFieldWrapper\n                            control={form.control}\n                            name="sku"\n                            label={<Trans>SKU</Trans>}\n                            render={({ field }) => (\n                                <Input {...field} readOnly className="cursor-not-allowed bg-muted" value={field.value?.toUpperCase?.() ?? ''} />\n                            )}\n                        />`,
                )
            }

            // Cambiar la moneda por defecto del preview en el diálogo de idioma de USD a COP
            if (normalizedId.includes('/@vendure/dashboard/src/lib/components/layout/language-dialog')) {
                nextCode = nextCode.replace(
                    `useState<string>('USD')`,
                    `useState<string>('COP')`,
                );
            }

            // Quita el item "Explore Platform & Cloud" del menú de usuario (link a vendure.io/pricing)
            if (normalizedId.includes('/@vendure/dashboard/src/lib/components/layout/nav-user')) {
                nextCode = nextCode.replace(
                    /<DropdownMenuGroup>\s*<DropdownMenuItem render={<a href="https:\/\/vendure\.io\/pricing"[\s\S]*?<\/DropdownMenuItem>\s*<\/DropdownMenuGroup>\s*<DropdownMenuSeparator \/>\s*/,
                    '',
                );
            }

            // Profile query must select Administrator customFields subfields
            if (
                normalizedId.includes(
                    '/@vendure/dashboard/src/app/routes/_authenticated/_profile/profile.graphql.ts',
                )
            ) {
                nextCode = nextCode.replace(
                    `            customFields`,
                    `            customFields {
                storeDescription
                storeHeaderBannerUrl {
                    id
                    preview
                }
                storeBannerUrl {
                    id
                    preview
                }
            }`,
                );
            }

            // Strip Asset relation objects from customFields before GraphQL mutations (only *Id is valid).
            if (normalizedId.includes('/@vendure/dashboard/src/lib/framework/form-engine/use-generated-form.tsx')) {
                nextCode = nextCode.replace(
                    `            const onSubmitWrapper = (values: any) => {
                let processed = convertEmptyStringsToNull(
                    removeEmptyIdFields(values, updateFields),
                    updateFields,
                );
                if (!entity) {
                    processed = stripNullNullableFields(processed, updateFields);
                }
                onSubmit(processed);
            };`,
                    `            const onSubmitWrapper = (values: any) => {
                let processed = convertEmptyStringsToNull(
                    removeEmptyIdFields(values, updateFields),
                    updateFields,
                );
                if (!entity) {
                    processed = stripNullNullableFields(processed, updateFields);
                }
                if (processed?.customFields && typeof processed.customFields === 'object') {
                    const cf = { ...processed.customFields } as Record<string, unknown>;
                    for (const key of Object.keys(cf)) {
                        if (key.endsWith('Url') && cf[\`\${key}Id\`] != null) {
                            delete cf[key];
                        }
                    }
                    delete cf.storeBannerUrl;
                    delete cf.storeHeaderBannerUrl;
                    processed = { ...processed, customFields: cf };
                }
                onSubmit(processed);
            };`,
                );
            }

            if (normalizedId.includes('/@vendure/dashboard/src/lib/framework/form-engine/utils.ts')) {
                nextCode = nextCode.replace(
                    `            const relationValue = entity.customFields[propertyAccessorKey];
            processedEntity.customFields[relationField] = relationValue === null ? null : relationValue?.id;
            delete processedEntity.customFields[propertyAccessorKey];`,
                    `            const relationValue = entity.customFields[propertyAccessorKey];
            const existingId = entity.customFields[relationField];
            if (relationValue === null || relationValue === undefined) {
                if (existingId != null && existingId !== '') {
                    processedEntity.customFields[relationField] = existingId;
                } else {
                    processedEntity.customFields[relationField] = null;
                }
            } else {
                processedEntity.customFields[relationField] =
                    typeof relationValue === 'object' ? relationValue?.id : relationValue;
            }
            delete processedEntity.customFields[propertyAccessorKey];`,
                );
            }

            // Profile save: map Asset relations to *Id fields and strip object keys from mutation input
            if (normalizedId.includes('/@vendure/dashboard/src/app/routes/_authenticated/_profile/profile.tsx')) {
                nextCode = nextCode.replace(
                    `        setValuesForUpdate: entity => {
            return {
                id: entity.id,
                firstName: entity.firstName,
                lastName: entity.lastName,
                emailAddress: entity.emailAddress,
                password: '',
                customFields: entity.customFields,
            };
        },
        transformUpdateInput: input => {
            return {
                ...input,
                password: input.password?.length ? input.password : undefined,
            };
        },`,
                    `        setValuesForUpdate: entity => {
            const cf = (entity.customFields ?? {}) as Record<string, any>;
            const {
                storeBannerUrl,
                storeHeaderBannerUrl,
                storeBannerUrlId,
                storeHeaderBannerUrlId,
                ...restCustomFields
            } = cf;

            const resolveRelationId = (relation: unknown, idValue: unknown) => {
                if (typeof idValue === 'string' && idValue) return idValue;
                if (relation && typeof relation === 'object' && relation !== null && 'id' in relation) {
                    const id = (relation as { id?: string | number | null }).id;
                    if (id != null) return String(id);
                }
                if (typeof idValue === 'string') return idValue || null;
                return null;
            };

            return {
                id: entity.id,
                firstName: entity.firstName,
                lastName: entity.lastName,
                emailAddress: entity.emailAddress,
                password: '',
                customFields: {
                    ...restCustomFields,
                    storeBannerUrlId: resolveRelationId(storeBannerUrl, storeBannerUrlId),
                    storeHeaderBannerUrlId: resolveRelationId(storeHeaderBannerUrl, storeHeaderBannerUrlId),
                },
            };
        },
        transformUpdateInput: input => {
            const customFields = { ...(input.customFields ?? {}) } as Record<string, unknown>;
            delete customFields.storeBannerUrl;
            delete customFields.storeHeaderBannerUrl;

            for (const key of ['storeBannerUrlId', 'storeHeaderBannerUrlId']) {
                if (customFields[key] === '' || customFields[key] === undefined) {
                    delete customFields[key];
                }
            }

            return {
                ...input,
                password: input.password?.length ? input.password : undefined,
                customFields,
            };
        },`,
                );
            }


            if (normalizedId.includes('/@vendure/dashboard/src/lib/framework/dashboard-widget/base-widget')) {
                nextCode = nextCode.replace(
                    `'h-full w-full flex flex-col rounded-md'`,
                    `'h-full w-full flex flex-col rounded-md overflow-hidden'`
                );
            }

            if (normalizedId.includes('/@vendure/dashboard/src/lib/components/ui/grid-layout.tsx')) {
                nextCode = nextCode.replace(
                    `<div className="h-full w-full">`,
                    `<div className="h-full w-full overflow-hidden">`,
                );
            }

            if (normalizedId.includes('/@vendure/dashboard/src/app/routes/_authenticated/index.tsx')) {
                if (!nextCode.includes('ECOMMER_RECOMMENDED_WIDGET_LAYOUT')) {
                    nextCode = nextCode.replace(
                        `const findNextPosition = (`,
                        `const ECOMMER_LAYOUT_VERSION = 4;
const ECOMMER_LAYOUT_VERSION_KEY = 'ecommer.widgetLayoutVersion';
const ECOMMER_RECOMMENDED_WIDGET_LAYOUT: Record<string, { x: number; y: number; w: number; h: number }> = {
    'ecommer-home-hero': { x: 0, y: 0, w: 12, h: 8 },
    'latest-orders-widget': { x: 0, y: 8, w: 6, h: 7 },
    'orders-summary-widget': { x: 6, y: 8, w: 6, h: 3 },
    'advanced-metrics': { x: 6, y: 11, w: 6, h: 4 },
    'invoice-quota': { x: 0, y: 15, w: 6, h: 2 },
    'ecommer-share-links': { x: 0, y: 17, w: 6, h: 4 },
    'metrics-widget': { x: 0, y: 21, w: 12, h: 5 },
};
function ecommerLayoutsOverlap(
    a: { x: number; y: number; w: number; h: number },
    b: { x: number; y: number; w: number; h: number },
): boolean {
    return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}
function ecommerHasOverlappingLayouts(
    layout: Record<string, { x: number; y: number; w: number; h: number }>,
): boolean {
    const entries = Object.values(layout);
    for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
            if (ecommerLayoutsOverlap(entries[i], entries[j])) return true;
        }
    }
    return false;
}
const findNextPosition = (`,
                    );
                }

                nextCode = nextCode.replace(
                    `    useEffect(() => {
        const savedLayouts = settings.widgetLayout || {};

        const initialWidgets = Array.from(getDashboardWidgetRegistry().entries())`,
                    `    useEffect(() => {
        const savedLayouts = settings.widgetLayout || {};
        const storedLayoutVersion =
            typeof localStorage !== 'undefined'
                ? Number.parseInt(localStorage.getItem(ECOMMER_LAYOUT_VERSION_KEY) ?? '0', 10)
                : 0;
        const layoutNeedsReset =
            storedLayoutVersion < ECOMMER_LAYOUT_VERSION ||
            (Object.keys(savedLayouts).length > 0 && ecommerHasOverlappingLayouts(savedLayouts));
        const effectiveLayouts = layoutNeedsReset
            ? { ...savedLayouts, ...ECOMMER_RECOMMENDED_WIDGET_LAYOUT }
            : savedLayouts;

        const initialWidgets = Array.from(getDashboardWidgetRegistry().entries())`,
                );

                nextCode = nextCode.replace(
                    `                const savedLayout = savedLayouts[id];`,
                    `                const savedLayout = effectiveLayouts[id];`,
                );

                nextCode = nextCode.replace(
                    `                // Only find next position if we don't have a saved layout
                if (!savedLayout) {
                    const pos = findNextPosition(acc, {
                        w: layout.w,
                        h: layout.h,
                    });
                    layout.x = pos.x;
                    layout.y = pos.y;
                }`,
                    `                const recommendedLayout = ECOMMER_RECOMMENDED_WIDGET_LAYOUT[id];
                if (recommendedLayout && layoutNeedsReset) {
                    layout.x = recommendedLayout.x;
                    layout.y = recommendedLayout.y;
                    layout.w = recommendedLayout.w;
                    layout.h = recommendedLayout.h;
                } else if (!savedLayout) {
                    const pos = findNextPosition(acc, {
                        w: layout.w,
                        h: layout.h,
                    });
                    layout.x = pos.x;
                    layout.y = pos.y;
                }`,
                );

                nextCode = nextCode.replace(
                    `        setWidgets(initialWidgets);
        setIsInitialized(true);
    }, [settings.widgetLayout, hasPermissions]);`,
                    `        setWidgets(initialWidgets);
        setIsInitialized(true);

        if (layoutNeedsReset && typeof localStorage !== 'undefined') {
            const layoutConfig: Record<string, { x: number; y: number; w: number; h: number }> = {};
            initialWidgets.forEach(widget => {
                layoutConfig[widget.widgetId] = {
                    x: widget.layout.x,
                    y: widget.layout.y,
                    w: widget.layout.w,
                    h: widget.layout.h,
                };
            });
            setWidgetLayout(layoutConfig);
            localStorage.setItem(ECOMMER_LAYOUT_VERSION_KEY, String(ECOMMER_LAYOUT_VERSION));
        }
    }, [settings.widgetLayout, hasPermissions, setWidgetLayout]);`,
                );
            }

            if (
                normalizedId.includes(
                    '/@vendure/dashboard/src/app/routes/_authenticated/_products/products_.$id.tsx',
                )
            ) {
                nextCode = nextCode.replace(
                    "import { Layers, Package, PlusIcon } from 'lucide-react';",
                    "import { Layers, Package, Pencil, PlusIcon, Info } from 'lucide-react';",
                );
                if (!nextCode.includes("import { Tooltip, TooltipContent, TooltipTrigger }")) {
                    nextCode = nextCode.replace(
                        "import { Button } from '@/vdb/components/ui/button.js';",
                        `import { Button } from '@/vdb/components/ui/button.js';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/vdb/components/ui/tooltip.js';`,
                    );
                }
                if (!nextCode.includes("import { useEffect, useRef, useState } from 'react';")) {
                    nextCode = nextCode.replace(
                        "import { useRef, useState } from 'react';",
                        "import { useEffect, useRef, useState } from 'react';",
                    );
                }

                if (!nextCode.includes('const [viewMode, setViewMode] = useState(false);')) {
                    nextCode = nextCode.replace(
                        `    const creatingNewEntity = params.id === NEW_ENTITY_PATH;
    const { t } = useLingui();`,
                        `    const creatingNewEntity = params.id === NEW_ENTITY_PATH;
    const [viewMode, setViewMode] = useState(false);
    const { t } = useLingui();`,
                    );
                }

                if (!nextCode.includes('const hasRequiredCreateValues =')) {
                    nextCode = nextCode.replace(
                        `    const { removeOptionGroupAsync } = useRemoveOptionGroup(entity?.id ?? '');`,
                        `    const { removeOptionGroupAsync } = useRemoveOptionGroup(entity?.id ?? '');

    const watchedTranslations = form.watch('translations');
    const watchedFeaturedAssetId = form.watch('featuredAssetId');
    const hasRequiredCreateValues =
        !!watchedTranslations?.[0]?.name?.trim() &&
        !!watchedTranslations?.[0]?.description?.trim() &&
        !!watchedFeaturedAssetId;

    useEffect(() => {
        if (entity && !creatingNewEntity) {
            setViewMode(true);
        }
    }, [entity, creatingNewEntity]);

    useEffect(() => {
        document.body.classList.add('hide-description-images');
        document.body.classList.add('product-detail-sticky');
        return () => {
            document.body.classList.remove('hide-description-images');
            document.body.classList.remove('product-detail-sticky');
        };
    }, []);`,
                    );
                }

                if (nextCode.includes('blockId="enabled-toggle"')) {
                    nextCode = nextCode.replace(
                        `                <PageBlock column="side" blockId="enabled-toggle">
                    <FormFieldWrapper
                        control={form.control}
                        name="enabled"
                        label={<Trans>Enabled</Trans>}
                        description={<Trans>When enabled, a product is available in the shop</Trans>}
                        render={({ field }) => (
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                        )}
                    />
                </PageBlock>
`,
                        ``,
                    );
                }

                if (!nextCode.includes('Imagen del producto')) {
                    nextCode = nextCode.replace(
                        `                <PageBlock column="side" blockId="assets" title={<Trans>Assets</Trans>}>
                    <Field>
                        <EntityAssets
                            assets={entity?.assets}
                            featuredAsset={entity?.featuredAsset}
                            compact={true}
                            value={form.getValues()}
                            onChange={value => {
                                form.setValue('featuredAssetId', value.featuredAssetId ?? undefined, {
                                    shouldDirty: true,
                                    shouldValidate: true,
                                });
                                form.setValue('assetIds', value.assetIds ?? [], {
                                    shouldDirty: true,
                                    shouldValidate: true,
                                });
                            }}
                        />
                    </Field>
                </PageBlock>`,
                        ``,
                    );
                }

                if (!nextCode.includes('blockId="product-images"')) {
                    nextCode = nextCode.replace(
                        `                </PageBlock>
                <CustomFieldsPageBlock column="main" entityType="Product" control={form.control} />`,
                        `                </PageBlock>
                <PageBlock column="main" blockId="product-images" title="Imagen del producto">
                    <Field>
                        <EntityAssets
                            assets={entity?.assets}
                            featuredAsset={entity?.featuredAsset}
                            compact={true}
                            maxAssets={3}
                            value={form.getValues()}
                            onChange={value => {
                                form.setValue('featuredAssetId', value.featuredAssetId ?? undefined, {
                                    shouldDirty: true,
                                    shouldValidate: true,
                                });
                                form.setValue('assetIds', value.assetIds ?? [], {
                                    shouldDirty: true,
                                    shouldValidate: true,
                                });
                            }}
                        />
                    </Field>
                    <p className="mt-2 text-xs text-muted-foreground">
                        Las imágenes de tus productos son la primera impresión que ven tus clientes. Puedes añadir hasta 3 imágenes; la primera será la imagen principal.
                    </p>
                    <Button
                        type="button"
                        variant={form.watch('enabled') ? 'default' : 'outline'}
                        disabled={creatingNewEntity}
                        className="mt-3"
                        onClick={() =>
                            form.setValue('enabled', !(form.getValues('enabled') ?? false), {
                                shouldDirty: true,
                                shouldValidate: true,
                            })
                        }
                    >
                        {form.watch('enabled') ? 'Habilitado' : 'Deshabilitado'}
                    </Button>
                    <span className="ml-2 mt-3 text-xs text-muted-foreground">
                        {form.watch('enabled')
                            ? 'Tu producto está activo en la tienda'
                            : 'Tu producto no aparece en la tienda'}
                    </span>
                </PageBlock>
                <CustomFieldsPageBlock column="main" entityType="Product" control={form.control} />`,
                    );
                }

                if (!nextCode.includes('product-view')) {
                    nextCode = nextCode.replace(
                        `            <PageLayout>
                <PageBlock column="main" blockId="main-form">`,
                        `            <PageLayout>
                {viewMode && entity ? (
                    <PageBlock column="main" blockId="product-view">
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <h2 className="text-2xl font-semibold">{entity.name}</h2>
                                <Button type="button" variant="ghost" size="icon" onClick={() => setViewMode(false)} aria-label="Editar nombre">
                                    <Pencil className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span className="inline-flex items-center gap-1">
                                    <Trans>Slug</Trans>
                                    <Tooltip>
                                        <TooltipTrigger render={<Info className="h-3.5 w-3.5 cursor-help" />} />
                                        <TooltipContent>
                                            Identificador de URL: parte final y legible de una dirección de tu producto
                                        </TooltipContent>
                                    </Tooltip>
                                </span>
                                <code className="rounded bg-muted px-2 py-0.5">{entity.translations?.[0]?.slug}</code>
                                <Button type="button" variant="ghost" size="icon" onClick={() => setViewMode(false)} aria-label="Editar slug">
                                    <Pencil className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                            {entity.translations?.[0]?.description && (
                                <div>
                                    <h3 className="mb-1 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                        <Trans>Description</Trans>
                                        <Button type="button" variant="ghost" size="icon" onClick={() => setViewMode(false)} aria-label="Editar descripción">
                                            <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                    </h3>
                                    <div
                                        className="border rounded-md p-3"
                                        dangerouslySetInnerHTML={{ __html: entity.translations[0].description }}
                                    />
                                </div>
                            )}
                            {entity.variantList?.totalItems > 0 && (
                                <div>
                                    <h3 className="mb-1 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                        <Trans>Product variants</Trans>
                                        <Button render={<Link to="./variants" />} variant="ghost" size="icon" aria-label="Editar variantes">
                                            <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                    </h3>
                                    <ProductVariantsTable
                                        productId={params.id}
                                        registerRefresher={refresher => {
                                            refreshRef.current = refresher;
                                        }}
                                        fromProductDetailPage={true}
                                    />
                                </div>
                            )}
                        </div>
                    </PageBlock>
                ) : (
                    <>
                <PageBlock column="main" blockId="main-form">`,
                    );
                }

                if (!nextCode.includes('viewMode && entity ? (')) {
                    nextCode = nextCode.replace(
                        `                    </Button>
                </ActionBarItem>
            </PageActionBar>`,
                        `                    </Button>
                </ActionBarItem>
            </PageActionBar>`,
                    );
                }

                if (
                    nextCode.includes('disabled={!form.formState.isDirty || !form.formState.isValid || isPending}') &&
                    !nextCode.includes('onClick={() => setViewMode(false)}>\n                            <Pencil className="mr-2 h-4 w-4" />')
                ) {
                    nextCode = nextCode.replace(
                        `                    <Button
                        type="submit"
                        disabled={!form.formState.isDirty || !form.formState.isValid || isPending}
                    >
                        {creatingNewEntity ? <Trans>Create</Trans> : <Trans>Update</Trans>}
                    </Button>`,
                        `                    {viewMode && entity ? (
                        <Button type="button" onClick={() => setViewMode(false)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            <Trans>Edit</Trans>
                        </Button>
                    ) : (
                        <Button
                            type="submit"
                            disabled={!form.formState.isDirty || !form.formState.isValid || isPending || (creatingNewEntity && !hasRequiredCreateValues)}
                        >
                            {creatingNewEntity ? <Trans>Create</Trans> : <Trans>Update</Trans>}
                        </Button>
                    )}`,
                    );
                }

                if (!nextCode.includes('</>\n                )}\n            </PageLayout>')) {
                    nextCode = nextCode.replace(
                        `            </PageLayout>
        </Page>
    );
}`,
                        `                    </>
                )}
            </PageLayout>
        </Page>
    );
}`,
                    );
                }

                if (!nextCode.includes('Completa el nombre, la descripción y añade una imagen')) {
                    nextCode = nextCode.replace(
                        `                    </DetailFormGrid>`,
                        `                    </DetailFormGrid>
                    {creatingNewEntity && !hasRequiredCreateValues && (
                        <p className="mb-4 text-xs text-muted-foreground">
                            Completa el nombre, la descripción y añade una imagen del producto para poder crearlo.
                        </p>
                    )}`,
                    );
                }

                if (!nextCode.includes("label={\n                                <span className=\"inline-flex items-center gap-1\">")) {
                    nextCode = nextCode.replace(
                        `                            name="slug"
                            label={<Trans>Slug</Trans>}`,
                        `                            name="slug"
                            label={
                                <span className="inline-flex items-center gap-1">
                                    <Trans>Slug</Trans>
                                    <Tooltip>
                                        <TooltipTrigger render={<Info className="h-3.5 w-3.5 cursor-help" />} />
                                        <TooltipContent>
                                            Identificador de URL: parte final y legible de una dirección de tu producto
                                        </TooltipContent>
                                    </Tooltip>
                                </span>
                            }`,
                    );
                }

                if (!nextCode.includes('Guarda el producto primero para poder asignar facetas')) {
                    nextCode = nextCode.replace(
                        `                <PageBlock column="side" blockId="facet-values" title={<Trans>Facet Values</Trans>}>
                    <FormFieldWrapper
                        control={form.control}
                        name="facetValueIds"
                        render={({ field }) => (
                            <AssignedFacetValues facetValues={entity?.facetValues ?? []} {...field} />
                        )}
                    />
                </PageBlock>`,
                        `                <PageBlock column="side" blockId="facet-values" title={<Trans>Facet Values</Trans>} className="relative">
                    {creatingNewEntity && !entity?.id && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/80 backdrop-blur-sm">
                            <p className="px-4 text-center text-sm text-muted-foreground">
                                Guarda el producto primero para poder asignar facetas
                            </p>
                        </div>
                    )}
                    <div className={creatingNewEntity && !entity?.id ? 'pointer-events-none blur-sm' : ''}>
                        <FormFieldWrapper
                            control={form.control}
                            name="facetValueIds"
                            render={({ field }) => (
                                <AssignedFacetValues facetValues={entity?.facetValues ?? []} {...field} />
                            )}
                        />
                    </div>
                </PageBlock>`,
                    );
                }
            }

            if (
                normalizedId.includes(
                    '/@vendure/dashboard/src/app/routes/_authenticated/_products/products.graphql.ts',
                )
            ) {
                if (!nextCode.includes('price\n                    priceWithTax\n                    stockLevels {\n                        stockLocation')) {
                    nextCode = nextCode.replace(
                        `query ProductVariantList($options: ProductVariantListOptions, $productId: ID) {
            productVariants(options: $options, productId: $productId) {
                items {
                    id
                    createdAt
                    updatedAt
                    featuredAsset {
                        ...Asset
                    }
                    name
                    sku
                    enabled
                    currencyCode
                    price
                    priceWithTax
                    stockLevels {
                        stockOnHand
                        stockAllocated
                    }
                }
                totalItems
            }
        }`,
                        `query ProductVariantList($options: ProductVariantListOptions, $productId: ID) {
            productVariants(options: $options, productId: $productId) {
                items {
                    id
                    createdAt
                    updatedAt
                    featuredAsset {
                        ...Asset
                    }
                    name
                    sku
                    enabled
                    currencyCode
                    price
                    priceWithTax
                    stockLevels {
                        stockLocation {
                            id
                        }
                        stockOnHand
                        stockAllocated
                    }
                }
                totalItems
            }
        }`,
                    );
                }

                if (!nextCode.includes('featuredAsset {\n                        id\n                        preview\n                    }')) {
                    nextCode = nextCode.replace(
                        `            variants {
                id
                name
                sku
                price
                currencyCode
                priceWithTax
                createdAt
                updatedAt
                options {`,
                        `            variants {
                id
                name
                sku
                price
                currencyCode
                priceWithTax
                createdAt
                updatedAt
                featuredAsset {
                    id
                    preview
                }
                stockLevels {
                    stockLocation {
                        id
                    }
                    stockOnHand
                    stockAllocated
                }
                options {`,
                    );
                }

                if (!nextCode.includes('featuredAsset {\n                        id\n                        preview\n                    }\n                stockLevels')) {
                    nextCode = nextCode.replace(
                        `mutation UpdateProductVariant($input: UpdateProductVariantInput!) {
        updateProductVariant(input: $input) {
            id
            name
            options {
                id
                code
                name
                groupId
            }
        }
    }`,
                        `mutation UpdateProductVariant($input: UpdateProductVariantInput!) {
        updateProductVariant(input: $input) {
            id
            name
            featuredAsset {
                id
                preview
            }
            stockLevels {
                stockOnHand
                stockAllocated
            }
            options {
                id
                code
                name
                groupId
            }
        }
    }`,
                    );
                }
            }

            if (
                normalizedId.includes(
                    '/@vendure/dashboard/src/app/routes/_authenticated/_products/products_.$id_.variants.tsx',
                )
            ) {
                if (!nextCode.includes("import { StockLevelLabel } from '@/vdb/components/shared/stock-level-label.js';")) {
                    nextCode = nextCode.replace(
                        `import { ConfirmationDialog } from '@/vdb/components/shared/confirmation-dialog.js';`,
                        `import { ConfirmationDialog } from '@/vdb/components/shared/confirmation-dialog.js';
import { StockLevelLabel } from '@/vdb/components/shared/stock-level-label.js';
import { VendureImage } from '@/vdb/components/shared/vendure-image.js';`,
                    );
                }

                if (!nextCode.includes('handleImageUpload')) {
                    nextCode = nextCode.replace(
                        `    const [optionsToAddToVariant, setOptionsToAddToVariant] = useState<
        Record<string, Record<string, string>>
    >({});

    const { data: productData, refetch, isFetching } = useQuery({`,
                        `    const [optionsToAddToVariant, setOptionsToAddToVariant] = useState<
        Record<string, Record<string, string>>
    >({});
    const [editingStockId, setEditingStockId] = useState<string | null>(null);
    const [editingStockValue, setEditingStockValue] = useState<string>('');
    const [uploadingImageId, setUploadingImageId] = useState<string | null>(null);

    const CREATE_ASSET_DOC = \`
        mutation CreateAssets($input: [CreateAssetInput!]!) {
            createAssets(input: $input) {
                ... on Asset { id name preview source mimeType type }
                ... on ErrorResult { message }
            }
        }
    \`;

    const UPDATE_VARIANT_DOC = \`
        mutation UpdateProductVariant($input: UpdateProductVariantInput!) {
            updateProductVariant(input: $input) {
                id
                featuredAsset { id preview }
                stockLevels { stockOnHand stockAllocated }
            }
        }
    \`;

    const handleImageUpload = async (variantId: string, file: File) => {
        setUploadingImageId(variantId);
        try {
            const res = await api.mutate<{ createAssets: Array<{ id: string; preview: string } | { message: string }> }>(
                CREATE_ASSET_DOC,
                { input: [{ file }] },
            );
            const asset = res.createAssets?.[0];
            if (!asset || !('id' in asset)) {
                const msg = asset && 'message' in asset ? asset.message : 'Error al subir imagen';
                toast.error(msg);
                return;
            }
            await api.mutate(UPDATE_VARIANT_DOC, {
                input: { id: variantId, featuredAssetId: asset.id },
            });
            toast.success('Imagen actualizada');
            refetch();
        } catch {
            toast.error('Error al subir imagen');
        } finally {
            setUploadingImageId(null);
        }
    };

    const handleStockSave = async (variantId: string, stockOnHand: number, stockLocationId?: string) => {
        try {
            await api.mutate(UPDATE_VARIANT_DOC, {
                input: {
                    id: variantId,
                    stockLevels: stockLocationId
                        ? [{ stockLocationId, stockOnHand }]
                        : undefined,
                    ...(stockLocationId ? {} : { stockOnHand }),
                },
            });
            toast.success('Stock actualizado');
            setEditingStockId(null);
            refetch();
        } catch {
            toast.error('Error al actualizar stock');
        }
    };

    const { data: productData, refetch, isFetching } = useQuery({`,
                    );
                }

                if (!nextCode.includes('<Trans>Imagen</Trans>')) {
                    nextCode = nextCode.replace(
                        `                            <TableHeader>
                                <TableRow>
                                    <TableHead>
                                        <Trans>Name</Trans>
                                    </TableHead>
                                    <TableHead>
                                        <Trans>SKU</Trans>
                                    </TableHead>`,
                        `                            <TableHeader>
                                <TableRow>
<TableHead>
                            <Trans>Image</Trans>
                        </TableHead>
                                    <TableHead>
                                        <Trans>Name</Trans>
                                    </TableHead>
                                    <TableHead>
                                        <Trans>SKU</Trans>
                                    </TableHead>
                                    <TableHead>
                                        <Trans>Stock</Trans>
                                    </TableHead>`,
                    );
                }

                if (!nextCode.includes('editingStockId === variant.id')) {
                    nextCode = nextCode.replace(
                        `                                {productData.product.variants.map(variant => (
                                    <TableRow key={variant.id}>
                                        <TableCell>
                                            {variant.featuredAsset ? (
                                                <VendureImage asset={variant.featuredAsset} preset="tiny" />
                                            ) : (
                                                <span className="text-muted-foreground text-xs">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell>{variant.name}</TableCell>
                                        <TableCell>{variant.sku}</TableCell>
                                        <TableCell>
                                            <StockLevelLabel stockLevels={variant.stockLevels} />
                                        </TableCell>`,
                        `                                {productData.product.variants.map(variant => (
                                    <TableRow key={variant.id}>
                                        <TableCell>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                id={'img-' + variant.id}
                                                onChange={e => {
                                                    const file = e.target.files?.[0];
                                                    if (file) handleImageUpload(variant.id, file);
                                                }}
                                            />
                                            <label
                                                htmlFor={'img-' + variant.id}
                                                className="cursor-pointer block"
                                            >
                                                {uploadingImageId === variant.id ? (
                                                    <span className="text-xs text-muted-foreground">Subiendo...</span>
                                                ) : variant.featuredAsset ? (
                                                    <VendureImage asset={variant.featuredAsset} preset="tiny" />
                                                ) : (
                                                    <div className="flex h-10 w-10 items-center justify-center rounded border border-dashed text-muted-foreground text-xs hover:border-primary">
                                                        +
                                                    </div>
                                                )}
                                            </label>
                                        </TableCell>
                                        <TableCell>{variant.name}</TableCell>
                                        <TableCell>{variant.sku}</TableCell>
                                        <TableCell>
                                            {editingStockId === variant.id ? (
                                                <input
                                                    type="number"
                                                    className="h-7 w-16 rounded border bg-background px-1 text-sm"
                                                    value={editingStockValue}
                                                    autoFocus
                                                    onChange={e => setEditingStockValue(e.target.value)}
                                                    onBlur={() => {
                                                        const val = parseInt(editingStockValue, 10);
                                                        if (!isNaN(val)) handleStockSave(variant.id, val, variant.stockLevels?.[0]?.stockLocation?.id);
                                                        else setEditingStockId(null);
                                                    }}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') {
                                                            const val = parseInt(editingStockValue, 10);
                                                            if (!isNaN(val)) handleStockSave(variant.id, val, variant.stockLevels?.[0]?.stockLocation?.id);
                                                            else setEditingStockId(null);
                                                        }
                                                        if (e.key === 'Escape') setEditingStockId(null);
                                                    }}
                                                />
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="cursor-pointer rounded bg-muted/50 px-1.5 py-0.5 text-sm hover:bg-muted"
                                                    onClick={() => {
                                                        setEditingStockId(variant.id);
                                                        setEditingStockValue(String(variant.stockLevels?.[0]?.stockOnHand ?? 0));
                                                    }}
                                                >
                                                    {variant.stockLevels?.[0]?.stockOnHand ?? 0}
                                                    <span className="ml-0.5 text-muted-foreground">/ {variant.stockLevels?.[0]?.stockAllocated ?? 0}</span>
                                                </button>
                                            )}
                                        </TableCell>`,
                    );
                }
            }

            if (
                normalizedId.includes(
                    '/@vendure/dashboard/src/lib/components/shared/entity-assets.tsx',
                )
            ) {
                if (!nextCode.includes('maxAssets?: number')) {
                    nextCode = nextCode.replace(
                        `    updatePermissions?: boolean;
    multiSelect?: boolean;
    value?: EntityAssetValue;`,
                        `    updatePermissions?: boolean;
    multiSelect?: boolean;
    maxAssets?: number;
    value?: EntityAssetValue;`,
                    );
                }
                if (!nextCode.includes('maxAssets,')) {
                    nextCode = nextCode.replace(
                        `    compact = false,
    updatePermissions = true,
    multiSelect = true,
    onChange,`,
                        `    compact = false,
    updatePermissions = true,
    multiSelect = true,
    maxAssets,
    onChange,`,
                    );
                }
                if (!nextCode.includes('cappedAssets')) {
                    nextCode = nextCode.replace(
                        `                const uniqueAssets = multiSelect
                    ? [...new Map([...assets, ...selectedAssets].map(item => [item.id, item])).values()]
                    : selectedAssets;

                const newFeaturedAsset = !featuredAsset || !multiSelect ? selectedAssets[0] : featuredAsset;

                setAssets(uniqueAssets);
                setFeaturedAsset(newFeaturedAsset);
                emitChange(uniqueAssets, newFeaturedAsset);`,
                        `                const uniqueAssets = multiSelect
                    ? [...new Map([...assets, ...selectedAssets].map(item => [item.id, item])).values()]
                    : selectedAssets;

                const cappedAssets = maxAssets ? uniqueAssets.slice(0, maxAssets) : uniqueAssets;

                const newFeaturedAsset = !featuredAsset || !multiSelect ? cappedAssets[0] : featuredAsset;

                setAssets(cappedAssets);
                setFeaturedAsset(newFeaturedAsset);
                emitChange(cappedAssets, newFeaturedAsset);`,
                    );
                }
                if (!nextCode.includes('assets.length < maxAssets')) {
                    nextCode = nextCode.replace(
                        `    const AddAssetButton = () =>
        updatePermissions && (`,
                        `    const AddAssetButton = () =>
        updatePermissions && (!maxAssets || assets.length < maxAssets) && (`,
                    );
                }
                if (!nextCode.includes('[assets, featuredAsset, multiSelect, maxAssets, emitChange]')) {
                    nextCode = nextCode.replace(
                        `        [assets, featuredAsset, multiSelect, emitChange],`,
                        `        [assets, featuredAsset, multiSelect, maxAssets, emitChange],`,
                    );
                }
            }

            if (
                normalizedId.includes(
                    '/@vendure/dashboard/src/app/routes/_authenticated/_products/components/product-variants-table.tsx',
                )
            ) {
                if (!nextCode.includes("import { VendureImage } from '@/vdb/components/shared/vendure-image.js'")) {
                    nextCode = nextCode.replace(
                        `import { Money } from '@/vdb/components/data-display/money.js';`,
                        `import { Money } from '@/vdb/components/data-display/money.js';
import { VendureImage } from '@/vdb/components/shared/vendure-image.js';
import { AssetPickerDialog } from '@/vdb/components/shared/asset/asset-picker-dialog.js';
import { ImagePlus } from 'lucide-react';
import { api } from '@/vdb/graphql/api.js';
import { toast } from 'sonner';`,
                    );
                }

                if (!nextCode.includes('import { useState, useRef }')) {
                    nextCode = nextCode.replace(
                        `import { useState } from 'react';`,
                        `import { useState, useRef, useCallback } from 'react';`,
                    );
                }

                if (!nextCode.includes('pickerOpenVariantId')) {
                    nextCode = nextCode.replace(
                        `    const [page, setPage] = useState(1);`,
                        `    const refetchListRef = useRef<(() => void) | null>(null);
    const [editingStockId, setEditingStockId] = useState<string | null>(null);
    const [editingStockValue, setEditingStockValue] = useState<string>('');
    const [uploadingImageId, setUploadingImageId] = useState<string | null>(null);
    const [pickerOpenVariantId, setPickerOpenVariantId] = useState<string | null>(null);

    const UPDATE_VARIANT_DOC = \`
        mutation UpdateProductVariant($input: UpdateProductVariantInput!) {
            updateProductVariant(input: $input) {
                id
                featuredAsset { id preview }
                stockLevels { stockOnHand stockAllocated }
            }
        }
    \`;

    const handleAssetSelect = async (variantId: string, assetId: string) => {
        setUploadingImageId(variantId);
        try {
            await api.mutate(UPDATE_VARIANT_DOC, {
                input: { id: variantId, featuredAssetId: assetId },
            });
            toast.success('Imagen actualizada');
            refetchListRef.current?.();
        } catch {
            toast.error('Error al actualizar imagen');
        } finally {
            setUploadingImageId(null);
            setPickerOpenVariantId(null);
        }
    };

    const handleStockSave = async (variantId: string, stockOnHand: number, stockLocationId?: string) => {
        try {
            await api.mutate(UPDATE_VARIANT_DOC, {
                input: {
                    id: variantId,
                    stockLevels: stockLocationId
                        ? [{ stockLocationId, stockOnHand }]
                        : undefined,
                    ...(stockLocationId ? {} : { stockOnHand }),
                },
            });
            toast.success('Stock actualizado');
            setEditingStockId(null);
            refetchListRef.current?.();
        } catch {
            toast.error('Error al actualizar stock');
        }
    };

    const [page, setPage] = useState(1);`,
                    );
                }

                if (!nextCode.includes('refetchListRef.current = refresher')) {
                    nextCode = nextCode.replace(
                        `registerRefresher={registerRefresher}`,
                        `registerRefresher={refresher => {
                refetchListRef.current = refresher;
                registerRefresher?.(refresher);
            }}`,
                    );
                }

                if (!nextCode.includes("onClick={() => { setEditingStockId(String(original.id))")) {
                    nextCode = nextCode.replace(
                        `                stockLevels: {
                    cell: ({ row: { original } }) => <StockLevelLabel stockLevels={original.stockLevels} />,
                },`,
                        `                featuredAsset: {
                    cell: ({ row: { original } }) => (
                        <div className="flex items-center">
                            <button
                                type="button"
                                className="cursor-pointer rounded border border-border p-0.5 hover:border-primary hover:bg-accent"
                                onClick={() => setPickerOpenVariantId(String(original.id))}
                                title="Cambiar imagen"
                            >
                                {uploadingImageId === String(original.id) ? (
                                    <span className="flex h-10 w-10 items-center justify-center text-xs text-muted-foreground">
                                        ...
                                    </span>
                                ) : original.featuredAsset ? (
                                    <VendureImage asset={original.featuredAsset} preset="tiny" />
                                ) : (
                                    <span className="flex h-10 w-10 items-center justify-center text-muted-foreground">
                                        <ImagePlus className="h-4 w-4" />
                                    </span>
                                )}
                            </button>
                        </div>
                    ),
                },
                stockLevels: {
                    cell: ({ row: { original } }) => (
                        editingStockId === String(original.id) ? (
                            <input
                                type="number"
                                className="h-7 w-16 rounded border bg-background px-1 text-sm"
                                value={editingStockValue}
                                autoFocus
                                onChange={e => setEditingStockValue(e.target.value)}
                                onBlur={() => {
                                    const val = parseInt(editingStockValue, 10);
                                    if (!isNaN(val)) handleStockSave(String(original.id), val, String(original.stockLevels?.[0]?.stockLocation?.id));
                                    else setEditingStockId(null);
                                }}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const val = parseInt(editingStockValue, 10);
                                        if (!isNaN(val)) handleStockSave(String(original.id), val, String(original.stockLevels?.[0]?.stockLocation?.id));
                                        else setEditingStockId(null);
                                    }
                                    if (e.key === 'Escape') setEditingStockId(null);
                                }}
                            />
                        ) : (
                            <button
                                type="button"
                                className="cursor-pointer rounded border border-border bg-background px-1.5 py-0.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                                onClick={() => {
                                    setEditingStockId(String(original.id));
                                    setEditingStockValue(String(original.stockLevels?.[0]?.stockOnHand ?? 0));
                                }}
                            >
                                {original.stockLevels?.[0]?.stockOnHand ?? 0}
                                <span className="ml-0.5 text-muted-foreground">/ {original.stockLevels?.[0]?.stockAllocated ?? 0}</span>
                            </button>
                        )
                    ),
                },`,
                    );
                }

                if (!nextCode.includes('AssetPickerDialog open={!!pickerOpenVariantId}')) {
                    nextCode = nextCode.replace(
                        `    return (
        <PaginatedListDataTable`,
                        `    return (
        <>
        <PaginatedListDataTable`,
                    );
                    nextCode = nextCode.replace(
                        `        />
    );
}`,
                        `        />
        <AssetPickerDialog
            open={!!pickerOpenVariantId}
            onClose={() => setPickerOpenVariantId(null)}
            onSelect={assets => {
                if (pickerOpenVariantId && assets[0]) {
                    handleAssetSelect(pickerOpenVariantId, assets[0].id);
                }
            }}
            multiSelect={false}
        />
        </>
    );
}`,
                    );
                }
            }

            if (
                normalizedId.includes(
                    '/@vendure/dashboard/src/lib/components/shared/rich-text-editor/responsive-toolbar.tsx',
                )
            ) {
                if (!nextCode.includes('const hideImages =')) {
                    nextCode = nextCode.replace(
                        `    const toolbarItems: ToolbarItem[] = useMemo(() => {
        if (!editor) return [];

        return [`,
                        `    const toolbarItems: ToolbarItem[] = useMemo(() => {
        if (!editor) return [];

        const hideImages =
            typeof document !== 'undefined' && document.body.classList.contains('hide-description-images');

        return [`,
                    );
                }
                if (!nextCode.includes("item => !(hideImages && item.id === 'image')")) {
                    nextCode = nextCode.replace(
                        `        ];
    }, [editor, disabled, linkDialogOpen, imageDialogOpen, canUndo, canRedo, canInsertTable]);`,
                        `        ].filter(item => !(hideImages && item.id === 'image'));
    }, [editor, disabled, linkDialogOpen, imageDialogOpen, canUndo, canRedo, canInsertTable]);`,
                    );
                }
            }

            if (normalizedId.includes('/@vendure/dashboard/src/app/routes/_authenticated/_sellers/sellers.tsx')) {
                if (!nextCode.includes("import { useState } from 'react';")) {
                    nextCode = nextCode.replace(
                        "import { Trans } from '@lingui/react/macro';",
                        "import { useState } from 'react';\nimport { Trans } from '@lingui/react/macro';",
                    );
                }

                if (!nextCode.includes('const [showDeleted, setShowDeleted] = useState(false);')) {
                    nextCode = nextCode.replace(
                        `function SellerListPage() {
    return (
        <ListPage`,
                        `function SellerListPage() {
    const [showDeleted, setShowDeleted] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    return (
        <ListPage
            key={refreshKey}`,
                    );
                }

                if (!nextCode.includes('transformVariables={')) {
                    nextCode = nextCode.replace(
                        `            onSearchTermChange={searchTerm => {
                return {
                    name: { contains: searchTerm },
                };
            }}`,
                        `            onSearchTermChange={searchTerm => {
                return {
                    name: { contains: searchTerm },
                };
            }}
            transformVariables={variables => ({
                ...variables,
                options: {
                    ...variables.options,
                    filter: {
                        ...variables.options?.filter,
                        deletedAt: showDeleted ? { isNull: false } : { isNull: true },
                    },
                },
            })}`,
                    );
                }

                if (!nextCode.includes('seller-toggle-button')) {
                    nextCode = nextCode.replace(
                        `            <ActionBarItem itemId="create-button" requiresPermission={['CreateSeller']}>`,
                        `            <ActionBarItem itemId="seller-toggle-button">
                <Button onClick={() => { setShowDeleted(v => !v); setRefreshKey(k => k + 1); }}>
                    {showDeleted ? 'Mostrar eliminados' : 'Ocultar eliminados'}
                </Button>
            </ActionBarItem>
            <ActionBarItem itemId="create-button" requiresPermission={['CreateSeller']}>`,
                    );
                }
            }

            return nextCode === code ? null : nextCode;
        },
    };
}

export default defineConfig({
    base: '/dashboard',
    build: {
        outDir: `${__dirname}/dist/dashboard`,
        emptyOutDir: true,
    },
    server: {
        fs: {
            // En dev el plugin del dashboard usa como root el paquete dentro de
            // node_modules, y las fuentes de marca (src/styles/fonts) quedan
            // fuera de la lista permitida de @fs → 403. Permitimos el proyecto.
            allow: [__dirname],
        },
    },
    optimizeDeps: {
        // @vendure-io/ui and @vendure/dashboard each ship their own nested
        // recharts@2.x (the project's own recharts is a separate v3 copy).
        // Without this, Vite's dev-server dependency scanner doesn't crawl
        // into those nested copies, so their `import get from 'lodash/get'`
        // hits an un-prebundled raw CJS file with no default export.
        include: ['@vendure-io/ui > recharts', '@vendure/dashboard > recharts'],
    },
    plugins: [
        patchVendureDashboardChannelPermissions(),
        patchBaseUiMouseUp(),
        injectGtm(),
        vendureDashboardPlugin({
            // The vendureDashboardPlugin will scan your configuration in order
            // to find any plugins which have dashboard extensions, as well as
            // to introspect the GraphQL schema based on any API extensions
            // and custom fields that are configured.
            vendureConfigPath: pathToFileURL('./src/vendure-config.ts'),
            // Points to the location of your Vendure server.
            api: IS_DEV
                ? { host: 'http://localhost', port: 3000 }
                : {
                    host: process.env.HOST_URL as string,
                    // host: 'https://admin.ecommer.shop'
                },
            // When you start the Vite server, your Admin API schema will
            // be introspected and the types will be generated in this location.
            // These types can be used in your dashboard extensions to provide
            // type safety when writing queries and mutations.
            gqlOutputPath: './src/gql',
            i18n: {
                defaultLanguage: (process.env.DASHBOARD_DEFAULT_LANGUAGE as LanguageCode) ?? LanguageCode.es,
                defaultLocale: process.env.DASHBOARD_DEFAULT_LOCALE ?? 'CO',
            },
            // ─── Ecommer brand palette ───────────────────────────────────────
            // #12123F Deadly Depths     → hsl(240 56% 16%)
            // #9969F8 Candy Grape Fizz  → hsl(260 91% 69%)
            // #6BB8FF Blue Mana         → hsl(209 100% 71%)
            // #F1F1F1 Beluga            → hsl(0 0% 95%)
            theme: {
                // Pulido moderno (sombras, radius, micro-interacciones) en capa
                // sobre los tokens de marca. Solo usa var(--…), sirve en ambos modos.
                additionalStylesheets: [
                    `${__dirname}/src/styles/brand-fonts.css`,
                    `${__dirname}/src/styles/dashboard-modern.css`,
                ],
                light: {
                    background: 'hsl(0 0% 95%)',          // Beluga
                    foreground: 'hsl(240 56% 16%)',       // Deadly Depths
                    card: 'hsl(0 0% 100%)',
                    'card-foreground': 'hsl(240 56% 16%)',
                    popover: 'hsl(0 0% 100%)',
                    'popover-foreground': 'hsl(240 56% 16%)',
                    primary: 'hsl(260 91% 69%)',       // Candy Grape Fizz
                    'primary-foreground': 'hsl(0 0% 100%)',
                    secondary: 'hsl(209 100% 71%)',      // Blue Mana
                    'secondary-foreground': 'hsl(240 56% 10%)',
                    muted: 'hsl(260 40% 93%)',
                    'muted-foreground': 'hsl(240 20% 45%)',
                    accent: 'hsl(209 100% 71%)',
                    'accent-foreground': 'hsl(240 56% 16%)',
                    border: 'hsl(240 20% 85%)',
                    input: 'hsl(240 20% 85%)',
                    ring: 'hsl(260 91% 69%)',
                    sidebar: 'hsl(0 0% 100%)',
                    'sidebar-foreground': 'hsl(240 56% 16%)',
                    'sidebar-primary': 'hsl(260 91% 69%)',
                    'sidebar-primary-foreground': 'hsl(0 0% 100%)',
                    'sidebar-accent': 'hsl(260 40% 93%)',
                    'sidebar-accent-foreground': 'hsl(240 56% 16%)',
                    'sidebar-border': 'hsl(240 20% 88%)',
                    'sidebar-ring': 'hsl(260 91% 69%)',
                    brand: '#9969F8',
                    'brand-lighter': '#c4a9fb',
                    'brand-darker': '#6b35f5',
                    // ── semantic states ──────────────────────────────────
                    destructive: 'hsl(0 84% 55%)',
                    'destructive-foreground': 'hsl(0 0% 100%)',
                    success: 'hsl(142 72% 29%)',
                    'success-foreground': 'hsl(0 0% 100%)',
                    warning: 'hsl(38 95% 48%)',
                    'warning-foreground': 'hsl(0 0% 100%)',
                    'soft-danger': 'hsl(0 84% 94%)',
                    'soft-danger-foreground': 'hsl(0 72% 42%)',
                    radius: '0.625rem',
                },
                dark: {
                    background: 'hsl(240 56% 10%)',
                    foreground: 'hsl(0 0% 95%)',          // Beluga
                    card: 'hsl(240 52% 14%)',
                    'card-foreground': 'hsl(0 0% 95%)',
                    popover: 'hsl(240 52% 12%)',
                    'popover-foreground': 'hsl(0 0% 95%)',
                    primary: 'hsl(260 91% 69%)',       // Candy Grape Fizz
                    'primary-foreground': 'hsl(0 0% 100%)',
                    secondary: 'hsl(209 100% 71%)',      // Blue Mana
                    'secondary-foreground': 'hsl(240 56% 10%)',
                    muted: 'hsl(240 40% 20%)',
                    'muted-foreground': 'hsl(240 15% 65%)',
                    accent: 'hsl(240 45% 22%)',
                    'accent-foreground': 'hsl(0 0% 95%)',
                    border: 'hsl(240 35% 22%)',
                    input: 'hsl(240 35% 22%)',
                    ring: 'hsl(260 91% 69%)',
                    sidebar: 'hsl(240 60% 8%)',
                    'sidebar-foreground': 'hsl(0 0% 95%)',
                    'sidebar-primary': 'hsl(260 91% 69%)',
                    'sidebar-primary-foreground': 'hsl(0 0% 100%)',
                    'sidebar-accent': 'hsl(240 45% 18%)',
                    'sidebar-accent-foreground': 'hsl(0 0% 95%)',
                    'sidebar-border': 'hsl(240 35% 18%)',
                    'sidebar-ring': 'hsl(260 91% 69%)',
                    brand: '#9969F8',
                    'brand-lighter': '#c4a9fb',
                    'brand-darker': '#6b35f5',
                    // ── semantic states ──────────────────────────────────
                    destructive: 'hsl(0 84% 60%)',
                    'destructive-foreground': 'hsl(0 0% 100%)',
                    success: 'hsl(142 72% 45%)',
                    'success-foreground': 'hsl(0 0% 100%)',
                    warning: 'hsl(38 95% 55%)',
                    'warning-foreground': 'hsl(0 0% 100%)',
                    'soft-danger': 'hsl(0 55% 20%)',
                    'soft-danger-foreground': 'hsl(0 84% 75%)',
                    radius: '0.625rem',
                },
            },
        }),
        // Plugin: inyecta WOMPI_PUBLIC_KEY en el HTML (corre en dev y build)
        {
            name: 'inject-wompi-key',
            transformIndexHtml(html) {
                const key =
                    process.env.WOMPI_PUBLIC_KEY?.trim() ||
                    process.env.PAYMENT_PUBLIC_KEY?.trim() ||
                    '';
                return html.replace(
                    '</head>',
                    `  <script>window.__WOMPI_PUBLIC_KEY__ = "${key}";</script>\n</head>`
                );
            },
        },
        // Plugin post-dashboard-html: modifica el HTML después de que vendureDashboardPlugin lo genera
        {
            name: 'post-dashboard-html',
            enforce: 'post',  // Se ejecuta DESPUÉS de todos los plugins
            generateBundle(options, bundle) {
                // Buscar el index.html en el bundle
                const indexHtml = bundle['index.html'];
                if (!indexHtml || indexHtml.type !== 'asset') {
                    console.warn('[post-dashboard-html] No se encontró index.html en el bundle');
                    return;
                }

                let html = indexHtml.source as string;

                // Favicons de marca (archivos copiados por scripts/copy-favicons.mjs)
                html = html.replace(
                    '<link rel="icon" type="image/png" href="favicon.png" />',
                    `<link rel="icon" type="image/x-icon" href="favicon.ico" />
    <link rel="icon" type="image/png" sizes="32x32" href="favicon-32x32.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="favicon-16x16.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png" />
    <link rel="manifest" href="site.webmanifest" />`,
                );

                // Inyectar título personalizado y scripts
                html = html.replace(
                    '<meta charset="UTF-8" />',
                    `<meta charset="UTF-8" />
    <title>Ecommer | Admin</title>
    <script>
      // Establecer idioma/locale por defecto para nuevos usuarios (sin settings guardados)
      (function() {
        try {
          var key = 'vendure-user-settings';
          if (!localStorage.getItem(key)) {
            localStorage.setItem(key, JSON.stringify({
              displayLanguage: 'es',
              displayLocale: 'CO',
              contentLanguage: 'es',
              theme: 'system',
              displayUiExtensionPoints: false,
              mainNavExpanded: true,
              activeChannelId: '',
              devMode: false,
              hasSeenOnboarding: false,
              tableSettings: {}
            }));
          }
        } catch(e) {}
      })();
    </script>
    <script>
      // Mantener título personalizado aunque el JS de Vendure lo sobreescriba
      Object.defineProperty(document, 'title', {
        set: function(val) {
          // ignorar cualquier cambio al título
        },
        get: function() {
          return 'Ecommer | Admin';
        },
        configurable: true
      });
    </script>
    <script>
        document.addEventListener('click', function(e) {
            const target = e.target;
            const menuButton = target.closest('[data-sidebar="menu-button"]');
            const menuSubButton = target.closest('[data-sidebar="menu-sub-button"]');
            
            if (!menuButton && !menuSubButton) return;
            
            const activeEl = menuButton || menuSubButton;
            const isCollapsibleTrigger = activeEl.getAttribute('data-slot') === 'collapsible-trigger';
            const isDropdownTrigger = activeEl.getAttribute('data-slot') === 'dropdown-menu-trigger';
            
            if (!isCollapsibleTrigger && !isDropdownTrigger) {
            setTimeout(function() {
                const closeBtn = document.querySelector('[data-sidebar="sidebar"] button.absolute.top-4.right-4');
                if (closeBtn) closeBtn.click();
            }, 50);
            }
        }, true);
        
        // Cerrar sidebar al tocar item dentro de un dropdown
        document.addEventListener('click', function(e) {
          const target = e.target;
          const dropdownItem = target.closest(
            '[data-slot="dropdown-menu-item"], [data-slot="dropdown-menu-radio-item"]'
          );
          
          if (!dropdownItem) return;
          
          setTimeout(function() {
            const closeBtn = document.querySelector('[data-sidebar="sidebar"] button.absolute.top-4.right-4');
            if (closeBtn) closeBtn.click();
          }, 100);
        }, true);
    </script>
    <style>
      /* Fix: ancho de app en móvil */
      html, body, #app {
        max-width: 100vw;
        width: 100%;
      }

            /* Fix: sidebar-inset no desborde en móvil */
            @media (max-width: 768px) {
                [data-slot="sidebar-inset"] {
                    width: 100% !important;
                    min-width: 0 !important;
                }
            }

            /* Sticky header - global (todos los tamaños) */
            header.border-b.border-border {
                position: sticky !important;
                top: 0 !important;
                z-index: 100 !important;
                background: var(--background, #fff) !important;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05) !important;
            }

            /* Sidebar scroll container - todos los tamaños */
            [data-slot="sidebar-inset"] {
                display: flex;
                flex-direction: column;
                overflow-y: auto;
                max-height: 100vh;
            }

            /* Product detail header (título + action bar) sticky */
            body.product-detail-sticky form.space-y-4 > div.flex.items-center.justify-between.gap-2 {
                position: sticky;
                top: 4.5rem;
                z-index: 90;
                background: var(--background, #fff);
                padding-block: 0.5rem;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
            }

            /* --- Vendure Dashboard: Fix superposición de labels en gráficos métricas home --- */
            /* Recharts XAxis tick labels: rotar y ajustar en displays pequeños */
            @media (max-width: 768px) {
                .recharts-xAxis .recharts-cartesian-axis-tick-value {
                    transform-box: fill-box;
                    transform-origin: right center;
                    transform: rotate(-45deg);
                    text-anchor: end !important;
                    font-size: 10px;
                }
            }

      /* Ocultar formulario nativo de Vendure condicionalmente */
      body.hide-native-login form > div:not([class*="max-w-sm"]),
      body.hide-native-login form [data-slot="separator"],
      body.hide-native-login form [data-slot="separator-root"],
      body.hide-native-login form [name="username"],
      body.hide-native-login form [name="password"],
      body.hide-native-login form [type="submit"],
      body.hide-native-login form h1,
      body.hide-native-login form > div:not([class*="max-w-sm"]) p.text-muted-foreground,
      body.hide-native-login form [data-slot="input-group"] {
          display: none !important;
      }
    </style>`
                );

                // Actualizar el bundle con el HTML modificado
                indexHtml.source = html;
            }
        },
    ],
    resolve: {
        alias: {
            '@/gql': `${__dirname}/src/gql/graphql.ts`,
            // Mirrors the "@/plugins/*" path mapping in tsconfig.dashboard.json.
            '@/plugins': `${__dirname}/src/plugins`,
        },
    },
});