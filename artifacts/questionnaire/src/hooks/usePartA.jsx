import { useState } from 'react';
import Field from '../components/Field.jsx';
import SectionHeader from '../components/SectionHeader.jsx';
import SectionLabel from '../components/SectionLabel.jsx';
import InfoBox from '../components/InfoBox.jsx';
import { C } from '../constants/colors.js';
import { useValidation } from '../utils/useValidation.js';
import { validatePage } from '../utils/validation.js';

const REFERRAL_OPTS = [
  'Previous Client', 'Referral — Accountant', 'Referral — Financial Planner',
  'Referral — Solicitor', 'Referral — Family/Friend', 'Referral — Real Estate Agent',
  'Google Search', 'Website', 'Social Media', 'Other',
];
const STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];
const SALUTATIONS = ['Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Prof', 'Rev', 'Mx', 'Other'];
const GENDERS = ['Male', 'Female', 'Non-binary', 'Prefer not to say', 'Other'];
const REL_STATUS = ['Single', 'Married', 'De Facto', 'Separated', 'Divorced', 'Widowed'];
const BDBN_OPTS = ['Yes — Lapsing', 'Yes — Non-Lapsing', 'No', 'Unsure'];
const RATE_TYPES = ['Fixed', 'Variable', 'Split', 'Interest Only', 'Other'];
const PROPERTY_TYPES = ['Residential Home', 'Investment Property', 'Vacant Land', 'Commercial', 'Rural', 'Other'];
const OWNERSHIP_TYPES = ['Sole', 'Joint Tenants', 'Tenants in Common', 'Other'];
const ACCOUNT_TYPES = ['Savings', 'Transaction/Cheque', 'Term Deposit', 'Offset', 'Other'];
const LOAN_TYPES = ['Personal Loan', 'Car Loan', 'Credit Card', 'Buy Now Pay Later', 'Student Loan', 'Other'];

function newItem(fields) {
  return { id: Date.now().toString(36) + Math.random().toString(36).slice(2), ...fields };
}

function PersonalDetailsPage({ prefix, D, update, label, ge }) {
  const c = D[prefix] || {};
  const set = (key, val) => update({ ...D, [prefix]: { ...c, [key]: val } });
  const isC1 = prefix === 'c1';
  return (
    <>
      <SectionHeader icon="👤" title={label} />
      <SectionLabel text="Name" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0 16px' }}>
        <Field label="Title" type="select" opts={SALUTATIONS} value={c.salut} onChange={v => set('salut', v)} required error={ge(`${prefix}.salut`)} />
        <Field label="First Name" value={c.first} onChange={v => set('first', v)} required error={ge(`${prefix}.first`)} />
        <Field label="Middle Name" value={c.middle} onChange={v => set('middle', v)} />
        <Field label="Last Name" value={c.last} onChange={v => set('last', v)} required error={ge(`${prefix}.last`)} />
        <Field label="Preferred Name / Nickname" value={c.nick} onChange={v => set('nick', v)} />
      </div>
      <SectionLabel text="Identity" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0 16px' }}>
        <Field label="Date of Birth" type="date" format="dob" value={c.dob} onChange={v => set('dob', v)} required error={ge(`${prefix}.dob`)} />
        <Field label="Place of Birth" value={c.pob} onChange={v => set('pob', v)} required error={ge(`${prefix}.pob`)} />
        <Field label="Gender" type="select" opts={GENDERS} value={c.gender} onChange={v => set('gender', v)} required error={ge(`${prefix}.gender`)} />
        <Field label="Citizenship" value={c.citizen} onChange={v => set('citizen', v)} required error={ge(`${prefix}.citizen`)} />
      </div>
      <Field label="Permanent Resident of Australia?" type="radio" opts={['Yes', 'No']} value={c.pr} onChange={v => set('pr', v)} required error={ge(`${prefix}.pr`)} />
      <SectionLabel text="Contact" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0 16px' }}>
        <Field label="Email Address" type="email" value={c.email} onChange={v => set('email', v)} required error={ge(`${prefix}.email`)} />
        <Field label="Mobile Number" type="tel" format="mobile" value={c.mobile} onChange={v => set('mobile', v)} required error={ge(`${prefix}.mobile`)} />
        <Field label="Home Phone" type="tel" value={c.homePhone} onChange={v => set('homePhone', v)} />
      </div>
      <Field label="Residential Address" value={c.addr} onChange={v => set('addr', v)} required error={ge(`${prefix}.addr`)} />
      <Field label="Is postal address the same as residential?" type="radio" opts={['Yes', 'No']} value={c.postalSame} onChange={v => set('postalSame', v)} required error={ge(`${prefix}.postalSame`)} />
      {c.postalSame === 'No' && (
        <Field label="Postal Address" value={c.postal} onChange={v => set('postal', v)} required error={ge(`${prefix}.postal`)} />
      )}
      <SectionLabel text="Employment" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0 16px' }}>
        <Field label="Occupation" value={c.occ} onChange={v => set('occ', v)} required error={ge(`${prefix}.occ`)}
          placeholder="Enter occupation, or 'Retired' / 'Student' if applicable" />
        <Field label="Employer or Business Name" value={c.employer} onChange={v => set('employer', v)} required error={ge(`${prefix}.employer`)}
          placeholder="Enter employer, or 'Self-employed' / 'N/A'" />
      </div>
      <SectionLabel text="Relationship" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0 16px' }}>
        <Field label="Relationship Status" type="select" opts={REL_STATUS} value={c.relStatus} onChange={v => set('relStatus', v)} required error={ge(`${prefix}.relStatus`)} />
        <Field label="Approximate date of relationship (if applicable)" type="date" value={c.relDate} onChange={v => set('relDate', v)} required error={ge(`${prefix}.relDate`)}
          sub="Enter approximate date, or any past date if not in a relationship" />
      </div>
      <Field label="Full name of partner/spouse (if applicable)" value={c.partnerName} onChange={v => set('partnerName', v)} />
      <Field label="Prior marriages or de facto relationships?" type="radio" opts={['Yes', 'No']} value={c.priorRel} onChange={v => set('priorRel', v)} required error={ge(`${prefix}.priorRel`)} />
      {c.priorRel === 'Yes' && (
        <>
          <Field label="Prior relationship details" type="textarea" rows={2} value={c.priorRelDetail} onChange={v => set('priorRelDetail', v)} required error={ge(`${prefix}.priorRelDetail`)} />
          <Field label="Are there children from a prior relationship?" type="radio" opts={['Yes', 'No']} value={c.priorRelChildren} onChange={v => set('priorRelChildren', v)} required error={ge(`${prefix}.priorRelChildren`)} />
        </>
      )}
      <SectionLabel text="Other" />
      <Field label="Religious or cultural considerations" value={c.religion} onChange={v => set('religion', v)} required error={ge(`${prefix}.religion`)}
        placeholder="Enter details, or type 'None' if not applicable" />
      <Field label="Interpreter required?" type="radio" opts={['Yes', 'No']} value={c.interpreter} onChange={v => set('interpreter', v)} required error={ge(`${prefix}.interpreter`)} />
      <Field label="Any concerns about legal capacity?" type="radio"
        opts={['No — full capacity', 'Some concerns', 'Please discuss']}
        value={c.capacity} onChange={v => set('capacity', v)} required error={ge(`${prefix}.capacity`)} />
      {c.capacity && c.capacity !== 'No — full capacity' && (
        <Field label="Capacity details" type="textarea" rows={2} value={c.capacityDetail} onChange={v => set('capacityDetail', v)} required error={ge(`${prefix}.capacityDetail`)} />
      )}
    </>
  );
}

