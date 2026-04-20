// Types pour l'application de conformité LCB-FT selon roadmap.md

// ─── Settings / Company ───────────────────────────────────────────────────────

export type SubscriptionPlan = 'STARTER' | 'BUSINESS' | 'ENTERPRISE';
export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'SUSPENDED';

export interface Subscription {
	id: string;
	plan: SubscriptionPlan;
	status: SubscriptionStatus;
	maxAccounts: number;
	maxShops: number;
	features: string[];
	startDate: string;
	expiresAt?: string | null;
}

export interface Company {
	id: string;
	name: string;
	siret?: string;
	address?: string;
	city?: string;
	logoUrl?: string;
	subscription?: Subscription | null;
	createdAt: string;
}

export interface Shop {
	id: string;
	name: string;
	code?: string;
	address?: string;
	city?: string;
	isActive: boolean;
	companyId: string;
	users?: AccountUser[];
	createdAt: string;
}

export interface AccountUser {
	id: string;
	email: string;
	firstName: string;
	lastName: string;
	role: string;
	isActive: boolean;
	isBlocked?: boolean;
	lastLogin?: string | null;
	shopIds: string[];
	shops?: { id: string; name: string; code?: string }[];
	createdAt: string;
}

export interface CompanyUsage {
	accounts: number;
	shops: number;
}

// ─── Existing types ───────────────────────────────────────────────────────────

export interface User {
	id: string;
	email: string;
	role: UserRole;
	firstName?: string;
	lastName?: string;
	companyName?: string;
	branch?: string;
	isActive?: boolean;
	permissions?: string[];
	lastLogin?: string | null;
}

export type UserRole =
	| 'conseiller'
	| 'caisse'
	| 'referent'
	| 'responsable'
	| 'admin';

export interface Dossier {
	id: string;
	type: 'achat' | 'vente';
	clientType: 'physique' | 'moral';
	montant: number;
	status: DossierStatus;
	clientId?: string;
	seuil: SeuilType;
	vigilanceType: VigilanceType;
	createdAt: Date;
	updatedAt: Date;
}

export type DossierStatus =
	| 'draft'
	| 'collecting'
	| 'researching'
	| 'scoring'
	| 'auto_validated'
	| 'escalated'
	| 'blocked'
	| 'under_review'
	| 'validated'
	| 'archived';

export type SeuilType =
	| 'none'           // < 10k
	| 'standard'       // 10k-15k
	| 'reinforced';    // > 15k

export type VigilanceType =
	| 'standard'
	| 'reinforced'
	| 'enhanced';

export interface Client {
	id: string;
	type: 'physique' | 'moral';
	nom: string;
	prenom?: string;
	dateNaissance?: Date;
	nationalite: string;
	adresse: Address;
	residenceFiscale: string;
	sourceFonds: string;
	relationAffaires: boolean;
	isPPE: boolean;
	riskScore: number;
}

export interface Address {
	rue: string;
	ville: string;
	codePostal: string;
	pays: string;
}

export interface Document {
	id: string;
	type: 'cni' | 'passeport' | 'autre';
	recto: string;      // URI de l'image
	verso?: string;     // URI de l'image
	ocrData: OCRData;
	isValid: boolean;
	expirationDate: Date;
}

export interface OCRData {
	nom: string;
	prenom: string;
	dateNaissance: Date;
	nationalite: string;
	numeroDocument: string;
	dateExpiration: Date;
	confidence: number; // Score de confiance OCR 0-1
}

export interface Recherche {
	id: string;
	dossierId: string;
	type: RechercheType;
	status: RechercheStatus;
	result: any;
	confidence: number;
	executedAt: Date;
	source: string;
}

export type RechercheType =
	| 'ppe'
	| 'sanctions'
	| 'gel_avoirs'
	| 'pays_liste'
	| 'reputation'
	| 'beneficiaires_effectifs';

export type RechercheStatus =
	| 'pending'
	| 'success'
	| 'failed'
	| 'escalated';

export interface ScoringResult {
	id: string;
	dossierId: string;
	scorePPE: number;
	scorePays: number;
	scoreReputation: number;
	scoreSignaux: number;
	scoreFinal: number;
	decision: DecisionType;
	justification: string;
	calculatedAt: Date;
}

export type DecisionType =
	| 'auto_validated'
	| 'vigilance_renforcee'
	| 'examen_renforce'
	| 'escalade'
	| 'blocage';

export interface Exception {
	id: string;
	dossierId: string;
	type: ExceptionType;
	description: string;
	status: 'pending' | 'resolved' | 'escalated';
	assignedTo?: string;
	createdAt: Date;
}

export type ExceptionType =
	| 'ppe'
	| 'gel_avoirs'
	| 'document_expire'
	| 'tiers_payeur'
	| 'absence_mandat'
	| 'be_incoherent';

export interface AuditLog {
	id: string;
	dossierId: string;
	userId: string;
	action: string;
	details: any;
	timestamp: Date;
	ipAddress?: string;
}

// Navigation types
export type RootStackParamList = {
	Splash: undefined;
	Login: undefined;
	SignUp: undefined;
	RoleSelection: undefined;
	BranchSelection: undefined;
	Dashboard: undefined;
	NewDossier: undefined;
	DocumentCapture: { docType: 'cni' | 'passeport' };
	OCRResult: { docId: string };
	ResearchHub: { dossierId: string };
	Scoring: { dossierId: string };
	Exceptions: { exceptionId: string };
};

// API Response types
export interface ApiResponse<T> {
	success: boolean;
	data?: T;
	error?: string;
	message?: string;
}

export interface LoginResponse {
	token: string;
	sessionId?: string;
	refreshToken?: string;
	user: User;
}

export interface SignupResponse extends LoginResponse {
	subscription?: {
		id: string;
		plan: string;
		billingCycle: string;
		status: string;
		currentPeriodEnd: string;
	};
}
