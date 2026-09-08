import { C } from '../constants/colors.js';

// ─── Primitives ───────────────────────────────────────────────────────────────

function fmt(v) { return v || '—'; }

function fmtDate(v) {
  if (!v) return '—';
  try {
    const [y, m, d] = v.split('-');
    if (!y || !m || !d) return v;
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
  } catch { return v; }
}

function PartHeader({ icon, title }) {
  return (
    <div style={{
      background: C.tealD, color: C.white, padding: '10px 16px', borderRadius: 6,
      marginTop: 28, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10,
    }}>
      {icon && <span style={{ fontSize: 18 }}>{icon}</span>}
      <span style={{ fontFamily: C.fontHeading, fontSize: 15, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {title}
      </span>
    </div>
  );
}

function SubHead({ title }) {
  return (
    <div style={{
      fontFamily: C.fontHeading, fontSize: 13, fontWeight: 700, color: C.teal,
      borderBottom: `2px solid ${C.bgBorder}`, paddingBottom: 4,
      marginTop: 18, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>
      {title}
    </div>
  );
}

function Row({ label, value }) {
  const v = Array.isArray(value) ? value.join(', ') : value;
  if (!v && v !== 0) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.textL, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, color: C.text, lineHeight: 1.5, wordBreak: 'break-word' }}>{v}</div>
    </div>
  );
}

function RowGrid({ children }) {
  return (
    <div className="summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0 24px' }}>
      {children}
    </div>
  );
}

function ItemCard({ title, children }) {
  return (
    <div style={{ border: `1px solid ${C.bgBorder}`, borderRadius: 6, padding: '12px 14px', marginBottom: 10, background: C.bg }}>
      {title && (
        <div style={{ fontSize: 12, fontWeight: 700, color: C.teal, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

function PersonCard({ person, idx, noun, showDOB, showAddr, showAgreed }) {
  if (!person) return null;
  const name = [person.salut, person.first, person.middle, person.last].filter(Boolean).join(' ');
  return (
    <ItemCard title={`${noun || 'Person'} ${idx + 1}${name ? ' — ' + name : ''}`}>
      <RowGrid>
        <Row label="Full Name" value={name || '—'} />
        {person.nick && <Row label="Preferred Name" value={person.nick} />}
        {showDOB && <Row label="Date of Birth" value={fmtDate(person.dob)} />}
        <Row label="Relationship" value={fmt(person.rel)} />
        <Row label="Email" value={fmt(person.email)} />
        <Row label="Mobile" value={fmt(person.mobile)} />
        {showAddr && <Row label="Address" value={fmt(person.addr)} />}
        {showAgreed && <Row label="Has agreed to act?" value={fmt(person.agreed)} />}
      </RowGrid>
    </ItemCard>
  );
}

function ScenSummary({ scen, scenLabel }) {
  if (!scen) return null;
  const gifts = scen.gifts || [];
  const resBenes = scen.resBenes || [];
  const giftCount = parseInt(scen.giftCount || 0);
  const resBeneCount = parseInt(scen.resBeneCount || 0);

  return (
    <div>
      {scenLabel && (
        <div style={{ background: C.slatePale, border: `1px solid ${C.slateL}`, borderRadius: 4, padding: '6px 12px', marginBottom: 10, fontSize: 13, color: C.teal, fontFamily: C.fontBody, fontWeight: 600 }}>
          {scenLabel}
        </div>
      )}
      <Row label="Specific gifts?" value={fmt(scen.hasGifts)} />
      {scen.hasGifts === 'Yes' && gifts.slice(0, giftCount).map((g, i) => (
        <ItemCard key={i} title={`Gift ${i + 1}`}>
          <RowGrid>
            <Row label="Beneficiary" value={[g.bFirst, g.bLast].filter(Boolean).join(' ')} />
            <Row label="Relationship" value={fmt(g.bRel)} />
            <Row label="Address" value={fmt(g.bAddr)} />
            <Row label="Description" value={fmt(g.desc)} />
            <Row label="Substitute gift?" value={fmt(g.hasSub)} />
            {g.hasSub === 'Yes' && <Row label="Substitute description" value={fmt(g.subDesc)} />}
          </RowGrid>
        </ItemCard>
      ))}
      <Row label="Number of residuary beneficiaries" value={fmt(scen.resBeneCount)} />
      {resBenes.slice(0, resBeneCount).map((r, i) => (
        <ItemCard key={i} title={`Residuary Beneficiary ${i + 1}`}>
          <RowGrid>
            <Row label="Name" value={[r.first, r.last].filter(Boolean).join(' ')} />
            <Row label="Relationship" value={fmt(r.rel)} />
            <Row label="Address" value={fmt(r.addr)} />
            <Row label="% of Residue" value={r.pct ? `${r.pct}%` : '—'} />
            <Row label="Testamentary Trust?" value={fmt(r.tt)} />
          </RowGrid>
        </ItemCard>
      ))}
    </div>
  );
}

// ─── Main Summary ─────────────────────────────────────────────────────────────

export default function SummaryView({ aData, bData, cData, dData }) {
  const isCouple = (aData.engType || '').startsWith('Couple');
  const discLevel = aData.disclosureLevel;
  const showFull = discLevel === 'full';
  const showSummary = discLevel === 'summary';
  const showC2 = isCouple;

  const c1 = aData.c1 || {};
  const c2 = aData.c2 || {};
  const n1 = c1.nick || c1.first || 'Client 1';
  const n2 = c2.nick || c2.first || 'Client 2';

  const c1Name = [c1.salut, c1.first, c1.last].filter(Boolean).join(' ') || 'Client 1';
  const c2Name = [c2.salut, c2.first, c2.last].filter(Boolean).join(' ') || 'Client 2';

  const showC2Dist = isCouple && cData.mirrorWill !== 'Yes — identical terms for both';
  const hasMinorChildren = (aData.childJoint || []).some(ch => {
    if (!ch.dob) return true;
    return (new Date() - new Date(ch.dob)) / (1000 * 60 * 60 * 24 * 365.25) < 18;
  });

  function renderClientPersonal(cx, label) {
    const c = aData[cx] || {};
    return (
      <>
        <SubHead title={label} />
        <RowGrid>
          <Row label="Full Name" value={[c.salut, c.first, c.middle, c.last].filter(Boolean).join(' ')} />
          {c.nick && <Row label="Preferred Name" value={c.nick} />}
          <Row label="Date of Birth" value={fmtDate(c.dob)} />
          <Row label="Place of Birth" value={fmt(c.pob)} />
          <Row label="Gender" value={fmt(c.gender)} />
          <Row label="Citizenship" value={fmt(c.citizen)} />
          <Row label="Permanent Resident?" value={fmt(c.pr)} />
        </RowGrid>
        <RowGrid>
          <Row label="Email" value={fmt(c.email)} />
          <Row label="Mobile" value={fmt(c.mobile)} />
          {c.homePhone && <Row label="Home Phone" value={c.homePhone} />}
          <Row label="Residential Address" value={fmt(c.addr)} />
          <Row label="Postal same as residential?" value={fmt(c.postalSame)} />
          {c.postalSame === 'No' && <Row label="Postal Address" value={fmt(c.postal)} />}
        </RowGrid>
        <RowGrid>
          <Row label="Occupation" value={fmt(c.occ)} />
          <Row label="Employer / Business" value={fmt(c.employer)} />
          <Row label="Relationship Status" value={fmt(c.relStatus)} />
          <Row label="Relationship Date" value={fmtDate(c.relDate)} />
          <Row label="Prior relationships?" value={fmt(c.priorRel)} />
          {c.priorRel === 'Yes' && <Row label="Prior relationship details" value={fmt(c.priorRelDetail)} />}
          {c.priorRel === 'Yes' && <Row label="Children from prior relationship?" value={fmt(c.priorRelChildren)} />}
        </RowGrid>
        <RowGrid>
          <Row label="Religious / cultural considerations" value={fmt(c.religion)} />
          <Row label="Interpreter required?" value={fmt(c.interpreter)} />
          <Row label="Legal capacity concerns?" value={fmt(c.capacity)} />
          {c.capacityDetail && <Row label="Capacity details" value={c.capacityDetail} />}
        </RowGrid>
      </>
    );
  }

  function renderAssets(px, clientLabel) {
    const props = aData[`${px}Props`] || [];
    const propCount = parseInt(aData[`${px}PropCount`] || 0);
    const banks = aData[`${px}Banks`] || [];
    const bankCount = parseInt(aData[`${px}BankCount`] || 0);
    const shares = aData[`${px}Shares`] || [];
    const shareCount = parseInt(aData[`${px}ShareCount`] || 0);
    const supers = aData[`${px}Supers`] || [];
    const superCount = parseInt(aData[`${px}SuperCount`] || 0);
    const morts = aData[`${px}Morts`] || [];
    const mortCount = parseInt(aData[`${px}MortCount`] || 0);
    const loans = aData[`${px}Loans`] || [];
    const loanCount = parseInt(aData[`${px}LoanCount`] || 0);

    return (
      <>
        {/* Property */}
        <SubHead title={`${clientLabel} — Property`} />
        <Row label="Owns real property?" value={fmt(aData[`${px}HasProperty`])} />
        {aData[`${px}HasProperty`] === 'Yes' && props.slice(0, propCount).map((p, i) => (
          <ItemCard key={i} title={`Property ${i + 1}`}>
            <RowGrid>
              <Row label="Address" value={fmt(p.addr)} />
              <Row label="Type" value={fmt(p.type)} />
              <Row label="Ownership" value={fmt(p.ownership)} />
              <Row label="Est. Value" value={p.estValue ? `$${p.estValue}` : '—'} />
              <Row label="Year Purchased" value={fmt(p.year)} />
            </RowGrid>
          </ItemCard>
        ))}

        {/* Financial Assets */}
        <SubHead title={`${clientLabel} — Financial Assets`} />
        <Row label="Has bank accounts?" value={fmt(aData[`${px}HasBank`])} />
        {aData[`${px}HasBank`] === 'Yes' && banks.slice(0, bankCount).map((b, i) => (
          <ItemCard key={i} title={`Bank Account ${i + 1}`}>
            <RowGrid>
              <Row label="Institution" value={fmt(b.institution)} />
              <Row label="Account Type" value={fmt(b.type)} />
              <Row label="Ownership" value={fmt(b.ownership)} />
              <Row label="Balance" value={b.balance ? `$${b.balance}` : '—'} />
            </RowGrid>
          </ItemCard>
        ))}
        <Row label="Has shares / managed funds?" value={fmt(aData[`${px}HasShares`])} />
        {aData[`${px}HasShares`] === 'Yes' && shares.slice(0, shareCount).map((s, i) => (
          <ItemCard key={i} title={`Investment ${i + 1}`}>
            <RowGrid>
              <Row label="Institution / Fund" value={fmt(s.institution)} />
              <Row label="Ownership" value={fmt(s.ownership)} />
              <Row label="Est. Value" value={s.value ? `$${s.value}` : '—'} />
            </RowGrid>
          </ItemCard>
        ))}
        <Row label="Has cryptocurrency?" value={fmt(aData[`${px}HasCrypto`])} />
        {aData[`${px}HasCrypto`] === 'Yes' && aData[`${px}CryptoDetail`] && (
          <Row label="Crypto details" value={aData[`${px}CryptoDetail`]} />
        )}
        <Row label="Foreign assets?" value={fmt(aData[`${px}ForeignAssets`])} />
        {aData[`${px}ForeignAssets`] === 'Yes' && aData[`${px}ForeignDetail`] && (
          <Row label="Foreign asset details" value={aData[`${px}ForeignDetail`]} />
        )}

        {/* Superannuation */}
        <SubHead title={`${clientLabel} — Superannuation`} />
        <Row label="Has superannuation?" value={fmt(aData[`${px}HasSuper`])} />
        {aData[`${px}HasSuper`] === 'Yes' && supers.slice(0, superCount).map((s, i) => (
          <ItemCard key={i} title={`Super Fund ${i + 1}`}>
            <RowGrid>
              <Row label="Fund Name" value={fmt(s.fund)} />
              <Row label="Balance" value={s.balance ? `$${s.balance}` : '—'} />
              <Row label="Binding Death Nomination?" value={fmt(s.bdbn)} />
              <Row label="Nomination Type" value={fmt(s.bdbnType)} />
            </RowGrid>
          </ItemCard>
        ))}

        {/* Liabilities */}
        <SubHead title={`${clientLabel} — Liabilities`} />
        <Row label="Has mortgages?" value={fmt(aData[`${px}HasMortgages`])} />
        {aData[`${px}HasMortgages`] === 'Yes' && morts.slice(0, mortCount).map((m, i) => (
          <ItemCard key={i} title={`Mortgage ${i + 1}`}>
            <RowGrid>
              <Row label="Lender" value={fmt(m.lender)} />
              <Row label="Property" value={fmt(m.property)} />
              <Row label="Rate Type" value={fmt(m.rateType)} />
              <Row label="Balance Owing" value={m.balance ? `$${m.balance}` : '—'} />
            </RowGrid>
          </ItemCard>
        ))}
        <Row label="Has other loans?" value={fmt(aData[`${px}HasLoans`])} />
        {aData[`${px}HasLoans`] === 'Yes' && loans.slice(0, loanCount).map((l, i) => (
          <ItemCard key={i} title={`Loan ${i + 1}`}>
            <RowGrid>
              <Row label="Type" value={fmt(l.type)} />
              <Row label="Lender" value={fmt(l.lender)} />
              <Row label="Balance" value={l.balance ? `$${l.balance}` : '—'} />
            </RowGrid>
          </ItemCard>
        ))}
        <Row label="Guarantees / contingent liabilities?" value={fmt(aData[`${px}Guarantees`])} />
        {aData[`${px}Guarantees`] === 'Yes' && aData[`${px}GuaranteeDetail`] && (
          <Row label="Guarantee details" value={aData[`${px}GuaranteeDetail`]} />
        )}
        {aData[`${px}OtherAssetNotes`] && (
          <Row label="Other asset notes" value={aData[`${px}OtherAssetNotes`]} />
        )}
      </>
    );
  }

  function renderClientBiz(px, label) {
    const bizList = bData[`${px}Businesses`] || [];
    const bizCount = parseInt(bData[`${px}BizCount`] || 0);
    const trustList = bData[`${px}Trusts`] || [];
    const trustCount = parseInt(bData[`${px}TrustCount`] || 0);

    return (
      <>
        <SubHead title={`${label} — Business Interests`} />
        <Row label="Has business interests?" value={fmt(bData[`${px}HasBiz`])} />
        {bData[`${px}HasBiz`] === 'Yes' && bizList.slice(0, bizCount).map((b, i) => (
          <ItemCard key={i} title={`Business ${i + 1}`}>
            <RowGrid>
              <Row label="Business Name" value={fmt(b.name)} />
              <Row label="Structure" value={fmt(b.structure)} />
              <Row label="ACN / ABN" value={fmt(b.acn)} />
              <Row label="Net Value" value={b.netValue ? `$${b.netValue}` : '—'} />
            </RowGrid>
          </ItemCard>
        ))}

        <SubHead title={`${label} — Trusts`} />
        <Row label="Involved in any trusts?" value={fmt(bData[`${px}HasTrusts`])} />
        {bData[`${px}HasTrusts`] === 'Yes' && trustList.slice(0, trustCount).map((t, i) => (
          <ItemCard key={i} title={`Trust ${i + 1}`}>
            <RowGrid>
              <Row label="Trust Name" value={fmt(t.name)} />
              <Row label="Trust Type" value={fmt(t.type)} />
              <Row label="Net Value" value={t.netValue ? `$${t.netValue}` : '—'} />
            </RowGrid>
          </ItemCard>
        ))}

        <SubHead title={`${label} — SMSF`} />
        <Row label="Has an SMSF?" value={fmt(bData[`${px}HasSmsf`])} />
      </>
    );
  }

  function renderInsurance(px, label) {
    const policies = bData[`${px}Life`] || [];
    const policyCount = parseInt(bData[`${px}LifeCount`] || 0);
    return (
      <>
        <SubHead title={`${label} — Insurance`} />
        <Row label="Has insurance?" value={fmt(bData[`${px}HasIns`])} />
        {bData[`${px}HasIns`] === 'Yes' && (
          <>
            {policies.slice(0, policyCount).map((p, i) => (
              <ItemCard key={i} title={`Life / TPD Policy ${i + 1}`}>
                <RowGrid>
                  <Row label="Insurer" value={fmt(p.insurer)} />
                  <Row label="Sum Insured" value={p.cover ? `$${p.cover}` : '—'} />
                  <Row label="Held inside super?" value={fmt(p.heldInSuper)} />
                  <Row label="Binding nomination?" value={fmt(p.beneFixed)} />
                </RowGrid>
              </ItemCard>
            ))}
            <RowGrid>
              <Row label="Number of Trauma policies" value={fmt(bData[`${px}TraumaCount`])} />
              <Row label="Number of Income Protection policies" value={fmt(bData[`${px}IncomeCount`])} />
            </RowGrid>
          </>
        )}
      </>
    );
  }

  function renderEpa(px, clientName) {
    const epaHealth = dData[`${px}EpaHealth`];
    const epaFin = dData[`${px}EpaFin`];
    const healthAtts = dData[`${px}HealthAtts`] || [];
    const healthAttCount = parseInt(dData[`${px}HealthAttCount`] || 0);
    const finAtts = dData[`${px}FinAtts`] || [];
    const finAttCount = parseInt(dData[`${px}FinAttCount`] || 0);
    const hasEpaHealth = (epaHealth || '').startsWith('Yes');
    const hasEpaFin = (epaFin || '').startsWith('Yes');

    return (
      <>
        <SubHead title={`${clientName} — EPA: Health & Personal`} />
        <Row label="EPA for health decisions" value={fmt(epaHealth)} />
        {hasEpaHealth && healthAtts.slice(0, healthAttCount).map((p, i) => (
          <PersonCard key={i} person={p} idx={i} noun="Health Attorney" showAddr showAgreed />
        ))}

        <SubHead title={`${clientName} — Medical & End of Life`} />
        <Row label="Advance Health Directive?" value={fmt(dData[`${px}Ahd`])} />
        <Row label="Life-sustaining treatment" value={fmt(dData[`${px}LifeSustaining`])} />
        <Row label="Organ donation" value={fmt(dData[`${px}OrganDonation`])} />

        <SubHead title={`${clientName} — EPA: Financial`} />
        <Row label="EPA for financial decisions" value={fmt(epaFin)} />
        {hasEpaFin && <Row label="When does EPA take effect?" value={fmt(dData[`${px}EpaFinTrigger`])} />}
        {hasEpaFin && finAtts.slice(0, finAttCount).map((p, i) => (
          <PersonCard key={i} person={p} idx={i} noun="Financial Attorney" showAddr showAgreed />
        ))}

        <SubHead title={`${clientName} — Funeral & Legacy Wishes`} />
        <Row label="Burial / Cremation preference" value={fmt(dData[`${px}BurialPref`])} />
        <Row label="Religious / cultural observances" value={fmt(dData[`${px}FuneralReligion`])} />
        <Row label="Legacy wishes" value={fmt(dData[`${px}Legacy`])} />
      </>
    );
  }

  return (
    <div style={{ fontFamily: C.fontBody }}>

      {/* ── PART A ── */}
      <PartHeader icon="👤" title="Part A — Identity, Family & Assets" />

      <SubHead title="Engagement Details" />
      <RowGrid>
        <Row label="Engagement Type" value={fmt(aData.engType)} />
        <Row label="State / Territory" value={fmt(aData.state)} />
        <Row label="How did you hear about us?" value={fmt(aData.referral)} />
        <Row label="Preferred contact method" value={fmt(aData.contactPref)} />
        <Row label="Urgent matter?" value={fmt(aData.urgent)} />
        {aData.urgentDetail && <Row label="Urgency details" value={aData.urgentDetail} />}
      </RowGrid>
      {(aData.referral || '').startsWith('Referral') && (
        <>
          <SubHead title="Referrer Details" />
          <RowGrid>
            <Row label="Name" value={[aData.refFirst, aData.refLast].filter(Boolean).join(' ')} />
            <Row label="Firm / Organisation" value={fmt(aData.refFirm)} />
            <Row label="Phone" value={fmt(aData.refPhone)} />
            <Row label="Email" value={fmt(aData.refEmail)} />
          </RowGrid>
        </>
      )}

      {renderClientPersonal('c1', `Client 1 — ${c1Name}`)}
      {showC2 && renderClientPersonal('c2', `Client 2 — ${c2Name}`)}

      <SubHead title="Children & Dependants" />
      <Row label="Has children?" value={fmt(aData.hasChildren)} />
      {aData.hasChildren === 'Yes' && (aData.childJoint || []).map((ch, i) => (
        <ItemCard key={i} title={`Child ${i + 1}`}>
          <RowGrid>
            <Row label="Name" value={[ch.salut, ch.first, ch.middle, ch.last].filter(Boolean).join(' ')} />
            <Row label="Date of Birth" value={fmtDate(ch.dob)} />
            <Row label="Relationship Type" value={fmt(ch.rel)} />
            <Row label="Special needs?" value={fmt(ch.special)} />
          </RowGrid>
        </ItemCard>
      ))}
      {aData.hasChildren === 'Yes' && <Row label="Grandchildren?" value={fmt(aData.grandchildren)} />}
      {aData.grandchildren === 'Yes' && <Row label="Grandchildren details" value={fmt(aData.grandchildrenDetail)} />}
      <Row label="Other financial dependants?" value={fmt(aData.otherDependants)} />
      {aData.otherDependants === 'Yes' && <Row label="Dependant details" value={fmt(aData.otherDependantsDetail)} />}

      <SubHead title="Family Background" />
      <RowGrid>
        <Row label={`${n1} — Father's name`} value={fmt(aData.c1FatherName)} />
        <Row label={`${n1} — Father still living?`} value={fmt(aData.c1FatherAlive)} />
        <Row label={`${n1} — Mother's name`} value={fmt(aData.c1MotherName)} />
        <Row label={`${n1} — Mother still living?`} value={fmt(aData.c1MotherAlive)} />
        {showC2 && <Row label={`${n2} — Father's name`} value={fmt(aData.c2FatherName)} />}
        {showC2 && <Row label={`${n2} — Father still living?`} value={fmt(aData.c2FatherAlive)} />}
        {showC2 && <Row label={`${n2} — Mother's name`} value={fmt(aData.c2MotherName)} />}
        {showC2 && <Row label={`${n2} — Mother still living?`} value={fmt(aData.c2MotherAlive)} />}
        <Row label="Family provision claim risk?" value={fmt(aData.familyProvisionRisk)} />
        {aData.familyProvisionRisk === 'Yes' && <Row label="Details" value={fmt(aData.familyProvisionDetail)} />}
      </RowGrid>

      <SubHead title="Financial Disclosure" />
      <Row label="Disclosure preference" value={fmt(aData.disclosureLevel)} />

      {showFull && renderAssets('c1', n1)}
      {showFull && showC2 && renderAssets('c2', n2)}

      {showSummary && (
        <>
          <SubHead title="Financial Summary — Totals" />
          <RowGrid>
            <Row label={`${n1} — Property total`} value={aData.c1PropTotal ? `$${aData.c1PropTotal}` : '—'} />
            <Row label={`${n1} — Bank / cash total`} value={aData.c1BankTotal ? `$${aData.c1BankTotal}` : '—'} />
            <Row label={`${n1} — Shares / investments total`} value={aData.c1ShareTotal ? `$${aData.c1ShareTotal}` : '—'} />
            <Row label={`${n1} — Other assets total`} value={aData.c1OtherTotal ? `$${aData.c1OtherTotal}` : '—'} />
            <Row label={`${n1} — Debts total`} value={aData.c1DebtTotal ? `$${aData.c1DebtTotal}` : '—'} />
            {showC2 && <Row label={`${n2} — Property total`} value={aData.c2PropTotal ? `$${aData.c2PropTotal}` : '—'} />}
            {showC2 && <Row label={`${n2} — Bank / cash total`} value={aData.c2BankTotal ? `$${aData.c2BankTotal}` : '—'} />}
            {showC2 && <Row label={`${n2} — Shares / investments total`} value={aData.c2ShareTotal ? `$${aData.c2ShareTotal}` : '—'} />}
            {showC2 && <Row label={`${n2} — Other assets total`} value={aData.c2OtherTotal ? `$${aData.c2OtherTotal}` : '—'} />}
            {showC2 && <Row label={`${n2} — Debts total`} value={aData.c2DebtTotal ? `$${aData.c2DebtTotal}` : '—'} />}
          </RowGrid>
        </>
      )}

      {/* ── PART B ── */}
      <PartHeader icon="💼" title="Part B — Business, Trusts & Insurance" />

      {renderClientBiz('c1', n1)}
      {showC2 && renderClientBiz('c2', n2)}

      {renderInsurance('c1', n1)}
      {showC2 && renderInsurance('c2', n2)}

      <SubHead title="Professional Advisors" />
      <RowGrid>
        <Row label="Accountant / Firm" value={fmt(bData.accountant)} />
        <Row label="Accountant phone" value={fmt(bData.accountantPhone)} />
        <Row label="Accountant email" value={fmt(bData.accountantEmail)} />
        <Row label="Authority to contact accountant?" value={fmt(bData.accountantAuthority)} />
      </RowGrid>

      {/* ── PART C ── */}
      <PartHeader icon="📝" title="Part C — Wills, Beneficiaries & Executors" />

      {isCouple && (
        <>
          <SubHead title="Will Structure" />
          <Row label="Will structure preference" value={fmt(cData.mirrorWill)} />
        </>
      )}

      <SubHead title={`${n1} — Primary Distribution`} />
      <ScenSummary scen={cData.c1Scen1} scenLabel={isCouple ? `If ${n2} survives ${n1}` : 'Primary distribution'} />

      <SubHead title={`${n1} — Contingency Distribution`} />
      <ScenSummary scen={cData.c1Scen2} scenLabel={isCouple ? `If ${n2} does NOT survive ${n1}` : 'If primary beneficiaries do not survive'} />

      {showC2Dist && (
        <>
          <SubHead title={`${n2} — Primary Distribution`} />
          <ScenSummary scen={cData.c2Scen1} scenLabel={`If ${n1} survives ${n2}`} />
          <SubHead title={`${n2} — Contingency Distribution`} />
          <ScenSummary scen={cData.c2Scen2} scenLabel={`If ${n1} does NOT survive ${n2}`} />
        </>
      )}

      {Object.keys(cData.beneProfiles || {}).length > 0 && (
        <>
          <SubHead title="Beneficiary Profiles" />
          {Object.entries(cData.beneProfiles).map(([name, profile]) => (
            <ItemCard key={name} title={name}>
              <RowGrid>
                <Row label="Financial maturity" value={fmt(profile?.literacy)} />
                <Row label="Testamentary Trust?" value={fmt(profile?.needsTT)} />
              </RowGrid>
            </ItemCard>
          ))}
        </>
      )}

      <SubHead title={`${n1} — Executors`} />
      {(cData.c1Execs || []).map((p, i) => (
        <PersonCard key={i} person={p} idx={i} noun="Executor" showAddr showAgreed />
      ))}
      <Row label={`${n1} — Preferred Will storage`} value={fmt(cData.c1WillLoc)} />

      {showC2 && (
        <>
          <SubHead title={`${n2} — Executors`} />
          {(cData.c2Execs || []).map((p, i) => (
            <PersonCard key={i} person={p} idx={i} noun="Executor" showAddr showAgreed />
          ))}
          <Row label={`${n2} — Preferred Will storage`} value={fmt(cData.c2WillLoc)} />
        </>
      )}

      {hasMinorChildren && (cData.guardians || []).length > 0 && (
        <>
          <SubHead title="Guardians for Minor Children" />
          {cData.guardians.map((p, i) => (
            <PersonCard key={i} person={p} idx={i} noun="Guardian" showAddr showAgreed />
          ))}
        </>
      )}

      <SubHead title="Existing Wills" />
      <RowGrid>
        <Row label={`${n1} — Has existing Will?`} value={fmt(cData.c1HasExistingWill)} />
        {cData.c1HasExistingWill === 'Yes' && <Row label={`${n1} — Will date`} value={fmtDate(cData.c1WillDate)} />}
        {cData.c1HasExistingWill === 'Yes' && <Row label={`${n1} — Will location`} value={fmt(cData.c1WillKept)} />}
        {showC2 && <Row label={`${n2} — Has existing Will?`} value={fmt(cData.c2HasExistingWill)} />}
        {showC2 && cData.c2HasExistingWill === 'Yes' && <Row label={`${n2} — Will date`} value={fmtDate(cData.c2WillDate)} />}
        {showC2 && cData.c2HasExistingWill === 'Yes' && <Row label={`${n2} — Will location`} value={fmt(cData.c2WillKept)} />}
      </RowGrid>

      {/* ── PART D ── */}
      <PartHeader icon="📋" title="Part D — EPA, Medical Wishes & Funeral Directions" />

      {renderEpa('c1', n1)}
      {showC2 && renderEpa('c2', n2)}

      <SubHead title="Additional Information" />
      <Row label="Currently involved in litigation?" value={fmt(dData.c1Litigation)} />
      <Row label="Anything else to know?" value={fmt(dData.c1AdditionalInfo)} />

      <SubHead title="Declaration" />
      <RowGrid>
        <Row label={`${n1} — Declaration Date`} value={fmtDate(dData.c1SignDate)} />
        {showC2 && <Row label={`${n2} — Declaration Date`} value={fmtDate(dData.c2SignDate)} />}
      </RowGrid>

    </div>
  );
}
