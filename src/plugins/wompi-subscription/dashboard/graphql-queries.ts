// ─── GraphQL documents ──────────────────────────────────────────

export const MY_SUBSCRIPTION_QUERY = `
  query MySubscription($customerEmail: String) {
    mySubscription(customerEmail: $customerEmail) {
      id
      status
      startsAt
      endsAt
      gracePeriodStart
      autoRenew
      plan {
        id
        name
        price
        billingInterval
        description
        planFeatures {
          id
          feature { code name type }
          value
        }
      }
      paymentMethodType
      paymentFlowType
      productLimit
      variationLimit
      hasAIAccess
      hasElectronicBilling
    }
  }
`;

export const ALL_PLANS_QUERY = `
  query AllPlans {
    allPlans {
      id
      name
      price
      billingInterval
      description
      planFeatures {
        id
        feature { code name type }
        value
      }
    }
  }
`;

export const MY_BIFROST_USAGE_QUERY = `
  query MyBifrostKeyUsage {
    myBifrostKeyUsage {
      key {
        id
        value
        planName
        kind
        isActive
        expiresAt
      }
      usage {
        usagePercent
        budgetMax
        budgetUsed
        budgetResetAt
        tokenUsed
        tokenLimit
        requestUsed
        requestLimit
        isActive
      }
    }
  }
`;

export const ACTIVE_ADMIN_QUERY = `
  query ActiveAdmin {
    activeAdministrator {
      emailAddress
    }
  }
`;
export const CHECK_PRODUCT_LIMIT_QUERY = `
  query CheckProductLimit($channelToken: String, $customerEmail: String) {
    checkProductLimit(channelToken: $channelToken, customerEmail: $customerEmail) {
      allowed current limit
    }
  }
`;

export const CHECK_VARIATION_LIMIT_QUERY = `
  query CheckVariationLimit($channelToken: String, $customerEmail: String) {
    checkVariationLimit(channelToken: $channelToken, customerEmail: $customerEmail) {
      allowed current limit
    }
  }
`;

export const CREATE_SUBSCRIPTION_MUTATION = `
  mutation CreateSubscriptionWithPayment($token: String!, $planId: Int!, $paymentMethod: String!, $customerEmail: String, $sessionId: String, $deviceId: String, $lastFour: String, $brand: String, $expiryMonth: String, $expiryYear: String, $cardHolderName: String) {
    createSubscriptionWithPayment(token: $token, planId: $planId, paymentMethod: $paymentMethod, customerEmail: $customerEmail, sessionId: $sessionId, deviceId: $deviceId, lastFour: $lastFour, brand: $brand, expiryMonth: $expiryMonth, expiryYear: $expiryYear, cardHolderName: $cardHolderName) {
      id
      status
      startsAt
      endsAt
      autoRenew
      plan { id name }
    }
  }
`;

export const CREATE_PENDING_MUTATION = `
  mutation CreatePendingSubscription($planId: Int!, $paymentMethod: String!, $customerEmail: String) {
    createPendingSubscription(planId: $planId, paymentMethod: $paymentMethod, customerEmail: $customerEmail) {
      id
      status
      asyncPaymentUrl
      qrImage
      transactionId
      plan { id name }
    }
  }
`;

export const STOP_AUTO_RENEW_MUTATION = `
  mutation StopAutoRenew($subscriptionId: Int!, $customerEmail: String) {
    stopAutoRenew(subscriptionId: $subscriptionId, customerEmail: $customerEmail) {
      id
      status
      autoRenew
    }
  }
`;

export const CANCEL_SUBSCRIPTION_MUTATION = `
  mutation CancelSubscription($subscriptionId: Int!, $customerEmail: String) {
    cancelSubscription(subscriptionId: $subscriptionId, customerEmail: $customerEmail) {
      id
      status
      plan { id name }
    }
  }
`;

// ─── Types ──────────────────────────────────────────────────────

export interface PlanFeatureEntry {
  id: number;
  feature: { code: string; name: string; type: string };
  value: string;
}

export interface Plan {
  id: number;
  name: string;
  price: number;
  billingInterval: string;
  description?: string;
  planFeatures: PlanFeatureEntry[];
}

export interface Subscription {
  id: number;
  status: string;
  startsAt?: string;
  endsAt?: string;
  gracePeriodStart?: string;
  autoRenew: boolean;
  plan: Plan;
  paymentMethodType?: string;
  paymentFlowType?: string;
  productLimit?: number;
  variationLimit?: number;
  hasAIAccess?: boolean;
  hasElectronicBilling?: boolean;
}

// ─── Payment method config ──────────────────────────────────────

export interface PaymentMethodOption {
  type: string;
  label: string;
  flow: 'recurrent' | 'manual';
  description: string;
}

