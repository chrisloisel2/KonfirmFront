export interface OperationalKpis {
  dossiersAujourdhui: number;
  attenteValidation: number;
  enCours: number;
  exceptionsEnAttente: number;
  scoringCritique: number;
  tauxValidation: number;
  mesExceptions: number;
}

export interface MonitoringSummary {
  activeSubscriptions: number;
  subscriptionsExpiringSoon: number;
  paymentsPendingReview: number;
  availableActivationKeys: number;
  redeemedActivationKeys: number;
  monthlyRecurringRevenueCents: number;
  revenueLast30DaysCents: number;
}

export interface SubscriptionItem {
  id: string;
  companyName: string;
  plan: string;
  billingCycle: string;
  status: string;
  priceCents: number;
  currency: string;
  seats: number;
  currentPeriodEnd: string;
  owner?: { firstName?: string; lastName?: string; email?: string };
}

export interface PaymentItem {
  id: string;
  reference: string;
  amountCents: number;
  currency: string;
  status: string;
  method: string;
  description?: string;
  paidAt?: string;
  subscription?: { companyName?: string; plan?: string; status?: string };
  user?: { firstName?: string; lastName?: string; email?: string };
}

export interface ActivationKeyItem {
  id: string;
  code: string;
  label?: string;
  plan: string;
  billingCycle: string;
  priceCents: number;
  currency: string;
  status: string;
  isRedeemed: boolean;
  redeemedAt?: string;
  redeemedByUser?: { firstName?: string; lastName?: string; email?: string };
}

export interface DashboardPayload {
  kpis: OperationalKpis;
  monitoring: MonitoringSummary;
  recentDossiers: Array<{
    id: string;
    numero: string;
    status: string;
    typeOuverture: string;
    montantInitial: number | null;
    client: string;
    updatedAt: string;
  }>;
  subscriptions: SubscriptionItem[];
  recentPayments: PaymentItem[];
  activationKeys: ActivationKeyItem[];
}

export const EMPTY_DATA: DashboardPayload = {
  kpis: {
    dossiersAujourdhui: 0,
    attenteValidation: 0,
    enCours: 0,
    exceptionsEnAttente: 0,
    scoringCritique: 0,
    tauxValidation: 0,
    mesExceptions: 0,
  },
  monitoring: {
    activeSubscriptions: 0,
    subscriptionsExpiringSoon: 0,
    paymentsPendingReview: 0,
    availableActivationKeys: 0,
    redeemedActivationKeys: 0,
    monthlyRecurringRevenueCents: 0,
    revenueLast30DaysCents: 0,
  },
  recentDossiers: [],
  subscriptions: [],
  recentPayments: [],
  activationKeys: [],
};
