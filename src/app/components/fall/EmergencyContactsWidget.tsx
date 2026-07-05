import { useState } from 'react';
import { UserPlus, Phone, Mail, Trash2, Pencil, Check, X } from 'lucide-react';
import type { EmergencyContact } from '../../../services/fallService';

interface Props {
  contacts: EmergencyContact[];
  onSave:   (contacts: EmergencyContact[]) => void;
}

const newId = () => (crypto?.randomUUID ? crypto.randomUUID() : `c-${Date.now()}-${Math.random().toString(36).slice(2)}`);

const inputStyle: React.CSSProperties = {
  flex: 1, minWidth: 0, padding: '10px 12px', background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(100,180,255,0.2)', borderRadius: '10px', color: '#e0f0ff',
  fontSize: '13px', outline: 'none', boxSizing: 'border-box',
};

/** Manage who gets alerted on a fall (name, phone, email + alert method). */
export function EmergencyContactsWidget({ contacts, onSave }: Props) {
  const [name, setName]   = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [pref, setPref]   = useState<'phone' | 'email' | 'both'>('both');
  const [editId, setEditId] = useState<string | null>(null);

  const reset = () => { setName(''); setPhone(''); setEmail(''); setPref('both'); setEditId(null); };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const needsPhone = pref === 'phone' || pref === 'both';
    const needsEmail = pref === 'email' || pref === 'both';

    if (needsPhone && !phone.trim()) return;
    if (needsEmail && !email.trim()) return;

    const newContact: EmergencyContact = {
      id: editId || newId(),
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      pref,
    };

    if (editId) {
      onSave(contacts.map(c => c.id === editId ? newContact : c));
    } else {
      onSave([...contacts, newContact]);
    }
    reset();
  };

  const edit = (c: EmergencyContact) => {
    setEditId(c.id);
    setName(c.name);
    setPhone(c.phone);
    setEmail(c.email || '');
    setPref(c.pref || 'both');
  };
  
  const remove = (id: string) => { onSave(contacts.filter(c => c.id !== id)); if (editId === id) reset(); };

  const showPhoneRequired = pref === 'phone' || pref === 'both';
  const showEmailRequired = pref === 'email' || pref === 'both';

  return (
    <div style={{ background: 'rgba(8,20,50,0.75)', backdropFilter: 'blur(20px)', border: '1px solid rgba(100,180,255,0.15)', borderRadius: '20px', padding: '22px' }}>
      <style>{`.ec-icon-btn:hover{ background:rgba(255,255,255,0.1)!important; }`}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <UserPlus size={18} color="#f43f5e" />
          <div>
            <p style={{ color: 'rgba(180,210,255,0.45)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 1px' }}>Who to alert</p>
            <p style={{ color: '#e0f0ff', fontWeight: 700, fontSize: '15px', margin: 0 }}>Emergency Contacts</p>
          </div>
        </div>
        <span style={{ color: 'rgba(180,210,255,0.4)', fontSize: '12px' }}>{contacts.length} saved</span>
      </div>

      {/* Add / edit form */}
      <form onSubmit={submit} style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <select value={pref} onChange={e => setPref(e.target.value as any)} style={{ ...inputStyle, flex: '1 1 100%', cursor: 'pointer', background: 'rgba(255,255,255,0.06)' }}>
          <option value="both" style={{ background: '#0a1428', color: '#e0f0ff' }}>Alert Method: Both Phone & Email</option>
          <option value="phone" style={{ background: '#0a1428', color: '#e0f0ff' }}>Alert Method: Phone Only</option>
          <option value="email" style={{ background: '#0a1428', color: '#e0f0ff' }}>Alert Method: Email Only</option>
        </select>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Name" style={inputStyle} />
        <input value={phone} onChange={e => setPhone(e.target.value)} placeholder={showPhoneRequired ? "Phone" : "Phone (optional)"} type="tel" style={inputStyle} />
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder={showEmailRequired ? "Email" : "Email (optional)"} type="email" style={{ ...inputStyle, flex: '1 1 100%' }} />
        <button type="submit" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', background: editId ? 'linear-gradient(135deg,#38bdf8,#0ea5e9)' : 'linear-gradient(135deg,#f43f5e,#e11d48)', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer', flexShrink: 0 }}>
          {editId ? <><Check size={15} /> Update</> : <><UserPlus size={15} /> Add</>}
        </button>
        {editId && (
          <button type="button" onClick={reset} className="ec-icon-btn" style={{ padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(100,180,255,0.2)', borderRadius: '10px', color: 'rgba(180,210,255,0.7)', cursor: 'pointer', display: 'flex' }}>
            <X size={15} />
          </button>
        )}
      </form>
      <p style={{ color: 'rgba(180,210,255,0.35)', fontSize: '11px', margin: '-6px 0 14px', lineHeight: 1.5 }}>
        Choose an alert method to set required fields. Email alerts will be sent via Novu when a fall is confirmed.
      </p>

      {/* List */}
      {contacts.length === 0 ? (
        <p style={{ color: 'rgba(180,210,255,0.5)', fontSize: '12.5px', margin: '0 0 16px', lineHeight: 1.5 }}>
          No contacts yet. Add at least one person to be alerted if you fall.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          {contacts.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(100,180,255,0.1)', borderRadius: '12px', padding: '10px 14px' }}>
              <div style={{ width: 34, height: 34, borderRadius: '10px', background: 'rgba(244,63,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {c.pref === 'email' ? (
                  <Mail size={15} color="#f43f5e" />
                ) : c.pref === 'both' ? (
                  <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                    <Phone size={10} color="#f43f5e" />
                    <Mail size={10} color="#f43f5e" />
                  </div>
                ) : (
                  <Phone size={15} color="#f43f5e" />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: '#e0f0ff', fontSize: '13.5px', fontWeight: 700, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</p>
                <div style={{ minWidth: 0, width: '100%' }}>
                  {c.phone && (
                    <a href={`tel:${c.phone}`} style={{ color: 'rgba(180,210,255,0.6)', fontSize: '12px', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }} title={c.phone}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: '6px', verticalAlign: 'middle' }}>
                        <Phone size={10} />
                      </span>
                      <span style={{ verticalAlign: 'middle' }}>{c.phone}</span>
                    </a>
                  )}
                  {c.email && (
                    <a href={`mailto:${c.email}`} style={{ color: 'rgba(180,210,255,0.6)', fontSize: '12px', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }} title={c.email}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: '6px', verticalAlign: 'middle' }}>
                        <Mail size={10} />
                      </span>
                      <span style={{ verticalAlign: 'middle' }}>{c.email}</span>
                    </a>
                  )}
                </div>
              </div>
              <button onClick={() => edit(c)} className="ec-icon-btn" aria-label="Edit contact" style={{ width: 28, height: 28, borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(56,189,248,0.25)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Pencil size={13} />
              </button>
              <button onClick={() => remove(c.id)} className="ec-icon-btn" aria-label="Delete contact" style={{ width: 28, height: 28, borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
