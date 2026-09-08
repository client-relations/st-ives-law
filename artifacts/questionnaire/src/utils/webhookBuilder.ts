// Webhook payload builder - matches the original form submission format
// Used when lawyer sends completed forms to Smokeball

function mapPerson(p: any) {
  if (!p) return null;
  return {
    title: p.salutation || p.salut || "",
    first: p.first || "",
    middle: p.middle || "",
    last: p.last || "",
    preferred_name: p.preferredName || p.nick || "",
    dob: p.dob || "",
    relationship: p.relationship || p.rel || "",
    email: p.email || "",
    mobile: p.mobile || "",
    address: p.address || p.addr || "",
    agreed_to_act: p.agreedToAct || p.agreed || "",
  };
}

function buildFinancial(prefix: string, aData: any) {
  const dl = aData.disclosureLevel || "";
  const isSummary = dl === "summary";
  return {
    disclosure_level: dl,
    properties: (aData[`${prefix}Props`] || []).map((p: any) => ({
      address: p.address || "",
      type: p.type || "",
      ownership: p.ownership || "",
      value: p.value || "",
      year_purchased: p.yearPurchased || "",
    })),
    bank_accounts: (aData[`${prefix}Banks`] || []).map((b: any) => ({
      institution: b.institution || "",
      account_type: b.accountType || "",
      balance: b.balance || "",
      ownership: b.ownership || "",
    })),
    shares: (aData[`${prefix}Shares`] || []).map((s: any) => ({
      platform: s.platform || "",
      description: s.description || "",
      value: s.value || "",
    })),
    crypto: aData[`${prefix}HasCrypto`] === "Yes"
      ? (aData[`${prefix}CryptoDetail`] || "")
      : null,
    foreign_assets: aData[`${prefix}ForeignAssets`] === "Yes"
      ? (aData[`${prefix}ForeignDetail`] || "")
      : null,
    superannuation: (aData[`${prefix}Supers`] || []).map((s: any) => ({
      fund: s.fund || "",
      abn: s.abn || "",
      balance: s.balance || "",
      bdbn: s.bdbn || "",
      nominated_beneficiary: s.nominatedBeneficiary || "",
      bdbn_expiry: s.bdbnExpiry || "",
    })),
    mortgages: (aData[`${prefix}Morts`] || []).map((m: any) => ({
      lender: m.lender || "",
      secured_property: m.securedProperty || "",
      balance: m.balance || "",
      rate_type: m.rateType || "",
    })),
    loans: (aData[`${prefix}Loans`] || []).map((l: any) => ({
      lender: l.lender || "",
      type: l.type || "",
      balance: l.balance || "",
    })),
    guarantees: aData[`${prefix}Guarantees`] === "Yes"
      ? (aData[`${prefix}GuaranteeDetail`] || "")
      : null,
    other_assets: aData[`${prefix}OtherAssetNotes`] || "",
    summary_totals: isSummary ? {
      properties: aData[`${prefix}PropTotal`] || "",
      bank: aData[`${prefix}BankTotal`] || "",
      shares: aData[`${prefix}ShareTotal`] || "",
      other: aData[`${prefix}OtherTotal`] || "",
      debt: aData[`${prefix}DebtTotal`] || "",
    } : null,
  };
}

function buildBusiness(prefix: string, bData: any) {
  return {
    businesses: (bData[`${prefix}Businesses`] || []).map((b: any) => ({
      name: b.name || "",
      structure: b.structure || "",
      acn_abn: b.acnAbn || "",
      value: b.value || "",
    })),
    trusts: (bData[`${prefix}Trusts`] || []).map((t: any) => ({
      name: t.name || "",
      type: t.type || "",
      value: t.value || "",
    })),
    smsf: bData[`${prefix}HasSmsf`] || "",
    insurance: {
      has_insurance: bData[`${prefix}HasIns`] || "",
      life_tpd: (bData[`${prefix}Life`] || []).map((p: any) => ({
        insurer: p.insurer || "",
        sum_insured: p.cover || "",
        inside_super: p.heldInSuper || "",
        binding_nomination: p.beneFixed || "",
      })),
      trauma_count: bData[`${prefix}TraumaCount`] || "",
      income_protection_count: bData[`${prefix}IncomeCount`] || "",
    },
  };
}

function buildWill(prefix: string, cData: any) {
  return {
    has_existing_will: cData[`${prefix}HasExistingWill`] || "",
    existing_will_date: cData[`${prefix}WillDate`] || "",
    existing_will_location: cData[`${prefix}WillKept`] || "",
    will_storage_preference: cData[`${prefix}WillLoc`] || "",
    executors: (cData[`${prefix}Execs`] || []).map(mapPerson),
    distribution_primary: cData[`${prefix}Scen1`] || {},
    distribution_contingency: cData[`${prefix}Scen2`] || {},
  };
}

