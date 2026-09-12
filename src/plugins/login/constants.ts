import { Permission } from '@vendure/core';

export const LOGIN_PLUGIN_OPTIONS = Symbol('LOGIN_PLUGIN_OPTIONS');
export const loggerCtx = 'LoginPlugin';

/**
 * Permisos estándar para los administradores de vendedores
 * Estos permisos se aplican tanto a usuarios nuevos como existentes
 */
export const SELLER_ADMIN_PERMISSIONS: Permission[] = [
    Permission.Authenticated,
    Permission.CreateOrder,
    Permission.ReadOrder,
    Permission.UpdateOrder,
    Permission.DeleteOrder,
    Permission.ReadCustomer,
    Permission.ReadPaymentMethod,
    Permission.CreatePaymentMethod,
    Permission.UpdatePaymentMethod,
    Permission.DeletePaymentMethod,
    Permission.ReadShippingMethod,
    Permission.CreateShippingMethod,
    Permission.UpdateShippingMethod,
    Permission.DeleteShippingMethod,
    Permission.ReadPromotion,
    //Permission.ReadCountry,
    //Permission.ReadZone,
    Permission.ReadChannel,
    Permission.CreateAsset,
    Permission.ReadAsset,
    Permission.UpdateAsset,
    Permission.CreateCustomer,
    Permission.UpdateCustomer,
    Permission.DeleteCustomer,
    Permission.CreateTag,
    Permission.ReadTag,
    Permission.UpdateTag,
    Permission.DeleteTag,
    //Permission.ReadAdministrator,
    Permission.UpdateAdministrator,
    Permission.CreateStockLocation,
    Permission.ReadStockLocation,
    Permission.UpdateStockLocation,
    Permission.CreatePromotion,
    Permission.ReadPromotion,
    Permission.UpdatePromotion,
    Permission.DeletePromotion,
    Permission.ReadFacet,
    Permission.ReadCollection,
    Permission.CreateProduct,
    Permission.ReadProduct,
    Permission.UpdateProduct,
    Permission.DeleteProduct,
    Permission.CreateAsset,
    Permission.ReadAsset,
    Permission.UpdateAsset,
    Permission.DeleteAsset,
];
