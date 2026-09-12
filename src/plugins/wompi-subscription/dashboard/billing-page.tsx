import {
    Page,
    PageLayout,
    PageBlock,
    PageTitle,
    Card,
    CardContent,
    Button,
} from '@vendure/dashboard';
import { CreditCard } from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
    gql,
    Plan,
    Subscription,
    MY_SUBSCRIPTION_QUERY,
    ALL_PLANS_QUERY,
    ACTIVE_ADMIN_QUERY,
    CHECK_PRODUCT_LIMIT_QUERY,
    CHECK_VARIATION_LIMIT_QUERY,
    STOP_AUTO_RENEW_MUTATION,
    CANCEL_SUBSCRIPTION_MUTATION,
    CREATE_SUBSCRIPTION_MUTATION,
    CREATE_PENDING_MUTATION,
    PAYMENT_METHODS,
} from './graphql-queries';
import { ViewStep } from './ViewStep';
import { PlansStep } from './PlansStep';
import { PaymentStep } from './PaymentStep';
import { SavedPaymentMethodsSection } from './components/saved-payment-methods-section';

export function BillingPage() {
    const [step, setStep] = useState<'view' | 'plans' | 'payment'>('view');
    const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
    const [sub, setSub] = useState<Subscription | null | undefined>(undefined);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [paymentTab, setPaymentTab] = useState<string>('recurrent');
    const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
    const [paymentProcessing, setPaymentProcessing] = useState(false);

    const [showTokenForm, setShowTokenForm] = useState(false);
    const [pendingResult, setPendingResult] = useState<any>(null);
    const [adminEmail, setAdminEmail] = useState<string | undefined>();
    const [usage, setUsage] = useState<{ product: { allowed: boolean; current: number; limit: number }; variation: { allowed: boolean; current: number; limit: number } } | null>(null);
    const paymentInFlight = useRef(false);

    useEffect(() => {
        gql<{ activeAdministrator: { emailAddress: string } }>(ACTIVE_ADMIN_QUERY)
            .then(d => setAdminEmail(d.activeAdministrator.emailAddress))
            .catch(() => { });
    }, []);

    const loadData = useCallback(async () => {
        try {
            const [subData, plansData] = await Promise.all([
                gql<{ mySubscription: Subscription | null }>(MY_SUBSCRIPTION_QUERY, { customerEmail: adminEmail }),
                gql<{ allPlans: Plan[] }>(ALL_PLANS_QUERY),
            ]);
            setSub(subData.mySubscription ?? null);
            setPlans(plansData.allPlans ?? []);
        } catch (e: any) {
            setError(e.message);
        }
    }, [adminEmail]);

    useEffect(() => {
        if (!adminEmail) return;
        const token = typeof window !== 'undefined'
            ? localStorage.getItem('vendure-selected-channel-token')
            : undefined;
        if (!token) return;
        Promise.all([
            gql<{ checkProductLimit: { allowed: boolean; current: number; limit: number } }>(
                CHECK_PRODUCT_LIMIT_QUERY, { channelToken: token, customerEmail: adminEmail }
            ),
            gql<{ checkVariationLimit: { allowed: boolean; current: number; limit: number } }>(
                CHECK_VARIATION_LIMIT_QUERY, { channelToken: token, customerEmail: adminEmail }
            ),
        ]).then(([product, variation]) => {
            setUsage({ product: product.checkProductLimit, variation: variation.checkVariationLimit });
        }).catch(() => { });
    }, [adminEmail]);

    useEffect(() => { if (adminEmail) loadData(); }, [adminEmail, loadData]);

    const handleSelectPlan = (plan: Plan) => {
        if (sub?.plan?.name?.toLowerCase() === plan.name.toLowerCase()) {
            setError('Ya tienes este plan activo');
            return;
        }
        setSelectedPlan(plan);
        setStep('payment');
        setError(null);
        setPendingResult(null);
        setShowTokenForm(false);
        setSelectedMethod(null);
    };

    const handleStopAutoRenew = async () => {
        if (!sub) return;
        setActionLoading('stopAutoRenew');
        try {
            const data = await gql<{ stopAutoRenew: Subscription }>(STOP_AUTO_RENEW_MUTATION, {
                subscriptionId: Number(sub.id),
                customerEmail: adminEmail,
            });
            setSub(prev => prev ? { ...prev, autoRenew: data.stopAutoRenew.autoRenew } : prev);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleCancel = async () => {
        if (!sub) return;
        setActionLoading('cancel');
        try {
            await gql(CANCEL_SUBSCRIPTION_MUTATION, {
                subscriptionId: Number(sub.id),
                customerEmail: adminEmail,
            });
            loadData();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setActionLoading(null);
        }
    };

    const handlePayment = async () => {
        if (!selectedPlan || !selectedMethod) return;

        const method = PAYMENT_METHODS.find(m => m.type === selectedMethod);
        if (!method) throw new Error('Método de pago no válido');

        if (method.flow === 'recurrent') {
            setShowTokenForm(true);
            return;
        }

        setPaymentProcessing(true);
        setError(null);

        try {
            const data = await gql<{ createPendingSubscription: any }>(CREATE_PENDING_MUTATION, {
                planId: Number(selectedPlan.id),
                paymentMethod: selectedMethod,
                customerEmail: adminEmail || null,
            });
            setPendingResult(data.createPendingSubscription);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setPaymentProcessing(false);
        }
    };

    const handleCloseTokenForm = useCallback(() => {
        setShowTokenForm(false);
    }, []);

    const handleWidgetTokenReceived = async (token: string, sessionId?: string, deviceId?: string, cardDetails?: { lastFour?: string; brand?: string; expiryMonth?: string; expiryYear?: string; cardHolderName?: string }) => {
        if (!selectedPlan || !selectedMethod) return;
        if (paymentInFlight.current) return;
        paymentInFlight.current = true;
        setPaymentProcessing(true);
        try {
            const data = await gql<{ createSubscriptionWithPayment: any }>(CREATE_SUBSCRIPTION_MUTATION, {
                token,
                planId: Number(selectedPlan.id),
                paymentMethod: selectedMethod,
                customerEmail: adminEmail || null,
                sessionId: sessionId || null,
                deviceId: deviceId || null,
                lastFour: cardDetails?.lastFour || null,
                brand: cardDetails?.brand || null,
                expiryMonth: cardDetails?.expiryMonth || null,
                expiryYear: cardDetails?.expiryYear || null,
                cardHolderName: cardDetails?.cardHolderName || null,
            });
            setSelectedPlan(null);
            setStep('view');
            loadData();
        } catch (e: any) {
            setError(e.message);
        } finally {
            paymentInFlight.current = false;
            setPaymentProcessing(false);
            setShowTokenForm(false);
        }
    };

    const handlePaymentSuccess = () => {
        setSelectedPlan(null);
        setStep('view');
        setPendingResult(null);
        setShowTokenForm(false);
        loadData();
    };

    return (
        <Page pageId="billing-page">
            <PageTitle>
                <span className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Facturación y Plan
                </span>
            </PageTitle>

            <PageLayout>
                <PageBlock column="main">
                    {error && (
                        <Card className="mb-4 border-destructive/50 bg-destructive/5">
                            <CardContent className="flex items-center justify-between">
                                <span className="text-sm text-destructive">{error}</span>
                                <Button variant="ghost" size="sm" onClick={() => setError(null)}>Cerrar</Button>
                            </CardContent>
                        </Card>
                    )}

                    {step === 'payment' && selectedPlan && (
                        <PaymentStep
                            plan={selectedPlan}
                            paymentTab={paymentTab}
                            setPaymentTab={setPaymentTab}
                            selectedMethod={selectedMethod}
                            setSelectedMethod={setSelectedMethod}
                            onPay={handlePayment}
                            paymentProcessing={paymentProcessing}
                            showTokenForm={showTokenForm}
                            onCloseTokenForm={handleCloseTokenForm}
                            onTokenReceived={handleWidgetTokenReceived}
                            pendingResult={pendingResult}
                            onSuccess={handlePaymentSuccess}
                            onBack={() => { setStep('plans'); setSelectedPlan(null); setPendingResult(null); setShowTokenForm(false); setSelectedMethod(null); }}
                        />
                    )}

                    {step === 'plans' && (
                        <PlansStep
                            plans={plans}
                            currentPlanName={sub?.plan?.name}
                            onSelect={handleSelectPlan}
                            onBack={() => setStep('view')}
                        />
                    )}

                    {step === 'view' && (
                        <>
                            <ViewStep
                                sub={sub}
                                usage={usage}
                                onShowPlans={() => setStep('plans')}
                                onStopAutoRenew={handleStopAutoRenew}
                                onCancel={handleCancel}
                                actionLoading={actionLoading}
                            />
                            <SavedPaymentMethodsSection
                                onSubscriptionUpdated={loadData}
                            />
                        </>
                    )}
                </PageBlock>
            </PageLayout>
        </Page>
    );
}
