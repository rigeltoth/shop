import { useEffect } from 'react';
import type { DashboardFormComponent } from '@vendure/dashboard';

/**
 * Replaces the "Slug" input on the product detail page with nothing.
 *
 * The dashboard's detailForms.inputs API only swaps the input control — the
 * "Slug" <FieldLabel> is rendered by the core route (products_.$id.tsx)
 * outside of that override, so it survives regardless of what this component
 * renders. To fully collapse the field (label included) we toggle a body
 * class while mounted, matched by a CSS rule in vite.config.mts that hides
 * the whole [data-slot="field"] wrapper containing label[for="field-slug"] —
 * same pattern this repo already uses for hide-native-login.
 */
export const HiddenSlugInput: DashboardFormComponent = () => {
    useEffect(() => {
        document.body.classList.add('hide-product-slug-field');
        return () => {
            document.body.classList.remove('hide-product-slug-field');
        };
    }, []);

    return null;
};
