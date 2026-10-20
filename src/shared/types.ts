export type ItemCategory = 'cutting' | 'drilling' | 'accessories' | 'holding' | 'safety';
export interface CatalogItem {
  id: string; name: string; category: ItemCategory; quantity: number;
  condition: 'ready' | 'broken' | 'late' | 'missing';
  attributes: { role: string; platform?: string; power?: 'corded' | 'battery' | 'manual'; bitSizes?: number[]; sizeMm?: number; blade?: string; requires?: string[]; outletRequired?: boolean };
}
export interface Borrower { id: string; name: string }
export interface ProjectTemplate { id: string; name: string; description: string; requirements: string[]; preferredDrill: string; durationMinutes: number }
export interface TimeRange { date: string; start: string; end: string }
export interface KitRequest extends TimeRange { project: string }
export interface Substitution { original: string; replacement: string; reason: string }
export interface Bundle {
  id: string; project: string; borrowerId: string; name: string; itemIds: string[]; items: CatalogItem[];
  substitutions: Substitution[]; bench: { id: string; name: string; outlet: boolean; date: string; start: string; end: string };
  returnDeadline: string; requiresConsent: boolean; consentReason?: string; score: number[]; request: KitRequest;
}
export interface Hold { id: string; bundle: Bundle; borrowerId: string; createdAt: string; expiresAt: string; status: 'active' | 'expired' | 'committed' | 'cancelled' }
export interface CheckInIssue { itemId: string; kind: 'missing' | 'damaged' }
export interface Booking { id: string; borrowerId: string; bundle: Bundle; status: 'booked' | 'cancelled' | 'returned'; createdAt: string; issues: { itemId: string; kind: 'broken' | 'late' | 'missing' | 'damaged'; replacementId?: string }[] }
export interface Loan { id: string; borrowerId: string; itemIds: string[]; start: string; end: string }
export interface BenchReservation extends TimeRange { id: string; borrowerId: string }
export interface WaitlistEntry { id: string; borrowerId: string; request: KitRequest; acceptsSubstitutions: boolean; status: 'waiting' | 'served'; bookingId?: string }
export interface LibraryState {
  schemaVersion: 1; libraryName: string; fictional: true; simulatedNow: string; savedAtWallTime?: number; currentBorrowerId: string;
  catalog: CatalogItem[]; borrowers: Borrower[]; templates: ProjectTemplate[];
  bench: { id: string; name: string; outlet: boolean; slotMinutes: number };
  loans: Loan[]; benchReservations: BenchReservation[]; bundles: Bundle[]; holds: Hold[]; bookings: Booking[]; waitlist: WaitlistEntry[];
  sequence: number;
}
export interface DomainResult { state: LibraryState; message: string; ok: boolean }
export interface FindResult extends DomainResult { bundles: Bundle[]; requirements: string[] }
export interface HoldResult extends DomainResult { hold?: Hold; conflicts?: string[] }
export interface CommitResult extends DomainResult { booking?: Booking; needsConsent?: boolean; consentReason?: string; conflicts?: string[]; alternatives?: Bundle[] }
export interface ReleaseResult extends DomainResult { released?: Booking; waitlistServed: Booking[] }
export interface IssueResult extends DomainResult { booking?: Booking; replacement?: CatalogItem; affectedItemId?: string; keptItemIds?: string[] }
export interface CheckInResult extends DomainResult { booking?: Booking; waitlistServed: Booking[] }
export interface CheckInRequest { bookingId: string; returnedItemIds: string[]; damagedItemIds?: string[]; missingItemIds?: string[] }
export interface Clock { now(): number }
