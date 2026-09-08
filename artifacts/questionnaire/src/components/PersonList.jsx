import { C } from '../constants/colors.js';
import { RELATIONSHIP_OPTIONS } from '../constants/relationshipOptions.js';
import Field from './Field.jsx';
import SectionLabel from './SectionLabel.jsx';

function newPerson() {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    salut: '', first: '', middle: '', last: '', nick: '',
    dob: '', rel: '', email: '', mobile: '', addr: '', agreed: '',
  };
}

export default function PersonList({ countLabel, D, update, noun = 'Person', nounKey, showDOB, showNick, showAgreed, showAddr, countError, getError }) {
  const list = D.list || [];
  const ge = getError || (() => null);
  const key = nounKey || noun.toLowerCase().replace(/\s+/g, '_');

  const setCount = (n) => {
    const count = Math.max(0, Math.min(20, parseInt(n, 10) || 0));
    let newList = [...list];
    while (newList.length < count) newList.push(newPerson());
    newList = newList.slice(0, count);
    update({ ...D, count, list: newList });
  };

  const updateItem = (idx, field, val) => {
    const newList = list.map((item, i) => i === idx ? { ...item, [field]: val } : item);
    update({ ...D, list: newList });
  };

  const cardStyle = {
    border: `1px solid ${C.bgBorder}`,
    borderRadius: 6,
    padding: '14px 16px',
    marginBottom: 12,
    background: C.bg,
  };

  return (
    <div>
      <Field
        label={countLabel || `Number of ${noun}s`}
        type="number"
        value={D.count || ''}
        onChange={setCount}
        placeholder="0"
        error={countError}
        required
      />
      {list.map((person, idx) => (
        <div key={person.id} style={cardStyle}>
          <SectionLabel text={`${noun} ${idx + 1}`} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0 16px' }}>
            <Field label="Title" type="select" opts={['Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Prof', 'Rev', 'Other']}
              value={person.salut} onChange={v => updateItem(idx, 'salut', v)} />
            <Field label="First Name" value={person.first} onChange={v => updateItem(idx, 'first', v)} required
              error={ge(`${key}_${idx}_first`)} />
            <Field label="Middle Name" value={person.middle} onChange={v => updateItem(idx, 'middle', v)} />
            <Field label="Last Name" value={person.last} onChange={v => updateItem(idx, 'last', v)} required
              error={ge(`${key}_${idx}_last`)} />
            {showNick && (
              <Field label="Preferred Name" value={person.nick} onChange={v => updateItem(idx, 'nick', v)} />
            )}
            {showDOB && (
              <Field label="Date of Birth" type="date" value={person.dob} onChange={v => updateItem(idx, 'dob', v)} />
            )}
            <Field label="Relationship" type="select" opts={RELATIONSHIP_OPTIONS}
              value={person.rel} onChange={v => updateItem(idx, 'rel', v)} required
              error={ge(`${key}_${idx}_rel`)} />
            <Field label="Email" type="email" value={person.email} onChange={v => updateItem(idx, 'email', v)} required
              error={ge(`${key}_${idx}_email`)} />
            <Field label="Mobile" type="tel" format="mobile" value={person.mobile} onChange={v => updateItem(idx, 'mobile', v)} required
              error={ge(`${key}_${idx}_mobile`)} />
          </div>
          {showAddr && (
            <Field label="Address" value={person.addr} onChange={v => updateItem(idx, 'addr', v)} required
              error={ge(`${key}_${idx}_addr`)} />
          )}
          {showAgreed && (
            <Field label="Has this person agreed to act?" type="radio" opts={['Yes', 'No', 'Not yet asked']}
              name={`${key}_${idx}_agreed`}
              value={person.agreed} onChange={v => updateItem(idx, 'agreed', v)}
              error={ge(`${key}_${idx}_agreed`)} />
          )}
        </div>
      ))}
    </div>
  );
}