export function usePartA(aData, setAData) {
  const [pg, setPg] = useState(0);
  const [visited, setVisited] = useState(new Set([0]));
  const { errors, setErrors, hasError, getError, clearErrors } = useValidation();

  const isCouple = (aData.engType || '').startsWith('Couple');
  const discLevel = aData.disclosureLevel;

  const allPages = [
    { key: 'welcome',    title: 'Welcome'               },
    { key: 'c1personal', title: 'C1 — Personal Details'  },
    ...(isCouple ? [{ key: 'c2personal', title: 'C2 — Personal Details' }] : []),
    { key: 'children',   title: 'Children'              },
    { key: 'family',     title: 'Family Background'     },
    { key: 'disclosure', title: 'Disclosure Preference' },
    ...(discLevel === 'full' ? [
      { key: 'c1property',    title: 'C1 — Property'                    },
      { key: 'c1financial',   title: 'C1 — Financial Assets'            },
      { key: 'c1super',       title: 'C1 — Superannuation'              },
      { key: 'c1liabilities', title: 'C1 — Other Assets & Liabilities'  },
      ...(isCouple ? [
        { key: 'c2property',    title: 'C2 — Property'                   },
        { key: 'c2financial',   title: 'C2 — Financial Assets'           },
        { key: 'c2super',       title: 'C2 — Superannuation'             },
        { key: 'c2liabilities', title: 'C2 — Other Assets & Liabilities' },
      ] : []),
    ] : []),
    ...(discLevel === 'summary' ? [{ key: 'summary', title: 'Financial Summary' }] : []),
    { key: 'partAsummary', title: '✦ Part A Complete' },
  ];

  const safePg = Math.min(pg, allPages.length - 1);
  const title = allPages[safePg]?.title || '';

  const goTo = (idx) => {
    clearErrors();
    setPg(idx);
    setVisited(v => new Set([...v, idx]));
  };

  const u = (data) => setAData(data);
  const update = (key, val) => setAData(prev => ({ ...prev, [key]: val }));
  const ge = getError;

  const handleNext = (aD, bD, cD, dD) => {
    const pageErrors = validatePage(allPages[safePg]?.key || '', aD, bD, cD, dD);
    if (pageErrors.length > 0) {
      setErrors(pageErrors);
      document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
      return false;
    }
    clearErrors();
    setPg(p => p + 1);
    setVisited(v => new Set([...v, safePg + 1]));
    return true;
  };

  function renderPage() {
    const key = allPages[safePg]?.key;
    switch (key) {
      case 'welcome':      return renderWelcome();
      case 'c1personal':   return <PersonalDetailsPage prefix="c1" D={aData} update={u} label="Client 1 — Personal Details" ge={ge} />;
      case 'c2personal':   return <PersonalDetailsPage prefix="c2" D={aData} update={u} label="Client 2 — Personal Details" ge={ge} />;
      case 'children':     return renderChildren();
      case 'family':       return renderFamily();
      case 'disclosure':   return renderDisclosure();
      case 'c1property':   return renderProperty('c1', 'Client 1 — Property');
      case 'c1financial':  return renderFinancial('c1', 'Client 1 — Financial Assets');
      case 'c1super':      return renderSuper('c1', 'Client 1 — Superannuation');
      case 'c1liabilities': return renderLiabilities('c1', 'Client 1 — Other Assets & Liabilities');
      case 'c2property':   return renderProperty('c2', 'Client 2 — Property');
      case 'c2financial':  return renderFinancial('c2', 'Client 2 — Financial Assets');
      case 'c2super':      return renderSuper('c2', 'Client 2 — Superannuation');
      case 'c2liabilities': return renderLiabilities('c2', 'Client 2 — Other Assets & Liabilities');
      case 'summary':      return renderSummary();
      case 'partAsummary': return renderPartSummary();
      default: return null;
    }
  }

  function renderWelcome() {
    const showRef = (aData.referral || '').startsWith('Referral');
    return (
      <>
        <SectionHeader icon="🐚" title="Welcome to St Ives Law" sub="Estate Planning Questionnaire — Part A: Identity, Family & Assets" />
        <InfoBox>
          <strong>About this questionnaire</strong><br />
          This form collects the information we need to prepare your estate planning documents. Please complete all sections as fully as possible. You can navigate between pages using the Back and Next buttons, or click any page in the sidebar.
        </InfoBox>
        <Field label="Engagement Type" type="radio"
          opts={['Single Client', 'Couple (Joint Matter)', 'Couple (Separate Matters)']}
          value={aData.engType} onChange={v => update('engType', v)} required error={ge('engType')} />
        <Field label="State / Territory" type="select" opts={STATES} value={aData.state || 'NSW'} onChange={v => update('state', v)} required error={ge('state')} />
        <Field label="How did you hear about us?" type="select" opts={REFERRAL_OPTS} value={aData.referral} onChange={v => update('referral', v)} required error={ge('referral')} />
        {showRef && (
          <>
            <SectionLabel text="Referrer Details" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0 16px' }}>
              <Field label="Referrer First Name" value={aData.refFirst} onChange={v => update('refFirst', v)} required error={ge('refFirst')} />
              <Field label="Referrer Last Name" value={aData.refLast} onChange={v => update('refLast', v)} required error={ge('refLast')} />
              <Field label="Referrer Firm / Organisation" value={aData.refFirm} onChange={v => update('refFirm', v)} required error={ge('refFirm')} />
              <Field label="Referrer Phone" type="tel" value={aData.refPhone} onChange={v => update('refPhone', v)} required error={ge('refPhone')} />
              <Field label="Referrer Email" type="email" value={aData.refEmail} onChange={v => update('refEmail', v)} required error={ge('refEmail')} />
            </div>
          </>
        )}
        <Field label="Preferred contact method" type="radio" opts={['Email', 'Phone Call', 'Video Call', 'Post']}
          value={aData.contactPref} onChange={v => update('contactPref', v)} required error={ge('contactPref')} />
        <Field label="Is this matter urgent?" type="radio" opts={['Yes', 'No']}
          value={aData.urgent} onChange={v => update('urgent', v)} required error={ge('urgent')} />
        {aData.urgent === 'Yes' && (
          <Field label="Please describe the urgency" type="textarea" value={aData.urgentDetail}
            onChange={v => update('urgentDetail', v)} required error={ge('urgentDetail')} />
        )}
      </>
    );
  }

  function renderChildren() {
    const showSameQ = isCouple;
    const useSeparate = isCouple && aData.sameChildren === 'No';

    function renderChildList(listKey, countKey) {
      const children = aData[listKey] || [];
      const setCount = (n) => {
        const c = Math.max(0, Math.min(20, parseInt(n, 10) || 0));
        let arr = [...children];
        while (arr.length < c) arr.push(newItem({ salut: '', first: '', middle: '', last: '', dob: '', rel: 'Biological', special: '' }));
        arr = arr.slice(0, c);
        u({ ...aData, [countKey]: c, [listKey]: arr });
      };
      const upChild = (idx, key, val) => {
        const arr = children.map((ch, i) => i === idx ? { ...ch, [key]: val } : ch);
        u({ ...aData, [listKey]: arr });
      };
      return (
        <>
          <Field label="Number of children" type="number" value={aData[countKey] || ''}
            onChange={setCount} error={ge(countKey)} />
          {children.map((ch, idx) => (
            <div key={ch.id || idx} style={{ border: `1px solid ${C.bgBorder}`, borderRadius: 6, padding: '14px 16px', marginBottom: 12, background: C.bg }}>
              <SectionLabel text={`Child ${idx + 1}`} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0 16px' }}>
                <Field label="Title" type="select" opts={SALUTATIONS} value={ch.salut} onChange={v => upChild(idx, 'salut', v)} />
                <Field label="First Name" value={ch.first} onChange={v => upChild(idx, 'first', v)} error={ge(`child_${idx}_first`)} />
                <Field label="Middle Name" value={ch.middle} onChange={v => upChild(idx, 'middle', v)} />
                <Field label="Last Name" value={ch.last} onChange={v => upChild(idx, 'last', v)} error={ge(`child_${idx}_last`)} />
                <Field label="Date of Birth" type="date" value={ch.dob} onChange={v => upChild(idx, 'dob', v)} error={ge(`child_${idx}_dob`)} />
                <Field label="Relationship Type" type="select" opts={['Biological', 'Adopted', 'Step-child', 'Other']}
                  value={ch.rel} onChange={v => upChild(idx, 'rel', v)} error={ge(`child_${idx}_rel`)} />
                <Field label="Special needs / disability" type="select"
                  opts={['None', 'Physical', 'Intellectual', 'Mental Health', 'Other']}
                  value={ch.special} onChange={v => upChild(idx, 'special', v)} error={ge(`child_${idx}_special`)} />
              </div>
            </div>
          ))}
        </>
      );
    }

    return (
      <>
        <SectionHeader icon="👨‍👩‍👧" title="Children & Dependants" />
        <Field label="Do you have any children?" type="radio" opts={['Yes', 'No']}
          value={aData.hasChildren} onChange={v => u({ ...aData, hasChildren: v })} error={ge('hasChildren')} />
        {aData.hasChildren === 'Yes' && (
          <>
            {showSameQ && (
              <Field label="Do Client 1 and Client 2 have the same children?" type="radio" opts={['Yes', 'No']}
                name="same_children"
                value={aData.sameChildren} onChange={v => u({ ...aData, sameChildren: v })} error={ge('sameChildren')} />
            )}
            {(!showSameQ || aData.sameChildren === 'Yes') && renderChildList('childJoint', 'childJointCount')}
            {useSeparate && (
              <>
                <SectionLabel text="Children of Client 1" />
                {renderChildList('c1Children', 'c1ChildrenCount')}
                <SectionLabel text="Children of Client 2" />
                {renderChildList('c2Children', 'c2ChildrenCount')}
              </>
            )}
            <Field label="Do you have or expect grandchildren?" type="radio" opts={['Yes', 'No']}
              value={aData.grandchildren} onChange={v => u({ ...aData, grandchildren: v })} error={ge('grandchildren')} />
            {aData.grandchildren === 'Yes' && (
              <Field label="Grandchildren details" type="textarea" value={aData.grandchildrenDetail}
                onChange={v => u({ ...aData, grandchildrenDetail: v })} error={ge('grandchildrenDetail')} />
            )}
          </>
        )}
        <Field label="Are there any other persons financially dependent on you?" type="radio" opts={['Yes', 'No']}
          value={aData.otherDependants} onChange={v => u({ ...aData, otherDependants: v })} error={ge('otherDependants')} />
        {aData.otherDependants === 'Yes' && (
          <Field label="Other dependant details" type="textarea" value={aData.otherDependantsDetail}
            onChange={v => u({ ...aData, otherDependantsDetail: v })} error={ge('otherDependantsDetail')} />
        )}
      </>
    );
  }

  function renderFamily() {
    return (
      <>
        <SectionHeader icon="🌳" title="Family Background" />
        <SectionLabel text="Client 1 Parents" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0 16px' }}>
          <Field label="Father's full name" value={aData.c1FatherName} onChange={v => update('c1FatherName', v)} required error={ge('c1FatherName')} placeholder="Enter name, or 'Unknown'" />
          <Field label="Is father still living?" type="radio" opts={['Yes', 'No', 'Unknown']} name="c1_father_alive" value={aData.c1FatherAlive} onChange={v => update('c1FatherAlive', v)} required error={ge('c1FatherAlive')} />
          <Field label="Mother's full name (incl. maiden name)" value={aData.c1MotherName} onChange={v => update('c1MotherName', v)} required error={ge('c1MotherName')} placeholder="Enter name, or 'Unknown'" />
          <Field label="Is mother still living?" type="radio" opts={['Yes', 'No', 'Unknown']} name="c1_mother_alive" value={aData.c1MotherAlive} onChange={v => update('c1MotherAlive', v)} required error={ge('c1MotherAlive')} />
        </div>
        {isCouple && (
          <>
            <SectionLabel text="Client 2 Parents" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0 16px' }}>
              <Field label="Father's full name" value={aData.c2FatherName} onChange={v => update('c2FatherName', v)} required error={ge('c2FatherName')} placeholder="Enter name, or 'Unknown'" />
              <Field label="Is father still living?" type="radio" opts={['Yes', 'No', 'Unknown']} name="c2_father_alive" value={aData.c2FatherAlive} onChange={v => update('c2FatherAlive', v)} required error={ge('c2FatherAlive')} />
              <Field label="Mother's full name (incl. maiden name)" value={aData.c2MotherName} onChange={v => update('c2MotherName', v)} required error={ge('c2MotherName')} placeholder="Enter name, or 'Unknown'" />
              <Field label="Is mother still living?" type="radio" opts={['Yes', 'No', 'Unknown']} name="c2_mother_alive" value={aData.c2MotherAlive} onChange={v => update('c2MotherAlive', v)} required error={ge('c2MotherAlive')} />
            </div>
          </>
        )}
        <SectionLabel text="Family Provision Risk" />
        <Field label="Is there a risk of a family provision claim against your estate?" type="radio" opts={['Yes', 'No', 'Unsure']}
          value={aData.familyProvisionRisk} onChange={v => update('familyProvisionRisk', v)} required error={ge('familyProvisionRisk')} />
        {aData.familyProvisionRisk === 'Yes' && (
          <Field label="Please provide details" type="textarea" value={aData.familyProvisionDetail}
            onChange={v => update('familyProvisionDetail', v)} required error={ge('familyProvisionDetail')} />
        )}
      </>
    );
  }

  function renderDisclosure() {
    return (
      <>
        <SectionHeader icon="💼" title="Disclosure Preference" sub="How much financial detail would you like to provide today?" />
        <InfoBox>The level of detail you provide helps us tailor your estate plan. You can always update this information at your appointment.</InfoBox>
        <Field label="Financial disclosure preference" type="radio"
          opts={[
            { value: 'full',    label: 'Full Disclosure — I will provide detailed asset and liability information' },
            { value: 'summary', label: 'Summary Only — I will provide approximate totals'                        },
            { value: 'discuss', label: 'Prefer to Discuss — I will bring this information to my appointment'     },
          ]}
          value={aData.disclosureLevel} onChange={v => update('disclosureLevel', v)} required error={ge('disclosureLevel')} />
      </>
    );
  }

  function renderProperty(px, label) {
    const hasKey = `${px}HasProperty`, cntKey = `${px}PropCount`, lstKey = `${px}Props`;
    const props = aData[lstKey] || [];
    const setCount = (n) => {
      const c = Math.max(0, Math.min(20, parseInt(n, 10) || 0));
      let arr = [...props];
      while (arr.length < c) arr.push(newItem({ addr: '', type: '', ownership: '', estValue: '', year: '' }));
      arr = arr.slice(0, c);
      u({ ...aData, [cntKey]: c, [lstKey]: arr });
    };
    const upProp = (idx, key, val) => u({ ...aData, [lstKey]: props.map((p, i) => i === idx ? { ...p, [key]: val } : p) });
    return (
      <>
        <SectionHeader icon="🏠" title={label} />
        <Field label="Do you own any real property?" type="radio" opts={['Yes', 'No']}
          value={aData[hasKey]} onChange={v => update(hasKey, v)} required error={ge(hasKey)} />
        {aData[hasKey] === 'Yes' && (
          <>
            <Field label="Number of properties" type="number" value={aData[cntKey] || ''}
              onChange={setCount} required error={ge(cntKey)} />
            {props.map((prop, idx) => (
              <div key={prop.id} style={{ border: `1px solid ${C.bgBorder}`, borderRadius: 6, padding: '14px 16px', marginBottom: 12, background: C.bg }}>
                <SectionLabel text={`Property ${idx + 1}`} />
                <Field label="Property Address" value={prop.addr} onChange={v => upProp(idx, 'addr', v)} required error={ge(`property_${idx}_addr`)} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0 16px' }}>
                  <Field label="Property Type" type="select" opts={PROPERTY_TYPES} value={prop.type} onChange={v => upProp(idx, 'type', v)} required error={ge(`property_${idx}_type`)} />
                  <Field label="Ownership Type" type="select" opts={OWNERSHIP_TYPES} value={prop.ownership} onChange={v => upProp(idx, 'ownership', v)} required error={ge(`property_${idx}_ownership`)} />
                  <Field label="Estimated Value ($)" value={prop.estValue} onChange={v => upProp(idx, 'estValue', v)} placeholder="e.g. 850,000" required error={ge(`property_${idx}_estValue`)} />
                  <Field label="Year Purchased" type="number" value={prop.year} onChange={v => upProp(idx, 'year', v)} placeholder="e.g. 2010" required error={ge(`property_${idx}_year`)} />
                </div>
              </div>
            ))}
          </>
        )}
      </>
    );
  }

  function renderFinancial(px, label) {
    const banks = aData[`${px}Banks`] || [];
    const shares = aData[`${px}Shares`] || [];
    const setBank = (n) => {
      const c = Math.max(0, Math.min(20, parseInt(n, 10) || 0));
      let arr = [...banks];
      while (arr.length < c) arr.push(newItem({ institution: '', type: '', balance: '', ownership: '' }));
      arr = arr.slice(0, c);
      u({ ...aData, [`${px}BankCount`]: c, [`${px}Banks`]: arr });
    };
    const setShare = (n) => {
      const c = Math.max(0, Math.min(20, parseInt(n, 10) || 0));
      let arr = [...shares];
      while (arr.length < c) arr.push(newItem({ platform: '', desc: '', value: '' }));
      arr = arr.slice(0, c);
      u({ ...aData, [`${px}ShareCount`]: c, [`${px}Shares`]: arr });
    };
    const upBank = (i, k, v) => u({ ...aData, [`${px}Banks`]: banks.map((b, j) => j === i ? { ...b, [k]: v } : b) });
    const upShare = (i, k, v) => u({ ...aData, [`${px}Shares`]: shares.map((s, j) => j === i ? { ...s, [k]: v } : s) });
    return (
      <>
        <SectionHeader icon="🏦" title={label} />
        <SectionLabel text="Bank Accounts" />
        <Field label="Do you hold any bank accounts?" type="radio" opts={['Yes', 'No']}
          value={aData[`${px}HasBank`]} onChange={v => update(`${px}HasBank`, v)} required error={ge(`${px}HasBank`)} />
        {aData[`${px}HasBank`] === 'Yes' && (
          <>
            <Field label="Number of bank accounts" type="number" value={aData[`${px}BankCount`] ?? ''}
              onChange={setBank} required error={ge(`${px}BankCount`)} />
            {banks.map((bank, idx) => (
              <div key={bank.id} style={{ border: `1px solid ${C.bgBorder}`, borderRadius: 6, padding: '14px 16px', marginBottom: 12, background: C.bg }}>
                <SectionLabel text={`Account ${idx + 1}`} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0 16px' }}>
                  <Field label="Institution" value={bank.institution} onChange={v => upBank(idx, 'institution', v)} required error={ge(`bank_account_${idx}_institution`)} />
                  <Field label="Account Type" type="select" opts={ACCOUNT_TYPES} value={bank.type} onChange={v => upBank(idx, 'type', v)} required error={ge(`bank_account_${idx}_type`)} />
                  <Field label="Balance ($)" value={bank.balance} onChange={v => upBank(idx, 'balance', v)} required error={ge(`bank_account_${idx}_balance`)} />
                  <Field label="Ownership" type="select" opts={['Sole', 'Joint']} value={bank.ownership} onChange={v => upBank(idx, 'ownership', v)} required error={ge(`bank_account_${idx}_ownership`)} />
                </div>
              </div>
            ))}
          </>
        )}
        <SectionLabel text="Shares & Investments" />
        <Field label="Do you hold any shares or investments?" type="radio" opts={['Yes', 'No']}
          value={aData[`${px}HasShares`]} onChange={v => update(`${px}HasShares`, v)} required error={ge(`${px}HasShares`)} />
        {aData[`${px}HasShares`] === 'Yes' && (
          <>
            <Field label="Number of share portfolios / investment accounts" type="number" value={aData[`${px}ShareCount`] ?? ''}
              onChange={setShare} required error={ge(`${px}ShareCount`)} />
            {shares.map((share, idx) => (
              <div key={share.id} style={{ border: `1px solid ${C.bgBorder}`, borderRadius: 6, padding: '14px 16px', marginBottom: 12, background: C.bg }}>
                <SectionLabel text={`Portfolio ${idx + 1}`} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0 16px' }}>
                  <Field label="Platform / Broker" value={share.platform} onChange={v => upShare(idx, 'platform', v)} required error={ge(`share_portfolio_${idx}_platform`)} />
                  <Field label="Description" value={share.desc} onChange={v => upShare(idx, 'desc', v)} required error={ge(`share_portfolio_${idx}_desc`)} />
                  <Field label="Approximate Value ($)" value={share.value} onChange={v => upShare(idx, 'value', v)} required error={ge(`share_portfolio_${idx}_value`)} />
                </div>
              </div>
            ))}
          </>
        )}
        <SectionLabel text="Other Assets" />
        <Field label="Do you hold any cryptocurrency?" type="radio" opts={['Yes', 'No']}
          value={aData[`${px}HasCrypto`]} onChange={v => update(`${px}HasCrypto`, v)} required error={ge(`${px}HasCrypto`)} />
        {aData[`${px}HasCrypto`] === 'Yes' && (
          <Field label="Cryptocurrency details (type, platform, approx. value)" type="textarea"
            value={aData[`${px}CryptoDetail`]} onChange={v => update(`${px}CryptoDetail`, v)} required error={ge(`${px}CryptoDetail`)} />
        )}
        <Field label="Do you hold any foreign assets?" type="radio" opts={['Yes', 'No']}
          value={aData[`${px}ForeignAssets`]} onChange={v => update(`${px}ForeignAssets`, v)} required error={ge(`${px}ForeignAssets`)} />
        {aData[`${px}ForeignAssets`] === 'Yes' && (
          <Field label="Foreign asset details (type, country, approx. value)" type="textarea"
            value={aData[`${px}ForeignDetail`]} onChange={v => update(`${px}ForeignDetail`, v)} required error={ge(`${px}ForeignDetail`)} />
        )}
      </>
    );
  }

  function renderSuper(px, label) {
    const funds = aData[`${px}Supers`] || [];
    const setCount = (n) => {
      const c = Math.max(0, Math.min(20, parseInt(n, 10) || 0));
      let arr = [...funds];
      while (arr.length < c) arr.push(newItem({ fundName: '', abn: '', balance: '', bdbn: '' }));
      arr = arr.slice(0, c);
      u({ ...aData, [`${px}SuperCount`]: c, [`${px}Supers`]: arr });
    };
    const upSuper = (i, k, v) => u({ ...aData, [`${px}Supers`]: funds.map((f, j) => j === i ? { ...f, [k]: v } : f) });
    return (
      <>
        <SectionHeader icon="🏛" title={label} />
        <InfoBox>Superannuation does not automatically form part of your estate. Binding Death Benefit Nominations (BDBNs) direct where your super goes on death.</InfoBox>
        <Field label="Do you hold any superannuation?" type="radio" opts={['Yes', 'No']}
          value={aData[`${px}HasSuper`]} onChange={v => update(`${px}HasSuper`, v)} required error={ge(`${px}HasSuper`)} />
        {aData[`${px}HasSuper`] === 'Yes' && (
          <>
            <Field label="Number of super funds" type="number" value={aData[`${px}SuperCount`] ?? ''}
              onChange={setCount} required error={ge(`${px}SuperCount`)} />
            {funds.map((f, idx) => (
              <div key={f.id} style={{ border: `1px solid ${C.bgBorder}`, borderRadius: 6, padding: '14px 16px', marginBottom: 12, background: C.bg }}>
                <SectionLabel text={`Fund ${idx + 1}`} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0 16px' }}>
                  <Field label="Fund Name" value={f.fundName} onChange={v => upSuper(idx, 'fundName', v)} required error={ge(`super_fund_${idx}_fundName`)} />
                  <Field label="Fund ABN" value={f.abn} onChange={v => upSuper(idx, 'abn', v)} required error={ge(`super_fund_${idx}_abn`)} />
                  <Field label="Balance ($)" value={f.balance} onChange={v => upSuper(idx, 'balance', v)} required error={ge(`super_fund_${idx}_balance`)} />
                  <Field label="BDBN Status" type="select" opts={BDBN_OPTS} value={f.bdbn} onChange={v => upSuper(idx, 'bdbn', v)} required error={ge(`super_fund_${idx}_bdbn`)} />
                </div>
              </div>
            ))}
          </>
        )}
      </>
    );
  }

  function renderLiabilities(px, label) {
    const morts = aData[`${px}Morts`] || [];
    const loans = aData[`${px}Loans`] || [];
    const setMort = (n) => {
      const c = Math.max(0, Math.min(20, parseInt(n, 10) || 0));
      let arr = [...morts];
      while (arr.length < c) arr.push(newItem({ lender: '', prop: '', balance: '', rate: '' }));
      arr = arr.slice(0, c);
      u({ ...aData, [`${px}MortCount`]: c, [`${px}Morts`]: arr });
    };
    const setLoan = (n) => {
      const c = Math.max(0, Math.min(20, parseInt(n, 10) || 0));
      let arr = [...loans];
      while (arr.length < c) arr.push(newItem({ lender: '', type: '', balance: '' }));
      arr = arr.slice(0, c);
      u({ ...aData, [`${px}LoanCount`]: c, [`${px}Loans`]: arr });
    };
    const upMort = (i, k, v) => u({ ...aData, [`${px}Morts`]: morts.map((m, j) => j === i ? { ...m, [k]: v } : m) });
    const upLoan = (i, k, v) => u({ ...aData, [`${px}Loans`]: loans.map((l, j) => j === i ? { ...l, [k]: v } : l) });
    return (
      <>
        <SectionHeader icon="📋" title={label} />
        <Field label="Other assets (vehicles, jewellery, art, etc.) — describe or enter 'None'" type="textarea" rows={2}
          value={aData[`${px}OtherAssetNotes`]} onChange={v => update(`${px}OtherAssetNotes`, v)} required
          placeholder="Enter details, or type 'None' if not applicable"
          error={ge(`${px}OtherAssetNotes`)} />
        <SectionLabel text="Mortgages" />
        <Field label="Are you subject to any mortgages?" type="radio" opts={['Yes', 'No']}
          value={aData[`${px}HasMortgages`]} onChange={v => update(`${px}HasMortgages`, v)} required error={ge(`${px}HasMortgages`)} />
        {aData[`${px}HasMortgages`] === 'Yes' && (
          <>
            <Field label="Number of mortgages" type="number" value={aData[`${px}MortCount`] ?? ''}
              onChange={setMort} required error={ge(`${px}MortCount`)} />
            {morts.map((m, idx) => (
              <div key={m.id} style={{ border: `1px solid ${C.bgBorder}`, borderRadius: 6, padding: '14px 16px', marginBottom: 12, background: C.bg }}>
                <SectionLabel text={`Mortgage ${idx + 1}`} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0 16px' }}>
                  <Field label="Lender" value={m.lender} onChange={v => upMort(idx, 'lender', v)} required error={ge(`mortgage_${idx}_lender`)} />
                  <Field label="Secured Property" value={m.prop} onChange={v => upMort(idx, 'prop', v)} required error={ge(`mortgage_${idx}_prop`)} />
                  <Field label="Balance ($)" value={m.balance} onChange={v => upMort(idx, 'balance', v)} required error={ge(`mortgage_${idx}_balance`)} />
                  <Field label="Rate Type" type="select" opts={RATE_TYPES} value={m.rate} onChange={v => upMort(idx, 'rate', v)} required error={ge(`mortgage_${idx}_rate`)} />
                </div>
              </div>
            ))}
          </>
        )}
        <SectionLabel text="Personal Loans" />
        <Field label="Are you subject to debt by way of personal loans or credit cards?" type="radio" opts={['Yes', 'No']}
          value={aData[`${px}HasLoans`]} onChange={v => update(`${px}HasLoans`, v)} required error={ge(`${px}HasLoans`)} />
        {aData[`${px}HasLoans`] === 'Yes' && (
          <>
            <Field label="Number of loans / credit cards" type="number" value={aData[`${px}LoanCount`] ?? ''}
              onChange={setLoan} required error={ge(`${px}LoanCount`)} />
            {loans.map((l, idx) => (
              <div key={l.id} style={{ border: `1px solid ${C.bgBorder}`, borderRadius: 6, padding: '14px 16px', marginBottom: 12, background: C.bg }}>
                <SectionLabel text={`Loan ${idx + 1}`} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0 16px' }}>
                  <Field label="Lender" value={l.lender} onChange={v => upLoan(idx, 'lender', v)} required error={ge(`loan_${idx}_lender`)} />
                  <Field label="Type" type="select" opts={LOAN_TYPES} value={l.type} onChange={v => upLoan(idx, 'type', v)} required error={ge(`loan_${idx}_type`)} />
                  <Field label="Balance ($)" value={l.balance} onChange={v => upLoan(idx, 'balance', v)} required error={ge(`loan_${idx}_balance`)} />
                </div>
              </div>
            ))}
          </>
        )}
        <SectionLabel text="Guarantees" />
        <Field label="Have you provided any personal guarantees?" type="radio" opts={['Yes', 'No']}
          value={aData[`${px}Guarantees`]} onChange={v => update(`${px}Guarantees`, v)} required error={ge(`${px}Guarantees`)} />
        {aData[`${px}Guarantees`] === 'Yes' && (
          <Field label="Guarantee details" type="textarea" value={aData[`${px}GuaranteeDetail`]}
            onChange={v => update(`${px}GuaranteeDetail`, v)} required error={ge(`${px}GuaranteeDetail`)} />
        )}
      </>
    );
  }

  function renderSummary() {
    const tot = { c1: {}, c2: {} };
    const setTot = (px, key, val) => u({ ...aData, [`${px}${key}`]: val });
    const rows = [
      { label: 'Total Real Property',      key: 'PropTotal'  },
      { label: 'Total Bank / Cash',         key: 'BankTotal'  },
      { label: 'Total Shares / Investments',key: 'ShareTotal' },
      { label: 'Total Other Assets',        key: 'OtherTotal' },
      { label: 'Total Debts / Liabilities', key: 'DebtTotal'  },
    ];
    const cols = isCouple ? ['c1', 'c2'] : ['c1'];
    const labels = isCouple ? ['Client 1', 'Client 2'] : ['Client 1'];
    const thStyle = { padding: '8px 10px', fontFamily: C.fontBody, fontSize: 12, fontWeight: 700, color: C.white, background: C.teal, textAlign: 'left' };
    const tdStyle = { padding: '6px 8px', borderBottom: `1px solid ${C.bgBorder}` };
    return (
      <>
        <SectionHeader icon="📊" title="Financial Summary" sub="Please provide approximate totals for your assets and liabilities." />
        <InfoBox>Please enter approximate amounts in Australian dollars. You can enter '0' if you have none.</InfoBox>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: C.fontBody, fontSize: 13 }}>
            <thead>
              <tr>
                <th style={thStyle}>Category</th>
                {labels.map(l => <th key={l} style={thStyle}>{l} ($)</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.key}>
                  <td style={{ ...tdStyle, fontWeight: 600, color: error => C.text }}>{row.label}</td>
                  {cols.map(px => (
                    <td key={px} style={tdStyle}>
                      <input type="text" value={aData[`${px}${row.key}`] ?? ''}
                        onChange={e => setTot(px, row.key, e.target.value)}
                        placeholder="0"
                        style={{ width: '100%', border: `1px solid ${ge(`${px}${row.key}`) ? C.red : C.border}`, borderRadius: 4, padding: '4px 6px', fontFamily: C.fontBody, fontSize: 13, color: C.text, background: ge(`${px}${row.key}`) ? '#fff5f5' : C.white }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  function renderPartSummary() {
    return (
      <div style={{ textAlign: 'center', padding: '32px 16px' }}>
        <div style={{ background: C.greenL, border: `1px solid ${C.green}`, borderRadius: 8, padding: '28px 32px', display: 'inline-block', maxWidth: 480, textAlign: 'left' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
          <h3 style={{ fontFamily: C.fontHeading, color: C.green, margin: '0 0 10px', fontWeight: 'normal', fontSize: 20 }}>Part A Complete</h3>
          <p style={{ fontFamily: C.fontBody, fontSize: 14, color: C.text, margin: 0, lineHeight: 1.6 }}>
            You have completed Part A — Identity, Family &amp; Assets. Click <strong>Proceed</strong> to continue with Part B.
          </p>
        </div>
      </div>
    );
  }

  return {
    pages: allPages, pg: safePg, setPg: goTo, handleNext,
    total: allPages.length,
    pct: Math.round(((safePg + 1) / allPages.length) * 100),
    title, visited, renderPage,
    errors, hasError, getError, clearErrors,
  };
}