export const PAYMENT_METHODS: PaymentMethodOption[] = [
  { type: 'CARD', label: 'Tarjeta crédito/débito', flow: 'recurrent', description: 'Se cobra automáticamente cada período — no necesitas hacer nada' },
  { type: 'NEQUI', label: 'Nequi', flow: 'recurrent', description: 'Requiere aprobación por notificación push en tu celular en cada renovación' },
  { type: 'DAVIPLATA', label: 'Daviplata', flow: 'recurrent', description: 'Requiere aprobación por notificación push en tu celular en cada renovación' },
  { type: 'BANCOLOMBIA_TRANSFER', label: 'Transferencia Bancolombia', flow: 'recurrent', description: 'Se cobra automáticamente desde tu cuenta Bancolombia' },
  { type: 'PSE', label: 'PSE', flow: 'manual', description: 'Debes iniciar sesión en tu banco y pagar antes del vencimiento' },
  { type: 'BANCOLOMBIA_QR', label: 'Bancolombia QR', flow: 'manual', description: 'Debes escanear el código QR y pagar antes del vencimiento' },
  { type: 'BANCOLOMBIA_COLLECT', label: 'Bancolombia Recogida', flow: 'manual', description: 'Debes pagar la factura en Bancolombia antes del vencimiento' },
  { type: 'PCOL', label: 'Pago contra entrega', flow: 'manual', description: 'Debes pagar contra entrega antes del vencimiento' },
  { type: 'BANCOLOMBIA_BNPL', label: 'Bancolombia Cuotas', flow: 'manual', description: 'Debes pagar en cuotas antes del vencimiento' },
  { type: 'SU_PLUS', label: 'Su Plus', flow: 'manual', description: 'Debes pagar con Su Plus antes del vencimiento' },
];

export function isRecurrent(type: string): boolean {
  return PAYMENT_METHODS.find(m => m.type === type)?.flow === 'recurrent';
}
export function isManual(type: string): boolean {
  return PAYMENT_METHODS.find(m => m.type === type)?.flow === 'manual';
}

// ─── Helpers ────────────────────────────────────────────────────

export async function gql<T>(query: string, variables?: Record<string, any>): Promise<T> {
  const res = await fetch('/admin-api/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data as T;
}

export const MY_SAVED_PAYMENT_METHODS = `
    query MySavedPaymentMethods {
        mySavedPaymentMethods {
            id
            type
            lastFour
            brand
            expiryMonth
            expiryYear
            cardHolderName
            isDefault
            createdAt
        }
    }
`;

export const SAVE_PAYMENT_METHOD_FOR_SUBSCRIPTION = `
    mutation SavePaymentMethodForSubscription(
        $token: String!
        $type: String!
        $lastFour: String!
        $brand: String!
        $expiryMonth: String!
        $expiryYear: String!
        $cardHolderName: String
    ) {
        savePaymentMethodForSubscription(
            token: $token
            type: $type
            lastFour: $lastFour
            brand: $brand
            expiryMonth: $expiryMonth
            expiryYear: $expiryYear
            cardHolderName: $cardHolderName
        ) {
            id
            type
            lastFour
            brand
            expiryMonth
            expiryYear
            cardHolderName
            isDefault
            createdAt
        }
    }
`;

export const DELETE_SAVED_PAYMENT_METHOD_FOR_SUBSCRIPTION = `
    mutation DeleteSavedPaymentMethodForSubscription($id: ID!) {
        deleteSavedPaymentMethodForSubscription(id: $id)
    }
`;

export const SET_DEFAULT_PAYMENT_METHOD_FOR_SUBSCRIPTION = `
    mutation SetDefaultPaymentMethodForSubscription($id: ID!) {
        setDefaultPaymentMethodForSubscription(id: $id) {
            id
            isDefault
        }
    }
`;

export const USE_SAVED_PAYMENT_METHOD_FOR_SUBSCRIPTION = `
    mutation UseSavedPaymentMethodForSubscription($paymentMethodId: ID!) {
        useSavedPaymentMethodForSubscription(paymentMethodId: $paymentMethodId) {
            id
            status
            paymentMethodType
            autoRenew
        }
    }
`;

export interface SavedPaymentMethod {
  id: string;
  type: string;
  lastFour: string;
  brand: string;
  expiryMonth: string;
  expiryYear: string;
  cardHolderName?: string;
  isDefault: boolean;
  createdAt: string;
}

export const GET_WOMPI_TRANSACTION_STATUS = `
  query GetAdminWompiTransactionStatus($transactionId: String!) {
    getAdminWompiTransactionStatus(transactionId: $transactionId) {
      id
      status
      statusMessage
      asyncPaymentUrl
      qrImage
      url
    }
  }
`;

export interface WompiTransactionStatus {
  id: string;
  status: string;
  statusMessage?: string | null;
  asyncPaymentUrl?: string | null;
  qrImage?: string | null;
  url?: string | null;
}

export function statusColor(status: string): 'success' | 'warning' | 'danger' | 'default' | 'destructive' {
  switch (status) {
    case 'ACTIVE': return 'success';
    case 'PENDING_PAYMENT':
    case 'GRACE_PERIOD': return 'warning';
    case 'SUSPENDED':
    case 'CANCELLED': return 'destructive';
    default: return 'default';
  }
}

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    ACTIVE: 'Activa',
    PENDING_PAYMENT: 'Pago pendiente',
    GRACE_PERIOD: 'Período de gracia',
    SUSPENDED: 'Suspendida',
    CANCELLED: 'Cancelada',
  };
  return labels[status] ?? status;
}
