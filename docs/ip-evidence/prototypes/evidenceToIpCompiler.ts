export type IpClass = 'patent' | 'copyright' | 'design' | 'trademark' | 'trade_secret' | 'contract' | 'release_evidence';
export type ClaimStatus = 'private_disclosure' | 'public_safe' | 'evidence_gated' | 'official_receipt_required' | 'not_supported';

export interface EvidenceItem {
  evidenceId: string;
  title: string;
  sourceType: string;
  url?: string | null;
  repo?: string | null;
  path?: string | null;
  sha?: string | null;
  familyIds: string[];
  ipClasses: IpClass[];
  claimStatus: ClaimStatus;
  rightsStatus: string;
  disclosureStatus: string;
  ownerEntity: string;
  verifiedAt: string;
  notes?: string | null;
}

export interface FamilyPacket {
  familyId: string;
  evidence: EvidenceItem[];
  publicSafeEvidence: EvidenceItem[];
  evidenceGatedItems: EvidenceItem[];
  officialReceiptRequiredItems: EvidenceItem[];
  openRightsItems: EvidenceItem[];
}

export function compileEvidenceForFamily(familyId: string, evidenceItems: EvidenceItem[]): FamilyPacket {
  const evidence = evidenceItems.filter((item) => item.familyIds.includes(familyId));

  return {
    familyId,
    evidence,
    publicSafeEvidence: evidence.filter((item) => item.claimStatus === 'public_safe'),
    evidenceGatedItems: evidence.filter((item) => item.claimStatus === 'evidence_gated'),
    officialReceiptRequiredItems: evidence.filter((item) => item.claimStatus === 'official_receipt_required'),
    openRightsItems: evidence.filter((item) => !['founder_created', 'official_receipt_attached'].includes(item.rightsStatus)),
  };
}

export function summarizeFamilyPacket(packet: FamilyPacket): string {
  return [
    `Family: ${packet.familyId}`,
    `Evidence items: ${packet.evidence.length}`,
    `Public-safe items: ${packet.publicSafeEvidence.length}`,
    `Evidence-gated items: ${packet.evidenceGatedItems.length}`,
    `Official receipt required: ${packet.officialReceiptRequiredItems.length}`,
    `Open rights review: ${packet.openRightsItems.length}`,
  ].join('\n');
}

export function assertNoUnsupportedPublicClaims(packet: FamilyPacket): void {
  const unsafe = packet.evidence.filter((item) =>
    item.claimStatus === 'not_supported' || item.claimStatus === 'official_receipt_required' || item.claimStatus === 'evidence_gated'
  );

  if (unsafe.length > 0) {
    throw new Error(
      `Family ${packet.familyId} has ${unsafe.length} evidence-gated or unsupported item(s); keep public claims downgraded until receipts exist.`
    );
  }
}