function buildEpa(prefix: string, dData: any) {
  return {
    health_personal: dData[`${prefix}EpaHealth`] || "",
    health_attorneys: (dData[`${prefix}HealthAtts`] || []).map(mapPerson),
    financial: dData[`${prefix}EpaFin`] || "",
    financial_attorneys: (dData[`${prefix}FinAtts`] || []).map(mapPerson),
    financial_epa_trigger: dData[`${prefix}EpaFinTrigger`] || "",
    ahd: dData[`${prefix}Ahd`] || "",
    life_sustaining: dData[`${prefix}LifeSustaining`] || "",
    organ_donation: dData[`${prefix}OrganDonation`] || "",
  };
}

function buildFuneral(prefix: string, dData: any) {
  return {
    burial_preference: dData[`${prefix}BurialPref`] || "",
    religious_observances: dData[`${prefix}FuneralReligion`] || "",
    legacy_wishes: dData[`${prefix}Legacy`] || "",
  };
}

function buildClient(prefix: string, aData: any, bData: any, cData: any, dData: any) {
  const c = aData[prefix] || {};
  return {
    salutation: c.salut || "",
    first: c.first || "",
    middle: c.middle || "",
    last: c.last || "",
    preferred_name: c.nick || "",
    dob: c.dob || "",
    gender: c.gender || "",
    email: c.email || "",
    mobile: c.mobile || "",
    home_phone: c.homePhone || "",
    address: c.addr || "",
    postal_address: c.postalSame === "Yes" ? (c.addr || "") : (c.postal || ""),
    occupation: c.occ || "",
    employer: c.employer || "",
    relationship_status: c.relStatus || "",
    relationship_date: c.relDate || "",
    partner_name: c.partnerName || "",
    place_of_birth: c.pob || "",
    citizenship: c.citizen || "",
    permanent_resident: c.pr || "",
    prior_relationships: c.priorRel || "",
    prior_relationship_detail: c.priorRelDetail || "",
    prior_relationship_children: c.priorRelChildren || "",
    religion: c.religion || "",
    interpreter_required: c.interpreter || "",
    capacity: c.capacity || "",
    capacity_detail: c.capacityDetail || "",
    litigation: dData[`${prefix}Litigation`] || "",
    additional_info: dData[`${prefix}AdditionalInfo`] || "",
    declaration_date: dData[`${prefix}SignDate`] || "",
    financial: buildFinancial(prefix, aData),
    business: buildBusiness(prefix, bData),
    will: buildWill(prefix, cData),
    epa: buildEpa(prefix, dData),
    funeral: buildFuneral(prefix, dData),
  };
}

export function buildFinalPayload(aData: any, bData: any, cData: any, dData: any, sessionId: string) {
  const isCouple =
    aData.engType === "Couple (Joint Matter)" ||
    aData.engType === "Couple (Separate Matters)";

  const children =
    aData.sameChildren === "No"
      ? [...(aData.c1Children || []), ...(aData.c2Children || [])]
      : (aData.childJoint || []);

  return {
    form_version: "v3",
    submitted_at: new Date().toISOString(),
    session_id: sessionId || "",
    engagement: {
      type: aData.engType || "",
      state: aData.state || "",
      urgent: aData.urgent || "",
      urgent_detail: aData.urgentDetail || "",
      referral: aData.referral || "",
      referrer_name: [aData.refFirst, aData.refLast].filter(Boolean).join(" "),
      referrer_firm: aData.refFirm || "",
      referrer_email: aData.refEmail || "",
      referrer_phone: aData.refPhone || "",
      contact_preference: aData.contactPref || "",
    },
    client_1: buildClient("c1", aData, bData, cData, dData),
    client_2: isCouple ? buildClient("c2", aData, bData, cData, dData) : null,
    family: {
      has_children: aData.hasChildren || "",
      children: children.map((ch: any) => ({
        title: ch.salut || ch.salutation || "",
        first: ch.first || "",
        middle: ch.middle || "",
        last: ch.last || "",
        dob: ch.dob || "",
        relationship: ch.relationship || "",
        special_needs: ch.specialNeeds || "",
      })),
      client1_father: {
        name: aData.c1FatherName || "",
        living: aData.c1FatherAlive || "",
      },
      client1_mother: {
        name: aData.c1MotherName || "",
        living: aData.c1MotherAlive || "",
      },
      client2_father: isCouple ? {
        name: aData.c2FatherName || "",
        living: aData.c2FatherAlive || "",
      } : null,
      client2_mother: isCouple ? {
        name: aData.c2MotherName || "",
        living: aData.c2MotherAlive || "",
      } : null,
      other_dependants: aData.otherDependants === "Yes"
        ? (aData.otherDependantsDetail || "")
        : null,
      has_grandchildren: aData.grandchildren || "",
      grandchildren_detail: aData.grandchildren === "Yes"
        ? (aData.grandchildrenDetail || "")
        : null,
      family_provision_risk: aData.familyProvisionRisk || "",
      family_provision_detail: aData.familyProvisionDetail || "",
    },
    guardians: (cData.guardians || []).map(mapPerson),
    professional_advisors: {
      accountant: bData.accountant || "",
      accountant_phone: bData.accountantPhone || "",
      accountant_email: bData.accountantEmail || "",
      accountant_authority: bData.accountantAuthority || "",
    },
    beneficiary_profiles: cData.beneProfiles || {},
    uploaded_documents: bData.uploadedFiles || [],
  };
}
